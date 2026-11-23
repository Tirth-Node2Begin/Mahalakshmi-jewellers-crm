"use client";

import { movementReasonLabel, stockApi } from "@/features/stock/api";
import { useCanSeeCost } from "@/features/stock/permissions";
import { usePermissions } from "@/lib/permissions";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { addDaysStr, formatCurrency, formatDateTime, formatWeight, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Lock } from "lucide-react";
import { useState } from "react";

export default function StockMovementsPage() {
  const { can } = usePermissions();
  const canSeeCost = useCanSeeCost();
  const allowed = can("reports.stock");

  const [from, setFrom] = useState(() => addDaysStr(localDateString(), -30));
  const [to, setTo] = useState(() => localDateString());
  const [itemId, setItemId] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);

  // the item picker is fed by the item master, searched as you type
  const { data: itemData } = useQuery({
    queryKey: ["stock", "items", { picker: true, per_page: 300 }],
    queryFn: () => stockApi.items({ per_page: 300 }),
    enabled: allowed,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["stock", "movements", { from, to, itemId }],
    queryFn: () => stockApi.register({ from, to, item_id: itemId ? Number(itemId) : undefined }),
    enabled: allowed && !!from && !!to,
  });

  const movements = (data?.movements ?? []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.item_name.toLowerCase().includes(q) ||
      m.item_code.toLowerCase().includes(q) ||
      (m.purchase_no ?? "").toLowerCase().includes(q) ||
      (m.invoice_no ?? "").toLowerCase().includes(q) ||
      (m.adjustment_reason ?? "").toLowerCase().includes(q)
    );
  });

  const { page, totalPages, pageItems, setPage } = usePagination(movements, 20, [from, to, itemId, search]);

  if (!allowed) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="You cannot open the stock register"
          hint="Ask the owner to give you the stock reports permission."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div>
            <Label htmlFor="mv_from">From</Label>
            <Input id="mv_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 w-auto" />
          </div>
          <div>
            <Label htmlFor="mv_to">To</Label>
            <Input id="mv_to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 w-auto" />
          </div>
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="mv_item">Item (optional)</Label>
            <Select id="mv_item" value={itemId} onChange={(e) => setItemId(e.target.value)} className="h-11">
              <option value="">All items</option>
              {(itemData?.items ?? []).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.item_code} — {it.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="mv_search">Search</Label>
            <Input
              id="mv_search"
              placeholder="Item, bill or reason…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="h-11"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom(addDaysStr(localDateString(), -30));
              setTo(localDateString());
              setItemId("");
              setRawSearch("");
            }}
          >
            Reset
          </Button>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Could not load the register"
            hint="Check the dates and try again — the start date must come before the end date."
          />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Nothing moved in this period"
            hint="Widen the dates, or clear the item filter."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1020px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-4 py-3">When</th>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3">In / Out</th>
                    <th className="px-3 py-3">Reason</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Weight</th>
                    <th className="px-3 py-3 text-right">Rate / g</th>
                    <th className="px-3 py-3">Bill / purchase</th>
                    <th className="px-3 py-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className="px-3 py-3">
                        <span className="block font-medium text-foreground">{m.item_name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {m.item_code}
                          {m.purity_code ? ` · ${m.purity_code}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={m.type === "in" ? "green" : "coral"}>{m.type === "in" ? "In" : "Out"}</Badge>
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {movementReasonLabel(m.reason)}
                        {m.adjustment_reason ? (
                          <span className="block text-xs text-muted-foreground">{m.adjustment_reason}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{Number(m.qty)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatWeight(m.weight)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {canSeeCost && m.rate_per_gram ? formatCurrency(m.rate_per_gram, true) : "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {m.invoice_no ?? m.purchase_no ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{m.user_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
