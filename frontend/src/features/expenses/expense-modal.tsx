"use client";

import { expensesApi, type Expense, type ExpenseCategory } from "@/features/expenses/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { localDateString } from "@/shared/utils/format";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function ExpenseModal({
  open,
  onClose,
  expense,
  categories,
  banks,
}: {
  open: boolean;
  onClose: () => void;
  expense?: Expense | null;
  categories: ExpenseCategory[];
  banks: { id: number; account_name: string }[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!expense;
  const [form, setForm] = useState({
    category_id: "",
    amount: "",
    expense_date: localDateString(),
    paid_to: "",
    payment_mode: "cash",
    bank_account_id: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        category_id: expense ? String(expense.category_id) : "",
        amount: expense?.amount ?? "",
        expense_date: expense?.expense_date ?? localDateString(),
        paid_to: expense?.paid_to ?? "",
        payment_mode: expense?.payment_mode ?? "cash",
        bank_account_id: "",
        description: expense?.description ?? "",
      });
      setError(null);
    }
  }, [open, expense]);

  const save = async () => {
    setError(null);
    if (!form.category_id) return setError("Pick a category.");
    if (!Number(form.amount)) return setError("Enter an amount.");
    if (Number(form.amount) < 0) return setError("Amount can't be negative.");
    setBusy(true);
    try {
      const payload = {
        category_id: Number(form.category_id),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        paid_to: form.paid_to || null,
        payment_mode: form.payment_mode,
        bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
        description: form.description || null,
      };
      if (isEdit) await expensesApi.update({ id: expense!.id, ...payload });
      else await expensesApi.create(payload);
      toast.success(isEdit ? "Expense updated." : "Expense recorded.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save expense.");
    } finally {
      setBusy(false);
    }
  };

  // only Variable, non-system categories are selectable for manual entry
  const selectable = categories.filter((c) => c.type === "variable" && c.is_system === 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit expense" : "Add expense"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            {isEdit ? "Save" : "Record expense"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="e_cat" required>Category</Label>
            <Select id="e_cat" value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
              <option value="">Select…</option>
              {selectable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="e_amount" required>Amount (₹)</Label>
            <Input id="e_amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="e_date">Date</Label>
            <Input id="e_date" type="date" value={form.expense_date} onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))} />
          </div>
          <div>
            <Label htmlFor="e_paidto">Paid to</Label>
            <Input id="e_paidto" value={form.paid_to} onChange={(e) => setForm((f) => ({ ...f, paid_to: e.target.value }))} />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="e_mode">Payment mode</Label>
            <Select id="e_mode" value={form.payment_mode} onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))}>
              {["cash", "upi", "bank", "card", "cheque"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          {form.payment_mode !== "cash" ? (
            <div>
              <Label htmlFor="e_bank">Bank account</Label>
              <Select id="e_bank" value={form.bank_account_id} onChange={(e) => setForm((f) => ({ ...f, bank_account_id: e.target.value }))}>
                <option value="">—</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        <div>
          <Label htmlFor="e_desc">Description</Label>
          <Textarea id="e_desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
        </div>
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
