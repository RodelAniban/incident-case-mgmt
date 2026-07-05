import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { apiClient, AUTH_TOKEN_KEY } from '../api/client';
import { hasPermission, Permission, UserSummary } from '../api/types';

const USER_STORAGE_KEY = 'icms.user';

interface AuthContextValue {
  user: UserSummary | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): UserSummary | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as UserSummary) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(() => readStoredUser());

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      can: (permission) => (user ? hasPermission(user.role, permission) : false),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
