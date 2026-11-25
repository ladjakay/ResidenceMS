// services/audit.service.ts
import { authFetch } from '../lib/auth-client';

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogsQuery {
  entity?: string;
  entityId?: string;
  actorId?: string;
  limit?: number;
}

function resolveAuthToken(token?: string): string {
  if (token) return token;
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    ''
  );
}

export async function fetchAuditLogs(
  apiBaseUrl: string,
  token?: string,
  params: AuditLogsQuery = {},
): Promise<AuditLogItem[]> {
  const cleanBase = apiBaseUrl.replace(/\/+$/, '');
  const searchParams = new URLSearchParams();
  if (params.entity) searchParams.set('entity', params.entity);
  if (params.entityId) searchParams.set('entityId', params.entityId);
  if (params.actorId) searchParams.set('actorId', params.actorId);
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  const url = `${cleanBase}/audit-logs${qs ? `?${qs}` : ''}`;
  const authToken = resolveAuthToken(token);

  const res = await authFetch(url, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (res.status === 401) {
    throw new Error(
      'Session expirée ou non authentifiée. Veuillez vous reconnecter.',
    );
  }

  if (res.status === 403) {
    throw new Error(
      "Accès refusé : droits administrateur requis pour consulter les journaux d'audit.",
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    throw new Error(
      `Réponse non-JSON (${res.status}) reçue depuis ${url}. Vérifiez NEXT_PUBLIC_API_URL. Extrait : ${rawText.slice(0, 120)}`,
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(
      errBody?.message ||
        `Impossible de charger les journaux d'audit (HTTP ${res.status}).`,
    );
  }

  return res.json();
}