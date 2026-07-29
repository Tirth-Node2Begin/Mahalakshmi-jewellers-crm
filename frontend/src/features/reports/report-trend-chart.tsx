"use client";

import { formatCurrency } from "@/shared/utils/format";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const shortMonth = (m: string) => {
  if (!/^\d{4}-\d{2}$/.test(m)) return m;
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
};

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-modal">
      <p className="mb-1 font-medium text-foreground">{shortMonth(label ?? "")}</p>
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

/** Grouped bars over a month series — reused by the revenue & P&L report tabs (ssr:false). */
export default function ReportTrendChart({
  data,
  series,
}: {
  data: Record<string, string | number>[];
  series: { key: string; label: string; color: string }[];
}) {
  const rows = data.map((d) => {
    const r: Record<string, string | number> = { month: shortMonth(String(d.month)) };
    for (const s of series) r[s.key] = Number(d[s.key] ?? 0);
    return r;
  });
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
        <Tooltip content={<Tip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
