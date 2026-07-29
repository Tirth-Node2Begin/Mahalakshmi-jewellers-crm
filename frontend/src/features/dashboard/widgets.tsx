"use client";

import { usePermissions } from "@/lib/permissions";
import { Card } from "@/shared/ui/card";
import { formatCurrency } from "@/shared/utils/format";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/** A single alert tile — turns amber when its count is non-zero. */
export interface AlertTile {
  key: string;
  count: number;
  label: string;
  href: string;
  icon: LucideIcon;
}

export function AlertRow({ tiles }: { tiles: AlertTile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((a) => (
        <Link key={a.key} href={a.href}>
          <div className={`flex items-center gap-3 rounded-card border p-4 transition-colors ${a.count > 0 ? "border-warning-strong/30 bg-warning-soft" : "border-border bg-card"}`}>
            <a.icon className={`h-5 w-5 shrink-0 ${a.count > 0 ? "text-warning-strong" : "text-muted-foreground"}`} aria-hidden />
            <div className="min-w-0">
              <p className={`text-lg font-bold tabular-nums ${a.count > 0 ? "text-warning-strong" : "text-foreground"}`}>{a.count}</p>
              <p className="truncate text-xs text-muted-foreground">{a.label}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Quick-action link, only rendered when the user holds `permission` (RBAC-gated). */
export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { can } = usePermissions();
  const allowed = actions.filter((a) => can(a.permission));
  if (allowed.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {allowed.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="inline-flex items-center gap-2 rounded-pill border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary-strong hover:shadow-raised"
        >
          <a.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {a.label}
        </Link>
      ))}
    </div>
  );
}

export function ListCard({ title, href, empty, children }: { title: string; href?: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {href ? <Link href={href} className="text-sm font-medium text-primary-strong hover:underline">View all</Link> : null}
      </div>
      {has ? <ul className="divide-y divide-border/60">{children}</ul> : <p className="px-5 py-8 text-center text-sm text-muted-foreground">{empty}</p>}
    </Card>
  );
}

export function Row({ left, right, sub, rightTone }: { left: React.ReactNode; right?: React.ReactNode; sub?: string; rightTone?: "green" | "coral" }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate">{left}</div>
        {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      {right !== undefined ? (
        <span className={`shrink-0 font-medium tabular-nums ${rightTone === "green" ? "text-success-strong" : rightTone === "coral" ? "text-attention-strong" : "text-muted-foreground"}`}>{right}</span>
      ) : null}
    </li>
  );
}

/** Horizontal count bars (e.g. items by status). */
export function CountBars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-background">
            <div
              className="flex h-full items-center justify-end rounded-md bg-primary/80 pr-2 text-[10px] font-semibold text-white"
              style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count > 0 ? "1.25rem" : 0 }}
            >
              {r.count > 0 ? r.count : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal ₹-value bars (e.g. stock value by category). */
export function ValueBars({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-background">
            <div className="h-full rounded-md bg-primary/70" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? "0.25rem" : 0 }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs font-medium tabular-nums text-foreground">{formatCurrency(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
