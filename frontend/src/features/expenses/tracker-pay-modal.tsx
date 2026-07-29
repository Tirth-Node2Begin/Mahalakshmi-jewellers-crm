"use client";

import { expensesApi } from "@/features/expenses/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { localDateString } from "@/shared/utils/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface PayTarget {
  itemId: number;
  itemName: string;
  month: number;
  year: number;
  defaultAmount: string;
}

export function TrackerPayModal({
  target,
  banks,
  onClose,
}: {
  target: PayTarget | null;
  banks: { id: number; account_name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateString());
  const [mode, setMode] = useState("cash");
  const [bank, setBank] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setAmount(target.defaultAmount && Number(target.defaultAmount) > 0 ? target.defaultAmount : "");
      // default the payment date to the tracked month so it lands in the right period
      const mm = String(target.month).padStart(2, "0");
      setDate(`${target.year}-${mm}-05`);
      setMode("cash");
      setBank("");
      setError(null);
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    if (!Number(amount)) return setError("Enter the amount paid.");
    if (Number(amount) < 0) return setError("Amount can't be negative.");
    setBusy(true);
    setError(null);
    try {
      await expensesApi.markPaid({
        fixed_cost_item_id: target.itemId,
        month: target.month,
        year: target.year,
        amount: Number(amount),
        payment_date: date,
        payment_mode: mode,
        bank_account_id: bank ? Number(bank) : null,
      });
      toast.success("Marked paid.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title={target ? `Pay ${target.itemName}` : ""}
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Mark paid
          </Button>
        </>
      }
    >
      {target ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {MONTH_NAMES[target.month]} {target.year}
          </p>
          <div>
            <Label htmlFor="t_amount" required>Amount paid (₹)</Label>
            <Input id="t_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="t_date" required>Payment date</Label>
              <Input id="t_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="t_mode">Mode</Label>
              <Select id="t_mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                {["cash", "upi", "bank", "card", "cheque"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {mode !== "cash" ? (
            <div>
              <Label htmlFor="t_bank">Bank account</Label>
              <Select id="t_bank" value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">—</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <FieldError message={error ?? undefined} />
        </div>
      ) : null}
    </Dialog>
  );
}
