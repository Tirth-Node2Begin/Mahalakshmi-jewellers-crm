"use client";

import { billingApi, invoiceStatusLabel, invoiceStatusTone, PAYMENT_MODE_LABELS } from "@/features/billing/api";
import { num } from "@/features/billing/calc";
import { BillPrintSheet, useAutoPrint } from "@/features/billing/print-sheet";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/shared/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Pencil, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

/**
 * One bill, and the paper it prints on.
 *
 * `?print=1` opens the browser print dialog as soon as the bill has loaded —
 * that is what the counter lands on straight after Save & Print. The sheet
 * itself carries the `.print-invoice` class, and globals.css hides everything
 * else on the page when it prints, so no nav or buttons reach the paper.
 */
function BillDetail() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const autoPrint = params.get("print") === "1";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["billing", "invoice", id],
    queryFn: () => billingApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const invoice = data?.invoice;
  useAutoPrint(autoPrint, Boolean(invoice));

  const cancel = useMutation({
    mutationFn: () => billingApi.cancel(id, reason.trim()),
    onSuccess: () => {
      toast.success("Bill cancelled. The stock and the ledger have been put back.");
      setCancelOpen(false);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not cancel the bill."),
  });

  const reprint = async () => {
    if (!invoice) return;
    try {
      // logged server-side so a duplicate print is always attributable
      await billingApi.reprint(invoice.id);
    } catch {
      /* printing must never be blocked by the audit call */
    }
    window.print();
  };

  if (isLoading) return <SkeletonCard lines={10} />;
  if (isError || !invoice) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Bill not found.</p>
        <Link href="/invoices" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to bills
        </Link>
      </Card>
    );
  }

  const balance = num(invoice.grand_total) - num(invoice.paid_amount);
  const isFinal = invoice.status === "final";

  return (
    <div className="space-y-6">
      {/* action bar — hidden on paper by the print rule in globals.css */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/invoices"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to bills"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h2 className="font-mono text-xl font-bold text-foreground">{invoice.invoice_no ?? "Draft bill"}</h2>
        <Badge tone={invoiceStatusTone(invoice.status)}>{invoiceStatusLabel(invoice.status)}</Badge>
        {invoice.customer_id ? (
          <Link href={`/customers/detail?id=${invoice.customer_id}`} className="text-sm font-medium text-primary-strong hover:underline">
            {invoice.customer_name}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{invoice.walkin_name || "Walk-in"}</span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void reprint()}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
          {invoice.status === "draft" && can("invoices.create") ? (
            <Button variant="secondary" size="sm" onClick={() => router.push(`/invoices/create?id=${invoice.id}`)}>
              <Pencil className="h-4 w-4" aria-hidden /> Continue this bill
            </Button>
          ) : null}
          {isFinal && can("invoices.cancel") ? (
            <Button variant="ghost" size="sm" className="text-attention-strong hover:bg-attention-soft" onClick={() => setCancelOpen(true)}>
              <Ban className="h-4 w-4" aria-hidden /> Cancel bill
            </Button>
          ) : null}
        </div>
      </div>

      {invoice.status === "cancelled" ? (
        <div className="rounded-card border border-attention-soft bg-attention-soft p-4 text-sm text-attention-strong">
          This bill was cancelled{invoice.cancel_reason ? `: ${invoice.cancel_reason}` : "."}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <BillPrintSheet invoice={invoice} />

        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-base font-semibold text-foreground">Money received</h3>
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing received against this bill yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(payment.amount, true)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.receipt_no} · {formatDate(payment.payment_date)} ·{" "}
                        {PAYMENT_MODE_LABELS[payment.payment_mode] ?? payment.payment_mode}
                        {payment.account_name ? ` · ${payment.account_name}` : ""}
                        {payment.cheque_number ? ` · Chq ${payment.cheque_number}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {isFinal && balance > 0.005 ? (
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="font-medium text-attention-strong">Balance due</span>
                <span className="font-semibold tabular-nums text-attention-strong">{formatCurrency(balance, true)}</span>
              </div>
            ) : null}
            {isFinal && balance > 0.005 && can("payments.create") ? (
              <Link
                href={`/payments?customer_id=${invoice.customer_id ?? ""}`}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-pill border border-border bg-card px-4 text-xs font-semibold text-primary-strong hover:bg-primary-soft"
              >
                Record money received
              </Link>
            ) : null}
          </Card>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-foreground">Bill trail</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Billed by" value={invoice.created_by_name ?? "—"} />
              <Row label="Bill date" value={formatDate(invoice.invoice_date)} />
              {invoice.finalized_at ? <Row label="Finalised" value={formatDateTime(invoice.finalized_at)} /> : null}
              {invoice.voucher_no ? <Row label="Accounting voucher" value={invoice.voucher_no} /> : null}
              {invoice.estimate_id ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">From estimate</dt>
                  <dd>
                    <Link href={`/estimates/detail?id=${invoice.estimate_id}`} className="font-medium text-primary-strong hover:underline">
                      View estimate
                    </Link>
                  </dd>
                </div>
              ) : null}
              <Row label="Price shown as" value={invoice.price_mode === "inclusive" ? "GST included in price" : "GST extra"} />
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this bill"
        maxWidth={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep the bill
            </Button>
            <Button variant="destructive" disabled={!reason.trim()} loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel the bill
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          The pieces go back into stock and the accounting entries are reversed. The bill number stays used, so the trail is
          intact.
        </p>
        <Label htmlFor="cancel_reason" required>
          Why is this bill being cancelled?
        </Label>
        <Input
          id="cancel_reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Customer changed their mind"
        />
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function BillDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <BillDetail />
    </Suspense>
  );
}
