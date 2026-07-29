"use client";

import { cn } from "@/shared/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/**
 * Optional-details disclosure. Keeps advanced fields out of the way for
 * non-technical users while remaining one click away. Matches the muted
 * uppercase section-label styling used across the forms.
 */
export function Collapsible({
  label,
  hint,
  defaultOpen = false,
  children,
  className,
}: {
  label: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-input border border-border bg-background", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">{label}</span>
          {hint ? <span className="mt-0.5 text-xs text-muted-foreground/70">{hint}</span> : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
