"use client";

import { payableFromLedger, vendorPaymentsApi } from "@/features/vendors/payments-api";
import { usePermissions } from "@/lib/permissions";
import { Input, Label } from "@/shared/ui/input";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lock } from "lucide-react";
import { useState } from "react";

/**
 * A vendor's account statement: what we owed at the start, every bill and
 * payment in between, and what we owe now. A `cr` balance means money is still
 * owed to the vendor — shown here in plain words, not accounting shorthand.
 */
export function VendorLedgerPanel({ supplierId }: { supplierId: number | null }) {
  const { can } = usePermissions();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const allowed = can("vendors.ledger");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendor-payments", "ledger", supplierId, from, to],
    queryFn: () => vendorPaymentsApi.ledger(supplierId!, from || undefined, to || undefined),
    enabled: allowed && !!supplierId,
  });

  if (!allowed) {
    return (
      <EmptyState
        icon={Lock}
        title="You cannot open vendor ledgers"
        hint="Ask the owner for the vendor-ledger permission."
      />
    );
  }

  if (!supplierId) {
    return <EmptyState icon={BookOpen} title="Choose a vendor" hint="Pick a vendor to see their full account." />;
  }

  if (isLoading) return <SkeletonRows rows={8} />;

  if (isError || !data) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Could not load this account"
        hint="This vendor may not have any accounting entries yet."
      />
    );
  }

  const s = data.statement;
  const openingOwed = payableFromLedger(s.opening, s.opening_type);
  const closingOwed = payableFromLedger(s.closing, s.closing_type);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="vl_from">From</Label>
          <Input id="vl_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 w-auto" />
        </div>
        <div>
          <Label htmlFor="vl_to">To</Label>
          <Input id="vl_to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 w-auto" />
        </div>
        <p className="ml-auto text-sm text-muted-foreground">
          {closingOwed > 0.005 ? "You still owe" : closingOwed < -0.005 ? "Paid in advance" : "All settled"}
          <span className="ml-2 text-base font-bold tabular-nums text-foreground">
            {formatCurrency(Math.abs(closingOwed), true)}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-3 py-3">Particulars</th>
              <th className="px-3 py-3">Voucher</th>
              <th className="border-l border-border px-3 py-3 text-right">
                You paid<span className="ml-1 font-normal normal-case text-muted-foreground/70">(Debit)</span>
              </th>
              <th className="border-l border-border px-3 py-3 text-right">
                You were billed<span className="ml-1 font-normal normal-case text-muted-foreground/70">(Credit)</span>
              </th>
              <th className="border-l border-border px-4 py-3 text-right">Balance owed</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50 bg-background/60">
              <td className="px-4 py-3 text-muted-foreground" colSpan={3}>
                Opening balance
              </td>
              <td className="border-l border-border px-3 py-3" />
              <td className="border-l border-border px-3 py-3" />
              <td className="whitespace-nowrap border-l border-border px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                {formatCurrency(Math.abs(openingOwed), true)}
                {openingOwed < -0.005 ? " advance" : ""}
              </td>
            </tr>
            {s.entries.map((e) => {
              const owed = payableFromLedger(e.balance, e.balance_type);
              const isDebit = Number(e.dr_amount) > 0;
              return (
                <tr key={e.entry_id} className="border-b border-border/50 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(e.vdate)}</td>
                  <td className="px-3 py-3">
                    {/* what this entry was against, not just the voucher note */}
                    <span className="font-medium text-foreground">{e.particulars}</span>
                    {e.narration ? <span className="block text-xs text-muted-foreground">{e.narration}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted-foreground">{e.voucher_no}</td>
                  <td className="border-l border-border px-3 py-3 text-right tabular-nums">
                    {isDebit ? (
                      <span className="font-medium text-foreground">{formatCurrency(e.dr_amount, true)}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="border-l border-border px-3 py-3 text-right tabular-nums">
                    {!isDebit ? (
                      <span className="font-medium text-foreground">{formatCurrency(e.cr_amount, true)}</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap border-l border-border px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    {formatCurrency(Math.abs(owed), true)}
                    {owed < -0.005 ? " adv." : ""}
                  </td>
                </tr>
              );
            })}
            {s.entries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={6}>
                  Nothing happened in this period.
                </td>
              </tr>
            ) : null}
            <tr className="border-t-2 border-border bg-background/60">
              <td className="px-4 py-3 font-semibold text-foreground" colSpan={3}>
                Total for this period
              </td>
              <td className="whitespace-nowrap border-l border-border px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                {formatCurrency(s.total_debit, true)}
              </td>
              <td className="whitespace-nowrap border-l border-border px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                {formatCurrency(s.total_credit, true)}
              </td>
              <td className="border-l border-border px-4 py-3" />
            </tr>
            <tr className="border-t border-border bg-background/60">
              <td className="px-4 py-3 font-semibold text-foreground" colSpan={5}>
                Closing balance
              </td>
              <td className="whitespace-nowrap border-l border-border px-4 py-3 text-right font-bold tabular-nums text-foreground">
                {formatCurrency(Math.abs(closingOwed), true)}
                {closingOwed < -0.005 ? " advance" : ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
