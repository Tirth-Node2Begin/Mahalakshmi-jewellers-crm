"use client";

import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import type { BillTotals } from "./calc";
import type { PriceMode } from "./types";

/**
 * The money column. Plain wording only — a counter hand should be able to read
 * this out to the customer without translating anything.
 */
export function TotalsPanel({
  totals,
  priceMode,
  onPriceModeChange,
  discount,
  onDiscountChange,
  grandLabel = "Grand Total",
  showRoundOff = true,
}: {
  totals: BillTotals;
  priceMode: PriceMode;
  onPriceModeChange: (mode: PriceMode) => void;
  discount: number;
  onDiscountChange: (value: number) => void;
  grandLabel?: string;
  showRoundOff?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* price mode — plain wording, not "exclusive / inclusive" */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Price shown to the customer</p>
        <div className="flex gap-1 rounded-pill bg-background p-1">
          {(
            [
              { mode: "exclusive" as const, label: "GST extra" },
              { mode: "inclusive" as const, label: "GST included in price" },
            ]
          ).map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => onPriceModeChange(option.mode)}
              aria-pressed={priceMode === option.mode}
              className={cn(
                "flex-1 rounded-pill px-3 py-2 text-xs font-semibold transition-colors",
                priceMode === option.mode ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label="Metal value" value={formatCurrency(totals.metal, true)} />
        <Row label="Making charges" value={formatCurrency(totals.making, true)} />

        <div className="flex items-center justify-between gap-3 py-0.5">
          <label htmlFor="bill_discount" className="text-muted-foreground">
            Discount on the whole bill
          </label>
          <input
            id="bill_discount"
            inputMode="decimal"
            value={discount}
            onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className="h-9 w-28 rounded-[12px] border border-border bg-card px-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none"
          />
        </div>

        <Row label={priceMode === "inclusive" ? "GST (already in the price)" : "GST"} value={formatCurrency(totals.tax, true)} />
        {totals.oldMetal > 0 ? (
          <Row label="Old metal given" value={`− ${formatCurrency(totals.oldMetal, true)}`} tone="success" />
        ) : null}
        {showRoundOff && Math.abs(totals.roundOff) >= 0.005 ? (
          <Row label="Round off" value={`${totals.roundOff > 0 ? "+" : "−"} ${formatCurrency(Math.abs(totals.roundOff), true)}`} />
        ) : null}
      </div>

      <div className="rounded-input bg-primary-soft px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.4px] text-primary-strong">{grandLabel}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-primary-strong">{formatCurrency(totals.grand, true)}</p>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-muted-foreground">
      <span>{label}</span>
      <span className={cn("tabular-nums", tone === "success" ? "font-medium text-success-strong" : "text-foreground")}>{value}</span>
    </div>
  );
}
