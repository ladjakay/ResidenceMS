// src/bookings/bookings.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @RequirePermissions('booking:create')
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    const userId = req.user.id;
    return this.bookingsService.create(createBookingDto, userId);
  }
}