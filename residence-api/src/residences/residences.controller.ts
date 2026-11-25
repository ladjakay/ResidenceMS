// src/residences/residences.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuditActorContext } from '../bookings/bookings.service';
import { ResidencesService } from './residences.service';
import { CreateResidenceDto } from './dto/create-residence.dto';
import { UpdateResidenceDto } from './dto/update-residence.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    email?: string;
    role?: string | { name?: string };
  };
}

function extractAuditContext(req: AuthenticatedRequest): AuditActorContext {
  const userId = req.user?.id || req.user?.userId || req.user?.sub || null;
  const rawRole = req.user?.role;
  const role = typeof rawRole === 'string' ? rawRole : rawRole?.name || null;

  const forwardedFor = req.headers['x-forwarded-for'];
  const ipFromHeader = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();

  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader || null;

  return {
    userId,
    email: req.user?.email || null,
    role,
    ipAddress: ipFromHeader || req.ip || null,
    userAgent,
  };
}

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
  create(
    @Body() dto: CreateResidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.residencesService.create(dto, extractAuditContext(req));
  }

  @Patch(':id')
  @RequirePermissions('residence:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateResidenceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.residencesService.update(id, dto, extractAuditContext(req));
  }

  // Désactiver ou réactiver une résidence (préserve l'audit et les réservations)
  @Patch(':id/status')
  @RequirePermissions('residence:delete')
  toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.residencesService.toggleActive(
      id,
      Boolean(isActive),
      extractAuditContext(req),
    );
  }
}