import { cn } from "@/shared/utils/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

/**
 * style.md §6 — one badge style everywhere: soft tint + strong text.
 * Status map: purple=new/info · green=active/paid/completed · amber=pending/partial ·
 * coral=overdue/dropped · gray=draft/inactive/cancelled.
 */
const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-pill px-3 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        purple: "bg-primary-soft text-primary-strong",
        green: "bg-success-soft text-success-strong",
        amber: "bg-warning-soft text-warning-strong",
        coral: "bg-attention-soft text-attention-strong",
        gray: "bg-background text-muted-foreground",
        gold: "bg-gold-soft text-gold-strong",
        blue: "bg-blue-soft text-blue-strong",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
