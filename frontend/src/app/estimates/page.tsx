"use client";

import { estimateStatusLabel, estimateStatusTone, estimatesApi } from "@/features/billing/api";
import { PermissionGate, usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "converted", label: "Turned into a bill" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
];

/**
 * Estimates are price quotations, not bills: no stock moves and nothing is
 * posted to the books until one is turned into a bill.
 */
export default function EstimatesPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const today = localDateString();

  const { data, isLoading } = useQuery({
    queryKey: ["estimates", "list", { status, search }],
    queryFn: () => estimatesApi.list({ status: status || undefined, search: search || undefined }),
  });

  const estimates = data?.estimates ?? [];
  const { page, totalPages, pageItems, setPage } = usePagination(estimates, 12, [status, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">Estimates</h2>
        <p className="text-sm text-muted-foreground">A price slip for the customer — nothing is sold until it becomes a bill.</p>
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key)}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-sm font-medium transition-colors",
                  status === tab.key ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:bg-background",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Search estimate number or customer…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-10 w-full max-w-xs"
            aria-label="Search estimates"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("");
              setRawSearch("");
            }}
          >
            Reset
          </Button>
          <div className="ml-auto">
            <PermissionGate permission="estimates.create">
              <Link
                href="/estimates/create"
                className="inline-flex h-8 items-center gap-2 rounded-pill bg-[linear-gradient(135deg,#35609f_0%,#2f5590_100%)] px-4 text-xs font-semibold text-white shadow-hero transition-all hover:-translate-y-0.5 hover:brightness-110"
              >
                <Plus className="h-4 w-4" aria-hidden /> New estimate
              </Link>
            </PermissionGate>
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : estimates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No estimates yet"
            hint={can("estimates.create") ? "Quote a price for a customer without touching stock." : "Nothing matches these filters."}
          />
        ) : (
          <>
            <div className="hidden grid-cols-[1.1fr_1.4fr_1fr_1fr_0.9fr] gap-4 border-b border-border bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground md:grid">
              <span>Estimate no.</span>
              <span>Customer</span>
              <span className="text-right">Total</span>
              <span>Valid until</span>
              <span className="text-right">Status</span>
            </div>
            {pageItems.map((estimate) => {
              // the list flags it, but re-check locally so the badge never lags
              const expired =
                estimate.status === "open" && estimate.valid_until !== null && estimate.valid_until < today;
              const badgeStatus = expired ? "expired" : estimate.status;
              return (
                <Link
                  key={estimate.id}
                  href={`/estimates/detail?id=${estimate.id}`}
                  className="grid grid-cols-2 gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background md:grid-cols-[1.1fr_1.4fr_1fr_1fr_0.9fr] md:items-center"
                >
                  <span className="font-mono text-sm font-medium text-foreground">
                    {estimate.estimate_no}
                    <span className="block font-sans text-xs text-muted-foreground">{formatDate(estimate.estimate_date)}</span>
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {estimate.customer_name}
                    {estimate.invoice_no ? (
                      <span className="block font-mono text-xs text-success-strong">Billed as {estimate.invoice_no}</span>
                    ) : null}
                  </span>
                  <span className="text-right text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(estimate.grand_total)}
                  </span>
                  <span className={cn("text-xs", expired ? "font-semibold text-warning-strong" : "text-muted-foreground")}>
                    {estimate.valid_until ? formatDate(estimate.valid_until) : "—"}
                  </span>
                  <span className="flex justify-end">
                    <Badge tone={estimateStatusTone(badgeStatus)}>{estimateStatusLabel(badgeStatus)}</Badge>
                  </span>
                </Link>
              );
            })}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      {estimates.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {estimates.filter((e) => e.status === "open").length} open · an estimate never affects stock or the accounts.
        </p>
      ) : null}
    </div>
  );
}
