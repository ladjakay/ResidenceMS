// src/bookings/dto/update-booking.dto.ts (Alternative explicite)
import { IsOptional, IsString, IsDateString, IsNumber, Min } from 'class-validator';

export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  residenceId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsDateString()
  checkOut?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}