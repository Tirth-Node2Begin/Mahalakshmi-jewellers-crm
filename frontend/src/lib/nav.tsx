"use client";

import { api } from "@/shared/api/http-client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./auth";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavContextValue {
  navigation: NavSection[];
  allowedHrefs: string[];
  isLoading: boolean;
  routeIsAllowed: (pathname: string) => boolean;
}

const NavContext = createContext<NavContextValue | null>(null);

// Routes that no longer exist in this app. The nav API may still advertise them
// until the backend catches up, so they are stripped here to avoid dead links.
const HIDDEN_NAV_HREFS = new Set<string>([
  "/leads",
  "/leads/meetings",
  "/orders",
  "/repairs",
  "/catalog",
  "/catalog/categories",
  "/website",
  "/website/blogs",
  "/website/reviews",
  "/website/enquiries",
  "/website/settings",
  "/hr",
  "/hr/employees",
  "/hr/attendance",
  "/hr/leaves",
  "/hr/payroll",
  "/hr/settings",
  "/automation",
  "/dashboard/google",
  "/dashboard/facebook",
  "/settings/integrations",
  "/settings/lead-sources",
]);

export function NavProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["auth", "nav", user?.id],
    queryFn: () => api.get<{ navigation: NavSection[]; allowed_hrefs: string[] }>("nav.php"),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const value = useMemo<NavContextValue>(() => {
    const allowedHrefs = data?.allowed_hrefs ?? [];
    // strip the hidden pages, then drop any section left with no items (e.g. Marketing)
    const navigation = (data?.navigation ?? [])
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !HIDDEN_NAV_HREFS.has(item.href)),
      }))
      .filter((section) => section.items.length > 0);
    return {
      navigation,
      allowedHrefs,
      isLoading,
      routeIsAllowed: (pathname: string) => {
        if (allowedHrefs.length === 0) return true; // fail-open while nav loads
        const clean = pathname.replace(/\/+$/, "") || "/";
        return allowedHrefs.some((href) => href === clean);
      },
    };
  }, [data, isLoading]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used inside NavProvider");
  return ctx;
}
