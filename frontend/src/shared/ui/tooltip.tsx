"use client";

import { cn } from "@/shared/utils/cn";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight global tooltip provider (planning/04 §5 provider stack, style.md §6).
 * A no-config passthrough today; individual <Tooltip> wrappers add hover labels.
 */
const TooltipContext = createContext<boolean>(false);

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <TooltipContext.Provider value>{children}</TooltipContext.Provider>;
}

export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const enabled = useContext(TooltipContext);
  const [open, setOpen] = useState(false);

  if (!enabled) return <>{children}</>;

  const position = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    left: "right-full top-1/2 mr-2 -translate-y-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-pill bg-foreground px-3 py-1.5 text-xs font-medium text-white shadow-raised",
            position,
          )}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
