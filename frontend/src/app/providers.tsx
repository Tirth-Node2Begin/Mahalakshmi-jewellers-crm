"use client";

import { AuthProvider } from "@/lib/auth";
import { NavProvider } from "@/lib/nav";
import { PermissionProvider } from "@/lib/permissions";
import { createAppQueryClient } from "@/shared/api/query-client";
import { LenisProvider } from "@/shared/providers/lenis-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AppShell } from "@/components/shell/app-shell";
import { TooltipProvider } from "@/shared/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <PermissionProvider>
            <NavProvider>
              <MotionConfig reducedMotion="user">
                <LenisProvider>
                  <TooltipProvider>
                    <Toaster
                      position="bottom-right"
                      toastOptions={{
                        style: {
                          borderRadius: "18px",
                          boxShadow: "var(--shadow-2)",
                          border: "1px solid var(--border)",
                        },
                      }}
                    />
                    <AppShell>{children}</AppShell>
                  </TooltipProvider>
                </LenisProvider>
              </MotionConfig>
            </NavProvider>
          </PermissionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
