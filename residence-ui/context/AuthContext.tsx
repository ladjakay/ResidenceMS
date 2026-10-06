// src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper React 19 pour détecter proprement le passage au client sans re-render synchrone
const emptySubscribe = () => () => {};
const useIsClient = () => {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Valeur côté Client
    () => false  // Valeur côté Server (SSR)
  );
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const isClient = useIsClient();

  // Lazy Initializers : lecture directe du localStorage côté client
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token');
    }
    return null;
  });

  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user_data');
      if (storedUser) {
        try {
          return JSON.parse(storedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  // Derived state : isLoading est vrai tant qu'on est en SSR / hydratation
  const isLoading = !isClient;

  const router = useRouter();

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Échec de la connexion');
    }

    const data = await response.json();

    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_data', JSON.stringify(data.user));

    router.push('/dashboard');
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
    router.push('/login');
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, hasPermission, isLoading }}
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