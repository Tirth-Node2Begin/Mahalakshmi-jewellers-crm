"use client";

import { expensesApi, type ExpenseCategory, type FixedItem } from "@/features/expenses/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function CategoryModal({
  open,
  onClose,
  category,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  category?: ExpenseCategory | null;
  defaultType: "fixed" | "variable";
}) {
  const queryClient = useQueryClient();
  const isEdit = !!category;
  const [name, setName] = useState("");
  const [type, setType] = useState<"fixed" | "variable">(defaultType);
  const [subs, setSubs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "");
      setType(category?.type ?? defaultType);
      setSubs("");
      setError(null);
    }
  }, [open, category, defaultType]);

  const save = async () => {
    if (name.trim().length < 2) return setError("Name must be at least 2 characters.");
    setBusy(true);
    setError(null);
    try {
      if (isEdit) await expensesApi.updateCategory({ id: category!.id, name, type });
      else await expensesApi.addCategory({ name, type, subcategories: type === "fixed" ? subs : "" });
      toast.success(isEdit ? "Category updated." : "Category added.");
      void queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save category.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit category" : "New category"}
      maxWidth={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>{isEdit ? "Save" : "Add"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="c_name" required>Name</Label>
          <Input id="c_name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="c_type">Type</Label>
          <Select id="c_type" value={type} onChange={(e) => setType(e.target.value as "fixed" | "variable")} disabled={isEdit}>
            <option value="variable">Variable — one-off spend</option>
            <option value="fixed">Fixed — recurring, tracked monthly</option>
          </Select>
        </div>
        {!isEdit && type === "fixed" ? (
          <div>
            <Label htmlFor="c_subs">Line items (optional)</Label>
            <Textarea id="c_subs" value={subs} onChange={(e) => setSubs(e.target.value)} rows={2} placeholder="Rent, Internet, Electricity" />
            <p className="mt-1.5 text-xs text-muted-foreground">Comma-separated. You can add amounts to each afterward.</p>
          </div>
        ) : null}
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}

export function ItemModal({
  open,
  onClose,
  categoryId,
  item,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  item?: FixedItem | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!item;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setAmount(item?.amount && Number(item.amount) > 0 ? item.amount : "");
      setError(null);
    }
  }, [open, item]);

  const save = async () => {
    if (name.trim().length < 2) return setError("Name must be at least 2 characters.");
    if (amount !== "" && Number(amount) < 0) return setError("Amount can't be negative.");
    setBusy(true);
    setError(null);
    try {
      if (isEdit) await expensesApi.updateItem({ id: item!.id, name, amount: amount ? Number(amount) : 0 });
      else await expensesApi.addItem({ category_id: categoryId, name, amount: amount ? Number(amount) : 0 });
      toast.success(isEdit ? "Item updated." : "Item added.");
      void queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit line item" : "Add line item"}
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>{isEdit ? "Save" : "Add"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="i_name" required>Name</Label>
          <Input id="i_name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label htmlFor="i_amount">Monthly amount (₹, optional)</Label>
          <Input id="i_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <p className="mt-1.5 text-xs text-muted-foreground">Used as the default when marking this paid each month.</p>
        </div>
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
