// src/bookings/bookings.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  Req,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { BookingsService } from './bookings.service';
import { PdfService } from './pdf.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { BookingStatus } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly pdfService: PdfService,
  ) {}

  /**
   * Créer une réservation
   * POST /bookings
   */
  @Post()
  @RequirePermissions('booking:create')
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Impossible d\'identifier l\'utilisateur connecté depuis le token JWT.',
      );
    }

    return this.bookingsService.create(createBookingDto, userId);
  }

  /**
   * Lister les réservations (avec ou sans filtre par statut)
   * GET /bookings?status=PENDING
   */
  @Get()
  @RequirePermissions('booking:read')
  async findAll(@Query('status') status?: BookingStatus) {
    return this.bookingsService.findAll(status);
  }

  /**
   * Obtenir les détails d'une réservation
   * GET /bookings/:id
   */
  @Get(':id')
  @RequirePermissions('booking:read')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  /**
   * Modifier uniquement le statut de la réservation
   * PATCH /bookings/:id/status
   */
  @Patch(':id/status')
  @RequirePermissions('booking:edit')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, updateBookingStatusDto);
  }

  /**
   * Modifier les détails d'une réservation (dates, résidence, remise, notes)
   * PATCH /bookings/:id
   */
  @Patch(':id')
  @RequirePermissions('booking:edit')
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  /**
   * Télécharger le reçu au format PDF
   * GET /bookings/:id/receipt
   */
  @Get(':id/receipt')
  @RequirePermissions('booking:read')
  async downloadReceipt(@Param('id') id: string, @Res() res: Response) {
    const booking = await this.bookingsService.findOne(id);

    if (!booking) {
      throw new NotFoundException('Réservation introuvable.');
    }

    const pdfBuffer = await this.pdfService.generateBookingReceipt(booking);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=recu-reservation-${booking.id.slice(0, 8)}.pdf`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.end(pdfBuffer);
  }
}