"use client";

import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { formatCurrency, formatDate, relativeTime } from "@/shared/utils/format";
import { Files } from "lucide-react";
import { num } from "./calc";
import type { HeldBill } from "./types";

/**
 * The held-bills tray. Several customers can be part-way through at the same
 * counter — each unfinished basket is a draft in the database, so it survives a
 * refresh and can be picked up again from any till.
 */
export function HeldBillsDialog({
  open,
  onClose,
  held,
  currentId,
  onResume,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  held: HeldBill[];
  currentId: number | null;
  onResume: (id: number) => void;
  onDiscard: (id: number) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Bills on hold" maxWidth={620}>
      {held.length === 0 ? (
        <EmptyState icon={Files} title="No bills on hold" hint="Save a bill as a draft to park it here and start another one." />
      ) : (
        <ul className="divide-y divide-border/60">
          {held.map((bill) => (
            <li key={bill.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {bill.customer_name}
                  {bill.id === currentId ? <span className="ml-2 text-xs font-normal text-primary-strong">(open here)</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(bill.invoice_date)} · {num(bill.line_count)} item(s) · saved {relativeTime(bill.updated_at)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(bill.grand_total, true)}</span>
              <Button size="sm" type="button" onClick={() => onResume(bill.id)} disabled={bill.id === currentId}>
                Resume
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="text-attention-strong hover:bg-attention-soft"
                onClick={() => onDiscard(bill.id)}
              >
                Discard
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
