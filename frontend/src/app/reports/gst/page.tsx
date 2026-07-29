"use client";

import { booksApi, type GstOutwardRow, type GstSummary } from "@/features/books/api";
import {
  CsvButton,
  DateRangeControls,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
} from "@/features/books/report-shell";
import { downloadCsv, fiscalYear, num } from "@/features/books/report-utils";
import { KpiCard } from "@/shared/ui/kpi-card";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, IndianRupee, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Plain words for the GST buckets — the shop's accountant knows the codes, the
 * jeweller does not, so we print the words and keep the code out of sight.
 */
const TREATMENT_LABEL: Record<string, string> = {
  taxable: "Taxable",
  exempt: "Exempt",
  nil_rated: "Nil rated",
  non_gst: "Outside GST",
  reverse_charge: "Reverse charge",
};

const TREATMENT_HINT: Record<string, string> = {
  taxable: "Normal sales — GST charged on the bill.",
  exempt: "Goods the law exempts from GST.",
  nil_rated: "Taxed at 0%.",
  non_gst: "Items GST does not apply to at all.",
  reverse_charge: "The buyer pays the GST, not the shop.",
};

const TREATMENT_ORDER = ["taxable", "nil_rated", "exempt", "non_gst", "reverse_charge"];

function treatmentLabel(t: string): string {
  return TREATMENT_LABEL[t] ?? t.replace(/_/g, " ");
}

interface OutwardGroup {
  treatment: string;
  rows: GstOutwardRow[];
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  bills: number;
}

function groupOutward(rows: GstOutwardRow[]): OutwardGroup[] {
  const map = new Map<string, GstOutwardRow[]>();
  for (const r of rows) {
    const key = String(r.tax_treatment ?? "taxable");
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return [...map.entries()]
    .map(([treatment, group]) => ({
      treatment,
      rows: [...group].sort((a, b) => num(a.tax_rate) - num(b.tax_rate)),
      taxable: group.reduce((s, r) => s + num(r.taxable_value), 0),
      cgst: group.reduce((s, r) => s + num(r.cgst), 0),
      sgst: group.reduce((s, r) => s + num(r.sgst), 0),
      igst: group.reduce((s, r) => s + num(r.igst), 0),
      bills: group.reduce((s, r) => s + num(r.bills), 0),
    }))
    .sort((a, b) => {
      const ai = TREATMENT_ORDER.indexOf(a.treatment);
      const bi = TREATMENT_ORDER.indexOf(b.treatment);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });
}

function buildCsv(gst: GstSummary, from: string, to: string) {
  const rows: (string | number)[][] = [["GST Summary"], [`${from} to ${to}`], []];

  rows.push(["Outward (sales)"]);
  rows.push(["Bucket", "Tax rate %", "Bills", "Taxable value", "CGST", "SGST", "IGST"]);
  for (const g of groupOutward(gst.outward)) {
    for (const r of g.rows) {
      rows.push([
        treatmentLabel(g.treatment),
        num(r.tax_rate),
        num(r.bills),
        num(r.taxable_value),
        num(r.cgst),
        num(r.sgst),
        num(r.igst),
      ]);
    }
    rows.push([`${treatmentLabel(g.treatment)} total`, "", g.bills, g.taxable, g.cgst, g.sgst, g.igst]);
  }

  rows.push([]);
  rows.push(["Inward (purchases)"]);
  rows.push(["Date", "Taxable value", "CGST", "SGST", "IGST"]);
  for (const r of gst.inward) {
    rows.push([r.purchase_date, num(r.taxable_value), num(r.cgst), num(r.sgst), num(r.igst)]);
  }

  rows.push([]);
  rows.push(["Total turnover", gst.total_turnover]);
  rows.push(["Output tax (on sales)", gst.output_tax]);
  rows.push(["Input tax (on purchases)", gst.input_tax]);
  rows.push(["Net payable", gst.net_payable]);
  rows.push([]);
  rows.push(["Reconciliation"]);
  rows.push(["GST turnover", gst.reconciliation.gst_turnover]);
  rows.push(["P&L sales", gst.reconciliation.pnl_income]);
  rows.push(["Difference", gst.reconciliation.difference]);

  downloadCsv(`gst-summary-${from}-to-${to}.csv`, rows);
}

export default function GstSummaryPage() {
  const fy = fiscalYear();
  const [range, setRange] = useState({ from: fy.from, to: fy.to });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "gst", range.from, range.to],
    queryFn: () => booksApi.gstSummary(range.from, range.to),
  });

  const gst = data?.gst;
  const outward = useMemo(() => groupOutward(gst?.outward ?? []), [gst]);
  const inwardTotals = useMemo(() => {
    const list = gst?.inward ?? [];
    return {
      taxable: list.reduce((s, r) => s + num(r.taxable_value), 0),
      cgst: list.reduce((s, r) => s + num(r.cgst), 0),
      sgst: list.reduce((s, r) => s + num(r.sgst), 0),
      igst: list.reduce((s, r) => s + num(r.igst), 0),
    };
  }, [gst]);

  const mismatch = gst ? Math.abs(gst.reconciliation.difference) >= 1 : false;

  return (
    <div className="space-y-6">
      <ReportToolbar title="GST Summary" subtitle="Tax collected on sales, tax paid on purchases, and what is due.">
        <DateRangeControls idPrefix="gst" from={range.from} to={range.to} onChange={setRange} />
        <PrintButton disabled={!gst} />
        <CsvButton disabled={!gst} onDownload={() => gst && buildCsv(gst, range.from, range.to)} />
      </ReportToolbar>

      <ReportState
        isLoading={isLoading}
        isError={isError || !gst}
        isEmpty={Boolean(gst) && outward.length === 0 && (gst?.inward.length ?? 0) === 0}
        icon={Receipt}
        emptyTitle="No GST activity in these dates"
        emptyHint="Finalise a bill or record a purchase, or widen the date range."
      >
        {gst ? (
          <PrintSheet title="GST Summary" from={range.from} to={range.to}>
            <div className="grid gap-4 border-b border-border p-6 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard icon={IndianRupee} label="Total turnover" value={formatCurrency(gst.total_turnover, true)} tone="purple" />
              <KpiCard icon={ArrowUpRight} label="Output tax (on sales)" value={formatCurrency(gst.output_tax, true)} tone="green" />
              <KpiCard icon={ArrowDownLeft} label="Input tax (on purchases)" value={formatCurrency(gst.input_tax, true)} tone="sky" />
              <KpiCard
                icon={Wallet}
                label={gst.net_payable >= 0 ? "Net payable" : "Net refundable"}
                value={formatCurrency(Math.abs(gst.net_payable), true)}
                tint={gst.net_payable > 0 ? "red" : "green"}
              />
            </div>

            {/* Outward — what the shop sold */}
            <section className="border-b border-border">
              <div className="px-6 pb-2 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Outward — sales</h3>
                <p className="text-xs text-muted-foreground">Tax the shop collected from customers.</p>
              </div>
              {outward.length === 0 ? (
                <p className="px-6 pb-5 text-sm text-muted-foreground">No sales in these dates.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                        <th className="px-6 py-3">Bucket</th>
                        <th className="px-3 py-3 text-right">Tax rate</th>
                        <th className="px-3 py-3 text-right">Bills</th>
                        <th className="px-3 py-3 text-right">Taxable value</th>
                        <th className="px-3 py-3 text-right">CGST</th>
                        <th className="px-3 py-3 text-right">SGST</th>
                        <th className="px-6 py-3 text-right">IGST</th>
                      </tr>
                    </thead>
                    {outward.map((g) => (
                      <tbody key={g.treatment}>
                        <tr className="bg-background/60">
                          <td colSpan={7} className="px-6 py-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.4px] text-foreground">
                              {treatmentLabel(g.treatment)}
                            </span>
                            {TREATMENT_HINT[g.treatment] ? (
                              <span className="ml-2 text-xs text-muted-foreground">{TREATMENT_HINT[g.treatment]}</span>
                            ) : null}
                          </td>
                        </tr>
                        {g.rows.map((r) => (
                          <tr key={`${g.treatment}-${String(r.tax_rate)}`} className="border-b border-border/50">
                            <td className="px-6 py-2.5 text-muted-foreground">{treatmentLabel(g.treatment)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{num(r.tax_rate)}%</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{num(r.bills)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                              {formatCurrency(num(r.taxable_value), true)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(num(r.cgst), true)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(num(r.sgst), true)}
                            </td>
                            <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                              {formatCurrency(num(r.igst), true)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-b-2 border-border bg-background font-semibold">
                          <td className="px-6 py-2.5 text-foreground">{treatmentLabel(g.treatment)} total</td>
                          <td className="px-3 py-2.5" />
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{g.bills}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(g.taxable, true)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(g.cgst, true)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(g.sgst, true)}
                          </td>
                          <td className="px-6 py-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(g.igst, true)}
                          </td>
                        </tr>
                      </tbody>
                    ))}
                  </table>
                </div>
              )}
            </section>

            {/* Inward — what the shop bought */}
            <section className="border-b border-border">
              <div className="px-6 pb-2 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Inward — purchases</h3>
                <p className="text-xs text-muted-foreground">Tax the shop paid to vendors and can claim back.</p>
              </div>
              {gst.inward.length === 0 ? (
                <p className="px-6 pb-5 text-sm text-muted-foreground">No purchases in these dates.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-3 py-3 text-right">Taxable value</th>
                        <th className="px-3 py-3 text-right">CGST</th>
                        <th className="px-3 py-3 text-right">SGST</th>
                        <th className="px-6 py-3 text-right">IGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gst.inward.map((r) => (
                        <tr key={r.purchase_date} className="border-b border-border/50">
                          <td className="px-6 py-2.5 text-foreground">{formatDate(r.purchase_date)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                            {formatCurrency(num(r.taxable_value), true)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(num(r.cgst), true)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(num(r.sgst), true)}
                          </td>
                          <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(num(r.igst), true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-background font-semibold">
                        <td className="px-6 py-3 text-foreground">Total</td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(inwardTotals.taxable, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(inwardTotals.cgst, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(inwardTotals.sgst, true)}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          {formatCurrency(inwardTotals.igst, true)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* Reconciliation — the two numbers must agree */}
            <section className={cn("px-6 py-5", mismatch && "bg-warning-soft")}>
              <h3 className={cn("text-sm font-semibold", mismatch ? "text-warning-strong" : "text-foreground")}>
                Reconciliation
              </h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-[0.4px] text-muted-foreground">GST turnover</dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">
                    {formatCurrency(gst.reconciliation.gst_turnover, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.4px] text-muted-foreground">P&amp;L sales</dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">
                    {formatCurrency(gst.reconciliation.pnl_income, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.4px] text-muted-foreground">Difference</dt>
                  <dd
                    className={cn(
                      "text-base font-semibold tabular-nums",
                      mismatch ? "text-warning-strong" : "text-success-strong",
                    )}
                  >
                    {formatCurrency(gst.reconciliation.difference, true)}
                  </dd>
                </div>
              </dl>
              <p className={cn("mt-3 text-sm", mismatch ? "text-warning-strong" : "text-muted-foreground")}>
                {mismatch
                  ? "GST turnover and P&L sales should match. Ask your accountant to check the sales entries in this period."
                  : "GST turnover matches the sales in the Profit & Loss report."}
              </p>
            </section>
          </PrintSheet>
        ) : null}
      </ReportState>
    </div>
  );
}
