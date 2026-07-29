"use client";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/** Client-side pagination over an in-memory list (planning/04 pattern). */
export function usePagination<T>(items: T[], perPage = 10, resetDeps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const depKey = JSON.stringify(resetDeps);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));

  // reset to page 1 when filters change — in an effect, never during render
  useEffect(() => {
    setPage(1);
  }, [depKey]);

  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * perPage, safePage * perPage),
    [items, safePage, perPage],
  );

  return { page: safePage, totalPages, pageItems, setPage, total: items.length };
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <nav className="flex items-center justify-center gap-1 py-4" aria-label="Pagination">
      <Button variant="ghost" size="iconSm" onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      {pages.map((p, i) => {
        const gap = i > 0 && p - pages[i - 1] > 1;
        return (
          <span key={p} className="flex items-center">
            {gap ? <span className="px-1 text-muted-foreground">…</span> : null}
            <button
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-pill px-3 text-sm font-medium transition-colors",
                p === page ? "bg-primary-deep text-white" : "text-muted-foreground hover:bg-background",
              )}
            >
              {p}
            </button>
          </span>
        );
      })}
      <Button variant="ghost" size="iconSm" onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
