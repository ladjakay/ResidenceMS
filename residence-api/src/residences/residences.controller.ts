// src/residences/residences.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ResidencesService } from './residences.service';
import { CreateResidenceDto } from './dto/create-residence.dto';
import { UpdateResidenceDto } from './dto/update-residence.dto';

@ApiTags('residences')
@Controller('residences')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ResidencesController {
  constructor(private readonly residencesService: ResidencesService) {}

  @Get()
  @RequirePermissions('residence:read')
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('available') available?: string,
  ) {
    const onlyAvailable = available === 'true';
    return this.residencesService.findAll(search, status, onlyAvailable);
  }

  @Get(':id')
  @RequirePermissions('residence:read')
  findOne(@Param('id') id: string) {
    return this.residencesService.findOne(id);
  }

  @Post()
  @RequirePermissions('residence:create')
  create(@Body() dto: CreateResidenceDto) {
    return this.residencesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('residence:update')
  update(@Param('id') id: string, @Body() dto: UpdateResidenceDto) {
    return this.residencesService.update(id, dto);
  }

  // Désactiver ou réactiver une résidence (préserve l'audit et les réservations)
  @Patch(':id/status')
  @RequirePermissions('residence:delete')
  toggleStatus(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.residencesService.toggleActive(id, Boolean(isActive));
  }

  // 1. Route accessible aux Agents, Gérants et Super Admin
  @Post('reservations')
  @RequirePermissions('booking:create')
  createBooking(@Body() bookingDto: any) {
    return { message: 'Réservation créée avec succès !' };
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