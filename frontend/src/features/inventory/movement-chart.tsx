"use client";

import { formatCurrency } from "@/shared/utils/format";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axisStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function shortMonth(month: string): string {
  // "2026-07" -> "Jul '26"
  const [year, monthNum] = month.split("-");
  const date = new Date(`${year}-${monthNum}-01`);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-modal">
      {label ? <p className="mb-0.5 font-medium text-foreground">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.name === "In Qty" ? "#3FD16F" : "#FF6DA8" }} className="font-semibold">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function MovementChart({ data }: { data: { month: string; in_qty: string; out_qty: string }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No movement yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: shortMonth(d.month),
    "In Qty": Number(d.in_qty),
    "Out Qty": Number(d.out_qty),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={48} />
        <Tooltip content={<ChartTip />} />
        <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }} />
        <Bar dataKey="In Qty" fill="#3FD16F" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Out Qty" fill="#FF6DA8" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
