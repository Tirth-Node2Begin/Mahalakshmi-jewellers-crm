"use client";

import { CATEGORY_COLORS, type InsightsResponse } from "@/features/expenses/api";
import { formatCurrency } from "@/shared/utils/format";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function shortDate(d: string) {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-modal">
      {label ? <p className="mb-0.5 font-medium text-foreground">{label}</p> : null}
      <p className="font-semibold text-primary-strong">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

/** Trend (daily area) + category donut — dynamically imported by the insights page (ssr:false). */
export default function InsightCharts({ data }: { data: InsightsResponse }) {
  const trend = data.daily.map((d) => ({ date: shortDate(d.date), total: Number(d.total) }));
  const donut = data.categories.slice(0, 8).map((c) => ({ name: c.name, value: Number(c.total) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">Daily trend</p>
        {trend.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No spend this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4270bf" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4270bf" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} />
              <Tooltip content={<ChartTip />} cursor={{ stroke: "#4270bf", strokeOpacity: 0.2 }} />
              <Area type="monotone" dataKey="total" stroke="#4270bf" strokeWidth={2.5} fill="url(#expFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-foreground">By category</p>
        {donut.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No categories</div>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="none">
                  {donut.map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTip />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {donut.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.name}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatCurrency(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
