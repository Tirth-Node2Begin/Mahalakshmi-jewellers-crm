"use client";

import { AUTH_EXPIRED_EVENT } from "@/configs/app.config";
import { api } from "@/shared/api/http-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * The whole CRM is served under an obscure basePath (see next.config.ts) on the
 * website's domain — e.g. /gate-7q4k9x2z/login. Next's router auto-applies the
 * basePath, so app routes use plain paths ("/login"); only raw window.location
 * redirects (logout) must prepend BASE_PATH. Keep BASE_PATH in sync with next.config.
 */
export const LOGIN_PATH = "/login";
export const BASE_PATH = "/gate-7q4k9x2z";

export interface SessionUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  roles: string[];
  primary_role: string;
  must_change_password: boolean;
  avatar_color: string | null;
}

interface LoginPayload {
  username: string;
  password: string;
  remember_me?: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_EARLY_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);

  const scheduleSilentRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        await api.post("v1/auth/refresh.php");
        scheduleSilentRefresh();
      } catch {
        // handled by the auth-expired event from the http client
      }
    }, ACCESS_TTL_MS - REFRESH_EARLY_MS);
  }, []);

  const probeSession = useCallback(async () => {
    try {
      const res = await api.get<{ authenticated: boolean; user?: SessionUser }>("v1/auth/me.php");
      if (res.authenticated && res.user) {
        setUser(res.user);
        scheduleSilentRefresh();
      } else {
        // one silent refresh attempt (access token may simply be expired)
        try {
          const refreshed = await api.request<{ user: SessionUser }>(
            "v1/auth/refresh.php",
            { method: "POST", skipAuthRetry: true },
            true,
          );
          setUser(refreshed.user);
          scheduleSilentRefresh();
        } catch {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleSilentRefresh]);

  useEffect(() => {
    void api.get("v1/auth/csrf.php").catch(() => undefined); // bootstrap CSRF cookie
    void probeSession();

    channel.current = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("crm-auth-sync") : null;
    if (channel.current) {
      channel.current.onmessage = (event) => {
        if (event.data === "login" || event.data === "logout") void probeSession();
      };
    }

    const onExpired = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);

    const onVisible = () => {
      if (document.visibilityState === "visible") void probeSession();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channel.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await api.post<{ user: SessionUser }>("v1/auth/login.php", payload);
      setUser(res.user);
      scheduleSilentRefresh();
      channel.current?.postMessage("login");
      return res.user;
    },
    [scheduleSilentRefresh],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("v1/auth/logout.php");
    } catch {
      // clear locally regardless
    }
    queryClient.clear();
    channel.current?.postMessage("logout");
    setUser(null);
    // raw location redirect (full reload) — must include the basePath manually
    window.location.replace(BASE_PATH + LOGIN_PATH);
  }, [queryClient]);

  const clearMustChangePassword = useCallback(() => {
    setUser((current) => (current ? { ...current, must_change_password: false } : current));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      logout,
      refreshUser: probeSession,
      clearMustChangePassword,
    }),
    [user, isLoading, login, logout, probeSession, clearMustChangePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
