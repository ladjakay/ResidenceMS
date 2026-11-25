// src/lib/api.service.ts
import { authFetch } from './auth-client';

export class ApiClientError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await authFetch(path, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const rawMsg =
      typeof data === 'object' && data !== null && 'message' in data
        ? (data as { message?: string | string[] }).message
        : null;
    const formattedMessage = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : rawMsg || `Erreur API (${res.status})`;

    throw new ApiClientError(formattedMessage, res.status, data);
  }

  return data as T;
}

export const bookingsApi = {
  list: () => apiRequest('/bookings'),
  get: (id: string) => apiRequest(`/bookings/${id}`),
  create: (payload: unknown) =>
    apiRequest('/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: unknown) =>
    apiRequest(`/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const residencesApi = {
  list: () => apiRequest('/residences'),
  get: (id: string) => apiRequest(`/residences/${id}`),
  create: (payload: unknown) =>
    apiRequest('/residences', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: unknown) =>
    apiRequest(`/residences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const clientsApi = {
  list: () => apiRequest('/clients'),
  get: (id: string) => apiRequest(`/clients/${id}`),
  create: (payload: unknown) =>
    apiRequest('/clients', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: unknown) =>
    apiRequest(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

export const financesApi = {
  summary: (query = '') => apiRequest(`/finances${query}`),
};

export const usersApi = {
  list: () => apiRequest('/users'),
  create: (payload: unknown) =>
    apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: unknown) =>
    apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  remove: (id: string) => apiRequest(`/users/${id}`, { method: 'DELETE' }),
};