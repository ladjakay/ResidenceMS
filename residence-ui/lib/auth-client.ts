// src/lib/auth-client.ts
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export function getAccessToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ||
    window.localStorage.getItem('token') ||
    ''
  );
}

export function getRefreshToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REFRESH_TOKEN_KEY) || '';
}

export function saveTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem('token', accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem('token');
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem('user_data');
}

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      clearTokens();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return null;
      }

      const data: { access_token?: string; refresh_token?: string } =
        await res.json();

      if (!data.access_token) {
        clearTokens();
        return null;
      }

      saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Wrapper fetch authentifié avec renouvellement automatique unique en cas de 401.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
  options: { redirectOnAuthFailure?: boolean } = { redirectOnAuthFailure: true },
): Promise<Response> {
  const url = input.startsWith('http')
    ? input
    : `${API_BASE_URL}${input.startsWith('/') ? '' : '/'}${input}`;

  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status !== 401) {
    return response;
  }

  const newToken = await refreshAccessToken();
  if (!newToken) {
    if (options.redirectOnAuthFailure && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);

  response = await fetch(url, {
    ...init,
    headers: retryHeaders,
  });

  if (
    response.status === 401 &&
    options.redirectOnAuthFailure &&
    typeof window !== 'undefined'
  ) {
    clearTokens();
    window.location.href = '/login';
  }

  return response;
}

export async function requestLogout(allSessions = false): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();

  try {
    if (allSessions && accessToken) {
      await fetch(`${API_BASE_URL}/auth/logout-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } else if (refreshToken || accessToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken || undefined }),
      });
    }
  } catch {
    // Nettoyage local assuré même en cas d'erreur réseau
  } finally {
    clearTokens();
  }
}