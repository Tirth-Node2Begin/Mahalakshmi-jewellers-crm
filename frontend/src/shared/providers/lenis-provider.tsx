"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

/** Smooth inertia scroll (style.md §14). Disabled for reduced-motion users. */
export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const lenis = new Lenis({
      duration: 1.05,
      // Lenis skips elements with data-lenis-prevent (modals, tables, menus)
    });
    let frame: number;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
