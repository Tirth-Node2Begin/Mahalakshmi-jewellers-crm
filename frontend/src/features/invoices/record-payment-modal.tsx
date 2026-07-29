"use client";

import { invoicesApi } from "@/features/invoices/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { formatCurrency } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { localDateString } from "@/shared/utils/format";
import { toast } from "sonner";

export function RecordPaymentModal({
  invoiceId,
  balance,
  open,
  onClose,
}: {
  invoiceId: number;
  balance: number;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: helpers } = useQuery({ queryKey: ["invoices", "helpers"], queryFn: () => invoicesApi.helpers(), enabled: open });

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateString());
  const [mode, setMode] = useState("cash");
  const [bank, setBank] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter an amount.");
    if (amt > balance + 0.01) return setError(`Cannot exceed the balance of ${formatCurrency(balance, true)}.`);
    setBusy(true);
    try {
      await invoicesApi.addPayment({
        invoice_id: invoiceId,
        amount: amt,
        payment_date: date,
        payment_mode: mode,
        bank_account_id: bank ? Number(bank) : null,
        cheque_number: mode === "cheque" ? chequeNumber || null : null,
        cheque_date: mode === "cheque" ? chequeDate || null : null,
        cheque_bank: mode === "cheque" ? chequeBank || null : null,
        notes: notes || null,
      });
      toast.success("Payment recorded.");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setAmount("");
      setChequeNumber("");
      setChequeDate("");
      setChequeBank("");
      setNotes("");
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="cta" onClick={() => void save()} loading={busy}>
            Record {amount ? formatCurrency(Number(amount)) : "payment"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="rounded-input bg-background p-3 text-sm text-muted-foreground">
          Outstanding balance: <span className="font-semibold text-foreground">{formatCurrency(balance, true)}</span>
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="p_amount" required>Amount (₹)</Label>
            <Input id="p_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p_date" required>Date</Label>
            <Input id="p_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="p_mode">Mode</Label>
            <Select id="p_mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              {[
                { value: "cash", label: "Cash" },
                { value: "upi", label: "UPI" },
                { value: "bank", label: "Bank Transfer" },
                { value: "card", label: "Card" },
                { value: "cheque", label: "Cheque" },
              ].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          {mode !== "cash" ? (
            <div>
              <Label htmlFor="p_bank">Bank account</Label>
              <Select id="p_bank" value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">—</option>
                {helpers?.bank_accounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        {mode === "cheque" ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="p_cheque">Cheque number</Label>
              <Input id="p_cheque" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p_cheque_date">Cheque date</Label>
              <Input id="p_cheque_date" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p_cheque_bank">Drawee bank / branch</Label>
              <Input id="p_cheque_bank" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
            </div>
          </div>
        ) : null}
        <div className="flex gap-2">
          {[0.5, 1].map((frac) => (
            <button
              key={frac}
              type="button"
              onClick={() => setAmount(String(Math.round(balance * frac * 100) / 100))}
              className="rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background"
            >
              {frac === 1 ? "Full balance" : "Half"}
            </button>
          ))}
        </div>
        <div>
          <Label htmlFor="p_notes">Notes (optional)</Label>
          <Textarea id="p_notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional detail about this payment…" />
        </div>
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
