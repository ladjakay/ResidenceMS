// src/bookings/bookings.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une réservation
   */
  async create(createBookingDto: CreateBookingDto, createdById: string) {
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
      throw new NotFoundException('Le client / locataire indiqué est introuvable.');
    }
    if (!tenant.isActive) {
      throw new BadRequestException('Ce client est désactivé. Impossible d\'effectuer une nouvelle réservation.');
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        residenceId,
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        },
        AND: [
          { checkIn: { lt: endDate } },
          { checkOut: { gt: startDate } },
        ],
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
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
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
  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.findOne(id);
    const currentStatus = booking.status;
    const newStatus = dto.status;

    if (currentStatus === BookingStatus.CANCELLED) {
      throw new BadRequestException('Une réservation annulée ne peut plus être modifiée.');
    }

    if (currentStatus === BookingStatus.COMPLETED) {
      throw new BadRequestException('Une réservation déjà terminée ne peut plus être modifiée.');
    }

    const totalAmount = Number(booking.totalAmount);
    let newPaidAmount = Number(booking.paidAmount ?? 0);

    // Règle CONFIRMED
    if (newStatus === BookingStatus.CONFIRMED) {
      if (dto.paidAmount !== undefined) {
        if (dto.paidAmount < 0) {
          throw new BadRequestException('Le montant payé ne peut pas être négatif.');
        }
        if (dto.paidAmount > totalAmount) {
          throw new BadRequestException(
            `Le montant payé (${dto.paidAmount} FCFA) ne peut pas dépasser le montant total (${totalAmount} FCFA).`,
          );
        }
        newPaidAmount = dto.paidAmount;
      }
    }
    // Règle COMPLETED
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

    return {
      message: `Statut de la réservation mis à jour vers "${newStatus}".`,
      data: updatedBooking,
    };
  }

  /**
   * Modifier les détails d'une réservation (PATCH /bookings/:id)
   */
  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.findOne(id);
    const totalAmount = Number(booking.totalAmount);
    const paidAmount = Number(booking.paidAmount ?? 0);

    // Verrouillage 1 : CANCELLED ou COMPLETED
    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Une réservation annulée ou terminée ne peut plus être modifiée.');
    }

    // Verrouillage 2 : CONFIRMED totalement payée
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
        AND: [
          { checkIn: { lt: endDate } },
          { checkOut: { gt: startDate } },
        ],
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

    return {
      message: 'Réservation mise à jour avec succès.',
      data: updatedBooking,
    };
  }
}