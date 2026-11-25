// src/audit/audit-events.helper.ts
import type { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import type { AuditActorContext } from '../bookings/bookings.service';

export type AuditDetails = Record<string, Prisma.InputJsonValue | undefined>;

/**
 * Journalise la création, modification, suppression d'un utilisateur ou le changement de ses permissions.
 */
export async function logUserManagementEvent(
  auditService: AuditService,
  action:
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'USER_DELETED'
    | 'USER_PERMISSIONS_UPDATED',
  targetUserId: string,
  details: AuditDetails,
  actor?: AuditActorContext,
) {
  await auditService.log({
    actorId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? null,
    action,
    entity: 'User',
    entityId: targetUserId,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    details,
  });
}

/**
 * Journalise l'enregistrement d'un paiement ou d'un remboursement d'une réservation.
 */
export async function logPaymentEvent(
  auditService: AuditService,
  action: 'PAYMENT_RECORDED' | 'PAYMENT_REFUNDED',
  bookingId: string,
  details: AuditDetails,
  actor?: AuditActorContext,
) {
  await auditService.log({
    actorId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? null,
    action,
    entity: 'Booking',
    entityId: bookingId,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    details,
  });
}

/**
 * Journalise les accès refusés (HTTP 403) sur les endpoints protégés.
 */
export async function logAccessDeniedEvent(
  auditService: AuditService,
  path: string,
  requiredPermission: string | string[],
  actor?: AuditActorContext,
) {
  await auditService.log({
    actorId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? null,
    action: 'ACCESS_DENIED_403',
    entity: 'User',
    entityId: actor?.userId ?? null,
    ipAddress: actor?.ipAddress ?? null,
    userAgent: actor?.userAgent ?? null,
    details: { path, requiredPermission },
  });
}