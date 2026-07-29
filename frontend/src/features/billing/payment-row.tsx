"use client";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { Trash2 } from "lucide-react";
import { num } from "./calc";
import type { BankAccount, PaymentLine, PaymentMode } from "./types";

const MODES: Array<{ mode: PaymentMode; label: string }> = [
  { mode: "cash", label: "Cash" },
  { mode: "upi", label: "UPI" },
  { mode: "card", label: "Card" },
  { mode: "bank", label: "Bank" },
  { mode: "cheque", label: "Cheque" },
];

/** Modes that settle into a bank account rather than the cash drawer. */
const NEEDS_ACCOUNT: PaymentMode[] = ["upi", "card", "bank", "cheque"];

/**
 * Money received. Tap a mode to add a split; the first one is pre-filled with
 * whatever is still owed, so a plain cash sale is one tap.
 */
export function PaymentRow({
  payments,
  total,
  bankAccounts,
  onAdd,
  onChange,
  onRemove,
}: {
  payments: PaymentLine[];
  total: number;
  bankAccounts: BankAccount[];
  onAdd: (mode: PaymentMode) => void;
  onChange: (key: string, patch: Partial<PaymentLine>) => void;
  onRemove: (key: string) => void;
}) {
  const received = payments.reduce((sum, p) => sum + num(p.amount), 0);
  const balance = Math.round((total - received) * 100) / 100;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((option) => (
          <button
            key={option.mode}
            type="button"
            onClick={() => onAdd(option.mode)}
            className="rounded-pill border border-border bg-card px-4 py-2 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
          >
            + {option.label}
          </button>
        ))}
      </div>

      {payments.length > 0 ? (
        <ul className="space-y-2">
          {payments.map((payment) => (
            <li key={payment.key} className="flex flex-wrap items-center gap-2 rounded-input border border-border bg-background p-2">
              <span className="w-16 shrink-0 text-sm font-semibold text-foreground">
                {MODES.find((m) => m.mode === payment.mode)?.label ?? payment.mode}
              </span>
              <input
                aria-label="Amount received"
                inputMode="decimal"
                value={payment.amount}
                onChange={(e) => onChange(payment.key, { amount: Number(e.target.value) || 0 })}
                onFocus={(e) => e.target.select()}
                className="h-9 w-32 rounded-[12px] border border-border bg-card px-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none"
              />
              {NEEDS_ACCOUNT.includes(payment.mode) ? (
                <select
                  aria-label="Deposit into"
                  value={payment.bank_account_id ?? ""}
                  onChange={(e) => onChange(payment.key, { bank_account_id: e.target.value ? Number(e.target.value) : null })}
                  className="h-9 rounded-[12px] border border-border bg-card px-2 text-sm transition-colors focus:border-primary focus:outline-none"
                >
                  <option value="">Which account?</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>
              ) : null}
              {payment.mode !== "cash" ? (
                <input
                  aria-label="Reference number"
                  value={payment.ref_no}
                  onChange={(e) => onChange(payment.key, { ref_no: e.target.value })}
                  placeholder={payment.mode === "cheque" ? "Cheque no." : "Ref / UTR"}
                  className="h-9 w-36 rounded-[12px] border border-border bg-card px-2 text-sm transition-colors focus:border-primary focus:outline-none"
                />
              ) : null}
              <Button
                variant="ghost"
                size="iconSm"
                type="button"
                aria-label="Remove this payment"
                className="ml-auto text-muted-foreground hover:text-attention-strong"
                onClick={() => onRemove(payment.key)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing received yet — tap a mode above.</p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Money received</span>
        <span className="font-semibold tabular-nums text-foreground">{formatCurrency(received, true)}</span>
      </div>
      {Math.abs(balance) >= 0.01 ? (
        <div className="flex items-center justify-between text-sm">
          <span className={cn("font-medium", balance > 0 ? "text-attention-strong" : "text-success-strong")}>
            {balance > 0 ? "Balance due" : "Change to return"}
          </span>
          <span className={cn("font-semibold tabular-nums", balance > 0 ? "text-attention-strong" : "text-success-strong")}>
            {formatCurrency(Math.abs(balance), true)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
