"use client";

import { booksApi, type OutstandingRow } from "@/features/books/api";
import {
  CsvButton,
  PrintButton,
  PrintSheet,
  ReportState,
  ReportToolbar,
  SingleDateControl,
} from "@/features/books/report-shell";
import { ageTone, daysAgo, downloadCsv } from "@/features/books/report-utils";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Side = "customers" | "vendors";

const SIDE_META: Record<
  Side,
  { tab: string; title: string; subtitle: string; amountLabel: string; detail: string; totalLabel: string; emptyTitle: string; emptyHint: string }
> = {
  customers: {
    tab: "Customers owe us",
    title: "Money customers owe the shop",
    subtitle: "Unpaid bills and balances, oldest activity first.",
    amountLabel: "Amount owed to us",
    detail: "/customers/detail",
    totalLabel: "Total customers owe us",
    emptyTitle: "Nobody owes the shop anything",
    emptyHint: "Every customer balance is settled as at this date.",
  },
  vendors: {
    tab: "We owe vendors",
    title: "Money the shop owes vendors",
    subtitle: "Unpaid purchases and balances, oldest activity first.",
    amountLabel: "Amount we owe",
    detail: "/vendors/detail",
    totalLabel: "Total we owe vendors",
    emptyTitle: "Nothing is owed to vendors",
    emptyHint: "Every vendor balance is settled as at this date.",
  },
};

function buildCsv(side: Side, rows: OutstandingRow[], total: number, asOf: string) {
  const meta = SIDE_META[side];
  const csv: (string | number)[][] = [
    [meta.title],
    [`As at ${asOf}`],
    [],
    ["Name", "Phone", "Last activity", "Waiting", meta.amountLabel],
  ];
  for (const r of rows) {
    const age = daysAgo(r.last_activity);
    csv.push([r.name, r.mobile ?? "", r.last_activity ?? "", age ? age.label : "No activity yet", r.balance]);
  }
  csv.push([]);
  csv.push([meta.totalLabel, "", "", "", total]);
  downloadCsv(`${side}-outstanding-as-at-${asOf}.csv`, csv);
}

export default function OutstandingPage() {
  const router = useRouter();
  const [side, setSide] = useState<Side>("customers");
  const [asOf, setAsOf] = useState(localDateString());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["books", "outstanding", side, asOf],
    queryFn: () => (side === "customers" ? booksApi.customerOutstanding(asOf) : booksApi.vendorOutstanding(asOf)),
  });

  const meta = SIDE_META[side];
  // the API already sorts by balance, but never rely on it for a money report
  const rows = useMemo(
    () => [...(data?.outstanding.rows ?? [])].sort((a, b) => b.balance - a.balance),
    [data],
  );
  const total = data?.outstanding.total ?? 0;

  return (
    <div className="space-y-6">
      <ReportToolbar title="Outstanding" subtitle="What customers owe you and what you owe your vendors.">
        <SingleDateControl id="outstanding-asof" label="As on" value={asOf} onChange={setAsOf} />
        <PrintButton disabled={!data} />
        <CsvButton disabled={!data} onDownload={() => data && buildCsv(side, rows, total, asOf)} />
      </ReportToolbar>

      <div className="flex flex-wrap gap-1 rounded-pill bg-background p-1 print:hidden">
        {(["customers", "vendors"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
              side === s ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {SIDE_META[s].tab}
          </button>
        ))}
      </div>

      <ReportState
        isLoading={isLoading}
        isError={isError || !data}
        isEmpty={rows.length === 0}
        icon={HandCoins}
        emptyTitle={meta.emptyTitle}
        emptyHint={meta.emptyHint}
      >
        <PrintSheet title={meta.title} asOf={asOf}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-border bg-background px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-foreground">{meta.totalLabel}</p>
              <p className="text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? "account" : "accounts"} with a balance on {formatDate(asOf)}.
              </p>
            </div>
            <span
              className={cn(
                "text-[32px] font-bold leading-none tabular-nums",
                side === "customers" ? "text-success-strong" : "text-attention-strong",
              )}
            >
              {formatCurrency(total, true)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Last activity</th>
                  <th className="px-3 py-3">Waiting</th>
                  <th className="px-6 py-3 text-right">{meta.amountLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const age = daysAgo(r.last_activity);
                  const href = `${meta.detail}?id=${r.party_id}`;
                  return (
                    <tr
                      key={r.party_id}
                      onClick={() => router.push(href)}
                      className="cursor-pointer border-b border-border/50 last:border-0 hover:bg-background"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-foreground hover:text-primary-strong hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{r.mobile ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(r.last_activity)}</td>
                      <td className="px-3 py-3">
                        {age ? (
                          <Badge tone={ageTone(age.days)}>{age.label}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No activity yet</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(r.balance, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background text-base font-bold">
                  <td className="px-6 py-4 text-foreground" colSpan={4}>
                    {meta.totalLabel}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums text-foreground">{formatCurrency(total, true)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="px-6 py-4 text-xs text-muted-foreground print:hidden">
            Tap any row to open that {side === "customers" ? "customer" : "vendor"}.
          </p>
        </PrintSheet>
      </ReportState>
    </div>
  );
}
