import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { apiClient, AUTH_TOKEN_KEY } from '../api/client';
import { hasPermission, Permission, UserSummary } from '../api/types';

const USER_STORAGE_KEY = 'icms.user';

export type LoginResult = { mfaRequired: false } | { mfaRequired: true; mfaToken: string };

interface AuthContextValue {
  user: UserSummary | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithGoogle: (idToken: string) => Promise<LoginResult>;
  completeMfaLogin: (mfaToken: string, code: string) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
  setMfaEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): UserSummary | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as UserSummary) : null;
}

function storeSession(data: { accessToken: string; user: UserSummary }) {
  localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(() => readStoredUser());

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    if (data.mfaRequired) {
      return { mfaRequired: true, mfaToken: data.mfaToken };
    }
    storeSession(data);
    setUser(data.user);
    return { mfaRequired: false };
  };

  const loginWithGoogle = async (idToken: string): Promise<LoginResult> => {
    const { data } = await apiClient.post('/auth/google', { idToken });
    if (data.mfaRequired) {
      return { mfaRequired: true, mfaToken: data.mfaToken };
    }
    storeSession(data);
    setUser(data.user);
    return { mfaRequired: false };
  };

  const completeMfaLogin = async (mfaToken: string, code: string) => {
    const { data } = await apiClient.post('/auth/mfa/login-verify', { mfaToken, code });
    storeSession(data);
    setUser(data.user);
  };

  const logout = () => {
    // Clear local state first so the UI reacts immediately — the revoke call
    // to the server is real (see backend RevokedToken) but shouldn't make the
    // user wait on a network round trip just to be signed out locally.
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    if (token) {
      apiClient.post('/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {
        // Best-effort — if this fails the token still expires naturally at JWT_EXPIRES_IN.
      });
    }
  };

  // Lets the Account Security page reflect an enroll/disable immediately,
  // without forcing a re-login just to refresh a claim baked into the JWT.
  const setMfaEnabled = (enabled: boolean) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mfaEnabled: enabled };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      loginWithGoogle,
      completeMfaLogin,
      logout,
      can: (permission) => (user ? hasPermission(user.role, permission) : false),
      setMfaEnabled,
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
