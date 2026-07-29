"use client";

import type { InventoryPayload } from "@/features/reports/api";
import { AlertRow, ListCard, QuickActions, Row, ValueBars } from "@/features/dashboard/widgets";
import { Card } from "@/shared/ui/card";
import { KpiCard } from "@/shared/ui/kpi-card";
import { formatCurrency } from "@/shared/utils/format";
import { ArrowDownUp, Boxes, Coins, Gem, Hammer, Layers, Package, PackagePlus, PackageSearch, ShoppingCart, SlidersHorizontal, Truck } from "lucide-react";

const REASON_LABEL: Record<string, string> = {
  purchase: "Purchase", production: "Production in", adjustment_in: "Adjustment +",
  sale_reversal: "Sale reversal", sale: "Sale", work_issue: "Issued to work",
  production_consume: "Consumed", adjustment_out: "Adjustment −", damage: "Damage",
  purchase_reversal: "Purchase reversal",
};

export function InventoryDashboard({ data }: { data: InventoryPayload }) {
  return (
    <>
      <QuickActions
        actions={[
          { label: "Add stock item", href: "/inventory?add=1", icon: PackagePlus, permission: "inventory.manage" },
          { label: "Adjust stock", href: "/inventory", icon: SlidersHorizontal, permission: "inventory.adjust" },
          { label: "Record purchase", href: "/vendors", icon: ShoppingCart, permission: "vendors.manage" },
          { label: "Vendors", href: "/vendors", icon: Truck, permission: "vendors.read" },
        ]}
      />

      <AlertRow
        tiles={[
          { key: "low_stock", count: data.alerts.low_stock, label: "Low stock items", href: "/inventory?low=1", icon: Boxes },
          { key: "dead_stock", count: data.alerts.dead_stock, label: "Dead stock (90d idle)", href: "/inventory", icon: PackageSearch },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Gem} label="Stock value" value={formatCurrency(data.kpis.stock_value)} tone="purple" />
        <KpiCard icon={Coins} label="Raw materials" value={formatCurrency(data.kpis.raw_value)} tone="amber" />
        <KpiCard icon={Package} label="Finished stock" value={formatCurrency(data.kpis.finished_value)} tone="sky" />
        <KpiCard icon={Boxes} label="Low-stock items" value={data.kpis.low_stock_count} tone="coral" />
        <KpiCard icon={Hammer} label="In production" value={data.kpis.orders_in_production} tone="purple" />
        <KpiCard icon={Layers} label="Stock in this month" value={formatCurrency(data.kpis.stock_added_value)} tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h3 className="mb-4 text-base font-semibold text-foreground">Stock value by category</h3>
          <ValueBars rows={data.stock_by_category.map((c) => ({ label: c.category, value: Number(c.value) }))} empty="No valued stock yet." />
        </Card>

        <ListCard title="Low stock" href="/inventory?low=1" empty="Stock levels are healthy.">
          {data.low_stock.map((s) => (
            <Row key={s.id} left={<span className="text-foreground">{s.name}</span>} right={`${Number(s.current_stock)} / ${Number(s.reorder_level)} ${s.unit ?? ""}`} sub={`${s.item_code} · ${s.item_type === "raw_material" ? "Raw" : "Finished"}`} rightTone="coral" />
          ))}
        </ListCard>
      </div>

      <ListCard title="Recent stock movements" href="/inventory" empty="No movements yet.">
        {data.recent_movements.map((m) => (
          <Row
            key={m.id}
            left={<span className="inline-flex items-center gap-2 text-foreground"><ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{m.item_name}</span>}
            right={`${m.type === "in" ? "+" : "−"}${Number(m.qty)}`}
            sub={`${m.item_code} · ${REASON_LABEL[m.reason] ?? m.reason}`}
            rightTone={m.type === "in" ? "green" : "coral"}
          />
        ))}
      </ListCard>
    </>
  );
}
