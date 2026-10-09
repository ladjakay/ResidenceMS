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
    // 1. Récupération des permissions requises sur la route
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si la route ne nécessite aucune permission spécifique, l'accès est libre
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. Extraction de l'utilisateur injecté par JwtStrategy
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Accès refusé : Profil utilisateur introuvable.");
    }

    // 3. Passe-droit automatique pour le SUPER_ADMIN (Accès total au système)
    const roleName = typeof user.role === 'object' ? user.role?.name : user.role;
    if (roleName === 'SUPER_ADMIN') {
      return true;
    }

    // 4. Extraction des permissions attribuées directement à l'Utilisateur (UserPermission)
    const directPermissions: string[] =
      user.userPermissions?.map(
        (up: any) => up.permission?.code || up.permission,
      ).filter(Boolean) || [];

    // 5. Extraction des permissions rattachées au Rôle (si définies via RolePermission)
    const rolePermissions: string[] =
      user.role?.permissions?.map(
        (rp: any) => rp.permission?.code || rp.permission,
      ).filter(Boolean) || [];

    // Support de rétrocompatibilité (si user.permissions est un tableau de chaînes basique)
    const legacyPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

    // 6. Fusion globale des permissions uniques
    const effectivePermissions = new Set([
      ...directPermissions,
      ...rolePermissions,
      ...legacyPermissions,
    ]);

    if (effectivePermissions.size === 0) {
      throw new ForbiddenException(
        "Accès refusé : Le Super Admin ne vous a attribué aucune permission.",
      );
    }

    // 7. Vérification de la présence d'au moins une des permissions requises pour exécuter l'action
    const hasPermission = requiredPermissions.some((permission) =>
      effectivePermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Accès refusé : Vous ne disposez pas de la permission [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}