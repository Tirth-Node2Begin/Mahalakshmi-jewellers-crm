"use client";

import { PAYMENT_MODE_LABEL } from "@/features/purchases/api";
import { VendorLedgerPanel } from "@/features/vendors/ledger-panel";
import { RecordVendorPaymentDialog } from "@/features/vendors/record-payment-dialog";
import { vendorPaymentsApi } from "@/features/vendors/payments-api";
import { PermissionGate, usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { addDaysStr, formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, BookOpen, IndianRupee, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "payments" | "ledger";

function VendorPaymentsInner() {
  const params = useSearchParams();
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("payments");
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState(() => addDaysStr(localDateString(), -90));
  const [to, setTo] = useState(() => localDateString());

  const [payOpen, setPayOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ supplierId?: number; purchaseId?: number }>({});
  const [cancelling, setCancelling] = useState<{ id: number; payment_no: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // deep link from a purchase: /vendors/payments?supplier_id=3&purchase_id=12
  const deepSupplier = params.get("supplier_id");
  const deepPurchase = params.get("purchase_id");
  useEffect(() => {
    if (!deepSupplier) return;
    setSupplierId(deepSupplier);
    setPrefill({
      supplierId: Number(deepSupplier),
      purchaseId: deepPurchase ? Number(deepPurchase) : undefined,
    });
    setPayOpen(true);
  }, [deepSupplier, deepPurchase]);

  const filters = {
    supplier_id: supplierId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-payments", "list", filters],
    queryFn: () => vendorPaymentsApi.list(filters),
  });

  const vendors = data?.vendors ?? [];
  const bankAccounts = data?.bank_accounts ?? [];
  const allPayments = data?.payments ?? [];
  const payments = allPayments.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.payment_no.toLowerCase().includes(q) ||
      p.vendor_name.toLowerCase().includes(q) ||
      (p.ref_no ?? "").toLowerCase().includes(q) ||
      (p.purchase_no ?? "").toLowerCase().includes(q)
    );
  });

  const { page, totalPages, pageItems, setPage } = usePagination(payments, 15, [search, supplierId, from, to]);
  const paidTotal = payments.filter((p) => p.status === "active").reduce((sum, p) => sum + Number(p.amount), 0);

  const openRecord = () => {
    setPrefill({ supplierId: supplierId ? Number(supplierId) : undefined });
    setPayOpen(true);
  };

  const cancelPayment = async () => {
    if (!cancelling) return;
    if (!cancelReason.trim()) {
      setCancelError("Please write why this payment is being cancelled.");
      return;
    }
    setBusy(true);
    setCancelError(null);
    try {
      await vendorPaymentsApi.cancel(cancelling.id, cancelReason.trim());
      toast.success("Payment cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["vendor-payments"] });
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
      setCancelling(null);
      setCancelReason("");
    } catch (e) {
      setCancelError(e instanceof ApiError ? e.message : "Could not cancel this payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard icon={Wallet} label="Payments in this period" value={payments.length} tone="purple" />
        <KpiCard icon={IndianRupee} label="Paid out" value={formatCurrency(paidTotal)} tone="green" />
        <KpiCard icon={BookOpen} label="Vendors" value={vendors.length} tone="sky" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap gap-2 border-b border-border p-4 pb-0">
          {(
            [
              { key: "payments", label: "Payments" },
              { key: "ledger", label: "Vendor account" },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
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
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          {tab === "payments" ? (
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="vpl_search">Search</Label>
              <Input
                id="vpl_search"
                placeholder="Payment number, vendor or reference…"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="h-11"
              />
            </div>
          ) : null}
          <div className="min-w-[200px]">
            <Label htmlFor="vpl_vendor">Vendor</Label>
            <Select id="vpl_vendor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="h-11">
              <option value="">{tab === "ledger" ? "Choose a vendor…" : "All vendors"}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          {tab === "payments" ? (
            <>
              <div>
                <Label htmlFor="vpl_from">From</Label>
                <Input id="vpl_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 w-auto" />
              </div>
              <div>
                <Label htmlFor="vpl_to">To</Label>
                <Input id="vpl_to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 w-auto" />
              </div>
            </>
          ) : null}
          <PermissionGate permission="payments.vendor">
            <Button variant="cta" size="sm" className="ml-auto" onClick={openRecord}>
              <Plus className="h-4 w-4" aria-hidden /> Record payment
            </Button>
          </PermissionGate>
        </div>

        {tab === "ledger" ? (
          <div className="p-4">
            <VendorLedgerPanel supplierId={supplierId ? Number(supplierId) : null} />
          </div>
        ) : isLoading ? (
          <SkeletonRows rows={8} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payments in this period"
            hint="Change the dates, or record what you have paid a vendor."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-left text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                    <th className="px-4 py-3">Payment no.</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Vendor</th>
                    <th className="px-3 py-3">Against bill</th>
                    <th className="px-3 py-3">How</th>
                    <th className="px-3 py-3">Reference</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-background">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{p.payment_no}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                      <td className="px-3 py-3 font-medium text-foreground">{p.vendor_name}</td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.purchase_no ?? "On account"}</td>
                      <td className="px-3 py-3 text-foreground">
                        {PAYMENT_MODE_LABEL[p.payment_mode] ?? p.payment_mode}
                        {p.account_name ? <span className="block text-xs text-muted-foreground">{p.account_name}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{p.ref_no ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(p.amount, true)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {p.status === "cancelled" ? (
                            <Badge tone="coral">Cancelled</Badge>
                          ) : can("payments.cancel") ? (
                            <button
                              onClick={() => {
                                setCancelling({ id: p.id, payment_no: p.payment_no });
                                setCancelReason("");
                                setCancelError(null);
                              }}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-attention-strong"
                              title="Cancel this payment"
                              aria-label="Cancel this payment"
                            >
                              <Ban className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      {tab === "ledger" && supplierId ? (
        <p className="text-sm text-muted-foreground">
          Looking for everything about this vendor?{" "}
          <Link href={`/vendors/detail?id=${supplierId}`} className="font-medium text-primary-strong hover:underline">
            Open their page
          </Link>
          .
        </p>
      ) : null}

      <RecordVendorPaymentDialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        vendors={vendors}
        bankAccounts={bankAccounts}
        defaultSupplierId={prefill.supplierId ?? null}
        defaultPurchaseId={prefill.purchaseId ?? null}
      />

      <Dialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        maxWidth={440}
        title={cancelling ? `Cancel ${cancelling.payment_no}?` : "Cancel payment"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => void cancelPayment()} loading={busy}>
              Cancel this payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-input bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            The money goes back into your account books and the bill it was paid against becomes unpaid again.
          </p>
          <div>
            <Label htmlFor="vpc_reason" required>
              Why is it being cancelled?
            </Label>
            <Textarea
              id="vpc_reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={255}
              placeholder="e.g. Entered twice by mistake"
            />
          </div>
          <FieldError message={cancelError ?? undefined} />
        </div>
      </Dialog>
    </div>
  );
}

export default function VendorPaymentsPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <VendorPaymentsInner />
    </Suspense>
  );
}
