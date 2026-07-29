"use client";

import { cn } from "@/shared/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Modal per style.md §6 — elevation 3, 24px radius, backdrop blur,
 * scale 0.96→1 enter, ESC/backdrop close, focus containment.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // keep the latest onClose without re-running the focus/lock effect — otherwise an
  // inline `onClose={() => ...}` (new identity every parent render) re-fires the effect
  // on each keystroke and yanks focus back to the first field. (Bug: bank-account UPI.)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // focus-in / scroll-lock / focus-restore — runs ONCE per open, never on re-render
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('input, select, textarea, button:not([aria-label="Close"])')
        ?.focus();
    });
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open]);

  // ESC to close + Tab focus containment (reads onClose via ref, so no re-focus churn)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" data-lenis-prevent>
          <motion.button
            aria-label="Close dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgba(16,17,24,0.4)] backdrop-blur-[4px]"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn("relative flex max-h-[calc(100vh-4rem)] w-full flex-col rounded-card bg-card shadow-modal")}
            style={{ maxWidth }}
          >
            <div className="flex items-center justify-between px-8 pt-7">
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <button
                aria-label="Close"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-6" data-lenis-prevent>
              {children}
            </div>
            {footer ? (
              <div className="flex justify-end gap-3 border-t border-border px-8 py-5">{footer}</div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
