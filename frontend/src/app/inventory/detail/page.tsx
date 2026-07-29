"use client";

import { inventoryApi, REASON_LABEL, STATE_TONE } from "@/features/inventory/api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// recharts is heavy + DOM-measuring → load client-only, matches CSR/static-export build
const MovementChart = dynamic(() => import("@/features/inventory/movement-chart"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>,
});

function DetailInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["inventory", "detail", id],
    queryFn: () => inventoryApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  if (isLoading) return <SkeletonCard lines={12} />;
  if (isError || !data)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Item not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
      </Card>
    );

  const { item, transactions, monthly_movement } = data;
  const typeLabel = item.item_type === "raw_material" ? "Raw material" : "Stock";

  return (
    <div className="space-y-6">
      {/* back link + header */}
      <div className="flex flex-wrap items-start gap-6">
        <Link href="/inventory" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-foreground">{item.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{item.item_code}</span>
            <Badge tone={item.item_type === "raw_material" ? "gray" : "purple"}>{typeLabel}</Badge>
          </div>
        </div>
      </div>

      {/* stats grid */}
      <Card>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Current stock</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tabular-nums">{Number(item.current_stock)}</span>
              <span className="text-sm text-muted-foreground">{item.unit}</span>
              <Badge tone={STATE_TONE[item.stock_state]}>{item.stock_state === "ok" ? "OK" : item.stock_state === "low" ? "Low" : "Out"}</Badge>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Average cost</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{formatCurrency(item.avg_cost, true)}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Stock value</p>
            <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{formatCurrency(item.stock_value)}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Reorder level</p>
            <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">
              {Number(item.reorder_level)} {item.unit}
            </p>
          </div>

          {item.selling_price ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Selling price</p>
              <p className="mt-2 text-lg font-semibold text-foreground tabular-nums">{formatCurrency(item.selling_price, true)}</p>
            </div>
          ) : null}
        </div>
      </Card>

      {/* movement chart */}
      <Card>
        <p className="mb-4 text-sm font-semibold text-foreground">12-month movement</p>
        <MovementChart data={monthly_movement} />
      </Card>

      {/* transactions table */}
      <Card className="p-0">
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">Transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-[0.4px] text-muted-foreground">
                  <th className="px-6 py-3 text-left font-medium">Date</th>
                  <th className="px-6 py-3 text-left font-medium">Movement</th>
                  <th className="px-6 py-3 text-right font-medium">Qty</th>
                  <th className="px-6 py-3 text-right font-medium">Unit cost</th>
                  <th className="px-6 py-3 text-right font-medium">Value</th>
                  <th className="px-6 py-3 text-left font-medium">Reference</th>
                  <th className="px-6 py-3 text-left font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const qty = Number(tx.qty);
                  const isIn = tx.type === "in";
                  const ref = tx.purchase_no || tx.invoice_no || tx.work_code || tx.production_batch;

                  return (
                    <tr key={tx.id} className="border-b border-border/60">
                      <td className="px-6 py-3 text-foreground">{formatDate(tx.created_at)}</td>
                      <td className="px-6 py-3">
                        <Badge tone={isIn ? "green" : "coral"}>{REASON_LABEL[tx.reason] || tx.reason}</Badge>
                      </td>
                      <td className={cn("px-6 py-3 text-right font-medium tabular-nums", isIn ? "text-success-strong" : "text-attention-strong")}>
                        {isIn ? "+" : "−"}{qty}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(tx.unit_cost, true)}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums">{formatCurrency(tx.value)}</td>
                      <td className="px-6 py-3 text-muted-foreground">{ref || "—"}</td>
                      <td className="px-6 py-3 text-muted-foreground">{tx.by_name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function InventoryDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={12} />}>
      <DetailInner />
    </Suspense>
  );
}
