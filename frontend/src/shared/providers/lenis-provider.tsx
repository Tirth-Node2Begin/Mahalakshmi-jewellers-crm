"use client";

import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";

/**
 * The running Lenis instance, or null when smooth scroll is off (reduced motion)
 * or not mounted yet. Programmatic scrolling MUST go through it — Lenis writes
 * the scroll position every frame, so a bare window.scrollTo() gets overwritten.
 */
let activeLenis: Lenis | null = null;

/**
 * Scroll the page to the very top or the very bottom, smoothly where the user
 * allows motion. Falls back to the native API when Lenis is not running.
 */
export function scrollPageTo(target: "top" | "bottom"): void {
  const top = target === "top" ? 0 : document.documentElement.scrollHeight;
  if (activeLenis !== null) {
    activeLenis.scrollTo(top, { duration: 0.9 });
    return;
  }
  // No Lenis => reduced motion (or pre-mount): jump, don't animate.
  window.scrollTo({ top, behavior: "auto" });
}

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
    activeLenis = lenis;
    let frame: number;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      activeLenis = null;
    };
  }, []);

  return <>{children}</>;
}
