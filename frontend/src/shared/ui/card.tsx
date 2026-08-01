import { cn } from "@/shared/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

/** style.md §6 — white 24px-radius floating card, elevation 1. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card bg-card p-6 shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  /** One short line telling the user what this section is for. */
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
