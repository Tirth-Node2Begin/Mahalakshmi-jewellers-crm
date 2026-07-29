"use client";

import { CHART } from "@/features/reports/api";
import { formatCurrency } from "@/shared/utils/format";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const shortMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-IN", { month: "short" });
};

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-modal">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-foreground">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Cashflow: money in (payments) vs money out (expenses), dynamically imported (ssr:false).
 *  When every expense is 0 (e.g. the sales/collections view, which can't see spend) the
 *  expense area is hidden so a single-series collections chart renders cleanly. */
export default function CashflowChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const rows = data.map((d) => ({ month: shortMonth(d.month), income: d.income, expense: d.expense }));
  const showExpense = rows.some((r) => r.expense !== 0);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.income} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.income} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.expense} stopOpacity={0.3} />
            <stop offset="100%" stopColor={CHART.expense} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="income" stroke={CHART.income} strokeWidth={2.5} fill="url(#inGrad)" />
        {showExpense && <Area type="monotone" dataKey="expense" stroke={CHART.expense} strokeWidth={2.5} fill="url(#outGrad)" />}
      </AreaChart>
    </ResponsiveContainer>
  );
}
