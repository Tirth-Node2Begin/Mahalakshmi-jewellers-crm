"use client";

import { bankAccountsApi } from "@/features/invoices/api";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Account {
  id: number;
  account_name: string;
  bank_name: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id: string | null;
}

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [form, setForm] = useState({ account_name: "", bank_name: "", account_number: "", ifsc_code: "", upi_id: "" });

  const { data, isLoading } = useQuery({ queryKey: ["bank-accounts"], queryFn: () => bankAccountsApi.list() });

  useEffect(() => {
    if (editing && editing !== "new") {
      setForm({
        account_name: editing.account_name,
        bank_name: editing.bank_name ?? "",
        account_number: editing.account_number ?? "",
        ifsc_code: editing.ifsc_code ?? "",
        upi_id: editing.upi_id ?? "",
      });
    } else if (editing === "new") {
      setForm({ account_name: "", bank_name: "", account_number: "", ifsc_code: "", upi_id: "" });
    }
  }, [editing]);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });

  const save = useMutation({
    mutationFn: () =>
      bankAccountsApi.save({
        id: editing !== "new" && editing ? editing.id : undefined,
        ...form,
      }),
    onSuccess: () => {
      toast.success("Saved.");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => bankAccountsApi.remove(id),
    onSuccess: () => {
      toast.success("Removed.");
      invalidate();
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Shared by invoice payments and expenses.</p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> Add account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon={Landmark} title="No bank accounts" hint="Add one to record non-cash payments against it." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <div className="h-2 rounded-pill bg-[linear-gradient(135deg,var(--grad-brand-from),var(--grad-brand-to))]" />
              <div className="mt-4 flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.account_name}</p>
                  <p className="text-xs text-muted-foreground">{a.bank_name ?? "—"}</p>
                  {a.upi_id ? <p className="text-xs text-muted-foreground">UPI: {a.upi_id}</p> : null}
                </div>
                <Landmark className="h-5 w-5 text-primary-strong" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditing(a as Account)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-attention-strong hover:bg-attention-soft" onClick={() => remove.mutate(a.id)}>
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add bank account" : "Edit bank account"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={form.account_name.trim().length < 2}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <Label htmlFor="b_name" required>Account name</Label>
            <Input id="b_name" value={form.account_name} onChange={(e) => setForm((f) => ({ ...f, account_name: e.target.value }))} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="b_bank">Bank</Label>
              <Input id="b_bank" value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="b_upi">UPI ID</Label>
              <Input id="b_upi" value={form.upi_id} onChange={(e) => setForm((f) => ({ ...f, upi_id: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="b_acc">Account number</Label>
              <Input id="b_acc" value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="b_ifsc">IFSC</Label>
              <Input id="b_ifsc" value={form.ifsc_code} onChange={(e) => setForm((f) => ({ ...f, ifsc_code: e.target.value }))} />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
