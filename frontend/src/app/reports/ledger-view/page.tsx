"use client";

import {
  booksApi,
  type LedgerRow,
  type LedgerViewMode,
  type LedgerViewReport,
  type StockBucket,
} from "@/features/books/api";
import {
  CsvButton,
  DateRangeControls,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
} from "@/features/books/report-shell";
import { downloadCsv, fiscalYear, num } from "@/features/books/report-utils";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { KpiCard } from "@/shared/ui/kpi-card";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, formatWeight } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Eye, FileSpreadsheet, Receipt, ShieldCheck, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const MODE_LABEL: Record<LedgerViewMode, string> = {
  full: "Full Ledger",
  gst: "GST Ledger",
};

function fmtQty(value: unknown): string {
  return num(value as number | string).toFixed(3);
}

function neg(bucket: StockBucket): StockBucket {
  return {
    qty: -bucket.qty,
    weight: -bucket.weight,
    value: -bucket.value,
  };
}

function stockLines(ledger: LedgerViewReport): { label: string; bucket: StockBucket; total?: boolean; muted?: boolean }[] {
  const gst = ledger.view === "gst";
  return [
    { label: gst ? "Adjusted purchases" : "Purchases", bucket: ledger.stock.visible_purchases },
    { label: gst ? "GST-visible sales" : "Sales", bucket: neg(ledger.stock.visible_sales) },
    { label: "Other stock movement", bucket: ledger.stock.other_movements, muted: true },
    { label: "Period net movement", bucket: ledger.stock.period_net, total: true },
    { label: "Stock balance as on end date", bucket: ledger.stock.live_balance, total: true },
  ];
}

function totals(rows: LedgerRow[]) {
  return rows.reduce(
    (acc, row) => ({
      qty: acc.qty + num(row.qty),
      weight: acc.weight + num(row.weight),
      taxable: acc.taxable + num(row.taxable_value),
      tax: acc.tax + num(row.tax_total),
      total: acc.total + num(row.total),
    }),
    { qty: 0, weight: 0, taxable: 0, tax: 0, total: 0 },
  );
}

function buildCsv(ledger: LedgerViewReport, from: string, to: string) {
  const rows: (string | number)[][] = [[MODE_LABEL[ledger.view]], [`${from} to ${to}`], []];
  const purchaseLabel = ledger.view === "gst" ? "Adjusted purchases" : "Purchases";

  rows.push([purchaseLabel]);
  rows.push(["Date", "Purchase no", "Vendor", "Tax bucket", "Qty", "Weight (g)", "Taxable value", "Tax", "Total"]);
  for (const row of ledger.purchases) {
    rows.push([
      row.purchase_date ?? "",
      row.purchase_no ?? "",
      row.party_name,
      row.tax_treatments ?? "",
      fmtQty(row.qty),
      num(row.weight).toFixed(3),
      num(row.taxable_value),
      num(row.tax_total),
      num(row.total),
    ]);
  }

  rows.push([]);
  rows.push(["Sales"]);
  rows.push(["Date", "Invoice no", "Customer", "Tax bucket", "Qty", "Weight (g)", "Taxable value", "Tax", "Total"]);
  for (const row of ledger.sales) {
    rows.push([
      row.invoice_date ?? "",
      row.invoice_no ?? "",
      row.party_name,
      row.tax_treatments ?? "",
      fmtQty(row.qty),
      num(row.weight).toFixed(3),
      num(row.taxable_value),
      num(row.tax_total),
      num(row.total),
    ]);
  }

  rows.push([]);
  rows.push(["Stock reconciliation"]);
  rows.push(["Line", "Qty", "Weight (g)", "Value"]);
  for (const line of stockLines(ledger)) {
    rows.push([line.label, line.bucket.qty.toFixed(3), line.bucket.weight.toFixed(3), line.bucket.value]);
  }

  downloadCsv(`ledger-view-${ledger.view}-${from}-to-${to}.csv`, rows);
}

function LedgerTable({ title, kind, rows }: { title: string; kind: "purchase" | "sale"; rows: LedgerRow[] }) {
  const t = totals(rows);
  return (
    <section className="border-b border-border">
      <div className="px-6 pb-2 pt-5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-5 text-sm text-muted-foreground">No rows in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                <th className="px-6 py-3">Date</th>
                <th className="px-3 py-3">{kind === "purchase" ? "Purchase no" : "Invoice no"}</th>
                <th className="px-3 py-3">{kind === "purchase" ? "Vendor" : "Customer"}</th>
                <th className="px-3 py-3">Tax bucket</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Weight</th>
                <th className="px-3 py-3 text-right">Taxable value</th>
                <th className="px-3 py-3 text-right">Tax</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${kind}-${row.id}`}
                  className={cn(
                    "border-b border-border/50 last:border-0 hover:bg-background",
                    row.is_adjustment && "bg-background text-muted-foreground",
                  )}
                >
                  <td className="px-6 py-2.5 text-foreground">
                    {formatDate(kind === "purchase" ? row.purchase_date : row.invoice_date)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {kind === "purchase" ? row.purchase_no : row.invoice_no}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">{row.party_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.tax_treatments ?? "GST"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtQty(row.qty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{formatWeight(row.weight)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {formatCurrency(num(row.taxable_value), true)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(num(row.tax_total), true)}
                  </td>
                  <td className="px-6 py-2.5 text-right font-medium tabular-nums text-foreground">
                    {formatCurrency(num(row.total), true)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background font-semibold">
                <td className="px-6 py-3 text-foreground" colSpan={4}>
                  Total
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{fmtQty(t.qty)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatWeight(t.weight)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatCurrency(t.taxable, true)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatCurrency(t.tax, true)}</td>
                <td className="px-6 py-3 text-right tabular-nums text-foreground">{formatCurrency(t.total, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function StockReconciliation({ ledger }: { ledger: LedgerViewReport }) {
  return (
    <section>
      <div className="px-6 pb-2 pt-5">
        <h3 className="text-sm font-semibold text-foreground">Stock Reconciliation</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              <th className="px-6 py-3">Line</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-3 py-3 text-right">Weight</th>
              <th className="px-6 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {stockLines(ledger).map((line) => (
              <tr
                key={line.label}
                className={cn(
                  "border-b border-border/50 last:border-0",
                  line.total && "bg-background font-semibold",
                  line.muted && "text-muted-foreground",
                )}
              >
                <td className="px-6 py-2.5 text-foreground">{line.label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{line.bucket.qty.toFixed(3)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatWeight(line.bucket.weight)}</td>
                <td className="px-6 py-2.5 text-right tabular-nums">{formatCurrency(line.bucket.value, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LedgerViewPage() {
  const fy = fiscalYear();
  const [range, setRange] = useState({ from: fy.from, to: fy.to });
  const [mode, setMode] = useState<LedgerViewMode>("gst");
  const { user, isLoading: authLoading } = useAuth();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const gstRestricted = user?.username !== "Admin";
  const canFull = can("reports.accounting") && !gstRestricted;
  const canGst = can("reports.gst");

  useEffect(() => {
    if (!permissionsLoading && !authLoading) {
      setMode(canFull ? "full" : "gst");
    }
  }, [authLoading, canFull, permissionsLoading]);

  const modeAllowed = mode === "full" ? canFull : canGst;
  const anyAllowed = canFull || canGst;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "ledger-view", mode, range.from, range.to],
    queryFn: () => booksApi.ledgerView(range.from, range.to, mode),
    enabled: !permissionsLoading && !authLoading && anyAllowed && modeAllowed,
  });

  const ledger = data?.ledger;
  const purchaseTotals = useMemo(() => totals(ledger?.purchases ?? []), [ledger]);
  const saleTotals = useMemo(() => totals(ledger?.sales ?? []), [ledger]);

  if (!permissionsLoading && !authLoading && !anyAllowed) {
    return (
      <Card>
        <EmptyState icon={ShieldCheck} title="No ledger access" hint="Ask an owner to grant GST or accounting reports." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ReportToolbar
        title="Ledger Views"
        subtitle={mode === "full" ? "All purchases, sales, and stock movement." : "GST-facing rows with stock reconciliation."}
      >
        <div className="flex rounded-pill bg-background p-1">
          {canFull ? (
            <Button variant={mode === "full" ? "primary" : "ghost"} size="sm" onClick={() => setMode("full")}>
              <Eye className="h-4 w-4" aria-hidden /> Full
            </Button>
          ) : null}
          {canGst ? (
            <Button variant={mode === "gst" ? "primary" : "ghost"} size="sm" onClick={() => setMode("gst")}>
              <Receipt className="h-4 w-4" aria-hidden /> GST
            </Button>
          ) : null}
        </div>
        <DateRangeControls idPrefix="ledger-view" from={range.from} to={range.to} onChange={setRange} />
        <PrintButton disabled={!ledger} />
        <CsvButton disabled={!ledger} onDownload={() => ledger && buildCsv(ledger, range.from, range.to)} />
      </ReportToolbar>

      <ReportState
        isLoading={permissionsLoading || authLoading || isLoading || (anyAllowed && !modeAllowed)}
        isError={modeAllowed && (isError || !ledger)}
        isEmpty={Boolean(ledger) && (ledger?.purchases.length ?? 0) === 0 && (ledger?.sales.length ?? 0) === 0}
        icon={FileSpreadsheet}
        emptyTitle="No ledger rows in this period"
        emptyHint="Record a purchase or finalise a bill, or widen the date range."
      >
        {ledger ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
              <KpiCard
                icon={ShoppingBag}
                label={ledger.view === "gst" ? "Adjusted purchases" : "Visible purchases"}
                value={formatCurrency(purchaseTotals.total, true)}
                tone="sky"
              />
              <KpiCard icon={Receipt} label="Visible sales" value={formatCurrency(saleTotals.total, true)} tone="green" />
              <KpiCard icon={Boxes} label="Stock balance" value={fmtQty(ledger.stock.live_balance.qty)} tone="amber" />
              <KpiCard
                icon={ShieldCheck}
                label="Ledger mode"
                value={ledger.view === "gst" ? "GST" : "Full"}
                tone={ledger.view === "gst" ? "gray" : "purple"}
              />
            </div>

            <PrintSheet title={MODE_LABEL[ledger.view]} from={range.from} to={range.to}>
              <LedgerTable title={ledger.view === "gst" ? "Adjusted purchases" : "Purchases"} kind="purchase" rows={ledger.purchases} />
              <LedgerTable title="Sales" kind="sale" rows={ledger.sales} />
              <StockReconciliation ledger={ledger} />
            </PrintSheet>
          </div>
        ) : null}
      </ReportState>
    </div>
  );
}
