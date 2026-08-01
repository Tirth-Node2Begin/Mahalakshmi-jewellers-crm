"use client";

import { Button } from "@/shared/ui/button";
import { Collapsible } from "@/shared/ui/collapsible";
import { formatCurrency } from "@/shared/utils/format";
import { Plus, Trash2 } from "lucide-react";
import { formatWeight, num, priceOldMetal, rateForPurity } from "./calc";
import type { Metal, OldMetalLine, Purity } from "./types";

/**
 * Old gold / silver handed over in exchange. Its value is a credit that comes
 * off what the customer pays. Empty by default — most bills never open it.
 */
export function OldMetalPanel({
  rows,
  purities,
  onChange,
  onAdd,
  onRemove,
}: {
  rows: OldMetalLine[];
  purities: Purity[];
  onChange: (key: string, patch: Partial<OldMetalLine>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}) {
  const total = rows.reduce((sum, row) => sum + priceOldMetal(row).value, 0);

  return (
    <Collapsible
      // remount on the empty↔filled boundary so a resumed draft that already has
      // exchange rows opens the panel instead of hiding the credit
      key={rows.length > 0 ? "has-rows" : "empty"}
      label="Old gold / silver taken in exchange"
      hint={rows.length > 0 ? `${rows.length} item(s) · ${formatCurrency(total, true)} off the bill` : "Optional — adds a credit against this bill"}
      defaultOpen={rows.length > 0}
    >
      {rows.length === 0 ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Nothing exchanged yet. Add a row for each piece the customer is handing over.
        </p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-[0.4px] text-muted-foreground">
                <th className="py-2 text-left font-medium">Metal</th>
                <th className="py-2 text-left font-medium">Purity</th>
                <th className="py-2 text-right font-medium">Gross wt</th>
                <th className="py-2 text-right font-medium">Deduction %</th>
                <th className="py-2 text-right font-medium">Net wt</th>
                <th className="py-2 text-right font-medium">Rate / g</th>
                <th className="py-2 text-right font-medium">Value</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const valued = priceOldMetal(row);
                const options = purities.filter((p) => p.metal === row.metal);
                return (
                  <tr key={row.key} className="border-b border-border/60">
                    <td className="py-2.5">
                      <select
                        aria-label="Metal"
                        value={row.metal}
                        onChange={(e) => {
                          const metal = e.target.value as Metal;
                          const first = purities.find((p) => p.metal === metal);
                          onChange(row.key, {
                            metal,
                            purity_id: first?.id ?? null,
                            rate_per_gram: num(first?.rate_per_gram),
                          });
                        }}
                        className="h-9 rounded-[12px] border border-border bg-card px-2 text-sm transition-colors focus:border-primary focus:outline-none"
                      >
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                        <option value="platinum">Platinum</option>
                      </select>
                    </td>
                    <td className="py-2.5">
                      <select
                        aria-label="Purity"
                        value={row.purity_id ?? ""}
                        onChange={(e) => {
                          const purityId = e.target.value ? Number(e.target.value) : null;
                          onChange(row.key, { purity_id: purityId, rate_per_gram: rateForPurity(purities, purityId) });
                        }}
                        className="h-9 rounded-[12px] border border-border bg-card px-2 text-sm transition-colors focus:border-primary focus:outline-none"
                      >
                        <option value="">Choose…</option>
                        {options.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 text-right">
                      <NumCell label="Gross weight" value={row.gross_weight} onChange={(v) => onChange(row.key, { gross_weight: v })} />
                    </td>
                    <td className="py-2.5 text-right">
                      <NumCell label="Deduction percent" value={row.deduction_pct} onChange={(v) => onChange(row.key, { deduction_pct: v })} width="w-20" />
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{formatWeight(valued.net_weight)}</td>
                    <td className="py-2.5 text-right">
                      <NumCell label="Rate per gram" value={row.rate_per_gram} onChange={(v) => onChange(row.key, { rate_per_gram: v })} />
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-success-strong">
                      {formatCurrency(valued.value, true)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(row.key)}
                        aria-label="Remove exchange row"
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
      )}

      <div className="flex items-center justify-between gap-4">
        <Button variant="secondary" size="sm" type="button" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden /> Add exchange row
        </Button>
        {rows.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Credit: <span className="font-semibold tabular-nums text-success-strong">{formatCurrency(total, true)}</span>
          </p>
        ) : null}
      </div>
    </Collapsible>
  );
}

function NumCell({
  label,
  value,
  onChange,
  width = "w-24",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  width?: string;
}) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className={`h-9 ${width} rounded-[12px] border border-border bg-card px-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none`}
    />
  );
}
