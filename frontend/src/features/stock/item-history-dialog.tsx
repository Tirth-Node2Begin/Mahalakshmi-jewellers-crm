"use client";

import { movementReasonLabel, stockApi } from "@/features/stock/api";
import { useCanSeeCost } from "@/features/stock/permissions";
import { Badge } from "@/shared/ui/badge";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDateTime, formatWeight } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";

/** What is left of one item right now, and everything that ever moved on it. */
export function ItemHistoryDialog({
  itemId,
  onClose,
}: {
  itemId: number | null;
  onClose: () => void;
}) {
  const canSeeCost = useCanSeeCost();
  const { data, isLoading } = useQuery({
    queryKey: ["stock", "item", itemId],
    queryFn: () => stockApi.detail(itemId!),
    enabled: !!itemId,
  });

  const item = data?.item;

  return (
    <Dialog open={!!itemId} onClose={onClose} maxWidth={720} title={item ? `${item.item_code} — ${item.name}` : "Item history"}>
      {isLoading || !item ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="In hand" value={formatWeight(item.availability.weight)} />
            <Figure label="Pieces" value={Number(item.availability.qty).toFixed(item.tracking === "bulk" ? 3 : 0)} />
            <Figure label="Net weight / piece" value={formatWeight(item.net_weight)} />
            {canSeeCost ? <Figure label="Stock value" value={formatCurrency(item.availability.value, true)} /> : null}
          </div>

          {item.movements.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="Nothing has moved yet" hint="Purchases, sales and adjustments will show here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="py-2">When</th>
                    <th className="py-2">What happened</th>
                    <th className="py-2 text-right">Weight</th>
                    <th className="py-2">Bill / purchase</th>
                    <th className="py-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {item.movements.map((m) => (
                    <tr key={m.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className="py-2.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={m.type === "in" ? "green" : "coral"}>{m.type === "in" ? "In" : "Out"}</Badge>
                          <span className="text-foreground">{movementReasonLabel(m.reason)}</span>
                        </span>
                        {m.adjustment_reason ? (
                          <span className="mt-1 block text-xs text-muted-foreground">{m.adjustment_reason}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-foreground">{formatWeight(m.weight)}</td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {m.invoice_no ?? m.purchase_no ?? "—"}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{m.user_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input bg-background px-4 py-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-base font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
