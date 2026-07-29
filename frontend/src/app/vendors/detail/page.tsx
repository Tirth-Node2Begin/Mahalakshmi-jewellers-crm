"use client";

import { usePermissions } from "@/lib/permissions";
import { vendorsApi, VENDOR_TYPE_LABEL, vendorStatusTone, type VendorPurchase } from "@/features/vendors/api";
import { VendorFormModal } from "@/features/vendors/vendor-form-modal";
import { VendorLedgerPanel } from "@/features/vendors/ledger-panel";
import { RecordVendorPaymentDialog } from "@/features/vendors/record-payment-dialog";
import { vendorPaymentsApi } from "@/features/vendors/payments-api";
import {
  PAYMENT_MODE_LABEL,
  paymentStateLabel,
  paymentStateTone,
  purchasesApi,
} from "@/features/purchases/api";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonCard, SkeletonRows } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Boxes, IndianRupee, Package, Pencil, Plus, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { LucideIcon } from "lucide-react";

type VendorTab = "overview" | "purchases" | "payments" | "ledger";

const VENDOR_TABS: { key: VendorTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "purchases", label: "Purchases" },
  { key: "payments", label: "Payments" },
  { key: "ledger", label: "Account" },
];

function DetailInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<VendorTab>("overview");
  const [payOpen, setPayOpen] = useState(false);

  const validId = Number.isFinite(id) && id > 0;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: () => vendorsApi.detail(id),
    enabled: validId,
  });

  // full purchase history from the purchases module — richer than the summary
  // the vendors endpoint returns (it carries paid / balance figures).
  const { data: purchaseData, isLoading: loadingPurchases } = useQuery({
    queryKey: ["purchases", "list", { supplier_id: id }],
    queryFn: () => purchasesApi.list({ supplier_id: id }),
    enabled: validId && tab === "purchases" && can("purchases.read"),
  });

  const { data: paymentData, isLoading: loadingPayments } = useQuery({
    queryKey: ["vendor-payments", "list", { supplier_id: id }],
    queryFn: () => vendorPaymentsApi.list({ supplier_id: id }),
    // also needed by the payment dialog, for the list of bank accounts
    enabled: validId && (tab === "payments" || payOpen),
  });

  if (isLoading) return <SkeletonCard lines={8} />;
  if (isError || !data)
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Vendor not found.</p>
        <Button variant="secondary" className="mt-4" onClick={() => history.back()}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
      </Card>
    );

  const { vendor, items, purchases, summary } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/vendors" className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground">{vendor.name}</h2>
          <p className="text-sm text-muted-foreground">
            {VENDOR_TYPE_LABEL[vendor.vendor_type]}
            {vendor.specialisation ? ` · ${vendor.specialisation}` : ""}
          </p>
        </div>
        <Badge tone={vendorStatusTone(vendor.vendor_status)}>{vendor.vendor_status}</Badge>
        {can("vendors.manage") ? (
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SpendStat icon={IndianRupee} label="Total purchased" value={formatCurrency(summary.total_purchased)} tone="gold" />
        <SpendStat
          icon={Wallet}
          label="Unpaid"
          value={formatCurrency(summary.unpaid_amount)}
          tone={summary.unpaid_amount > 0 ? "coral" : "gray"}
        />
        <SpendStat icon={Receipt} label="Purchases" value={summary.purchase_count} tone="purple" />
        <SpendStat icon={Boxes} label="Items supplied" value={summary.item_count} tone="gray" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {VENDOR_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-t-lg border-b-2 px-3 pb-3 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-primary-strong" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        {can("payments.vendor") ? (
          <Button variant="cta" size="sm" className="mb-2 ml-auto" onClick={() => setPayOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Record payment
          </Button>
        ) : null}
      </div>

      {tab === "overview" ? (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <dl className="space-y-3 text-sm">
              <Row label="Company" value={vendor.company ?? "—"} />
              <Row label="Person" value={vendor.contact_person ?? "—"} />
              <Row label="Mobile" value={vendor.mobile ?? "—"} />
              <Row label="Email" value={vendor.email ?? "—"} />
              <Row label="City" value={[vendor.city, vendor.state].filter(Boolean).join(", ") || "—"} />
            </dl>
          </Card>
          <Card>
            <CardHeader title="Payment & compliance" />
            <dl className="space-y-3 text-sm">
              <Row label="GSTIN" value={vendor.gstin ?? "—"} />
              <Row label="PAN" value={vendor.pan_no ?? "—"} />
              <Row label="Bank" value={vendor.bank_name ?? "—"} />
              <Row label="Account" value={vendor.account_no ?? "—"} />
              <Row label="IFSC" value={vendor.ifsc ?? "—"} />
              <Row label="UPI" value={vendor.upi ?? "—"} />
              <Row label="Terms" value={vendor.payment_terms ?? "—"} />
              {vendor.karigar_rate ? <Row label="Rate" value={formatCurrency(vendor.karigar_rate)} /> : null}
            </dl>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={`Purchase history (${purchases.length})`} />
            {purchases.length === 0 ? (
              <EmptyState icon={Receipt} title="No purchases recorded yet." hint="Purchases made from this supplier / maker will show up here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">Purchase</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Payment</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 font-mono text-xs text-foreground">{p.purchase_no}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(p.purchase_date)}</td>
                        <td className="py-2.5">
                          <Badge tone={purchaseStatusTone(p.status)}>{p.status}</Badge>
                        </td>
                        <td className="py-2.5">
                          <Badge tone={p.payment_status === "paid" ? "green" : "amber"}>{p.payment_status}</Badge>
                        </td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-foreground">{formatCurrency(p.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title={`Supplied items (${items.length})`} />
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inventory items sourced from this vendor.</p>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id}>
                    <Link href={`/inventory/detail?id=${it.id}`} className="flex items-center gap-3 rounded-input border border-border px-4 py-2 hover:bg-background">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{it.item_code}</span>
                      <Badge tone="gray">{it.jw_status.replace(/_/g, " ")}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </div>
      ) : null}

      {tab === "purchases" ? (
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title="Everything bought from this vendor" />
          {!can("purchases.read") ? (
            <EmptyState icon={Package} title="You cannot see purchases" hint="Ask the owner for the purchases permission." />
          ) : loadingPurchases ? (
            <SkeletonRows rows={6} />
          ) : (purchaseData?.purchases ?? []).length === 0 ? (
            <EmptyState icon={Package} title="No purchases yet" hint="Purchases from this vendor will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-6 py-3">Purchase no.</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Vendor bill</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Paid</th>
                    <th className="px-3 py-3 text-right">Still to pay</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(purchaseData?.purchases ?? []).map((p) => {
                    const due = Number(p.balance_due);
                    const paid = Number(p.paid_amount);
                    return (
                      <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                        <td className="px-6 py-3">
                          <Link
                            href={`/purchases/detail?id=${p.id}`}
                            className="font-mono text-xs font-semibold text-primary-strong hover:underline"
                          >
                            {p.purchase_no}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(p.purchase_date)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{p.invoice_ref ?? "—"}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatCurrency(p.grand_total, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(paid, true)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatCurrency(due, true)}</td>
                        <td className="px-6 py-3">
                          {p.status === "cancelled" ? (
                            <Badge tone="coral">Cancelled</Badge>
                          ) : (
                            <Badge tone={paymentStateTone(due, paid)}>{paymentStateLabel(due, paid)}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "payments" ? (
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title="Money paid to this vendor" />
          {loadingPayments ? (
            <SkeletonRows rows={6} />
          ) : (paymentData?.payments ?? []).length === 0 ? (
            <EmptyState icon={Wallet} title="No payments yet" hint="Payments made to this vendor will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-6 py-3">Payment no.</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Against bill</th>
                    <th className="px-3 py-3">How</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(paymentData?.payments ?? []).map((pay) => (
                    <tr key={pay.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                      <td className="px-6 py-3 font-mono text-xs text-foreground">
                        {pay.payment_no}
                        {pay.status === "cancelled" ? (
                          <Badge tone="coral" className="ml-2">
                            Cancelled
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(pay.payment_date)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                        {pay.purchase_no ?? "On account"}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {PAYMENT_MODE_LABEL[pay.payment_mode] ?? pay.payment_mode}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{pay.ref_no ?? "—"}</td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(pay.amount, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "ledger" ? (
        <Card>
          <CardHeader title="Account statement" />
          <VendorLedgerPanel supplierId={id} />
        </Card>
      ) : null}

      <VendorFormModal open={editOpen} onClose={() => setEditOpen(false)} vendor={vendor} />
      <RecordVendorPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        vendors={[{ id: vendor.id, name: vendor.name, company: vendor.company }]}
        bankAccounts={paymentData?.bank_accounts ?? []}
        defaultSupplierId={vendor.id}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

type StatTone = "gold" | "blue" | "purple" | "coral" | "gray";

const STAT_CHIP_TONE: Record<StatTone, string> = {
  gold: "bg-gold-soft text-gold-strong",
  blue: "bg-blue-soft text-blue-strong",
  purple: "bg-primary-soft text-primary-strong",
  coral: "bg-attention-soft text-attention-strong",
  gray: "bg-background text-muted-foreground",
};

/** Small stat tile for the spend summary row — answers "how much have we bought from this partner". */
function SpendStat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string | number; tone: StatTone }) {
  return (
    <div className="flex flex-col rounded-card bg-card p-4 shadow-card">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", STAT_CHIP_TONE[tone])}>
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="mt-3 truncate text-lg font-bold leading-6 text-foreground tabular-nums">{value}</span>
      <span className="mt-0.5 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function purchaseStatusTone(status: VendorPurchase["status"]): BadgeProps["tone"] {
  if (status === "received") return "green";
  if (status === "cancelled") return "coral";
  return "gray";
}

export default function VendorDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <DetailInner />
    </Suspense>
  );
}
