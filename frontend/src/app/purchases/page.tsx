"use client";

import {
  paymentStateLabel,
  paymentStateTone,
  purchaseStatusTone,
  purchasesApi,
} from "@/features/purchases/api";
import { PermissionGate } from "@/lib/permissions";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { addDaysStr, formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Package, PackagePlus, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PurchasesPage() {
  const router = useRouter();
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState(() => addDaysStr(localDateString(), -90));
  const [to, setTo] = useState(() => localDateString());

  const filters = {
    search: search || undefined,
    supplier_id: supplierId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["purchases", "list", filters],
    queryFn: () => purchasesApi.list(filters),
  });

  const purchases = data?.purchases ?? [];
  const vendors = data?.vendors ?? [];
  const { page, totalPages, pageItems, setPage } = usePagination(purchases, 15, [search, supplierId, from, to]);

  const live = purchases.filter((p) => p.status !== "cancelled");
  const totalBought = live.reduce((sum, p) => sum + Number(p.grand_total), 0);
  const totalDue = live.reduce((sum, p) => sum + Number(p.balance_due), 0);

  return (
    <div className="space-y-6">
      {/* primary action lives here now — "New Purchase" was removed from the sidebar */}
      <div className="flex items-center justify-end">
        <PermissionGate permission="purchases.create">
          <Link
            href="/purchases/create"
            className="inline-flex h-11 items-center gap-2 rounded-pill bg-[linear-gradient(135deg,#35609f_0%,#2f5590_100%)] px-6 text-sm font-semibold text-white shadow-hero transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            <PackagePlus className="h-5 w-5" aria-hidden /> New Purchase
          </Link>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard icon={Package} label="Purchases in this period" value={live.length} tone="purple" />
        <KpiCard icon={IndianRupee} label="Bought for" value={formatCurrency(totalBought)} tone="sky" />
        <KpiCard
          icon={Wallet}
          label="Still to pay"
          value={formatCurrency(totalDue)}
          tone={totalDue > 0 ? "coral" : "green"}
        />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="pu_search">Search</Label>
            <Input
              id="pu_search"
              placeholder="Purchase number, vendor bill or vendor…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="h-11"
            />
          </div>
          <div>
            <Label htmlFor="pu_from">From</Label>
            <Input id="pu_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 w-auto" />
          </div>
          <div>
            <Label htmlFor="pu_to">To</Label>
            <Input id="pu_to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 w-auto" />
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="pu_vendor">Vendor</Label>
            <Select id="pu_vendor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-11">
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRawSearch("");
              setSupplierId("");
              setFrom(addDaysStr(localDateString(), -90));
              setTo(localDateString());
            }}
          >
            Reset
          </Button>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No purchases in this period"
            hint="Change the dates, or record what you bought from a vendor."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-4 py-3">Purchase no.</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Vendor</th>
                    <th className="px-3 py-3">Vendor bill</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Paid</th>
                    <th className="px-3 py-3 text-right">Still to pay</th>
                    <th className="px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const due = Number(p.balance_due);
                    const paid = Number(p.paid_amount);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/purchases/detail?id=${p.id}`)}
                        className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-background"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/purchases/detail?id=${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-xs font-semibold text-primary-strong hover:underline"
                          >
                            {p.purchase_no}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(p.purchase_date)}</td>
                        <td className="px-3 py-3 font-medium text-foreground">{p.vendor_name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{p.invoice_ref ?? "—"}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(p.grand_total, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(paid, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(due, true)}
                        </td>
                        <td className="px-3 py-3">
                          {p.status === "cancelled" ? (
                            <Badge tone={purchaseStatusTone(p.status)}>Cancelled</Badge>
                          ) : (
                            <Badge tone={paymentStateTone(due, paid)}>{paymentStateLabel(due, paid)}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
