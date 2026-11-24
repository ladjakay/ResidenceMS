// src/residences/dto/create-residence.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResidenceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerNight: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}