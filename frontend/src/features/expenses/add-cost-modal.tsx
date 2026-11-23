"use client";

import { expensesApi } from "@/features/expenses/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { invalidateMoneyQueries } from "@/shared/api/invalidate-money";

const NEW_CATEGORY = "__new__";

/** One-dialog "Add cost" flow for the fixed-cost tracker: pick (or create) a
 *  category and add the line item in a single step, so users never have to
 *  detour through the Categories page. */
export function AddCostModal({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  /** Non-system fixed categories the item can go under. */
  categories: { id: number; name: string }[];
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState<string>(NEW_CATEGORY);
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCategoryId(categories[0] ? String(categories[0].id) : NEW_CATEGORY);
      setNewCategory("");
      setName("");
      setAmount("");
      setError(null);
    }
    // reset only when the dialog opens — a background refetch of `categories`
    // must not wipe what the user is typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const creatingCategory = categoryId === NEW_CATEGORY;
    if (creatingCategory && newCategory.trim().length < 2) return setError("Group name must be at least 2 characters.");
    if (name.trim().length < 2) return setError("Cost name must be at least 2 characters.");
    if (amount !== "" && Number(amount) < 0) return setError("Amount can't be negative.");
    setBusy(true);
    setError(null);
    try {
      let catId = Number(categoryId);
      if (creatingCategory) {
        const res = (await expensesApi.addCategory({ name: newCategory.trim(), type: "fixed" })) as { id: number };
        catId = res.id;
        // if the item step below fails, retrying must reuse this category
        // instead of trying to create it again (name conflict)
        setCategoryId(String(catId));
        void queryClient.invalidateQueries({ queryKey: ["expenses"] });
        void queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
        invalidateMoneyQueries(queryClient);
      }
      await expensesApi.addItem({ category_id: catId, name: name.trim(), amount: amount ? Number(amount) : 0 });
      toast.success("Fixed cost added.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      invalidateMoneyQueries(queryClient);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add the cost.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add fixed cost"
      maxWidth={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>Add cost</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="ac_cat" required>Group</Label>
          <Select id="ac_cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_CATEGORY}>+ New group…</option>
          </Select>
        </div>
        {categoryId === NEW_CATEGORY ? (
          <div>
            <Label htmlFor="ac_newcat" required>Group name</Label>
            <Input id="ac_newcat" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Rent" />
          </div>
        ) : null}
        <div>
          <Label htmlFor="ac_name" required>Cost name</Label>
          <Input id="ac_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shop rent" autoFocus />
        </div>
        <div>
          <Label htmlFor="ac_amount">Monthly amount (₹)</Label>
          <Input id="ac_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 25000" />
          <p className="mt-1.5 text-xs text-muted-foreground">Used as the default when you mark it paid each month. Leave blank if it changes.</p>
        </div>
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
