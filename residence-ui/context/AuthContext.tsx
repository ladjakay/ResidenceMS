// context/AuthContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  getAccessToken,
  refreshAccessToken,
  requestLogout,
  saveTokens,
  type AuthUser,
} from '@/lib/auth-client';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

const USER_DATA_KEY = 'user_data';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllSessions: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  hasPermission: (permissionCode: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const emptySubscribe = () => () => {};
const useIsClient = () => {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
};

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const storedUser = window.localStorage.getItem(USER_DATA_KEY);
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isClient = useIsClient();

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return getAccessToken() || null;
    }
    return null;
  });

  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const isLoading = !isClient;
  const router = useRouter();

  // Synchronisation automatique entre onglets du navigateur
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === 'access_token' ||
        event.key === 'token' ||
        event.key === USER_DATA_KEY
      ) {
        const nextToken = getAccessToken() || null;
        const nextUser = readStoredUser();
        setToken(nextToken);
        setUser(nextUser);

        if (!nextToken || !nextUser) {
          router.push('/login');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [router]);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message;
      throw new Error(msg || 'Échec de la connexion');
    }

    const data: {
      access_token: string;
      refresh_token?: string;
      user: AuthUser;
    } = await response.json();

    setToken(data.access_token);
    setUser(data.user);
    saveTokens(data.access_token, data.refresh_token);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_DATA_KEY, JSON.stringify(data.user));
    }

    router.push('/dashboard');
  };

  const refreshSession = async (): Promise<string | null> => {
    const nextToken = await refreshAccessToken();
    if (!nextToken) {
      setToken(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_DATA_KEY);
      }
      return null;
    }
    setToken(nextToken);
    return nextToken;
  };

  const logout = async () => {
    await requestLogout(false);
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_DATA_KEY);
    }
    router.push('/login');
  };

  const logoutAllSessions = async () => {
    await requestLogout(true);
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_DATA_KEY);
    }
    router.push('/login');
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        logoutAllSessions,
        refreshSession,
        hasPermission,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
};