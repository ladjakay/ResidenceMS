// src/tenants/tenants.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuditActorContext } from '../bookings/bookings.service';
import {
  TenantsService,
  type CreateTenantPayload,
  type UpdateTenantPayload,
} from './tenants.service';

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

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Post()
  create(
    @Body() body: CreateTenantPayload,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tenantsService.create(body, extractAuditContext(req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateTenantPayload,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tenantsService.update(id, body, extractAuditContext(req));
  }

  @Patch(':id/status')
  toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tenantsService.toggleActive(
      id,
      Boolean(isActive),
      extractAuditContext(req),
    );
  }
}