"use client";

import type { AuditValues } from "./api";

/**
 * Turns the raw old_values / new_values JSON into something a shop owner can read:
 * "Rate changed 7,250 → 7,310" instead of a wall of JSON.
 */

const inGrouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export interface DiffRow {
  key: string;
  label: string;
  before: string | null;
  after: string | null;
}

/** "rate_per_gram" → "Rate per gram" */
function keyLabel(key: string): string {
  const words = key.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return inGrouping.format(value);
  if (typeof value === "string") {
    // numeric strings come back from MySQL decimals — group them like numbers
    if (/^-?\d+(\.\d+)?$/.test(value.trim())) return inGrouping.format(Number(value));
    return value;
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  return JSON.stringify(value);
}

export function buildDiff(oldValues: AuditValues, newValues: AuditValues): DiffRow[] {
  const before = oldValues ?? {};
  const after = newValues ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  const rows: DiffRow[] = [];
  for (const key of keys) {
    const hasBefore = key in before;
    const hasAfter = key in after;
    const b = hasBefore ? renderValue(before[key]) : null;
    const a = hasAfter ? renderValue(after[key]) : null;
    if (hasBefore && hasAfter && b === a) continue; // unchanged — not worth showing
    rows.push({ key, label: keyLabel(key), before: b, after: a });
  }
  return rows;
}

/** One-line gist for the collapsed row. */
export function diffSummary(oldValues: AuditValues, newValues: AuditValues): string {
  const rows = buildDiff(oldValues, newValues);
  if (rows.length === 0) return "No field details recorded.";

  const phrase = (r: DiffRow) =>
    r.before !== null && r.after !== null
      ? `${r.label} changed ${r.before} → ${r.after}`
      : r.after !== null
        ? `${r.label} set to ${r.after}`
        : `${r.label} was ${r.before}`;

  const head = rows.slice(0, 2).map(phrase).join(" · ");
  return rows.length > 2 ? `${head} · +${rows.length - 2} more` : head;
}

export function LogDiff({ oldValues, newValues }: { oldValues: AuditValues; newValues: AuditValues }) {
  const rows = buildDiff(oldValues, newValues);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing else was recorded for this action.</p>;
  }

  const isChange = rows.some((r) => r.before !== null && r.after !== null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.4px] text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Field</th>
            {isChange ? <th className="py-2 pr-4 font-medium">Before</th> : null}
            <th className="py-2 font-medium">{isChange ? "After" : "Value"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/60">
              <td className="py-2 pr-4 text-muted-foreground">{r.label}</td>
              {isChange ? (
                <td className="py-2 pr-4 tabular-nums text-muted-foreground line-through decoration-border">
                  {r.before ?? "—"}
                </td>
              ) : null}
              <td className="py-2 tabular-nums font-medium text-foreground">{r.after ?? r.before ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
