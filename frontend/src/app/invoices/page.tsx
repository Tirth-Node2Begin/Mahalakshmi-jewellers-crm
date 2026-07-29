"use client";

import { billingApi, invoiceStatusLabel, invoiceStatusTone } from "@/features/billing/api";
import { num } from "@/features/billing/calc";
import { PermissionGate } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, Files, IndianRupee, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "All" },
  { key: "draft", label: "On hold" },
  { key: "final", label: "Final" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BillsPage() {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "list", { status, from, to, search }],
    queryFn: () =>
      billingApi.list({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search || undefined,
      }),
  });

  const invoices = data?.invoices ?? [];
  const { page, totalPages, pageItems, setPage } = usePagination(invoices, 12, [status, from, to, search]);

  // headline numbers off the rows on screen — final bills only, drafts are not sales
  const finals = invoices.filter((i) => i.status === "final");
  const billed = finals.reduce((sum, i) => sum + num(i.grand_total), 0);
  const collected = finals.reduce((sum, i) => sum + num(i.paid_amount), 0);
  const drafts = invoices.filter((i) => i.status === "draft").length;

  const resetFilters = () => {
    setStatus("");
    setFrom("");
    setTo("");
    setRawSearch("");
  };

  return (
    <div className="space-y-6">
      {!isLoading && data && !data.rates_set_today ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-warning-strong/30 bg-warning-soft p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-strong" aria-hidden />
          <p className="flex-1 text-sm font-medium text-warning-strong">Today&apos;s rates are not set yet.</p>
          <Link href="/rates" className="text-sm font-semibold text-warning-strong underline">
            Set them now
          </Link>
        </div>
      ) : null}

      {/* primary action lives here now — "New Bill" was removed from the sidebar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/estimates"
          className="inline-flex h-11 items-center gap-2 rounded-pill border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-background"
        >
          <FileText className="h-4 w-4" aria-hidden /> Estimates
        </Link>
        <PermissionGate permission="invoices.create">
          <Link
            href="/invoices/create"
            className="inline-flex h-11 items-center gap-2 rounded-pill bg-[linear-gradient(135deg,#35609f_0%,#2f5590_100%)] px-6 text-sm font-semibold text-white shadow-hero transition-all hover:-translate-y-0.5 hover:brightness-110"
          >
            <Plus className="h-5 w-5" aria-hidden /> New Bill
          </Link>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={IndianRupee} label="Billed" value={formatCurrency(billed)} tone="purple" />
        <KpiCard icon={Wallet} label="Received" value={formatCurrency(collected)} tone="green" />
        <KpiCard icon={FileText} label="Balance due" value={formatCurrency(billed - collected)} tone="coral" />
        <KpiCard
          icon={Files}
          label="On hold"
          value={drafts}
          tone="gray"
          onClick={() => setStatus(status === "draft" ? "" : "draft")}
          active={status === "draft"}
        />
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
            placeholder="Search bill number, customer or phone…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-10 w-full max-w-xs"
            aria-label="Search bills"
          />
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" aria-label="From date" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" aria-label="To date" />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No bills here" hint="Change the filters, or start a new bill at the counter." />
        ) : (
          <>
            <div className="hidden grid-cols-[1.2fr_1.5fr_1fr_1fr_0.9fr_0.8fr] gap-4 border-b border-border bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground md:grid">
              <span>Bill no.</span>
              <span>Customer</span>
              <span className="text-right">Total</span>
              <span className="text-right">Received / due</span>
              <span>Date</span>
              <span className="text-right">Status</span>
            </div>
            {pageItems.map((invoice) => {
              const balance = num(invoice.grand_total) - num(invoice.paid_amount);
              const isFinal = invoice.status === "final";
              return (
                <Link
                  key={invoice.id}
                  href={invoice.status === "draft" ? `/invoices/create?id=${invoice.id}` : `/invoices/detail?id=${invoice.id}`}
                  className="grid grid-cols-2 gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background md:grid-cols-[1.2fr_1.5fr_1fr_1fr_0.9fr_0.8fr] md:items-center"
                >
                  <span className="font-mono text-sm font-medium text-foreground">
                    {invoice.invoice_no ?? <span className="font-sans text-muted-foreground">Not numbered</span>}
                  </span>
                  <span className="truncate text-sm text-foreground">
                    {invoice.customer_name}
                    {invoice.customer_mobile ? (
                      <span className="block text-xs text-muted-foreground">{invoice.customer_mobile}</span>
                    ) : null}
                  </span>
                  <span className="text-right text-sm font-medium tabular-nums text-foreground">
                    {formatCurrency(invoice.grand_total)}
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {isFinal ? (
                      balance > 0.005 ? (
                        <>
                          <span className="block text-muted-foreground">{formatCurrency(invoice.paid_amount)} received</span>
                          <span className="block font-semibold text-attention-strong">{formatCurrency(balance)} due</span>
                        </>
                      ) : (
                        <span className="font-medium text-success-strong">Paid in full</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(invoice.invoice_date)}</span>
                  <span className="flex justify-end">
                    <Badge tone={invoiceStatusTone(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
                  </span>
                </Link>
              );
            })}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
