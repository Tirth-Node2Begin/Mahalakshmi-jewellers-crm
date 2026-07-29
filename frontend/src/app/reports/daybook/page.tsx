"use client";

import { booksApi, type DayBookVoucher } from "@/features/books/api";
import {
  CsvButton,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
  SingleDateControl,
} from "@/features/books/report-shell";
import { downloadCsv, num } from "@/features/books/report-utils";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText } from "lucide-react";
import { useMemo, useState } from "react";

/** Voucher types in the shop's own words — nobody outside accounting says "contra". */
const VTYPE_LABEL: Record<string, string> = {
  sale: "Sale",
  purchase: "Purchase",
  receipt: "Money received",
  payment: "Payment out",
  expense: "Expense",
  journal: "Journal",
  contra: "Cash / bank transfer",
  adjustment: "Stock adjustment",
  opening: "Opening balance",
};

const VTYPE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  sale: "green",
  purchase: "blue",
  receipt: "green",
  payment: "coral",
  expense: "coral",
  journal: "purple",
  contra: "blue",
  adjustment: "amber",
  opening: "gray",
};

const vtypeLabel = (t: string) => VTYPE_LABEL[t] ?? t.replace(/_/g, " ");

function voucherTotals(v: DayBookVoucher) {
  return {
    dr: v.entries.reduce((s, e) => s + num(e.dr_amount), 0),
    cr: v.entries.reduce((s, e) => s + num(e.cr_amount), 0),
  };
}

function buildCsv(vouchers: DayBookVoucher[], date: string) {
  const csv: (string | number)[][] = [
    ["Day Book"],
    [date],
    [],
    ["Voucher no", "Type", "Narration", "Ledger", "Debit", "Credit"],
  ];
  let dr = 0;
  let cr = 0;
  for (const v of vouchers) {
    for (const e of v.entries) {
      dr += num(e.dr_amount);
      cr += num(e.cr_amount);
      csv.push([
        v.voucher_no,
        vtypeLabel(v.vtype),
        v.narration ?? "",
        e.ledger_name,
        num(e.dr_amount) || "",
        num(e.cr_amount) || "",
      ]);
    }
  }
  csv.push([]);
  csv.push(["Total", "", "", "", dr, cr]);
  downloadCsv(`day-book-${date}.csv`, csv);
}

export default function DayBookPage() {
  const [date, setDate] = useState(localDateString());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "daybook", date],
    queryFn: () => booksApi.dayBook(date),
  });

  const vouchers = useMemo(() => data?.vouchers ?? [], [data]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const v of vouchers) {
      const t = voucherTotals(v);
      dr += t.dr;
      cr += t.cr;
    }
    return { dr, cr };
  }, [vouchers]);

  return (
    <div className="space-y-6">
      <ReportToolbar title="Day Book" subtitle="Every entry posted on one day, in the order it was recorded.">
        <SingleDateControl id="daybook-date" label="Date" value={date} onChange={setDate} />
        <PrintButton disabled={vouchers.length === 0} />
        <CsvButton disabled={vouchers.length === 0} onDownload={() => buildCsv(vouchers, date)} />
      </ReportToolbar>

      <ReportState
        isLoading={isLoading}
        isError={isError || !data}
        isEmpty={vouchers.length === 0}
        icon={BookOpenText}
        emptyTitle="Nothing was recorded on this day"
        emptyHint="Pick another date — bills, receipts and payments all appear here the day they are entered."
      >
        <PrintSheet title="Day Book" asOf={date}>
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-2 border-border bg-background px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {vouchers.length} {vouchers.length === 1 ? "entry" : "entries"} on this day
              </p>
              <p className="text-xs text-muted-foreground">Total debits and total credits should always match.</p>
            </div>
            <div className="flex gap-8">
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.4px] text-muted-foreground">Total debit</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(totals.dr, true)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.4px] text-muted-foreground">Total credit</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(totals.cr, true)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            {vouchers.map((v) => {
              const t = voucherTotals(v);
              return (
                <div key={v.id} className="rounded-input border border-border">
                  <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3">
                    <span className="font-mono text-sm font-medium text-foreground">{v.voucher_no}</span>
                    <Badge tone={VTYPE_TONE[v.vtype] ?? "gray"}>{vtypeLabel(v.vtype)}</Badge>
                    {v.narration ? (
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{v.narration}</span>
                    ) : (
                      <span className="min-w-0 flex-1" />
                    )}
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(Math.max(t.dr, t.cr), true)}
                    </span>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                        <th className="px-4 py-2">Ledger</th>
                        <th className="px-4 py-2 text-right">Debit</th>
                        <th className="px-4 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.entries.map((e, i) => (
                        <tr key={`${v.id}-${i}`} className="border-t border-border/50">
                          <td className="px-4 py-2 text-foreground">{e.ledger_name}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-foreground">
                            {num(e.dr_amount) ? formatCurrency(num(e.dr_amount), true) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-foreground">
                            {num(e.cr_amount) ? formatCurrency(num(e.cr_amount), true) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </PrintSheet>
      </ReportState>
    </div>
  );
}
