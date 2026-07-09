import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, setUnauthorizedHandler } from '../api/client';
import type { AuthUser } from '../api/types';
import { clearStoredAuth, readStoredAuth, writeStoredAuth, type StoredAuth } from './storage';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readStoredAuth());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredAuth();
      setAuth(null);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: auth?.token ?? null,
      user: auth?.user ?? null,
      login: async (email: string, password: string) => {
        const result = await authApi.login(email, password);
        if (result.user.role !== 'ADMIN') {
          throw new Error(
            "Accès réservé aux comptes administrateurs — les comptes commerciaux n'ont pas accès au panneau.",
          );
        }
        const stored: StoredAuth = { token: result.accessToken, user: result.user };
        writeStoredAuth(stored);
        setAuth(stored);
      },
      logout: () => {
        clearStoredAuth();
        setAuth(null);
      },
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  return ctx;
}
