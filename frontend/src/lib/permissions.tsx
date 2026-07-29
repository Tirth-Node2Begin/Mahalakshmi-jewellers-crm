"use client";

import { api } from "@/shared/api/http-client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./auth";

interface PermissionContextValue {
  permissions: string[];
  dataScope: "all" | "own";
  isLoading: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  canAll: (...permissions: string[]) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

function matches(granted: string, wanted: string): boolean {
  if (granted === "*" || granted === wanted) return true;
  if (granted.endsWith(".*")) return wanted.startsWith(granted.slice(0, -1));
  return false;
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["auth", "permissions", user?.id],
    queryFn: () => api.get<{ permissions: string[]; data_scope: "all" | "own" }>("user_permissions.php"),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const value = useMemo<PermissionContextValue>(() => {
    const permissions = data?.permissions ?? [];
    const can = (permission: string) => permissions.some((granted) => matches(granted, permission));
    return {
      permissions,
      dataScope: data?.data_scope ?? "all",
      isLoading,
      can,
      canAny: (...list: string[]) => list.some(can),
      canAll: (...list: string[]) => list.every(can),
    };
  }, [data, isLoading]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error("usePermissions must be used inside PermissionProvider");
  return ctx;
}

export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = usePermissions();
  const allowed = permission ? can(permission) : anyOf ? canAny(...anyOf) : true;
  return <>{allowed ? children : fallback}</>;
}
