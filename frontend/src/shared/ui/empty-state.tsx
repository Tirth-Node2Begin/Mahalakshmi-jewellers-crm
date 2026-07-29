import { Button } from "@/shared/ui/button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** style.md §9 — never a bare "No data" string. */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft">
        <Icon className="h-10 w-10 text-primary-strong" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action && onAction ? (
        <Button className="mt-6" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
