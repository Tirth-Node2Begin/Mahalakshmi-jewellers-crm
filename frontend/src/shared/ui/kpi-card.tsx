"use client";

import { cn } from "@/shared/utils/cn";
import type { LucideIcon } from "lucide-react";

/** Clickable KPI tile (style.md §6, §11) — icon chip, big number, caption. */
export function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "purple",
  active,
  onClick,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "purple" | "green" | "amber" | "coral" | "sky" | "gray";
  active?: boolean;
  onClick?: () => void;
  /** Tint the whole tile: green for income/profit, red for an actual loss, grey for a neutral money figure. */
  tint?: "green" | "red" | "grey";
}) {
  const chipTone = tint
    ? tint === "green"
      ? "bg-white text-success-strong"
      : tint === "red"
        ? "bg-white text-attention-strong"
        : "bg-white text-muted-foreground"
    : {
        purple: "bg-primary-soft text-primary-strong",
        green: "bg-success-soft text-success-strong",
        amber: "bg-warning-soft text-warning-strong",
        coral: "bg-attention-soft text-attention-strong",
        sky: "bg-[color-mix(in_oklab,var(--sky)_15%,white)] text-[color-mix(in_oklab,var(--sky)_75%,black)]",
        gray: "bg-background text-muted-foreground",
      }[tone];

  // stronger-than-*-soft tint, mixed with --card so it stays right in dark mode too
  const cardBg =
    tint === "green"
      ? "bg-[color-mix(in_oklab,var(--success)_30%,var(--card))]"
      : tint === "red"
        ? "bg-[color-mix(in_oklab,var(--attention)_28%,var(--card))]"
        : tint === "grey"
          ? "bg-[color-mix(in_oklab,var(--muted-foreground)_16%,var(--card))]"
          : "bg-card";
  const valueColor = tint === "green" ? "text-success-strong" : tint === "red" ? "text-attention-strong" : "text-foreground";
  const labelColor = tint === "green" ? "text-success-strong/80" : tint === "red" ? "text-attention-strong/80" : "text-muted-foreground";

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-card p-5 text-left shadow-card transition-all duration-150",
        cardBg,
        onClick && "hover:-translate-y-0.5 hover:shadow-raised",
        active && "ring-2 ring-primary",
      )}
    >
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full", chipTone)}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className={cn("mt-4 text-[28px] font-bold leading-8 tabular-nums", valueColor)}>{value}</span>
      <span className={cn("mt-0.5 text-sm", labelColor)}>{label}</span>
    </Comp>
  );
}
