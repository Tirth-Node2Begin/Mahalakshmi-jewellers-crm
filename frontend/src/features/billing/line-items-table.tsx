"use client";

import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { formatWeight, makingLabel, num, priceLine } from "./calc";
import type { BillLine, PriceMode } from "./types";

/**
 * The lines on a bill or an estimate — a SUMMARY, not a form.
 *
 * Every figure used to be an input sitting in a seven-column grid, which put
 * five text boxes and two dropdowns on screen per item and left the counter
 * unsure which of them mattered. The details now live in the step-by-step
 * `ItemDetailsDialog`, reached from "Edit" here, so this list only has to answer
 * one question: what is on the bill and what does each line come to.
 */
export function LineItemsTable({
  lines,
  priceMode,
  onEdit,
  onRemove,
  emptyState,
}: {
  lines: BillLine[];
  priceMode: PriceMode;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  emptyState?: ReactNode;
}) {
  if (lines.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <ul className="space-y-2">
      {lines.map((line) => {
        const priced = priceLine(line, priceMode);
        const isTaxable = line.tax_treatment === "taxable";
        const needsReason = !isTaxable && !line.exempt_reason;

        const meta = [
          line.item_code,
          line.purity_code,
          num(line.qty) > 1 ? `${num(line.qty)} pc` : null,
          `${formatWeight(line.net_weight)} net`,
          num(line.rate_per_gram) > 0 ? `${formatCurrency(line.rate_per_gram, true)}/g` : "No rate",
          `Making ${makingLabel(line.making_type, line.making_value)}`,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li
            key={line.key}
            className={cn(
              "flex items-start gap-3 rounded-card border bg-background/40 p-3",
              needsReason ? "border-attention-strong/50" : "border-border",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold text-foreground">
                {line.description || "Untitled item"}
              </p>
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{meta}</p>

              {/* A line that charges no GST says so, and says why — it never
                  shows a rate or a tax amount, because it has neither. */}
              {!isTaxable ? (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-attention-strong">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  No GST — Non GST
                  {needsReason ? (
                    <span className="font-normal">· a reason is still needed, open Edit</span>
                  ) : (
                    <span className="font-normal text-muted-foreground">· {line.exempt_reason}</span>
                  )}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums text-foreground">
                {formatCurrency(priced.line_total, true)}
              </p>
              {isTaxable ? (
                <p className="text-[11px] text-muted-foreground">
                  {priceMode === "inclusive" ? "incl." : "+"} GST {formatCurrency(priced.tax_amount, true)}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(line.key)}
                aria-label={`Edit ${line.description || "line"}`}
                className="flex h-8 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
              <button
                type="button"
                onClick={() => onRemove(line.key)}
                aria-label={`Remove ${line.description || "line"}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-attention-soft hover:text-attention-strong"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
