"use client";

import { RecordPaymentModal } from "@/features/invoices/record-payment-modal";
import { billingApi, useCompanySettings } from "@/features/billing/api";
import { paymentModeLabel, paymentsApi } from "@/features/invoices/api";
import type { PaymentRow } from "@/features/invoices/types";
import { printPaymentReceipt } from "@/app/invoices/detail/payment-receipt";
import { PermissionGate } from "@/lib/permissions";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BanknoteArrowDown, Check, IndianRupee, Plus, Printer, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { invalidateMoneyQueries } from "@/shared/api/invalidate-money";

const MODE_OPTIONS = [
  { value: "", label: "All modes" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
];

function chequeStatusTone(status: string | null): "green" | "coral" | "amber" | "gray" {
  if (status === "cleared") return "green";
  if (status === "bounced") return "coral";
  if (status === "pending" || status === "deposited") return "amber";
  return "gray";
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [mode, setMode] = useState("");

  const filters = { search: search || undefined, payment_mode: mode || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["payments", "list", filters],
    queryFn: () => paymentsApi.list(filters),
  });

  const payments = data?.payments ?? [];
  const stats = data?.stats;
  const bankAccounts = data?.bank_accounts ?? [];
  const { page, totalPages, pageItems, setPage } = usePagination(payments, 15, [search, mode]);

  // "record payment" flow: pick an open bill, then hand it to the existing RecordPaymentModal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedInvoiceId, setPickedInvoiceId] = useState("");
  const [recordTarget, setRecordTarget] = useState<{ id: number; balance: number } | null>(null);

  const { data: helpers, isLoading: helpersLoading } = useQuery({
    queryKey: ["payments", "helpers"],
    queryFn: () => paymentsApi.helpers(),
    enabled: pickerOpen,
  });

  const openInvoices = helpers?.open_invoices ?? [];

  const startRecording = () => {
    const invoice = openInvoices.find((o) => String(o.id) === pickedInvoiceId);
    if (!invoice) return;
    setPickerOpen(false);
    setRecordTarget({ id: invoice.id, balance: Number(invoice.balance) });
  };

  const closeRecordModal = () => {
    setRecordTarget(null);
    setPickedInvoiceId("");
    void queryClient.invalidateQueries({ queryKey: ["payments"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    invalidateMoneyQueries(queryClient);
  };

  const resetFilters = () => {
    setRawSearch("");
    setMode("");
  };

  // a received cheque sits in Cheques in Hand until the bank confirms it, so the
  // bank balance stays honest. These two actions are what move it on.
  const [chequeTarget, setChequeTarget] = useState<PaymentRow | null>(null);
  const [chequeAction, setChequeAction] = useState<"clear" | "bounce">("clear");
  const [chequeBank, setChequeBank] = useState("");
  const [clearedOn, setClearedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [bounceReason, setBounceReason] = useState("");
  const [chequeSaving, setChequeSaving] = useState(false);

  const openChequeDialog = (payment: PaymentRow, action: "clear" | "bounce") => {
    setChequeTarget(payment);
    setChequeAction(action);
    setChequeBank(payment.bank_account_id ? String(payment.bank_account_id) : "");
    setClearedOn(new Date().toISOString().slice(0, 10));
    setBounceReason("");
  };

  const submitCheque = async () => {
    if (!chequeTarget) return;
    if (chequeAction === "bounce" && bounceReason.trim() === "") {
      toast.error("Please say what the bank said.");
      return;
    }
    setChequeSaving(true);
    try {
      if (chequeAction === "clear") {
        await paymentsApi.clearCheque({
          id: chequeTarget.id,
          bank_account_id: chequeBank ? Number(chequeBank) : null,
          cleared_on: clearedOn,
        });
        toast.success("Cheque marked cleared.");
      } else {
        await paymentsApi.bounceCheque({ id: chequeTarget.id, reason: bounceReason.trim() });
        toast.success("Cheque marked bounced — the bill is due again.");
      }
      setChequeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      invalidateMoneyQueries(queryClient);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the cheque.");
    } finally {
      setChequeSaving(false);
    }
  };

  // the payments list doesn't carry the full bill/company — fetch the bill and print the receipt
  const company = useCompanySettings();
  const printReceipt = async (payment: PaymentRow) => {
    try {
      // an on-account receipt has no bill, so there are no bill totals to show
      const bill = payment.invoice_id ? (await billingApi.detail(payment.invoice_id)).invoice : null;
      printPaymentReceipt({ payment, bill, company });
    } catch {
      toast.error("Could not open the receipt.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Wallet} label="Collected this month" value={stats ? formatCurrency(stats.collected_this_month) : "—"} tone="green" />
        <KpiCard icon={IndianRupee} label="Total collected" value={stats ? formatCurrency(stats.total_collected) : "—"} tone="purple" />
        <KpiCard icon={AlertCircle} label="Cheques pending" value={stats?.cheque_pending_count ?? "—"} tone="amber" />
        <KpiCard icon={Receipt} label="Outstanding" value={stats ? formatCurrency(stats.total_outstanding) : "—"} tone="coral" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input placeholder="Search receipt, bill number or customer…" value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={mode} onChange={(e) => setMode(e.target.value)} className="h-10 w-auto max-w-[180px]">
            {MODE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="payments.create">
            <Button
              variant="cta"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setPickedInvoiceId("");
                setPickerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Record payment
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : payments.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" hint="Payments recorded against bills will show up here." />
        ) : (
          <>
            <div className="hidden grid-cols-[0.9fr_1fr_1.2fr_1fr_1fr_1.2fr_0.9fr] gap-4 border-b border-border bg-background px-4 py-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground md:grid">
              <span>Date</span>
              <span>Receipt</span>
              <span>Customer</span>
              <span>Bill</span>
              <span>Mode</span>
              <span>Bank / Cheque</span>
              <span className="text-right">Amount</span>
            </div>
            {pageItems.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-2 gap-4 border-b border-border/60 px-4 py-4 last:border-0 md:grid-cols-[0.9fr_1fr_1.2fr_1fr_1fr_1.2fr_0.9fr] md:items-center"
              >
                <span className="text-sm text-muted-foreground">{formatDate(p.payment_date)}</span>
                <button
                  onClick={() => void printReceipt(p)}
                  className="text-left font-mono text-sm font-medium text-primary-strong hover:underline"
                  title="View / print receipt"
                >
                  {p.receipt_no}
                </button>
                <span className="truncate text-sm text-foreground">{p.customer_name}</span>
                {p.invoice_id ? (
                  <Link href={`/invoices/detail?id=${p.invoice_id}`} className="truncate text-sm font-medium text-primary-strong hover:underline">
                    {p.invoice_no}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">On account</span>
                )}
                <span className="text-sm text-foreground">{paymentModeLabel(p.payment_mode)}</span>
                <span className="text-sm text-muted-foreground">
                  {p.payment_mode === "cheque" ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {p.cheque_number ? <span className="font-mono text-xs">{p.cheque_number}</span> : null}
                      {p.cheque_status ? <Badge tone={chequeStatusTone(p.cheque_status)}>{p.cheque_status}</Badge> : null}
                      {p.cheque_status === "cleared" ? (
                        <span className="text-xs text-muted-foreground">{p.bank_name ?? ""}</span>
                      ) : p.cheque_status !== "bounced" ? (
                        <PermissionGate permission="payments.create">
                          <span className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openChequeDialog(p, "clear")}>
                              <Check className="h-3.5 w-3.5" aria-hidden /> Cleared
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openChequeDialog(p, "bounce")}>
                              <BanknoteArrowDown className="h-3.5 w-3.5" aria-hidden /> Bounced
                            </Button>
                          </span>
                        </PermissionGate>
                      ) : null}
                    </span>
                  ) : (
                    p.bank_name ?? "—"
                  )}
                </span>
                <span className="flex items-center justify-end gap-2 text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(p.amount, true)}
                  <button
                    onClick={() => void printReceipt(p)}
                    className="text-muted-foreground transition-colors hover:text-primary-strong"
                    aria-label="Print receipt"
                    title="Print receipt"
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                  </button>
                </span>
              </div>
            ))}
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <Dialog
        open={chequeTarget !== null}
        onClose={() => setChequeTarget(null)}
        title={chequeAction === "clear" ? "Cheque cleared" : "Cheque bounced"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setChequeTarget(null)} disabled={chequeSaving}>
              Cancel
            </Button>
            <Button variant="cta" onClick={() => void submitCheque()} disabled={chequeSaving}>
              {chequeSaving ? "Saving…" : chequeAction === "clear" ? "Mark cleared" : "Mark bounced"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {chequeAction === "clear" ? (
              <>
                Cheque {chequeTarget?.cheque_number ?? ""} for{" "}
                <span className="font-semibold text-foreground">{formatCurrency(chequeTarget?.amount ?? 0, true)}</span>{" "}
                has reached the bank. The money moves into that account now.
              </>
            ) : (
              <>
                The bank returned cheque {chequeTarget?.cheque_number ?? ""} for{" "}
                <span className="font-semibold text-foreground">{formatCurrency(chequeTarget?.amount ?? 0, true)}</span>.
                The receipt is cancelled and the bill becomes due again.
              </>
            )}
          </p>

          {chequeAction === "clear" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="cheque_bank">Banked into</Label>
                <Select id="cheque_bank" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)}>
                  <option value="">Choose an account…</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.account_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleared_on">Cleared on</Label>
                <Input id="cleared_on" type="date" value={clearedOn} onChange={(e) => setClearedOn(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="bounce_reason" required>
                What did the bank say?
              </Label>
              <Textarea
                id="bounce_reason"
                rows={3}
                value={bounceReason}
                onChange={(e) => setBounceReason(e.target.value)}
                placeholder="Insufficient funds, signature mismatch…"
              />
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a bill"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button variant="cta" onClick={startRecording} disabled={!pickedInvoiceId}>
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Label htmlFor="pick_invoice" required>Bill with an outstanding balance</Label>
          <Select id="pick_invoice" value={pickedInvoiceId} onChange={(e) => setPickedInvoiceId(e.target.value)} disabled={helpersLoading}>
            <option value="">{helpersLoading ? "Loading…" : "Select a bill…"}</option>
            {openInvoices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.invoice_no} · {o.customer_name} · {formatCurrency(o.balance, true)}
              </option>
            ))}
          </Select>
          {!helpersLoading && openInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills currently have an outstanding balance.</p>
          ) : null}
        </div>
      </Dialog>

      {recordTarget ? (
        <RecordPaymentModal invoiceId={recordTarget.id} balance={recordTarget.balance} open={recordTarget !== null} onClose={closeRecordModal} />
      ) : null}
    </div>
  );
}
