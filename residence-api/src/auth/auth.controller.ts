// src/auth/auth.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuditActorContext } from '../bookings/bookings.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    email?: string;
    role?: string | { name?: string };
  };
}

function buildAuditContext(req: AuthenticatedRequest): AuditActorContext {
  const userId = req.user?.id || req.user?.userId || req.user?.sub || null;
  const rawRole = req.user?.role;
  const role = typeof rawRole === 'string' ? rawRole : rawRole?.name || null;
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipFromHeader = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();
  const uaHeader = req.headers['user-agent'];

  return {
    userId,
    email: req.user?.email || null,
    role,
    ipAddress: ipFromHeader || req.ip || null,
    userAgent: Array.isArray(uaHeader) ? uaHeader[0] : uaHeader || null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest) {
    return this.authService.login(loginDto, buildAuditContext(req));
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @Throttle({ auth: { limit: 15, ttl: 60_000 } })
  refresh(
    @Body('refresh_token') refreshToken: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.refreshTokens(refreshToken, buildAuditContext(req));
  }

  @Post('logout')
  logout(
    @Body('refresh_token') refreshToken: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.logout(refreshToken, buildAuditContext(req));
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  logoutAll(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub || '';
    return this.authService.logoutAllSessions(userId, buildAuditContext(req));
  }
}