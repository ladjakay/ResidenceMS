import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsOptional,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  residenceId: string;

  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @IsDateString()
  @IsNotEmpty()
  checkIn: string; // Format YYYY-MM-DD

  @IsDateString()
  @IsNotEmpty()
  checkOut: string; // Format YYYY-MM-DD

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}