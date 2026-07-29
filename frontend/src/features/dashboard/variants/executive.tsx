"use client";

import type { ExecutivePayload } from "@/features/reports/api";
import { CHART } from "@/features/reports/api";
import { AlertRow, ListCard, QuickActions, Row } from "@/features/dashboard/widgets";
import { Card } from "@/shared/ui/card";
import { KpiCard } from "@/shared/ui/kpi-card";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { Banknote, Boxes, FileText, Gift, IndianRupee, PackagePlus, Receipt, TrendingUp, Wallet } from "lucide-react";
import dynamic from "next/dynamic";

const CashflowChart = dynamic(() => import("@/features/reports/dashboard-charts"), {
  ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Loading chart…</div>,
});

export function ExecutiveDashboard({ data }: { data: ExecutivePayload }) {
  return (
    <>
      <QuickActions
        actions={[
          { label: "New invoice", href: "/invoices/create", icon: FileText, permission: "invoices.create" },
          { label: "Add stock", href: "/inventory?add=1", icon: PackagePlus, permission: "inventory.manage" },
        ]}
      />

      <AlertRow
        tiles={[
          { key: "overdue_invoices", count: data.alerts.overdue_invoices, label: "Overdue invoices", href: "/invoices", icon: Receipt },
          { key: "low_stock", count: data.alerts.low_stock, label: "Low stock items", href: "/inventory?low=1", icon: Boxes },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={IndianRupee} label="Revenue this month" value={formatCurrency(data.kpis.month_revenue)} tint="green" />
        <KpiCard icon={Wallet} label="Expenses this month" value={formatCurrency(data.kpis.month_expenses)} tint="grey" />
        <KpiCard icon={TrendingUp} label="Profit this month" value={formatCurrency(data.kpis.month_net)} tint={Number(data.kpis.month_net) >= 0 ? "green" : "red"} />
        <KpiCard icon={Banknote} label="Money to collect" value={formatCurrency(data.kpis.outstanding)} tint="grey" />
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Cashflow · 12 months</h3>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CHART.income }} />In</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CHART.expense }} />Out</span>
          </div>
        </div>
        <CashflowChart data={data.cashflow} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Recent payments" href="/invoices" empty="No payments yet.">
          {data.recent_payments.map((p) => (
            <Row key={p.id} left={<span className="text-foreground">{p.customer_name}</span>} right={formatCurrency(p.amount)} sub={`${p.invoice_no} · ${p.payment_mode}`} rightTone="green" />
          ))}
        </ListCard>
        <ListCard title="Recent expenses" href="/expenses" empty="No expenses recorded.">
          {data.recent_expenses.map((e) => (
            <Row key={e.id} left={<span className="text-foreground">{e.paid_to || e.category_name}</span>} right={formatCurrency(e.amount)} sub={e.category_name} rightTone="coral" />
          ))}
        </ListCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard title="Low stock" href="/inventory?low=1" empty="Stock levels are healthy.">
          {data.low_stock.map((s) => (
            <Row key={s.id} left={<span className="text-foreground">{s.name}</span>} right={`${Number(s.current_stock)} ${s.unit ?? ""}`} sub={s.item_code} rightTone="coral" />
          ))}
        </ListCard>

        <ListCard title="Upcoming occasions" href="/customers" empty="Nothing in the next 7 days.">
          {data.upcoming_occasions.map((o, i) => (
            <Row key={i} left={<span className="inline-flex items-center gap-2 text-foreground"><Gift className="h-3.5 w-3.5 text-primary-strong" aria-hidden />{o.name}</span>} right={formatDate(o.on_date)} sub={o.occasion} />
          ))}
        </ListCard>
      </div>
    </>
  );
}
