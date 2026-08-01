"use client";

import { reportsApi, TAB_META, CHART, type ReportTab } from "@/features/reports/api";
import { usePermissions } from "@/lib/permissions";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpenText,
  Boxes,
  ChartLine,
  Download,
  FileSpreadsheet,
  HandCoins,
  IndianRupee,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TrendChart = dynamic(() => import("@/features/reports/report-trend-chart"), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>,
});

const N = (v: unknown) => Number(v ?? 0);
const arr = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

function fyStart() {
  const now = new Date();
  const y = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
}

/**
 * The books — ledger-derived statements, each gated on its own permission.
 * Descriptions are written for the shop owner, not the accountant.
 */
const FINANCIAL_REPORTS: {
  href: string;
  title: string;
  description: string;
  permission?: string;
  anyOf?: string[];
  icon: LucideIcon;
}[] = [
  {
    href: "/reports/pnl",
    title: "Profit & Loss",
    description: "What the shop earned and what it spent.",
    permission: "reports.pnl",
    icon: ChartLine,
  },
  {
    href: "/reports/trial-balance",
    title: "Trial Balance",
    description: "Every ledger's debit and credit totals.",
    permission: "reports.accounting",
    icon: Scale,
  },
  {
    href: "/reports/gst",
    title: "GST Summary",
    description: "Tax collected, tax paid, and what is due.",
    permission: "reports.gst",
    icon: Receipt,
  },
  {
    href: "/reports/ledger-view",
    title: "Ledger Views",
    description: "Full books or GST-facing ledger, by role.",
    anyOf: ["reports.accounting", "reports.gst"],
    icon: FileSpreadsheet,
  },
  {
    href: "/reports/outstanding",
    title: "Outstanding",
    description: "What customers owe you and what you owe vendors.",
    permission: "reports.outstanding",
    icon: HandCoins,
  },
  {
    href: "/reports/stock",
    title: "Stock",
    description: "What is in the shop, and what has not sold.",
    permission: "reports.stock",
    icon: Boxes,
  },
  {
    href: "/reports/daybook",
    title: "Day Book",
    description: "Every entry recorded on a single day.",
    permission: "reports.accounting",
    icon: BookOpenText,
  },
];

function FinancialReports() {
  const { can, canAny } = usePermissions();
  const allowed = FINANCIAL_REPORTS.filter((r) => (r.permission ? can(r.permission) : canAny(...(r.anyOf ?? []))));
  if (allowed.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-foreground">Financial Reports</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowed.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-card bg-card p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-raised"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("revenue");
  const [from, setFrom] = useState(fyStart());
  const [to, setTo] = useState(localDateString());
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await reportsApi.exportCsv(tab, from, to);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const { data: tabsData } = useQuery({ queryKey: ["reports", "tabs"], queryFn: () => reportsApi.tabs() });
  // the server may still advertise retired tabs — only render the ones this app still has
  const allowedTabs = (tabsData?.tabs ?? []).filter((t) => TAB_META[t] !== undefined);
  // land on the first tab the user is actually allowed to see (avoids a stuck skeleton on revenue)
  useEffect(() => {
    if (allowedTabs.length && !allowedTabs.includes(tab)) setTab(allowedTabs[0]);
  }, [allowedTabs, tab]);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", tab, from, to],
    queryFn: () => reportsApi.tab(tab, from, to),
    enabled: allowedTabs.includes(tab),
  });
  const d = (data?.data ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <FinancialReports />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-pill bg-background p-1">
          {allowedTabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-pill px-4 py-1.5 text-sm font-medium transition-colors", tab === t ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground")}>
              {TAB_META[t].label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" />
          <span className="text-muted-foreground">→</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" />
          <Button variant="secondary" size="sm" onClick={() => void exportCsv()} loading={exporting}>
            <Download className="h-3.5 w-3.5" aria-hidden /> CSV
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <SkeletonCard />
      ) : tab === "revenue" ? (
        <RevenueTab d={d} />
      ) : tab === "expenses" ? (
        <ExpensesTab d={d} />
      ) : tab === "customers" ? (
        <CustomersTab d={d} />
      ) : (
        <InventoryTab d={d} />
      )}
    </div>
  );
}

function BarList({ rows, valueFmt = formatCurrency, color = CHART.primary }: { rows: { label: string; value: number }[]; valueFmt?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No data.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-muted-foreground">{r.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-background">
            <div className="h-full rounded-md" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? "2px" : 0, background: color }} />
          </div>
          <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{valueFmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-foreground">{title}</h3>
      {children}
    </Card>
  );
}

function RevenueTab({ d }: { d: Record<string, unknown> }) {
  const trend = arr<Record<string, unknown>>(d.trend).map((r) => ({ month: String(r.m), billed: N(r.billed), collected: N(r.collected) }));
  const aging = (d.aging ?? {}) as Record<string, unknown>;
  return (
    <div className="space-y-6">
      <Panel title="Billed vs Collected">
        <TrendChart data={trend} series={[{ key: "billed", label: "Billed", color: CHART.primary }, { key: "collected", label: "Collected", color: CHART.income }]} />
      </Panel>
      <div className="grid gap-4 sm:grid-cols-4">
        {([["0–30 days", "d0_30"], ["31–60", "d31_60"], ["61–90", "d61_90"], ["90+", "d90p"]] as const).map(([label, key], i) => (
          <KpiCard key={key} icon={IndianRupee} label={`Outstanding ${label}`} value={formatCurrency(N(aging[key]))} tone={i >= 2 ? "coral" : "amber"} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top customers by revenue"><BarList rows={arr<Record<string, unknown>>(d.top_customers).map((r) => ({ label: String(r.name), value: N(r.revenue) }))} color={CHART.income} /></Panel>
        <Panel title="Collection by mode"><BarList rows={arr<Record<string, unknown>>(d.by_mode).map((r) => ({ label: String(r.mode), value: N(r.total) }))} /></Panel>
      </div>
    </div>
  );
}

function ExpensesTab({ d }: { d: Record<string, unknown> }) {
  const totals = (d.totals ?? {}) as Record<string, unknown>;
  const rev = N(totals.revenue), exp = N(totals.expense);
  const pl = arr<Record<string, unknown>>(d.pl_trend).map((r) => ({ month: String(r.m), revenue: N(r.revenue), expense: N(r.expense) }));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={TrendingUp} label="Revenue" value={formatCurrency(rev)} tone="green" />
        <KpiCard icon={TrendingDown} label="Expenses" value={formatCurrency(exp)} tone="coral" />
        <KpiCard icon={IndianRupee} label="Net P&L" value={formatCurrency(rev - exp)} tone={rev - exp >= 0 ? "purple" : "coral"} />
      </div>
      <Panel title="Revenue vs Expenses (P&L)">
        <TrendChart data={pl} series={[{ key: "revenue", label: "Revenue", color: CHART.income }, { key: "expense", label: "Expense", color: CHART.expense }]} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By category"><BarList rows={arr<Record<string, unknown>>(d.by_category).map((r) => ({ label: String(r.name), value: N(r.total) }))} color={CHART.expense} /></Panel>
        <Panel title="Fixed vs Variable"><BarList rows={arr<Record<string, unknown>>(d.fixed_variable).map((r) => ({ label: String(r.type), value: N(r.total) }))} /></Panel>
      </div>
    </div>
  );
}

function CustomersTab({ d }: { d: Record<string, unknown> }) {
  const withRevenue = Boolean(d.with_revenue);
  return (
    <div className="space-y-6">
      <Panel title={withRevenue ? "Top customers by revenue" : "Top customers by orders"}>
        <BarList
          rows={arr<Record<string, unknown>>(d.top_customers).map((r) => ({ label: String(r.name), value: withRevenue ? N(r.revenue) : N(r.orders) }))}
          valueFmt={withRevenue ? formatCurrency : (v) => String(v)}
          color={CHART.income}
        />
      </Panel>
    </div>
  );
}

function InventoryTab({ d }: { d: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      <Panel title="Stock valuation by type"><BarList rows={arr<Record<string, unknown>>(d.valuation).map((r) => ({ label: String(r.item_type).replace("_", " "), value: N(r.value) }))} /></Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Stock by vendor (purchase value)"><BarList rows={arr<Record<string, unknown>>(d.by_vendor).map((r) => ({ label: String(r.name), value: N(r.spend) }))} color={CHART.expense} /></Panel>
        <Panel title="Dead stock (no movement 90d)"><BarList rows={arr<Record<string, unknown>>(d.dead_stock).map((r) => ({ label: String(r.name), value: N(r.value) }))} color={CHART.warning} /></Panel>
      </div>
    </div>
  );
}
