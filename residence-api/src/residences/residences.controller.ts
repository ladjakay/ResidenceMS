// src/residences/residences.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ResidencesService } from './residences.service';

@ApiTags('residences')
@Controller('residences')
@UseGuards(JwtAuthGuard, PermissionsGuard) // Les 2 Guards s'exécutent dans l'ordre
export class ResidencesController {

  // 1. Route accessible aux Agents, Gérants et Super Admin
  @Post('reservations')
  @RequirePermissions('booking:create')
  createBooking(@Body() bookingDto: any) {
    return { message: 'Réservation créée avec succès !' };
  }
constructor(private readonly residencesService: ResidencesService) {}
@Get()
  findAll() {
    return this.residencesService.findAll();
  }
  // 2. Route financière réservée EXCLUSIVEMENT aux Gérants et Super Admin
  @Get('finances/chiffre-affaires')
  @RequirePermissions('finance:view')
  getRevenueReport() {
    return {
      residence: 'Résidence Fleurie - Abidjan',
      chiffreAffairesXOF: 4500000,
      periode: 'Octobre 2026',
    };
  }
}