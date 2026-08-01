"use client";

import {
  PAYMENT_MODE_LABEL,
  paymentStateLabel,
  paymentStateTone,
  purchasesApi,
} from "@/features/purchases/api";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { formatCurrency, formatDate, formatWeight } from "@/shared/utils/format";
import { PurchasePrintSheet } from "@/features/purchases/purchase-print-sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Ban, Printer, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

function PurchaseDetailInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchases", "detail", id],
    queryFn: () => purchasesApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const cancel = async () => {
    if (!reason.trim()) {
      setCancelError("Please write why this purchase is being cancelled.");
      return;
    }
    setBusy(true);
    setCancelError(null);
    try {
      await purchasesApi.cancel(id, reason.trim());
      toast.success("Purchase cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setCancelOpen(false);
      setReason("");
    } catch (e) {
      setCancelError(e instanceof ApiError ? e.message : "Could not cancel this purchase.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <SkeletonCard lines={10} />;
  if (isError || !data) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">That purchase could not be found.</p>
        <Link href="/purchases" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to purchases
        </Link>
      </Card>
    );
  }

  const p = data.purchase;
  const paid = Number(p.paid_amount);
  const due = Number(p.grand_total) - paid;
  const cancelled = p.status === "cancelled";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/purchases"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to purchases"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground">{p.purchase_no}</h2>
          <p className="text-sm text-muted-foreground">
            {formatDate(p.purchase_date)} ·{" "}
            <Link href={`/vendors/detail?id=${p.supplier_id}`} className="font-medium text-primary-strong hover:underline">
              {p.vendor_name}
            </Link>
            {p.invoice_ref ? ` · Vendor bill ${p.invoice_ref}` : ""}
          </p>
        </div>
        {cancelled ? (
          <Badge tone="coral">Cancelled</Badge>
        ) : (
          <Badge tone={paymentStateTone(due, paid)}>{paymentStateLabel(due, paid)}</Badge>
        )}
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print
        </Button>
        {!cancelled && can("purchases.cancel") ? (
          <Button variant="destructive" size="sm" onClick={() => setCancelOpen(true)}>
            <Ban className="h-4 w-4" aria-hidden /> Cancel purchase
          </Button>
        ) : null}
      </div>

      {cancelled && p.cancel_reason ? (
        <Card className="border border-attention-strong/30 bg-attention-soft">
          <p className="flex items-start gap-3 text-sm text-attention-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>This purchase was cancelled.</strong> Reason: {p.cancel_reason}
            </span>
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-0">
            <CardHeader className="px-6 pt-6" title={`What was bought (${p.items.length})`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-6 py-3">Item</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Weight</th>
                    <th className="px-3 py-3 text-right">Rate / g</th>
                    <th className="px-3 py-3 text-right">Making</th>
                    <th className="px-3 py-3 text-right">GST</th>
                    <th className="px-6 py-3 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((line) => (
                    <tr key={line.id} className="border-b border-border/50 last:border-0">
                      <td className="px-6 py-3">
                        <span className="block font-medium text-foreground">
                          {line.description ?? line.item_name ?? "Item"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {line.item_code ? (
                            <span className="font-mono">{line.item_code}</span>
                          ) : (
                            "Making / service charge"
                          )}
                          {line.purity_code ? ` · ${line.purity_code}` : ""}
                          {line.huid ? ` · HUID ${line.huid}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{Number(line.qty)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {Number(line.weight) > 0 ? formatWeight(line.weight) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {Number(line.rate_per_gram) > 0 ? formatCurrency(line.rate_per_gram, true) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {Number(line.making_charge) > 0 ? formatCurrency(line.making_charge, true) : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {Number(line.tax_rate) > 0 ? `${Number(line.tax_rate)}%` : "—"}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(line.line_total, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Payments made (${p.payments.length})`} />
            {p.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing paid against this purchase yet.</p>
            ) : (
              <ul className="space-y-2">
                {p.payments.map((pay) => (
                  <li
                    key={pay.id}
                    className="flex flex-wrap items-center gap-3 rounded-input border border-border px-4 py-3"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{pay.payment_no}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(pay.payment_date)}</span>
                    <span className="text-sm text-foreground">{PAYMENT_MODE_LABEL[pay.payment_mode] ?? pay.payment_mode}</span>
                    {pay.ref_no ? <span className="text-xs text-muted-foreground">Ref {pay.ref_no}</span> : null}
                    <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(pay.amount, true)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!cancelled && due > 0.01 && can("payments.vendor") ? (
              <Link
                href={`/vendors/payments?supplier_id=${p.supplier_id}&purchase_id=${p.id}`}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-pill border border-border bg-card px-5 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
              >
                <Wallet className="h-4 w-4" aria-hidden /> Pay this vendor
              </Link>
            ) : null}
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Totals" />
          <dl className="space-y-3 text-sm">
            <Row label="Goods and charges" value={formatCurrency(p.subtotal, true)} />
            {Number(p.cgst) > 0 ? <Row label="CGST" value={formatCurrency(p.cgst, true)} /> : null}
            {Number(p.sgst) > 0 ? <Row label="SGST" value={formatCurrency(p.sgst, true)} /> : null}
            {Number(p.igst) > 0 ? <Row label="IGST" value={formatCurrency(p.igst, true)} /> : null}
            {Number(p.round_off) !== 0 ? <Row label="Round off" value={formatCurrency(p.round_off, true)} /> : null}
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="font-semibold text-foreground">Bill total</dt>
              <dd className="font-bold tabular-nums text-foreground">{formatCurrency(p.grand_total, true)}</dd>
            </div>
            <Row label="Paid" value={formatCurrency(paid, true)} />
            <div className="flex justify-between gap-4">
              <dt className="font-semibold text-foreground">Still to pay</dt>
              <dd className={`font-bold tabular-nums ${due > 0.01 ? "text-attention-strong" : "text-success-strong"}`}>
                {formatCurrency(Math.max(0, due), true)}
              </dd>
            </div>
          </dl>
          {p.notes ? <p className="mt-5 rounded-input bg-background p-3 text-sm text-muted-foreground">{p.notes}</p> : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Entered by {p.created_by_name ?? "—"}
            {p.voucher_no ? ` · Voucher ${p.voucher_no}` : ""}
          </p>
        </Card>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        maxWidth={460}
        title={`Cancel ${p.purchase_no}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void cancel()} loading={busy}>
              Cancel this purchase
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-3 rounded-input bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              The stock from this purchase goes back out and the accounting entry is reversed. If any piece has already
              been sold, the cancellation will be refused.
            </span>
          </p>
          <div>
            <Label htmlFor="pc_reason" required>
              Why is it being cancelled?
            </Label>
            <Textarea
              id="pc_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={255}
              placeholder="e.g. Wrong weight entered — vendor bill re-issued"
            />
          </div>
          <FieldError message={cancelError ?? undefined} />
        </div>
      </Dialog>

      {/* the paper version — hidden on screen; @media print in globals.css
          prints ONLY this sheet, so the cards above never reach the paper */}
      <div className="hidden print:block">
        <PurchasePrintSheet purchase={p} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export default function PurchaseDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <PurchaseDetailInner />
    </Suspense>
  );
}
