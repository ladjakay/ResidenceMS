import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsNotEmpty()
  @IsString()
  role: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}