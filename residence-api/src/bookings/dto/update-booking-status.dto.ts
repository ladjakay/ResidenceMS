import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus, {
    message: 'Le statut fourni est invalide.',
  })
  @IsNotEmpty()
  status: BookingStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;
}