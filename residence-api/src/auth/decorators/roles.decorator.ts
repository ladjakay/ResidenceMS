import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour restreindre l'accès à certains rôles.
 * Exemple d'utilisation : @Roles('SUPER_ADMIN', 'GERANT')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);