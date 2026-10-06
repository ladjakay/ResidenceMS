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
} from '@nestjs/common';
import type { Response } from 'express'; // Import type pour éviter l'erreur TS1272 / isolatedModules
import { BookingsService } from './bookings.service';
import { PdfService } from './pdf.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
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

  @Post()
  @RequirePermissions('booking:create')
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingsService.create(createBookingDto, userId);
  }

  @Get()
  @RequirePermissions('booking:read')
  async findAll(@Query('status') status?: BookingStatus) {
    return this.bookingsService.findAll(status);
  }

  @Get(':id')
  @RequirePermissions('booking:read')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions('booking:update')
  async updateStatus(
    @Param('id') id: string,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, updateBookingStatusDto);
  }

  @Get(':id/receipt')
  @RequirePermissions('booking:read')
  async downloadReceipt(@Param('id') id: string, @Res() res: Response) {
    const booking = await this.bookingsService.findOne(id);

    if (!booking) {
      throw new NotFoundException('Réservation introuvable.');
    }

    const pdfBuffer = await this.pdfService.generateBookingReceipt(booking);

    // Configuration des en-têtes de réponse pour le téléchargement
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=recu-reservation-${booking.id.slice(0, 8)}.pdf`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    res.end(pdfBuffer);
  }
}