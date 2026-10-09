import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Récupération des rôles définis au niveau de la méthode ou du contrôleur
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucun rôle n'est spécifié, l'accès est autorisé
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 2. Récupération de l'utilisateur injecté dans la requête par JwtAuthGuard
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      return false;
    }

    // 3. Extraction du nom du rôle (gestion des formats chaîne ou objet)
    const userRole = typeof user.role === 'object' ? user.role?.name : user.role;

    // 4. Vérification si le rôle de l'utilisateur fait partie des rôles autorisés
    return requiredRoles.includes(userRole);
  }
}