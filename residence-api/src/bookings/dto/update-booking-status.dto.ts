import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { BookingStatus } from '@prisma/client';

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus, {
    message: 'Le statut fourni est invalide.',
  })
  @IsNotEmpty()
  status: BookingStatus;

  
  @IsNumber()
  @Min(0)
  @IsString()
  paidAmount?: number;
  
  @IsOptional()
  cancellationReason?: string;
}