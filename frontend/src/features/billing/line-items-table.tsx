"use client";

import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { formatWeight, makingLabel, num, priceLine } from "./calc";
import type { BillLine, MakingType, PriceMode } from "./types";

const MAKING_LABELS: Record<MakingType, string> = {
  per_gram: "₹ / gram",
  fixed: "₹ fixed",
  percent: "% of metal",
};

/**
 * The lines on a bill or an estimate.
 *
 * Rate and making charge are editable inline ONLY with `invoices.override` —
 * for everyone else they are the day's rate and the tag's making, shown as text.
 * Weights stay editable for bulk lines (they come off the scale); a tagged piece
 * carries its own weights, so those are read-only.
 */
export function LineItemsTable({
  lines,
  priceMode,
  canOverride,
  onChange,
  onRemove,
  emptyState,
}: {
  lines: BillLine[];
  priceMode: PriceMode;
  canOverride: boolean;
  onChange: (key: string, patch: Partial<BillLine>) => void;
  onRemove: (key: string) => void;
  emptyState?: ReactNode;
}) {
  if (lines.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-[0.4px] text-muted-foreground">
            <th className="py-2 pl-1 text-left font-medium">Item</th>
            <th className="py-2 text-left font-medium">HUID</th>
            <th className="py-2 text-right font-medium">Gross</th>
            <th className="py-2 text-right font-medium">Net</th>
            <th className="py-2 text-right font-medium">Rate / g</th>
            <th className="py-2 text-right font-medium">Making</th>
            <th className="py-2 text-right font-medium">GST</th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const priced = priceLine(line, priceMode);
            const isBulk = line.tracking === "bulk";
            return (
              <tr key={line.key} className="border-b border-border/60 align-top">
                <td className="py-3 pl-1">
                  {line.item_id === null ? (
                    <input
                      value={line.description}
                      onChange={(e) => onChange(line.key, { description: e.target.value })}
                      placeholder="Describe the piece"
                      aria-label="Item description"
                      className="h-9 w-48 rounded-[12px] border border-border bg-card px-2 text-sm transition-colors focus:border-primary focus:outline-none"
                    />
                  ) : (
                    <span className="block max-w-[220px] truncate font-medium text-foreground">{line.description}</span>
                  )}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {[line.item_code, line.purity_code, isBulk ? `${num(line.qty)} pc` : null].filter(Boolean).join(" · ") || "Not from stock"}
                  </span>
                </td>
                <td className="py-3 font-mono text-xs text-muted-foreground">{line.huid || "—"}</td>
                <td className="py-3 text-right">
                  {isBulk ? (
                    <NumCell
                      label="Gross weight"
                      value={line.gross_weight}
                      onChange={(v) => onChange(line.key, { gross_weight: v })}
                    />
                  ) : (
                    <span className="tabular-nums text-muted-foreground">{formatWeight(line.gross_weight)}</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {isBulk ? (
                    <NumCell label="Net weight" value={line.net_weight} onChange={(v) => onChange(line.key, { net_weight: v })} />
                  ) : (
                    <span className="tabular-nums font-medium text-foreground">{formatWeight(line.net_weight)}</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {canOverride ? (
                    <NumCell label="Rate per gram" value={line.rate_per_gram} onChange={(v) => onChange(line.key, { rate_per_gram: v })} />
                  ) : (
                    <span className={cn("tabular-nums", num(line.rate_per_gram) <= 0 ? "text-attention-strong" : "text-foreground")}>
                      {num(line.rate_per_gram) > 0 ? formatCurrency(line.rate_per_gram, true) : "No rate"}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right">
                  {canOverride ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <NumCell label="Making charge" value={line.making_value} onChange={(v) => onChange(line.key, { making_value: v })} />
                      <select
                        aria-label="Making charge type"
                        value={line.making_type}
                        onChange={(e) => onChange(line.key, { making_type: e.target.value as MakingType })}
                        className="h-9 rounded-[12px] border border-border bg-card px-1.5 text-xs transition-colors focus:border-primary focus:outline-none"
                      >
                        {(Object.keys(MAKING_LABELS) as MakingType[]).map((t) => (
                          <option key={t} value={t}>
                            {MAKING_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{makingLabel(line.making_type, line.making_value)}</span>
                  )}
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(priced.making_charge, true)}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span className="block tabular-nums text-muted-foreground">{num(line.tax_rate)}%</span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    {formatCurrency(priced.tax_amount, true)}
                  </span>
                </td>
                <td className="py-3 text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(priced.line_total, true)}
                </td>
                <td className="py-3 pl-1 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(line.key)}
                    aria-label={`Remove ${line.description || "line"}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-attention-soft hover:text-attention-strong"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NumCell({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className="h-9 w-24 rounded-[12px] border border-border bg-card px-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none"
    />
  );
}
