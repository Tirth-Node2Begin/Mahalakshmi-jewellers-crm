"use client";

import { booksApi, type Nature, type TrialBalance, type TrialBalanceRow } from "@/features/books/api";
import {
  CsvButton,
  DateRangeControls,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
} from "@/features/books/report-shell";
import { downloadCsv, fiscalYear } from "@/features/books/report-utils";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Scale } from "lucide-react";
import { useMemo, useState } from "react";

/** Sheet order — the order an accountant expects to read them in. */
const NATURE_ORDER: Nature[] = ["asset", "liability", "income", "expense"];
const NATURE_LABEL: Record<Nature, string> = {
  asset: "Assets",
  liability: "Liabilities",
  income: "Income",
  expense: "Expenses",
};

interface Group {
  nature: Nature;
  rows: TrialBalanceRow[];
  debit: number;
  credit: number;
}

function groupByNature(rows: TrialBalanceRow[]): Group[] {
  return NATURE_ORDER.map((nature) => {
    const group = rows.filter((r) => r.nature === nature);
    return {
      nature,
      rows: group,
      debit: group.reduce((s, r) => s + r.debit, 0),
      credit: group.reduce((s, r) => s + r.credit, 0),
    };
  }).filter((g) => g.rows.length > 0);
}

/** `1,200.00 Dr` — the trial balance is an accountant's page, so Dr/Cr is correct here. */
function side(amount: number, type: "dr" | "cr"): string {
  if (amount === 0) return "—";
  return `${formatCurrency(amount, true)} ${type === "dr" ? "Dr" : "Cr"}`;
}

function buildCsv(tb: TrialBalance, from: string, to: string) {
  const rows: (string | number)[][] = [
    ["Trial Balance"],
    [`${from} to ${to}`],
    [],
    ["Group", "Code", "Ledger", "Opening", "Opening Dr/Cr", "Debit", "Credit", "Closing", "Closing Dr/Cr"],
  ];
  for (const g of groupByNature(tb.rows)) {
    for (const r of g.rows) {
      rows.push([
        NATURE_LABEL[g.nature],
        r.code ?? "",
        r.name,
        r.opening,
        r.opening_type.toUpperCase(),
        r.debit,
        r.credit,
        r.closing,
        r.closing_type.toUpperCase(),
      ]);
    }
    rows.push([`${NATURE_LABEL[g.nature]} subtotal`, "", "", "", "", g.debit, g.credit, "", ""]);
  }
  rows.push([]);
  rows.push(["Total", "", "", "", "", tb.total_debit, tb.total_credit, "", ""]);
  rows.push(["Balanced", tb.balanced ? "Yes" : "NO — the books do not tie"]);
  downloadCsv(`trial-balance-${from}-to-${to}.csv`, rows);
}

export default function TrialBalancePage() {
  const fy = fiscalYear();
  const [range, setRange] = useState({ from: fy.from, to: fy.to });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "trial-balance", range.from, range.to],
    queryFn: () => booksApi.trialBalance(range.from, range.to),
  });

  const tb = data?.trial_balance;
  const groups = useMemo(() => groupByNature(tb?.rows ?? []), [tb]);

  return (
    <div className="space-y-6">
      <ReportToolbar title="Trial Balance" subtitle="Every ledger's debit and credit totals for the period.">
        <DateRangeControls idPrefix="tb" from={range.from} to={range.to} onChange={setRange} />
        <PrintButton disabled={!tb} />
        <CsvButton disabled={!tb} onDownload={() => tb && buildCsv(tb, range.from, range.to)} />
      </ReportToolbar>

      {/* Books that do not tie is a real problem, not a formatting nit — say so loudly. */}
      {tb && !tb.balanced ? (
        <Card className="flex items-start gap-3 border border-attention-strong/40 bg-attention-soft print:hidden">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-attention-strong" aria-hidden />
          <div>
            <p className="font-semibold text-attention-strong">The books do not balance</p>
            <p className="mt-1 text-sm text-attention-strong/90">
              Total debits ({formatCurrency(tb.total_debit, true)}) and total credits (
              {formatCurrency(tb.total_credit, true)}) differ by{" "}
              {formatCurrency(Math.abs(tb.total_debit - tb.total_credit), true)}. Ask your accountant to check the
              entries in this period before filing anything from this report.
            </p>
          </div>
        </Card>
      ) : null}

      <ReportState
        isLoading={isLoading}
        isError={isError || !tb}
        isEmpty={groups.length === 0}
        icon={Scale}
        emptyTitle="No ledger activity in these dates"
        emptyHint="Pick a wider date range, or record a bill or payment to see figures here."
      >
        {tb ? (
          <PrintSheet title="Trial Balance" from={range.from} to={range.to}>
            {!tb.balanced ? (
              <p className="border-b border-border bg-attention-soft px-6 py-3 text-sm font-semibold text-attention-strong">
                Warning: total debits and credits do not match. This sheet does not tie.
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-6 py-3">Ledger</th>
                    <th className="px-3 py-3 text-right">Opening</th>
                    <th className="px-3 py-3 text-right">Debit</th>
                    <th className="px-3 py-3 text-right">Credit</th>
                    <th className="px-6 py-3 text-right">Closing</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.nature}>
                    <tr className="bg-background/60">
                      <td
                        colSpan={5}
                        className="px-6 py-2 text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground"
                      >
                        {NATURE_LABEL[g.nature]}
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.ledger_id} className="border-b border-border/50 hover:bg-background">
                        <td className="px-6 py-2.5">
                          <span className="block text-foreground">{r.name}</span>
                          {r.code ? <span className="block font-mono text-xs text-muted-foreground">{r.code}</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {side(r.opening, r.opening_type)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                          {r.debit === 0 ? "—" : formatCurrency(r.debit, true)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                          {r.credit === 0 ? "—" : formatCurrency(r.credit, true)}
                        </td>
                        <td className="px-6 py-2.5 text-right font-medium tabular-nums text-foreground">
                          {side(r.closing, r.closing_type)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b-2 border-border bg-background text-sm font-semibold">
                      <td className="px-6 py-2.5 text-foreground">{NATURE_LABEL[g.nature]} subtotal</td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatCurrency(g.debit, true)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatCurrency(g.credit, true)}
                      </td>
                      <td className="px-6 py-2.5" />
                    </tr>
                  </tbody>
                ))}
                <tfoot>
                  <tr
                    className={cn(
                      "border-t-2 border-border text-base font-bold",
                      tb.balanced ? "bg-background" : "bg-attention-soft",
                    )}
                  >
                    <td className="px-6 py-4 text-foreground">Total</td>
                    <td className="px-3 py-4" />
                    <td
                      className={cn(
                        "px-3 py-4 text-right tabular-nums",
                        tb.balanced ? "text-foreground" : "text-attention-strong",
                      )}
                    >
                      {formatCurrency(tb.total_debit, true)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-4 text-right tabular-nums",
                        tb.balanced ? "text-foreground" : "text-attention-strong",
                      )}
                    >
                      {formatCurrency(tb.total_credit, true)}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-medium uppercase tracking-[0.4px]">
                      <span className={tb.balanced ? "text-success-strong" : "text-attention-strong"}>
                        {tb.balanced ? "Balanced" : "Does not tie"}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </PrintSheet>
        ) : null}
      </ReportState>
    </div>
  );
}
