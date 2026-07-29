import { localDateString } from "@/shared/utils/format";

/**
 * Shared plumbing for the financial report pages (app/reports/**).
 * Extracted from the original Profit & Loss page so all six reports share one
 * date-range vocabulary and one CSV writer.
 */

/** Indian fiscal year: 1 Apr → 31 Mar. */
export function fiscalYear(d = new Date()) {
  const startYear = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: localDateString(start), to: localDateString(end) };
}

export const RANGE_PRESETS = [
  { key: "month", label: "This Month", range: () => monthRange(0) },
  { key: "last", label: "Last Month", range: () => monthRange(-1) },
  { key: "year", label: "This Year", range: () => fiscalYear() },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]["key"];

/** Which preset (if any) the current from/to pair matches — for button highlighting. */
export function activePreset(from: string, to: string): RangePresetKey | undefined {
  return RANGE_PRESETS.find((p) => {
    const r = p.range();
    return r.from === from && r.to === to;
  })?.key;
}

/**
 * MySQL DECIMAL / SUM() columns come back over JSON as strings. Anything read
 * straight out of a raw row must go through this before arithmetic.
 */
export type Numeric = number | string;

export function num(value: Numeric | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV client-side from already-loaded rows and hand it to the browser.
 * The leading BOM is what makes Excel open ₹ and Indian names correctly.
 */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * "45 days ago" — the ageing hint on the outstanding report. Plain words, no
 * accounting jargon, because the shop owner reads this one.
 */
export function daysAgo(value: string | null | undefined): { days: number; label: string } | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const then = new Date(y, m - 1, d);
  if (Number.isNaN(then.getTime())) return null;
  const today = new Date();
  const days = Math.max(
    0,
    Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - then.getTime()) / 86_400_000),
  );
  if (days === 0) return { days, label: "Today" };
  if (days === 1) return { days, label: "Yesterday" };
  return { days, label: `${days} days ago` };
}

/** Colour cue for how long money has been sitting unpaid. */
export function ageTone(days: number): "gray" | "amber" | "coral" {
  if (days >= 90) return "coral";
  if (days >= 30) return "amber";
  return "gray";
}
