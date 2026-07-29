"use client";

import { accountingApi } from "@/features/accounting/api";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";

const balance = (amount: number, type: "dr" | "cr") => `${formatCurrency(amount, true)} ${type === "dr" ? "Dr" : "Cr"}`;

/** Opening balance → every entry with a running balance → closing balance. */
export function LedgerStatementDialog({
  open,
  onClose,
  ledgerId,
  ledgerName,
  defaultFrom,
  defaultTo,
}: {
  open: boolean;
  onClose: () => void;
  ledgerId: number | null;
  ledgerName: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  // follow the page's date range each time the panel is opened for a ledger
  useEffect(() => {
    if (!open) return;
    setFrom(defaultFrom);
    setTo(defaultTo);
  }, [open, ledgerId, defaultFrom, defaultTo]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounting", "ledger", ledgerId, from, to],
    queryFn: () => accountingApi.ledger(ledgerId!, from, to),
    enabled: open && ledgerId !== null,
  });

  const statement = data?.statement;

  return (
    <Dialog open={open} onClose={onClose} title={ledgerName || "Ledger"} maxWidth={920}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="statement-from">From</Label>
            <Input id="statement-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" />
          </div>
          <div>
            <Label htmlFor="statement-to">To</Label>
            <Input id="statement-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" />
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
          <SkeletonRows rows={6} />
        ) : isError || !statement ? (
          <EmptyState
            icon={BookOpen}
            title="We could not load this ledger"
            hint="Check your internet connection and try again in a moment."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.4px] text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Voucher</th>
                  <th className="py-2 pr-4 font-medium">Particulars</th>
                  <th className="py-2 pr-4 text-right font-medium">Debit</th>
                  <th className="py-2 pr-4 text-right font-medium">Credit</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60 bg-background/60">
                  <td className="py-2 pr-4 text-muted-foreground" colSpan={5}>
                    Opening balance
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums text-foreground">
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
                  statement.entries.map((e, i) => (
                    <tr key={`${e.voucher_id}-${i}`} className="border-b border-border/60 last:border-0">
                      <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{formatDate(e.vdate)}</td>
                      <td className="whitespace-nowrap py-2 pr-4 text-muted-foreground">{e.voucher_no}</td>
                      <td className="py-2 pr-4 text-body">{e.narration ?? e.vtype}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Number(e.dr_amount) > 0 ? formatCurrency(e.dr_amount, true) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Number(e.cr_amount) > 0 ? formatCurrency(e.cr_amount, true) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-foreground">{balance(e.balance, e.balance_type)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t-2 border-border">
                  <td className="py-2 pr-4 font-semibold text-foreground" colSpan={5}>
                    Closing balance
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-foreground">
                    {balance(statement.closing, statement.closing_type)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
  );
}
