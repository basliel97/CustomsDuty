"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, getStoredUser, persistSession, ApiError, type AuthUser } from "@/lib/api-client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    const data = res.data!;
    persistSession(data);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        // ignore network errors during logout
      }
    }
    clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<{ id: string; email: string; role: string; branchLocation?: string }>("/auth/me");
      const current = getStoredUser();
      const next: AuthUser = { ...(current ?? {}), ...(res.data ?? {}) } as AuthUser;
      if (next.id) {
        persistSession({ accessToken: localStorage.getItem("cdp_access_token") ?? "", refreshToken: localStorage.getItem("cdp_refresh_token") ?? "", user: next });
      }
      setUser(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refreshUser }), [user, loading, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}