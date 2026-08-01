"use client";

import { booksApi, type Pnl, type PnlLine } from "@/features/books/api";
import {
  CsvButton,
  DateRangeControls,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
} from "@/features/books/report-shell";
import { downloadCsv, fiscalYear } from "@/features/books/report-utils";
import { usePermissions } from "@/lib/permissions";
import { EmptyState } from "@/shared/ui/empty-state";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ChartLine, Lock } from "lucide-react";
import { useState } from "react";

function buildCsv(pnl: Pnl) {
  const rows: (string | number)[][] = [["Profit & Loss"], [`${pnl.from} to ${pnl.to}`], []];
  rows.push(["Section", "Account", "Amount"]);
  for (const l of pnl.income) rows.push(["Income", l.name, l.amount]);
  rows.push(["", "Total Income", pnl.total_income]);
  for (const l of pnl.cogs) rows.push(["Cost of Goods Sold", l.name, l.amount]);
  rows.push(["", "Total Cost of Goods Sold", pnl.total_cogs]);
  rows.push(["", "Gross Profit", pnl.gross_profit]);
  for (const l of pnl.expenses) rows.push(["Expenses", l.name, l.amount]);
  rows.push(["", "Total Expenses", pnl.total_expenses]);
  rows.push(["", "Net Profit", pnl.net_profit]);

  downloadCsv(`profit-and-loss-${pnl.from}-to-${pnl.to}.csv`, rows);
}

export default function ProfitAndLossPage() {
  const fy = fiscalYear();
  const { can } = usePermissions();
  const [range, setRange] = useState({ from: fy.from, to: fy.to });

  // profit is the owner's figure — anyone else gets a plain explanation rather
  // than a failed request. books.php enforces this server-side regardless.
  const allowed = can("reports.pnl");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "pnl", range.from, range.to],
    queryFn: () => booksApi.pnl(range.from, range.to),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <EmptyState
        icon={Lock}
        title="Profit & Loss is not open to you"
        hint="Only the owner can see the shop's profit. Ask them to grant it from Settings → Roles if you need it."
      />
    );
  }

  const pnl = data?.pnl;
  const empty =
    !!pnl && pnl.income.length === 0 && pnl.cogs.length === 0 && pnl.expenses.length === 0;

  return (
    <div className="space-y-6">
      <ReportToolbar title="Profit & Loss" subtitle="What the shop earned and what it spent.">
        <DateRangeControls idPrefix="pnl" from={range.from} to={range.to} onChange={setRange} />
        <PrintButton disabled={!pnl} />
        <CsvButton disabled={!pnl} onDownload={() => pnl && buildCsv(pnl)} />
      </ReportToolbar>

      <ReportState
        isLoading={isLoading}
        isError={isError || !pnl}
        isEmpty={empty}
        icon={ChartLine}
        emptyTitle="Nothing recorded in these dates"
        emptyHint="Pick a wider date range, or make a bill to see figures here."
      >
        {pnl ? (
          <PrintSheet title="Profit & Loss" from={pnl.from} to={pnl.to}>
            <Section title="Money in (Income)" lines={pnl.income} total={pnl.total_income} totalLabel="Total Income" />

            <Section
              title="Cost of goods sold"
              lines={pnl.cogs}
              total={pnl.total_cogs}
              totalLabel="Total Cost of Goods Sold"
              emptyHint="No cost of goods recorded in these dates."
            />

            <div className="flex items-center justify-between gap-4 border-y-2 border-border bg-background px-6 py-4">
              <span className="text-base font-semibold text-foreground">Gross Profit</span>
              <span
                className={cn(
                  "text-xl font-bold tabular-nums",
                  pnl.gross_profit >= 0 ? "text-success-strong" : "text-attention-strong",
                )}
              >
                {formatCurrency(pnl.gross_profit, true)}
              </span>
            </div>

            <Section
              title="Money out (Expenses)"
              lines={pnl.expenses}
              total={pnl.total_expenses}
              totalLabel="Total Expenses"
              emptyHint="No expenses recorded in these dates."
            />

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 px-6 py-8",
                pnl.net_profit >= 0 ? "bg-success-soft" : "bg-attention-soft",
              )}
            >
              <div>
                <p
                  className={cn(
                    "text-lg font-semibold",
                    pnl.net_profit >= 0 ? "text-success-strong" : "text-attention-strong",
                  )}
                >
                  {pnl.net_profit >= 0 ? "Net Profit" : "Net Loss"}
                </p>
                <p className="text-xs text-muted-foreground">Income minus cost of goods and all expenses.</p>
              </div>
              <span
                className={cn(
                  "text-[40px] font-bold leading-none tabular-nums",
                  pnl.net_profit >= 0 ? "text-success-strong" : "text-attention-strong",
                )}
              >
                {formatCurrency(Math.abs(pnl.net_profit), true)}
              </span>
            </div>
          </PrintSheet>
        ) : null}
      </ReportState>
    </div>
  );
}

function Section({
  title,
  lines,
  total,
  totalLabel,
  emptyHint,
}: {
  title: string;
  lines: PnlLine[];
  total: number;
  totalLabel: string;
  emptyHint?: string;
}) {
  return (
    <div className="border-b border-border px-6 py-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint ?? "Nothing recorded in these dates."}</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.ledger_id} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-body">{l.name}</span>
              <span className="tabular-nums text-foreground">{formatCurrency(l.amount, true)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between gap-4 border-t border-border pt-3 text-sm font-semibold">
        <span className="text-foreground">{totalLabel}</span>
        <span className="tabular-nums text-foreground">{formatCurrency(total, true)}</span>
      </div>
    </div>
  );
}
