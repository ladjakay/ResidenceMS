// src/auth/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Décorateur pour restreindre l'accès aux routes selon les permissions de l'utilisateur.
 * Exemple d'utilisation: @Permissions('booking:create', 'booking:read')
 */
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);