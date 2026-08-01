"use client";

import { metalLabel, stockApi, type Metal, type StockSummaryRow } from "@/features/stock/api";
import { useMetals } from "@/features/stock/metal-select";
import { useCanSeeCost } from "@/features/stock/permissions";
import { Card, CardHeader } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { KpiCard } from "@/shared/ui/kpi-card";
import { SkeletonCard, SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatWeight } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Boxes, Coins, Gem, IndianRupee, Scale } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

interface MetalTotals {
  pieces: number;
  weight: number;
  value: number;
  bulkWeight: number;
}

function emptyTotals(): MetalTotals {
  return { pieces: 0, weight: 0, value: 0, bulkWeight: 0 };
}

export default function StockSummaryPage() {
  const canSeeCost = useCanSeeCost();
  const { data, isLoading } = useQuery({
    queryKey: ["stock", "summary"],
    queryFn: () => stockApi.summary(),
  });
  const { data: metalsData } = useMetals();

  const rows = useMemo(() => data?.summary ?? [], [data]);

  /** Per-metal headline figures. Tagged rows count pieces, bulk rows carry loose grams. */
  const totals = useMemo(() => {
    const map = new Map<Metal, MetalTotals>();
    for (const row of rows) {
      if (!row.metal) continue;
      const entry = map.get(row.metal) ?? emptyTotals();
      entry.weight += Number(row.weight ?? 0);
      entry.value += Number(row.value ?? 0);
      if (row.tracking === "tagged") entry.pieces += Number(row.qty ?? 0);
      else entry.bulkWeight += Number(row.weight ?? 0);
      map.set(row.metal, entry);
    }
    return map;
  }, [rows]);

  /** purity → { tagged, bulk } for one metal. */
  const byMetal = useMemo(() => {
    type PurityCell = { tagged?: StockSummaryRow; bulk?: StockSummaryRow };
    const map = new Map<Metal, Map<string, PurityCell>>();
    for (const row of rows) {
      if (!row.metal) continue;
      const purities = map.get(row.metal) ?? new Map<string, PurityCell>();
      const purity = row.purity ?? "Not set";
      const cell: PurityCell = purities.get(purity) ?? {};
      cell[row.tracking] = row;
      purities.set(purity, cell);
      map.set(row.metal, purities);
    }
    return map;
  }, [rows]);

  /**
   * Metals to show, in master order, with anything the summary carries that is no
   * longer in the master appended — a metal the shop stopped dealing in still has
   * stock on the shelf, and dropping it here would hide it.
   */
  const metalOrder = useMemo(() => {
    const known = (metalsData?.metals ?? []).map((m) => m.code);
    const present = [...totals.keys()];
    return [...known, ...present.filter((m) => !known.includes(m))];
  }, [metalsData, totals]);

  const grandWeight = rows.reduce((sum, r) => sum + Number(r.weight ?? 0), 0);
  const grandValue = rows.reduce((sum, r) => sum + Number(r.value ?? 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
        </div>
        <Card className="p-0">
          <SkeletonRows rows={6} />
        </Card>
      </div>
    );
  }

  const hasStock = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
        <div className="min-w-0 flex-1" />
        <Link
          href="/inventory/items"
          className="inline-flex h-10 items-center gap-2 rounded-pill border border-border bg-card px-5 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
        >
          <Gem className="h-4 w-4" aria-hidden /> Item list
        </Link>
        <Link
          href="/inventory/movements"
          className="inline-flex h-10 items-center gap-2 rounded-pill border border-border bg-card px-5 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden /> Movements
        </Link>
      </div>

      {/* one card per metal + weight + value — all in ONE row on desktop, however
          many metals the shop has (the metals master can grow) */}
      <div
        className="grid grid-cols-2 gap-4 lg:grid-cols-[repeat(var(--kpi-cols),minmax(0,1fr))]"
        style={{ "--kpi-cols": metalOrder.length + 2 } as React.CSSProperties}
      >
        {metalOrder.map((metal) => {
          const t = totals.get(metal) ?? emptyTotals();
          return (
            <KpiCard
              key={metal}
              icon={metal === "gold" ? Coins : Boxes}
              label={`${metalLabel(metal, metalsData?.metals)} — pieces in stock`}
              value={Math.round(t.pieces)}
              tone={metal === "gold" ? "amber" : "sky"}
            />
          );
        })}
        <KpiCard icon={Scale} label="Total weight in hand" value={formatWeight(grandWeight)} tone="purple" />
        {canSeeCost ? (
          <KpiCard icon={IndianRupee} label="Stock value" value={formatCurrency(grandValue)} tone="green" />
        ) : (
          <KpiCard
            icon={Scale}
            label="Loose metal (bulk)"
            value={formatWeight(
              metalOrder.reduce((sum, m) => sum + (totals.get(m)?.bulkWeight ?? 0), 0),
            )}
            tone="gray"
          />
        )}
      </div>

      {!hasStock ? (
        <Card>
          <EmptyState
            icon={Boxes}
            title="No stock yet"
            hint="Record a purchase or enter your opening stock and this page will fill up."
          />
        </Card>
      ) : (
        metalOrder.map((metal) => {
          const purities = byMetal.get(metal);
          if (!purities || purities.size === 0) return null;
          const t = totals.get(metal) ?? emptyTotals();
          return (
            <Card key={metal} className="p-0">
              <CardHeader
                className="px-6 pt-6"
                title={
                  <span className="flex items-baseline gap-3">
                    {metalLabel(metal, metalsData?.metals)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatWeight(t.weight)}
                      {canSeeCost ? ` · ${formatCurrency(t.value)}` : ""}
                    </span>
                  </span>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead>
                    <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                      <th className="px-6 py-3">Purity</th>
                      <th className="px-3 py-3 text-right">Tagged pieces</th>
                      <th className="px-3 py-3 text-right">Tagged weight</th>
                      <th className="px-3 py-3 text-right">Bulk weight</th>
                      <th className="px-3 py-3 text-right">Total weight</th>
                      {canSeeCost ? <th className="px-6 py-3 text-right">Value</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {[...purities.entries()].map(([purity, cell]) => {
                      const taggedWeight = Number(cell.tagged?.weight ?? 0);
                      const bulkWeight = Number(cell.bulk?.weight ?? 0);
                      const value = Number(cell.tagged?.value ?? 0) + Number(cell.bulk?.value ?? 0);
                      return (
                        <tr key={purity} className="border-b border-border/50 last:border-0">
                          <td className="px-6 py-3 font-medium text-foreground">{purity}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-foreground">
                            {Math.round(Number(cell.tagged?.qty ?? 0))}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {formatWeight(taggedWeight)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {formatWeight(bulkWeight)}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                            {formatWeight(taggedWeight + bulkWeight)}
                          </td>
                          {canSeeCost ? (
                            <td className="px-6 py-3 text-right tabular-nums text-foreground">
                              {formatCurrency(value, true)}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
