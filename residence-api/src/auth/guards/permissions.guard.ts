// src/auth/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuditService } from '../../audit/audit.service';
import { logAccessDeniedEvent } from '../../audit/audit-events.helper';
import type { AuditActorContext } from '../../bookings/bookings.service';

export const PERMISSIONS_KEY = 'permissions';

interface RequestWithActor extends Request {
  user?: {
    id?: string;
    userId?: string;
    sub?: string;
    email?: string;
    role?: string | { name?: string };
    permissions?: string[];
  };
}

function extractActorContext(req: RequestWithActor): AuditActorContext {
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

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithActor>();
    const user = req.user;
    const roleName =
      typeof user?.role === 'string' ? user.role : user?.role?.name;

    if (roleName === 'SUPER_ADMIN') {
      return true;
    }

    const userPermissions = new Set<string>(user?.permissions ?? []);
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.has(perm),
    );

    if (!hasAll) {
      await logAccessDeniedEvent(
        this.auditService,
        req.originalUrl || req.url,
        requiredPermissions,
        extractActorContext(req),
      );
      throw new ForbiddenException(
        'Accès refusé : permissions insuffisantes pour cette action.',
      );
    }

    return true;
  }
}