"use client";

import { usePageHeader } from "@/components/shell/page-header";
import { accountingApi } from "@/features/accounting/api";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

const balance = (amount: number, type: "dr" | "cr") => `${formatCurrency(amount, true)} ${type === "dr" ? "Dr" : "Cr"}`;

/**
 * Opening balance → every entry with a running balance → closing balance.
 * Rendered on its own page (`/accounting/ledger?id=…`) so a statement can be
 * linked to, printed and read without a modal in the way.
 */
export function LedgerStatementView({
  ledgerId,
  from,
  to,
  onRangeChange,
}: {
  ledgerId: number | null;
  from: string;
  to: string;
  onRangeChange: (range: { from: string; to: string }) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounting", "ledger", ledgerId, from, to],
    queryFn: () => accountingApi.ledger(ledgerId!, from, to),
    enabled: ledgerId !== null,
  });

  const statement = data?.statement;

  // The heading is the ledger's own name, so it comes from the data — push it to
  // the shell header instead of printing a second <h1> here.
  usePageHeader(
    statement?.ledger.name,
    `${statement?.ledger.code ? `${statement.ledger.code} · ` : ""}Opening balance, every entry, and the running balance.`,
  );

  return (
    <div className="space-y-5">
      {statement?.filtered_non_gst ? (
        <p className="text-xs font-medium text-muted-foreground">
          GST-visible ledger. Non-GST sale and receipt vouchers are filtered from this view.
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <Label htmlFor="statement-from">From</Label>
          <Input
            id="statement-from"
            type="date"
            value={from}
            onChange={(e) => onRangeChange({ from: e.target.value, to })}
            className="h-10 w-40"
          />
        </div>
        <div>
          <Label htmlFor="statement-to">To</Label>
          <Input
            id="statement-to"
            type="date"
            value={to}
            onChange={(e) => onRangeChange({ from, to: e.target.value })}
            className="h-10 w-40"
          />
        </div>
        {statement ? (
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-[0.4px] text-muted-foreground">Closing balance</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {balance(statement.closing, statement.closing_type)}
            </p>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <SkeletonRows rows={8} />
      ) : isError || !statement ? (
        <EmptyState
          icon={BookOpen}
          title="We could not load this ledger"
          hint="Check your internet connection and try again in a moment."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b-2 border-border text-left text-xs uppercase tracking-[0.4px] text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Particulars</th>
                <th className="py-2 pr-4 font-medium">Voucher</th>
                <th className="w-28 border-l border-border py-2 pl-3 pr-3 text-right font-medium text-primary-strong">
                  Debit
                </th>
                <th className="w-28 border-l border-border py-2 pl-3 pr-3 text-right font-medium text-primary-strong">
                  Credit
                </th>
                <th className="w-32 border-l border-border py-2 pl-3 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/60 bg-background/60">
                <td className="py-2 pr-4 text-muted-foreground" colSpan={3}>
                  Opening balance
                </td>
                <td className="border-l border-border py-2 pl-3 pr-3" />
                <td className="border-l border-border py-2 pl-3 pr-3" />
                <td className="whitespace-nowrap border-l border-border py-2 pl-3 text-right font-medium tabular-nums text-foreground">
                  {balance(statement.opening, statement.opening_type)}
                </td>
              </tr>

              {statement.entries.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                    No entries in these dates.
                  </td>
                </tr>
              ) : (
                statement.entries.map((e) => {
                  const isDebit = Number(e.dr_amount) > 0;
                  return (
                    <tr key={e.entry_id} className="border-b border-border/60 align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{formatDate(e.vdate)}</td>
                      <td className="py-2 pr-4">
                        {/* particulars = the other side of the entry, "To …" / "By …" */}
                        <span className="font-medium text-foreground">{e.particulars}</span>
                        {e.narration ? <span className="block text-xs text-muted-foreground">{e.narration}</span> : null}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-4 text-xs text-muted-foreground">{e.voucher_no}</td>
                      <td className="border-l border-border py-2 pl-3 pr-3 text-right tabular-nums">
                        {isDebit ? (
                          <span className="font-medium text-foreground">{formatCurrency(e.dr_amount, true)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="border-l border-border py-2 pl-3 pr-3 text-right tabular-nums">
                        {!isDebit ? (
                          <span className="font-medium text-foreground">{formatCurrency(e.cr_amount, true)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-l border-border py-2 pl-3 text-right tabular-nums text-foreground">
                        {balance(e.balance, e.balance_type)}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* column totals — the two sides of the ledger at a glance */}
              <tr className="border-t-2 border-border bg-background/60">
                <td className="py-2 pr-4 font-semibold text-foreground" colSpan={3}>
                  Total for this period
                </td>
                <td className="whitespace-nowrap border-l border-border py-2 pl-3 pr-3 text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(statement.total_debit, true)}
                </td>
                <td className="whitespace-nowrap border-l border-border py-2 pl-3 pr-3 text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(statement.total_credit, true)}
                </td>
                <td className="border-l border-border py-2 pl-3" />
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 pr-4 font-semibold text-foreground" colSpan={5}>
                  Closing balance
                </td>
                <td className="whitespace-nowrap border-l border-border py-2 pl-3 text-right font-semibold tabular-nums text-foreground">
                  {balance(statement.closing, statement.closing_type)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
