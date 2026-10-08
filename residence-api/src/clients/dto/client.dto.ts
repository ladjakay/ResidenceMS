import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire.' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de famille est obligatoire.' })
  lastName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le numéro de téléphone est obligatoire.' })
  phone: string;

  @IsEmail({}, { message: 'Format d\'email invalide.' })
  @IsOptional()
  email?: string;
}

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}