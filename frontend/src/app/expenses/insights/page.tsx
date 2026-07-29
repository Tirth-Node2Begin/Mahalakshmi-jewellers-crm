"use client";

import { expensesApi } from "@/features/expenses/api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { addDaysStr, formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

// recharts is heavy + DOM-measuring → load client-only, matches CSR/static-export build
const InsightCharts = dynamic(() => import("@/features/expenses/insight-charts"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading charts…</div>,
});

const PERIODS = [
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "quarterly", label: "Quarter" },
  { key: "yearly", label: "Year" },
] as const;

/** shift a yyyy-mm-dd reference date by ±1 unit of the given period */
function shiftDate(date: string, period: string, dir: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (period === "weekly") return addDaysStr(date, 7 * dir);
  const months = period === "quarterly" ? 3 : period === "yearly" ? 12 : 1;
  // clamp to the target month's last day so Jan 31 + 1 month = Feb 28, not Mar 3
  const first = new Date(y!, m! - 1 + months * dir, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return localDateString(new Date(first.getFullYear(), first.getMonth(), Math.min(d!, lastDay)));
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<string>("monthly");
  const [refDate, setRefDate] = useState(localDateString());
  const [compare, setCompare] = useState(false);

  const compareDate = useMemo(() => (compare ? shiftDate(refDate, period, -1) : undefined), [compare, refDate, period]);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", "insights", period, refDate, compareDate],
    queryFn: () => expensesApi.insights(period, refDate, compareDate),
  });

  const delta = useMemo(() => {
    if (!data?.comparison) return null;
    const prev = data.comparison.total;
    if (prev === 0) return null;
    return ((data.total - prev) / prev) * 100;
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/expenses" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Expenses
        </Link>
        <div className="ml-auto flex rounded-pill bg-background p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
                period === p.key ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="iconSm" onClick={() => setRefDate((d) => shiftDate(d, period, -1))} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <span className="min-w-40 text-center text-sm font-semibold text-foreground">{data?.range.label ?? "…"}</span>
            <Button variant="ghost" size="iconSm" onClick={() => setRefDate((d) => shiftDate(d, period, 1))} aria-label="Next period">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-[28px] font-bold leading-8 text-foreground tabular-nums">{formatCurrency(data?.total ?? 0)}</span>
            {delta !== null ? (
              <span className={cn("flex items-center gap-0.5 text-sm font-medium", delta > 0 ? "text-attention-strong" : "text-success-strong")}>
                {delta > 0 ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            ) : null}
          </div>

          <Button variant={compare ? "primary" : "secondary"} size="sm" className="ml-auto" onClick={() => setCompare((c) => !c)}>
            Compare to previous
          </Button>
        </div>

        {data?.comparison ? (
          <p className="mt-2 text-xs text-muted-foreground">
            vs {data.comparison.range.label}: {formatCurrency(data.comparison.total)}
          </p>
        ) : null}
      </Card>

      <Card>
        {isLoading || !data ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <InsightCharts data={data} />
        )}
      </Card>

      {data && data.payments.length > 0 ? (
        <Card>
          <p className="mb-4 text-sm font-semibold text-foreground">Payment modes</p>
          <div className="space-y-3">
            {data.payments.map((p) => {
              const pct = data.total > 0 ? (Number(p.total) / data.total) * 100 : 0;
              return (
                <div key={p.mode}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">{p.mode}</span>
                    <span className="font-medium tabular-nums text-foreground">{formatCurrency(p.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-background">
                    <div className="h-full rounded-pill bg-[linear-gradient(90deg,var(--grad-brand-from),var(--grad-brand-to))]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
