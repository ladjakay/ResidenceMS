// src/bookings/bookings.service.ts
import { 
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  ConflictException 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Création d'une réservation avec contrôle d'overbooking
   */
  async create(createBookingDto: CreateBookingDto, createdById: string) {
    const { residenceId, tenantId, checkIn, checkOut, discountAmount = 0, notes } = createBookingDto;

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);

    // 1. Validation de la logique temporelle
    if (startDate >= endDate) {
      throw new BadRequestException(
        'La date de départ (checkOut) doit être strictement postérieure à la date d\'arrivée (checkIn).'
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      throw new BadRequestException('La date d\'arrivée ne peut pas être dans le passé.');
    }

    // 2. Vérification de l'existence de la résidence et du locataire
    const residence = await this.prisma.residence.findUnique({
      where: { id: residenceId },
    });

    if (!residence) {
      throw new NotFoundException('La résidence demandée est introuvable.');
    }

    if (!residence.isAvailable) {
      throw new BadRequestException('Cette résidence est actuellement hors service ou indisponible.');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Le client / locataire indiqué est introuvable.');
    }

    // 3. Détection de chevauchement de dates (Contrôle anti-overbooking)
    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        residenceId,
        // Ignorer les réservations annulées
        status: {
          notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        },
        // Règle d'intersection des intervalles de dates :
        // Une réservation chevauche si (CheckIn_existant < CheckOut_demande) ET (CheckOut_existant > CheckIn_demande)
        AND: [
          { checkIn: { lt: endDate } },
          { checkOut: { gt: startDate } },
        ],
      },
    });

    if (overlappingBooking) {
      throw new ConflictException(
        `La résidence "${residence.name}" est déjà réservée sur la période demandée (du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}).`
      );
    }

    // 4. Calcul de la durée et des montants
    const diffInTime = endDate.getTime() - startDate.getTime();
    const numberOfNights = Math.ceil(diffInTime / (1000 * 3600 * 24));

    const pricePerNight = Number(residence.pricePerNight);
    const rawTotalAmount = pricePerNight * numberOfNights;
    const finalTotalAmount = Math.max(0, rawTotalAmount - discountAmount);

    // 5. Création de la réservation au sein d'une transaction Prisma
    const newBooking = await this.prisma.$transaction(async (tx) => {
      return tx.booking.create({
        data: {
          residenceId,
          tenantId,
          createdById,
          checkIn: startDate,
          checkOut: endDate,
          nightsCount: numberOfNights,
          pricePerNight,
          totalAmount: finalTotalAmount,
          discountAmount,
          notes,
          status: BookingStatus.PENDING, // Ou CONFIRMED selon la règle métier
        },
        include: {
          residence: {
            select: { id: true, name: true, address: true },
          },
          tenant: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
        },
      });
    });

    return {
      message: 'Réservation créée avec succès.',
      data: newBooking,
    };
  }
}