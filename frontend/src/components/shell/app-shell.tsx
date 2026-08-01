"use client";

import { LOGIN_PATH, useAuth } from "@/lib/auth";
import { useNav } from "@/lib/nav";
import { Skeleton } from "@/shared/ui/skeleton";
import { Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ForcedPasswordChange } from "./forced-password-change";
import { Header } from "./header";
import { PageHeaderProvider } from "./page-header";
import { Sidebar } from "./sidebar";

/**
 * Client-side guard (no middleware — static export, planning/04 §5):
 * unauthenticated → LOGIN_PATH · authenticated on login → / · disallowed route → /.
 * must_change_password blocks the app until resolved.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { routeIsAllowed, isLoading: navLoading } = useNav();
  // next.config sets trailingSlash:true, so usePathname() returns e.g. "/login/".
  // Strip the trailing slash before comparing to the canonical route strings
  // ("/login", "/") — otherwise the login page is never recognised and the guard
  // spins forever / redirect-loops. (nav.routeIsAllowed already normalises too.)
  const pathname = (usePathname() ?? "/").replace(/\/+$/, "") || "/";
  const router = useRouter();

  const isLoginPage = pathname === LOGIN_PATH;

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && !isLoginPage) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (isAuthenticated && isLoginPage) {
      router.replace("/");
      return;
    }
    if (isAuthenticated && !isLoginPage && !navLoading && !routeIsAllowed(pathname)) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, isLoginPage, navLoading, pathname, routeIsAllowed, router]);

  // Show the login form only once we know there is no session. While the session
  // probe is in flight — or while an authenticated visitor is being sent on to the
  // dashboard — hold the splash, otherwise the login card flashes before the
  // redirect lands.
  if (isLoginPage && !isLoading && !isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading || !isAuthenticated || isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-hero bg-[linear-gradient(135deg,var(--grad-brand-from),var(--grad-brand-to))] shadow-hero">
            <Zap className="h-8 w-8 text-white" aria-hidden />
          </span>
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (user?.must_change_password) {
    return <ForcedPasswordChange />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="mx-auto max-w-[1440px] px-6 pb-24 md:pb-10 md:pl-[136px] md:pr-10">
        <PageHeaderProvider>
          <Header />
          <main>{children}</main>
        </PageHeaderProvider>
      </div>
    </div>
  );
}
