"use client";

import type { SalesPayload } from "@/features/reports/api";
import { CHART } from "@/features/reports/api";
import { AlertRow, ListCard, QuickActions, Row } from "@/features/dashboard/widgets";
import { Card } from "@/shared/ui/card";
import { KpiCard } from "@/shared/ui/kpi-card";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { Banknote, Boxes, FileText, Gift, IndianRupee, Receipt } from "lucide-react";
import dynamic from "next/dynamic";

const CollectionsChart = dynamic(() => import("@/features/reports/dashboard-charts"), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>,
});

export function SalesDashboard({ data }: { data: SalesPayload }) {
  // Reuse the cashflow area chart as a single collections series (no spend visibility).
  const series = data.collections.map((c) => ({ month: c.month, income: c.collected, expense: 0 }));
  return (
    <>
      <QuickActions
        actions={[
          { label: "New sale", href: "/invoices/create", icon: FileText, permission: "invoices.create" },
          { label: "Take payment", href: "/invoices", icon: Banknote, permission: "payments.create" },
        ]}
      />

      <AlertRow
        tiles={[
          { key: "overdue_invoices", count: data.alerts.overdue_invoices, label: "Overdue invoices", href: "/invoices", icon: Receipt },
          { key: "low_stock", count: data.alerts.low_stock, label: "Low stock items", href: "/inventory?low=1", icon: Boxes },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        <KpiCard icon={IndianRupee} label="Collections this month" value={formatCurrency(data.kpis.month_collections)} tint="green" />
        <KpiCard icon={Banknote} label="Money to collect" value={formatCurrency(data.kpis.outstanding)} tint="grey" />
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Collections · 12 months</h3>
          <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: CHART.income }} />Collected</span>
        </div>
        <CollectionsChart data={series} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Recent payments" href="/invoices" empty="No payments yet.">
          {data.recent_payments.map((p) => (
            <Row key={p.id} left={<span className="text-foreground">{p.customer_name}</span>} right={formatCurrency(p.amount)} sub={`${p.invoice_no} · ${p.payment_mode}`} rightTone="green" />
          ))}
        </ListCard>

        <ListCard title="Upcoming occasions — reach out" href="/customers" empty="Nothing in the next 7 days.">
          {data.upcoming_occasions.map((o, i) => (
            <Row key={i} left={<span className="inline-flex items-center gap-2 text-foreground"><Gift className="h-3.5 w-3.5 text-primary-strong" aria-hidden />{o.name}</span>} right={formatDate(o.on_date)} sub={o.occasion} />
          ))}
        </ListCard>
      </div>
    </>
  );
}
