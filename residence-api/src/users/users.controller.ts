// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { AuditActorContext } from '../bookings/bookings.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPermissionsDto } from './dto/update-user-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users')
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(search, status, role);
  }

  @Get('permissions')
  getPermissions() {
    return this.usersService.getAllPermissions();
  }

  @Post('users')
  create(
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.create(dto, extractAuditContext(req));
  }

  @Patch('users/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.update(id, dto, extractAuditContext(req));
  }

  @Patch('users/:id/status')
  toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.toggleStatus(
      id,
      Boolean(isActive),
      extractAuditContext(req),
    );
  }

  @Patch('users/:id/permissions')
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateRoleAndPermissions(
      id,
      dto,
      extractAuditContext(req),
    );
  }
}