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
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto, createdById: string) {
    // 1. Validation de la présence de l'utilisateur créateur
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
        "La date de départ (checkOut) doit être strictly supérieure à la date d'arrivée (checkIn).",
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

    // 2. Création de la réservation avec connexions Prisma explicites
    const booking = await this.prisma.booking.create({
      data: {
        checkIn: startDate,
        checkOut: endDate,
        nightsCount,
        pricePerNight,
        totalAmount,
        discountAmount,
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
   * Récupérer une réservation par son ID
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
   * Changer le statut d'une réservation (Validation, Annulation, etc.)
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

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: newStatus,
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
}