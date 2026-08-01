"use client";

import { booksApi, type DeadStockItem, type StockSummaryRow } from "@/features/books/api";
import { CsvButton, PrintButton, PrintSheet, ReportState, ReportToolbar } from "@/features/books/report-shell";
import { downloadCsv, num } from "@/features/books/report-utils";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Select } from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, formatWeight, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Clock, Gem } from "lucide-react";
import { useMemo, useState } from "react";

type Tab = "summary" | "dead";

const METAL_LABEL: Record<string, string> = { gold: "Gold", silver: "Silver", platinum: "Platinum" };
const TRACKING_LABEL: Record<string, string> = { tagged: "Tagged pieces", bulk: "Bulk / loose" };

const label = (map: Record<string, string>, key: string | null | undefined) =>
  key ? (map[key] ?? key.replace(/_/g, " ")) : "—";

const DAYS_OPTIONS = [30, 60, 90, 180, 365];

function summaryCsv(rows: StockSummaryRow[]) {
  const csv: (string | number)[][] = [
    ["Stock Summary"],
    [`As on ${localDateString()}`],
    [],
    ["Metal", "Purity", "Kind", "Items", "Pieces", "Weight (g)", "Value"],
  ];
  for (const r of rows) {
    csv.push([
      label(METAL_LABEL, r.metal),
      r.purity ?? "—",
      label(TRACKING_LABEL, r.tracking),
      num(r.items),
      num(r.qty),
      num(r.weight).toFixed(3),
      num(r.value),
    ]);
  }
  csv.push([]);
  csv.push([
    "Total",
    "",
    "",
    rows.reduce((s, r) => s + num(r.items), 0),
    rows.reduce((s, r) => s + num(r.qty), 0),
    rows.reduce((s, r) => s + num(r.weight), 0).toFixed(3),
    rows.reduce((s, r) => s + num(r.value), 0),
  ]);
  downloadCsv(`stock-summary-${localDateString()}.csv`, csv);
}

function deadCsv(items: DeadStockItem[], days: number) {
  const csv: (string | number)[][] = [
    [`Dead Stock — sitting ${days} days or longer`],
    [`As on ${localDateString()}`],
    [],
    ["Item code", "Name", "Metal", "Purity", "Net weight (g)", "Days in stock", "In stock since", "Average cost"],
  ];
  for (const i of items) {
    csv.push([
      i.item_code,
      i.name,
      label(METAL_LABEL, i.metal),
      i.purity ?? "—",
      num(i.net_weight).toFixed(3),
      num(i.days_in_stock),
      i.in_since ? i.in_since.slice(0, 10) : "",
      num(i.avg_cost),
    ]);
  }
  downloadCsv(`dead-stock-${days}-days-${localDateString()}.csv`, csv);
}

export default function StockReportPage() {
  const [tab, setTab] = useState<Tab>("summary");
  const [days, setDays] = useState(180);

  const summaryQuery = useQuery({
    queryKey: ["books", "stock-summary"],
    queryFn: () => booksApi.stockSummary(),
    enabled: tab === "summary",
  });

  const deadQuery = useQuery({
    queryKey: ["books", "dead-stock", days],
    queryFn: () => booksApi.deadStock(days),
    enabled: tab === "dead",
  });

  const rows = useMemo(() => summaryQuery.data?.summary ?? [], [summaryQuery.data]);
  const items = deadQuery.data?.items ?? [];

  /** One tile per metal — weight is what a jeweller checks first, value second. */
  const perMetal = useMemo(() => {
    const map = new Map<string, { weight: number; value: number; pieces: number }>();
    for (const r of rows) {
      const key = String(r.metal ?? "other");
      const acc = map.get(key) ?? { weight: 0, value: 0, pieces: 0 };
      acc.weight += num(r.weight);
      acc.value += num(r.value);
      acc.pieces += num(r.qty);
      map.set(key, acc);
    }
    return [...map.entries()];
  }, [rows]);

  const totals = useMemo(
    () => ({
      items: rows.reduce((s, r) => s + num(r.items), 0),
      qty: rows.reduce((s, r) => s + num(r.qty), 0),
      weight: rows.reduce((s, r) => s + num(r.weight), 0),
      value: rows.reduce((s, r) => s + num(r.value), 0),
    }),
    [rows],
  );

  const deadWeight = items.reduce((s, i) => s + num(i.net_weight), 0);
  const deadValue = items.reduce((s, i) => s + num(i.avg_cost), 0);

  return (
    <div className="space-y-6">
      <ReportToolbar title="Stock" subtitle="What is in the shop right now, and what has not moved.">
        {tab === "dead" ? (
          <div>
            <Label htmlFor="dead-days">Not sold for</Label>
            <Select
              id="dead-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-10 w-44"
            >
              {DAYS_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days or more
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <PrintButton disabled={tab === "summary" ? rows.length === 0 : items.length === 0} />
        <CsvButton
          disabled={tab === "summary" ? rows.length === 0 : items.length === 0}
          onDownload={() => (tab === "summary" ? summaryCsv(rows) : deadCsv(items, days))}
        />
      </ReportToolbar>

      <div className="flex flex-wrap gap-1 rounded-pill bg-background p-1 print:hidden">
        {(
          [
            ["summary", "Stock Summary"],
            ["dead", "Dead Stock"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <ReportState
          isLoading={summaryQuery.isLoading}
          isError={summaryQuery.isError}
          isEmpty={rows.length === 0}
          icon={Boxes}
          emptyTitle="There is no stock on hand"
          emptyHint="Record a purchase or add items to inventory and they will show up here."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
              {perMetal.map(([metal, m]) => (
                <KpiCard
                  key={metal}
                  icon={Gem}
                  label={`${label(METAL_LABEL, metal)} — ${formatCurrency(m.value, true)}`}
                  value={formatWeight(m.weight)}
                  tone={metal === "gold" ? "amber" : "gray"}
                />
              ))}
            </div>

            <PrintSheet title="Stock Summary" asOf={localDateString()}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                      <th className="px-6 py-3">Metal</th>
                      <th className="px-3 py-3">Purity</th>
                      <th className="px-3 py-3">Kind</th>
                      <th className="px-3 py-3 text-right">Items</th>
                      <th className="px-3 py-3 text-right">Pieces</th>
                      <th className="px-3 py-3 text-right">Weight</th>
                      <th className="px-6 py-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={`${r.metal}-${r.purity ?? "none"}-${r.tracking}-${i}`}
                        className="border-b border-border/50 last:border-0 hover:bg-background"
                      >
                        <td className="px-6 py-3 font-medium text-foreground">{label(METAL_LABEL, r.metal)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{r.purity ?? "—"}</td>
                        <td className="px-3 py-3">
                          <Badge tone={r.tracking === "tagged" ? "purple" : "gray"}>
                            {label(TRACKING_LABEL, r.tracking)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{num(r.items)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{num(r.qty)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatWeight(r.weight)}</td>
                        <td className="px-6 py-3 text-right font-medium tabular-nums text-foreground">
                          {formatCurrency(num(r.value), true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-background text-base font-bold">
                      <td className="px-6 py-4 text-foreground" colSpan={3}>
                        Total
                      </td>
                      <td className="px-3 py-4 text-right tabular-nums text-foreground">{totals.items}</td>
                      <td className="px-3 py-4 text-right tabular-nums text-foreground">{totals.qty}</td>
                      <td className="px-3 py-4 text-right tabular-nums text-foreground">{formatWeight(totals.weight)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-foreground">
                        {formatCurrency(totals.value, true)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </PrintSheet>
          </div>
        </ReportState>
      ) : (
        <ReportState
          isLoading={deadQuery.isLoading}
          isError={deadQuery.isError}
          isEmpty={items.length === 0}
          icon={Clock}
          emptyTitle="Nothing has been sitting that long"
          emptyHint="No tagged piece has been in stock for this many days. Try a shorter period."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3 print:hidden">
              <KpiCard icon={Clock} label="Pieces not moving" value={items.length} tone="coral" />
              <KpiCard icon={Gem} label="Weight stuck in stock" value={formatWeight(deadWeight)} tone="amber" />
              <KpiCard icon={Boxes} label="Money stuck in stock" value={formatCurrency(deadValue, true)} tone="gray" />
            </div>

            <PrintSheet title={`Dead Stock — ${days} days or longer`} asOf={localDateString()}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                      <th className="px-6 py-3">Item code</th>
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Metal</th>
                      <th className="px-3 py-3">Purity</th>
                      <th className="px-3 py-3 text-right">Net weight</th>
                      <th className="px-3 py-3 text-right">Days in stock</th>
                      <th className="px-6 py-3">In stock since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                        <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{i.item_code}</td>
                        <td className="px-3 py-3 font-medium text-foreground">{i.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{label(METAL_LABEL, i.metal)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{i.purity ?? "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatWeight(i.net_weight)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span
                            className={cn(
                              "tabular-nums font-semibold",
                              num(i.days_in_stock) >= 365 ? "text-attention-strong" : "text-warning-strong",
                            )}
                          >
                            {num(i.days_in_stock)}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">{formatDate(i.in_since)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PrintSheet>
          </div>
        </ReportState>
      )}
    </div>
  );
}
