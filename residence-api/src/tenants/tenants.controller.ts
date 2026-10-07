// src/tenants/tenants.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Ajustez le chemin selon votre Guard Auth
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }
}