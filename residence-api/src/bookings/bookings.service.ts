// src/bookings/bookings.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { logPaymentEvent } from '../audit/audit-events.helper';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

export interface AuditActorContext {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Créer une réservation
   */
  async create(
    createBookingDto: CreateBookingDto,
    createdById: string,
    auditCtx?: AuditActorContext,
  ) {
    if (!createdById) {
      throw new UnauthorizedException(
        'Utilisateur non identifié. Veuillez vous reconnecter.',
      );
    }

    const {
      residenceId,
      tenantId,
      checkIn,
      checkOut,
      discountAmount = 0,
      notes,
    } = createBookingDto;

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);

    if (startDate >= endDate) {
      throw new BadRequestException(
        "La date de départ (checkOut) doit être strictement supérieure à la date d'arrivée (checkIn).",
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new BadRequestException(
        "La date d'arrivée ne peut pas être située dans le passé.",
      );
    }

    const residence = await this.prisma.residence.findUnique({
      where: { id: residenceId },
    });

    if (!residence) {
      throw new NotFoundException('Résidence introuvable.');
    }

    if (!residence.isAvailable) {
      throw new BadRequestException(
        'Cette résidence est actuellement désactivée ou indisponible.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(
        'Le client / locataire indiqué est introuvable.',
      );
    }
    if (!tenant.isActive) {
      throw new BadRequestException(
        "Ce client est désactivé. Impossible d'effectuer une nouvelle réservation.",
      );
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        residenceId,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        },
        AND: [{ checkIn: { lt: endDate } }, { checkOut: { gt: startDate } }],
      },
    });

    if (overlappingBooking) {
      throw new ConflictException(
        `La résidence est déjà réservée sur cette période (du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}).`,
      );
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const nightsCount = Math.ceil(diffTime / (1000 * 3600 * 24));
    const pricePerNight = Number(residence.pricePerNight);
    const rawTotal = pricePerNight * nightsCount;
    const totalAmount = Math.max(0, rawTotal - discountAmount);

    const booking = await this.prisma.booking.create({
      data: {
        checkIn: startDate,
        checkOut: endDate,
        nightsCount,
        pricePerNight,
        totalAmount,
        discountAmount,
        paidAmount: 0,
        notes,
        status: BookingStatus.PENDING,
        residence: {
          connect: { id: residenceId },
        },
        tenant: {
          connect: { id: tenantId },
        },
        createdBy: {
          connect: { id: createdById },
        },
      },
      include: {
        residence: true,
        tenant: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? createdById,
      actorEmail: auditCtx?.email ?? booking.createdBy?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'BOOKING_CREATED',
      entity: 'Booking',
      entityId: booking.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        residenceId: booking.residenceId,
        residenceName: booking.residence.name,
        tenantId: booking.tenantId,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        nightsCount: booking.nightsCount,
        totalAmount: Number(booking.totalAmount),
        discountAmount: Number(booking.discountAmount),
        status: booking.status,
      },
    });

    return {
      message: 'Réservation créée avec succès.',
      data: booking,
    };
  }

  /**
   * Récupérer toutes les réservations
   */
  async findAll(status?: BookingStatus) {
    return this.prisma.booking.findMany({
      where: status ? { status } : {},
      include: {
        residence: { select: { id: true, name: true, address: true } },
        tenant: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupérer une réservation par ID
   */
  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        residence: true,
        tenant: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Réservation avec l'ID "${id}" introuvable.`);
    }

    return booking;
  }

  /**
   * Modifier le statut et le montant payé (PATCH /bookings/:id/status)
   */
  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    auditCtx?: AuditActorContext,
  ) {
    const booking = await this.findOne(id);
    const currentStatus = booking.status;
    const newStatus = dto.status;

    if (currentStatus === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Une réservation annulée ne peut plus être modifiée.',
      );
    }

    if (currentStatus === BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Une réservation déjà terminée ne peut plus être modifiée.',
      );
    }

    const totalAmount = Number(booking.totalAmount);
    const previousPaidAmount = Number(booking.paidAmount ?? 0);
    let newPaidAmount = previousPaidAmount;

    if (newStatus === BookingStatus.CONFIRMED) {
      if (dto.paidAmount !== undefined) {
        if (dto.paidAmount < 0) {
          throw new BadRequestException(
            'Le montant payé ne peut pas être négatif.',
          );
        }
        if (dto.paidAmount > totalAmount) {
          throw new BadRequestException(
            `Le montant payé (${dto.paidAmount} FCFA) ne peut pas dépasser le montant total (${totalAmount} FCFA).`,
          );
        }
        newPaidAmount = dto.paidAmount;
      }
    }

    if (newStatus === BookingStatus.COMPLETED) {
      newPaidAmount = totalAmount;
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
        paidAmount: newPaidAmount,
        notes: dto.cancellationReason
          ? `${booking.notes || ''} | Raison annulation: ${dto.cancellationReason}`.trim()
          : booking.notes,
      },
      include: {
        residence: true,
        tenant: true,
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'BOOKING_STATUS_CHANGED',
      entity: 'Booking',
      entityId: updatedBooking.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        previousStatus: currentStatus,
        newStatus,
        previousPaidAmount,
        newPaidAmount,
        totalAmount,
        cancellationReason: dto.cancellationReason ?? null,
      },
    });

    if (newPaidAmount > previousPaidAmount) {
      await logPaymentEvent(
        this.auditService,
        'PAYMENT_RECORDED',
        updatedBooking.id,
        {
          amountPaidNow: newPaidAmount - previousPaidAmount,
          previousPaidAmount,
          newPaidAmount,
          totalAmount,
          status: newStatus,
        },
        auditCtx,
      );
    } else if (newPaidAmount < previousPaidAmount) {
      await logPaymentEvent(
        this.auditService,
        'PAYMENT_REFUNDED',
        updatedBooking.id,
        {
          refundAmount: previousPaidAmount - newPaidAmount,
          previousPaidAmount,
          newPaidAmount,
          remainingPaid: newPaidAmount,
          status: newStatus,
        },
        auditCtx,
      );
    }

    return {
      message: `Statut de la réservation mis à jour vers "${newStatus}".`,
      data: updatedBooking,
    };
  }

  /**
   * Modifier les détails d'une réservation (PATCH /bookings/:id)
   */
  async update(
    id: string,
    dto: UpdateBookingDto,
    auditCtx?: AuditActorContext,
  ) {
    const booking = await this.findOne(id);
    const totalAmount = Number(booking.totalAmount);
    const paidAmount = Number(booking.paidAmount ?? 0);

    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Une réservation annulée ou terminée ne peut plus être modifiée.',
      );
    }

    if (booking.status === BookingStatus.CONFIRMED && paidAmount >= totalAmount) {
      throw new BadRequestException(
        'Une réservation confirmée et entièrement réglée ne peut plus être éditée.',
      );
    }

    const residenceId = dto.residenceId || booking.residenceId;
    const startDate = dto.checkIn ? new Date(dto.checkIn) : booking.checkIn;
    const endDate = dto.checkOut ? new Date(dto.checkOut) : booking.checkOut;

    if (startDate >= endDate) {
      throw new BadRequestException(
        "La date de départ (checkOut) doit être strictement supérieure à la date d'arrivée (checkIn).",
      );
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        id: { not: id },
        residenceId,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        },
        AND: [{ checkIn: { lt: endDate } }, { checkOut: { gt: startDate } }],
      },
    });

    if (overlappingBooking) {
      throw new ConflictException(
        `La résidence est déjà réservée sur cette nouvelle période (du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}).`,
      );
    }

    const residence = await this.prisma.residence.findUnique({
      where: { id: residenceId },
    });

    if (!residence) {
      throw new NotFoundException('Résidence introuvable.');
    }

    const diffTime = endDate.getTime() - startDate.getTime();
    const nightsCount = Math.ceil(diffTime / (1000 * 3600 * 24));
    const pricePerNight = Number(residence.pricePerNight);
    const discountAmount = Number(dto.discountAmount ?? booking.discountAmount);
    const rawTotal = pricePerNight * nightsCount;
    const newTotalAmount = Math.max(0, rawTotal - discountAmount);

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        checkIn: startDate,
        checkOut: endDate,
        nightsCount,
        pricePerNight,
        totalAmount: newTotalAmount,
        discountAmount,
        notes: dto.notes ?? booking.notes,
        residenceId,
        tenantId: dto.tenantId ?? booking.tenantId,
      },
      include: {
        residence: true,
        tenant: true,
      },
    });

    await this.auditService.log({
      actorId: auditCtx?.userId ?? null,
      actorEmail: auditCtx?.email ?? null,
      actorRole: auditCtx?.role ?? null,
      action: 'BOOKING_UPDATED',
      entity: 'Booking',
      entityId: updatedBooking.id,
      ipAddress: auditCtx?.ipAddress ?? null,
      userAgent: auditCtx?.userAgent ?? null,
      details: {
        before: {
          residenceId: booking.residenceId,
          checkIn: booking.checkIn.toISOString(),
          checkOut: booking.checkOut.toISOString(),
          totalAmount,
          discountAmount: Number(booking.discountAmount),
        },
        after: {
          residenceId: updatedBooking.residenceId,
          checkIn: updatedBooking.checkIn.toISOString(),
          checkOut: updatedBooking.checkOut.toISOString(),
          totalAmount: newTotalAmount,
          discountAmount,
        },
      },
    });

    return {
      message: 'Réservation mise à jour avec succès.',
      data: updatedBooking,
    };
  }
}