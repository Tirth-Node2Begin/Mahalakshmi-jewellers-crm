"use client";

import { PAYMENT_MODE_LABEL, type PaymentMode } from "@/features/purchases/api";
import { vendorPaymentsApi, type BankAccount } from "@/features/vendors/payments-api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * Pay a vendor. Choosing the vendor pulls up their unpaid purchases so the
 * person at the counter can see exactly what is outstanding before typing an
 * amount, and can tie the payment to one bill if they want to.
 */
export function RecordVendorPaymentDialog({
  open,
  onClose,
  vendors,
  bankAccounts,
  defaultSupplierId,
  defaultPurchaseId,
}: {
  open: boolean;
  onClose: () => void;
  vendors: { id: number; name: string; company?: string | null }[];
  bankAccounts: BankAccount[];
  defaultSupplierId?: number | null;
  defaultPurchaseId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [bankId, setBankId] = useState("");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(() => localDateString());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(defaultSupplierId ? String(defaultSupplierId) : "");
    setPurchaseId(defaultPurchaseId ? String(defaultPurchaseId) : "");
    setAmount("");
    setMode("cash");
    setBankId("");
    setRefNo("");
    setDate(localDateString());
    setNotes("");
    setError(null);
  }, [open, defaultSupplierId, defaultPurchaseId]);

  const { data: dueData, isFetching: loadingDue } = useQuery({
    queryKey: ["vendor-payments", "due", supplierId],
    queryFn: () => vendorPaymentsApi.due(Number(supplierId)),
    enabled: open && !!supplierId,
  });

  const duePurchases = dueData?.purchases ?? [];
  const totalDue = duePurchases.reduce((sum, p) => sum + Number(p.balance_due), 0);

  const save = async () => {
    setError(null);
    if (!supplierId) return setError("Choose the vendor you are paying.");
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError("Enter the amount you are paying.");
    if (mode !== "cash" && !bankId) return setError("Choose the account the money is going out of.");
    setBusy(true);
    try {
      await vendorPaymentsApi.create({
        supplier_id: Number(supplierId),
        purchase_id: purchaseId ? Number(purchaseId) : null,
        amount: amt,
        payment_mode: mode,
        bank_account_id: mode === "cash" || !bankId ? null : Number(bankId),
        ref_no: refNo.trim() || null,
        payment_date: date,
        notes: notes.trim() || null,
      });
      toast.success("Payment recorded.");
      void queryClient.invalidateQueries({ queryKey: ["vendor-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not record this payment. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={620}
      title="Record a vendor payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="cta" onClick={() => void save()} loading={busy}>
            Pay {amount ? formatCurrency(Number(amount)) : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="vp_vendor" required>
              Vendor
            </Label>
            <Select
              id="vp_vendor"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setPurchaseId("");
              }}
            >
              <option value="">Choose a vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.company ? ` — ${v.company}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="vp_date" required>
              Payment date
            </Label>
            <Input id="vp_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        {supplierId ? (
          <div className="rounded-input bg-background p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                Bills still to be paid
              </span>
              <span className="text-sm font-semibold text-foreground">{formatCurrency(totalDue, true)}</span>
            </div>
            {loadingDue ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : duePurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing outstanding for this vendor. You can still record a payment on account.
              </p>
            ) : (
              <ul className="space-y-2">
                {duePurchases.map((p) => {
                  const selected = purchaseId === String(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPurchaseId(selected ? "" : String(p.id));
                          if (!selected) setAmount(String(Number(p.balance_due)));
                        }}
                        className={cn(
                          "flex w-full flex-wrap items-center gap-3 rounded-input border px-3 py-2 text-left transition-colors",
                          selected ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-background",
                        )}
                      >
                        <span className="font-mono text-xs text-muted-foreground">{p.purchase_no}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(p.purchase_date)}</span>
                        <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(p.balance_due, true)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Tap a bill to pay it off exactly, or leave them all untapped to pay on account.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="vp_amount" required>
              Amount (₹)
            </Label>
            <Input id="vp_amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="vp_mode" required>
              How are you paying?
            </Label>
            <Select id="vp_mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
              {(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {mode !== "cash" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="vp_bank" required>
                From which account
              </Label>
              <Select id="vp_bank" value={bankId} onChange={(e) => setBankId(e.target.value)}>
                <option value="">Choose…</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.account_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="vp_ref">Reference / cheque number</Label>
              <Input id="vp_ref" value={refNo} onChange={(e) => setRefNo(e.target.value)} maxLength={60} />
            </div>
          </div>
        ) : null}

        <div>
          <Label htmlFor="vp_notes">Note (optional)</Label>
          <Textarea
            id="vp_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={255}
            rows={2}
            placeholder="Anything you want to remember about this payment…"
          />
        </div>

        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
