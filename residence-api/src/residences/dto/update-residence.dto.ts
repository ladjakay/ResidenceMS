// src/residences/dto/update-residence.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateResidenceDto } from './create-residence.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateResidenceDto extends PartialType(CreateResidenceDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}