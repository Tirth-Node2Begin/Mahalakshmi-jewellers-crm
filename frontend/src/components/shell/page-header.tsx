"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PageHeading = { title: string; subtitle?: string };

type Store = {
  override: PageHeading | null;
  setOverride: (heading: PageHeading | null) => void;
};

const PageHeaderContext = createContext<Store>({ override: null, setOverride: () => {} });

/**
 * One heading per screen. The shell <Header/> is the only thing that renders a
 * page title — pages must never print their own <h1>, or the user sees the same
 * words twice (once in the top bar, once above the content).
 *
 * Static titles live in the route map in header.tsx. Screens whose heading is
 * data-driven (a ledger name, a report name) push it up with usePageHeader().
 */
export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<PageHeading | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

/** Read side — for the shell header only. */
export function usePageHeaderOverride() {
  return useContext(PageHeaderContext).override;
}

/**
 * Set the shell heading from inside a page. Pass `undefined` for the title while
 * the data is still loading and the route map's default stays in place.
 */
export function usePageHeader(title: string | undefined, subtitle?: string) {
  const { setOverride } = useContext(PageHeaderContext);

  useEffect(() => {
    if (!title) return;
    setOverride({ title, subtitle });
    // Unmounting on navigation clears it, so the next route falls back to its
    // own map entry instead of inheriting this one.
    return () => setOverride(null);
  }, [title, subtitle, setOverride]);
}
