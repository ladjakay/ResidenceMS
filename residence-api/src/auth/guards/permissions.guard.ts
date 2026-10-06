// src/auth/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Récupérer les permissions définies sur la méthode ou le contrôleur via @RequirePermissions()
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucune permission particulière n'est exigée, on laisse passer la requête
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. Extraire l'utilisateur injecté par le JwtAuthGuard dans l'objet Request
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException("Accès refusé : Profil utilisateur ou permissions introuvables.");
    }

    // 3. Vérifier si l'utilisateur possède au moins une des permissions requises (ou TOUTES selon votre politique)
    const hasPermission = requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Accès refusé : Vous ne disposez pas de la permission [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}