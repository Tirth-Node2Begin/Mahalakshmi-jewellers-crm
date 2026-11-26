"use client";

import { usePermissions } from "@/lib/permissions";
import {
  PARTNER_PAGES,
  vendorsApi,
  vendorStatusTone,
  type VendorPaymentRow,
  type VendorPurchase,
} from "@/features/vendors/api";
import { VendorFormModal } from "@/features/vendors/vendor-form-modal";
import { useVendorTypes } from "@/features/vendors/vendor-type-select";
import { VendorLedgerPanel } from "@/features/vendors/ledger-panel";
import { RecordVendorPaymentDialog } from "@/features/vendors/record-payment-dialog";
import { vendorPaymentsApi } from "@/features/vendors/payments-api";
import { PAYMENT_MODE_LABEL, paymentStateLabel, paymentStateTone } from "@/features/purchases/api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Boxes,
  IndianRupee,
  Package,
  Pencil,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { LucideIcon } from "lucide-react";

type VendorTab = "overview" | "purchases" | "payments" | "items" | "ledger";

const VENDOR_TABS: { key: VendorTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "purchases", label: "Purchases" },
  { key: "payments", label: "Payments" },
  { key: "items", label: "Items supplied" },
  { key: "ledger", label: "Account" },
];

function DetailInner() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const { can } = usePermissions();
  const { labelOf, categoryOf } = useVendorTypes();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<VendorTab>("overview");
  const [payOpen, setPayOpen] = useState(false);

  const validId = Number.isFinite(id) && id > 0;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vendors", "detail", id],
    queryFn: () => vendorsApi.detail(id),
    enabled: validId,
  });

  // only needed for the bank-account picker inside the payment dialog
  const { data: paymentMeta } = useQuery({
    queryKey: ["vendor-payments", "list", { supplier_id: id }],
    queryFn: () => vendorPaymentsApi.list({ supplier_id: id }),
    enabled: validId && payOpen,
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

  const { vendor, items, purchases, payments, summary } = data;
  const owed = summary.balance_due;
  const address = [vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={PARTNER_PAGES[categoryOf(vendor.vendor_type)].href}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label={`Back to ${PARTNER_PAGES[categoryOf(vendor.vendor_type)].label.toLowerCase()}`}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground">{vendor.name}</h2>
          <p className="text-sm text-muted-foreground">
            {labelOf(vendor.vendor_type)}
            {vendor.company ? ` · ${vendor.company}` : ""}
            {vendor.specialisation ? ` · ${vendor.specialisation}` : ""}
          </p>
        </div>
        <Badge tone={vendorStatusTone(vendor.vendor_status)}>{vendor.vendor_status}</Badge>
        {can("vendors.manage") ? (
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)} aria-label="Edit vendor">
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SpendStat icon={IndianRupee} label="Total purchased" value={formatCurrency(summary.total_purchased)} tone="gold" />
        <SpendStat icon={Wallet} label="Total paid" value={formatCurrency(summary.total_paid)} tone="blue" />
        <SpendStat
          icon={Wallet}
          label={owed < 0 ? "Advance with them" : "Still to pay"}
          value={formatCurrency(Math.abs(owed))}
          tone={owed > 0 ? "coral" : "gray"}
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
              tab === t.key
                ? "border-primary text-primary-strong"
                : "border-transparent text-muted-foreground hover:text-foreground",
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
                <Row label="Company" value={vendor.company} />
                <Row label="Person" value={vendor.contact_person} />
                <Row label="Mobile" value={vendor.mobile} />
                <Row label="WhatsApp" value={vendor.whatsapp} />
                <Row label="Email" value={vendor.email} />
                <Row label="Address" value={address} />
              </dl>
            </Card>

            <Card>
              <CardHeader title="Payment & compliance" />
              <dl className="space-y-3 text-sm">
                <Row label="GSTIN" value={vendor.gstin} />
                <Row label="PAN" value={vendor.pan_no} />
                <Row label="Bank" value={vendor.bank_name} />
                <Row label="Account" value={vendor.account_no} />
                <Row label="IFSC" value={vendor.ifsc} />
                <Row label="UPI" value={vendor.upi} />
                <Row label="Terms" value={vendor.payment_terms} />
                {Number(vendor.karigar_rate ?? 0) > 0 ? (
                  <Row label="Making rate" value={formatCurrency(Number(vendor.karigar_rate))} />
                ) : null}
                {summary.opening_balance !== 0 ? (
                  <Row
                    label="Opening balance"
                    value={`${formatCurrency(Math.abs(summary.opening_balance))} ${summary.opening_balance > 0 ? "we owed" : "advance"}`}
                  />
                ) : null}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Activity" />
              <dl className="space-y-3 text-sm">
                <Row label="Last purchase" value={summary.last_purchase_date ? formatDate(summary.last_purchase_date) : null} />
                <Row label="Last payment" value={summary.last_payment_date ? formatDate(summary.last_payment_date) : null} />
                <Row label="Payments made" value={String(summary.payment_count)} />
                <Row label="Unpaid bills" value={formatCurrency(summary.unpaid_amount)} />
                <Row label="Added on" value={formatDate(vendor.created_at)} />
              </dl>
            </Card>

            {vendor.notes ? (
              <Card>
                <CardHeader title="Notes" />
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{vendor.notes}</p>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 lg:col-span-2">
            <Card className="p-0">
              <CardHeader className="px-6 pt-6" title={`Recent purchases (${purchases.length})`} />
              <PurchaseTable rows={purchases.slice(0, 8)} canOpen={can("purchases.read")} />
              {purchases.length > 8 ? (
                <div className="px-6 pb-4">
                  <Button variant="ghost" size="sm" onClick={() => setTab("purchases")}>
                    See all purchases
                  </Button>
                </div>
              ) : null}
            </Card>

            <Card className="p-0">
              <CardHeader className="px-6 pt-6" title={`Recent payments (${payments.length})`} />
              <PaymentTable rows={payments.slice(0, 8)} />
              {payments.length > 8 ? (
                <div className="px-6 pb-4">
                  <Button variant="ghost" size="sm" onClick={() => setTab("payments")}>
                    See all payments
                  </Button>
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "purchases" ? (
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title="Everything bought from this vendor" />
          <PurchaseTable rows={purchases} canOpen={can("purchases.read")} />
        </Card>
      ) : null}

      {tab === "payments" ? (
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title="Money paid to this vendor" />
          <PaymentTable rows={payments} />
        </Card>
      ) : null}

      {tab === "items" ? (
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title={`Stock sourced from this vendor (${items.length})`} />
          {items.length === 0 ? (
            <EmptyState icon={Boxes} title="Nothing sourced yet" hint="Items received from this vendor will appear here." />
          ) : (
            <ul className="px-6 pb-6">
              {items.map((it) => (
                <li key={it.id}>
                  <Link
                    href={`/inventory/detail?id=${it.id}`}
                    className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0 hover:bg-background"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{it.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{it.item_code}</span>
                    <Badge tone="gray">{it.status.replace(/_/g, " ")}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
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
        bankAccounts={paymentMeta?.bank_accounts ?? []}
        defaultSupplierId={vendor.id}
      />
    </div>
  );
}

function PurchaseTable({ rows, canOpen }: { rows: VendorPurchase[]; canOpen: boolean }) {
  if (rows.length === 0) {
    return <EmptyState icon={Package} title="No purchases yet" hint="Bills raised by this vendor will appear here." />;
  }
  return (
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
          {rows.map((p) => {
            const due = Number(p.balance_due);
            const paid = Number(p.paid_amount);
            return (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                <td className="px-6 py-3">
                  {canOpen ? (
                    <Link
                      href={`/purchases/detail?id=${p.id}`}
                      className="font-mono text-xs font-semibold text-primary-strong hover:underline"
                    >
                      {p.purchase_no}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-foreground">{p.purchase_no}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{formatDate(p.purchase_date)}</td>
                <td className="px-3 py-3 text-muted-foreground">{p.invoice_ref ?? "—"}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                  {formatCurrency(p.grand_total, true)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(paid, true)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{formatCurrency(due, true)}</td>
                <td className="px-6 py-3">
                  {p.status === "cancelled" ? (
                    <Badge tone="coral">Cancelled</Badge>
                  ) : p.status === "draft" ? (
                    <Badge tone="gray">Draft</Badge>
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
  );
}

function PaymentTable({ rows }: { rows: VendorPaymentRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Wallet} title="No payments yet" hint="Payments made to this vendor will appear here." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
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
          {rows.map((pay) => (
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
              <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{pay.purchase_no ?? "On account"}</td>
              <td className="px-3 py-3 text-foreground">
                {PAYMENT_MODE_LABEL[pay.payment_mode] ?? pay.payment_mode}
                {pay.account_name ? <span className="text-muted-foreground"> · {pay.account_name}</span> : null}
              </td>
              <td className="px-3 py-3 text-muted-foreground">{pay.ref_no ?? "—"}</td>
              <td
                className={cn(
                  "px-6 py-3 text-right font-semibold tabular-nums",
                  pay.status === "cancelled" ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {formatCurrency(pay.amount, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value || "—"}</dd>
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
function SpendStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: StatTone;
}) {
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

export default function VendorDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={8} />}>
      <DetailInner />
    </Suspense>
  );
}
