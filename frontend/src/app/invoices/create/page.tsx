"use client";

import {
  billingApi,
  useDefaultTaxRate,
} from "@/features/billing/api";
import {
  billTotals,
  blankOldMetal,
  lineFromStockItem,
  lineToPayload,
  nextKey,
  num,
  oldMetalToPayload,
} from "@/features/billing/calc";
import { CustomerStrip } from "@/features/billing/customer-strip";
import { HeldBillsDialog } from "@/features/billing/held-bills-dialog";
import { ItemSearch } from "@/features/billing/item-search";
import { LineItemsTable } from "@/features/billing/line-items-table";
import { OldMetalPanel } from "@/features/billing/old-metal-panel";
import { PaymentRow } from "@/features/billing/payment-row";
import { TotalsPanel } from "@/features/billing/totals-panel";
import type {
  BillCustomer,
  BillLine,
  InvoiceDetail,
  OldMetalLine,
  PaymentLine,
  PaymentMode,
  PriceMode,
} from "@/features/billing/types";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Files, Gem, Printer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * The New Bill screen — the most-used page in the shop.
 *
 * One screen, no wizard, keyboard first: the scanner types into the item box and
 * presses Enter. Everything on screen is a LIVE ESTIMATE; the server recomputes
 * and re-prices on draft_save and again inside the finalize transaction, so a
 * disagreement between these figures and the printed bill is never fatal.
 */
function BillBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const urlId = Number(params.get("id")) || null;
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canOverride = can("invoices.override");
  const defaultTaxRate = useDefaultTaxRate();

  const [draftId, setDraftId] = useState<number | null>(urlId);
  const [customer, setCustomer] = useState<BillCustomer | null>(null);
  const [walkin, setWalkin] = useState({ name: "", phone: "" });
  const [billDate, setBillDate] = useState(localDateString());
  const [priceMode, setPriceMode] = useState<PriceMode>("exclusive");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [oldMetal, setOldMetal] = useState<OldMetalLine[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  const [heldOpen, setHeldOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [ratesAcknowledged, setRatesAcknowledged] = useState(false);
  const [saving, setSaving] = useState<"" | "draft" | "final">("");

  /* -------------------------------------------------------------- queries */

  // the billing screen's opening payload: today's rates flag, purities, banks
  const { data: meta } = useQuery({
    queryKey: ["billing", "meta"],
    queryFn: () => billingApi.list({}),
    staleTime: 60_000,
  });
  const purities = meta?.purities ?? [];
  const bankAccounts = meta?.bank_accounts ?? [];
  const ratesSetToday = meta?.rates_set_today ?? true;

  const { data: heldData } = useQuery({
    queryKey: ["billing", "held"],
    queryFn: () => billingApi.held(),
    staleTime: 15_000,
  });
  const held = heldData?.held ?? [];

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["billing", "invoice", urlId],
    queryFn: () => billingApi.detail(urlId!),
    enabled: urlId !== null && urlId > 0,
  });

  /* ------------------------------------------------------------ hydration */

  const hydratedFor = useRef<number | null>(null);

  const hydrate = (invoice: InvoiceDetail) => {
    setDraftId(invoice.id);
    setCustomer(
      invoice.customer_id
        ? { id: invoice.customer_id, name: invoice.customer_name ?? "Customer", mobile: invoice.customer_mobile }
        : null,
    );
    setWalkin({ name: invoice.walkin_name ?? "", phone: invoice.walkin_phone ?? "" });
    setBillDate(invoice.invoice_date);
    setPriceMode(invoice.price_mode);
    setDiscount(num(invoice.discount_total));
    setNotes(invoice.notes ?? "");
    setLines(
      invoice.items.map((item) => {
        const qty = num(item.qty) || 1;
        return {
          key: nextKey(),
          item_id: item.inventory_item_id,
          item_code: item.item_code,
          description: item.description,
          huid: item.huid,
          purity_id: null,
          purity_code: item.purity_code,
          tracking: item.item_type === "tagged" ? "tagged" : "bulk",
          qty,
          gross_weight: num(item.gross_weight),
          net_weight: num(item.net_weight),
          rate_per_gram: num(item.rate_per_gram),
          // invoice_items keeps the computed charge, not the scheme it came from,
          // so it round-trips as a fixed amount per piece
          making_type: "fixed",
          making_value: qty > 0 ? num(item.making_charge) / qty : num(item.making_charge),
          discount: num(item.discount),
          tax_rate: num(item.tax_rate),
          tax_treatment: item.tax_treatment,
          exempt_reason: item.exempt_reason,
        } satisfies BillLine;
      }),
    );
    setOldMetal(
      invoice.old_metal.map((row) => ({
        key: nextKey("o"),
        metal: row.metal,
        purity_id: row.purity_id,
        description: row.description ?? "",
        gross_weight: num(row.gross_weight),
        deduction_pct: num(row.deduction_pct),
        rate_per_gram: num(row.rate_per_gram),
      })),
    );
  };

  useEffect(() => {
    const invoice = existing?.invoice;
    if (!invoice || hydratedFor.current === invoice.id) return;
    if (invoice.status !== "draft") {
      toast.error("That bill is already finalised — opening it read-only.");
      router.replace(`/invoices/detail?id=${invoice.id}`);
      return;
    }
    hydratedFor.current = invoice.id;
    hydrate(invoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  /* ------------------------------------------------------------- mutators */

  const addLine = (line: BillLine) => {
    setLines((current) => [...current, line]);
    if (num(line.rate_per_gram) <= 0) {
      toast.warning(`No rate on file for ${line.purity_code ?? "this purity"} — the bill will price it when you save.`);
    }
  };
  const patchLine = (key: string, patch: Partial<BillLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key));

  const patchOldMetal = (key: string, patch: Partial<OldMetalLine>) =>
    setOldMetal((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const totals = billTotals(lines, oldMetal, discount, priceMode);

  const addPayment = (mode: PaymentMode) => {
    setPayments((current) => {
      const received = current.reduce((sum, p) => sum + num(p.amount), 0);
      const remaining = Math.max(0, Math.round((totals.grand - received) * 100) / 100);
      return [...current, { key: nextKey("p"), mode, amount: remaining, bank_account_id: null, ref_no: "" }];
    });
  };
  const patchPayment = (key: string, patch: Partial<PaymentLine>) =>
    setPayments((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const startNew = () => {
    hydratedFor.current = null;
    setDraftId(null);
    setCustomer(null);
    setWalkin({ name: "", phone: "" });
    setBillDate(localDateString());
    setPriceMode("exclusive");
    setDiscount(0);
    setNotes("");
    setLines([]);
    setOldMetal([]);
    setPayments([]);
    router.replace("/invoices/create");
  };

  /* --------------------------------------------------------------- saving */

  const buildPayload = () => ({
    id: draftId ?? undefined,
    customer_id: customer?.id ?? null,
    walkin_name: customer ? null : walkin.name.trim() || null,
    walkin_phone: customer ? null : walkin.phone.trim() || null,
    invoice_date: billDate,
    price_mode: priceMode,
    discount: num(discount),
    notes: notes.trim() || null,
    items: lines.map(lineToPayload),
    old_metal: oldMetal.filter((row) => num(row.gross_weight) > 0).map(oldMetalToPayload),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  /** Pull the server's version of the draft back onto the screen. */
  const refreshFromServer = async (id: number) => {
    try {
      const res = await billingApi.detail(id);
      hydratedFor.current = res.invoice.id;
      hydrate(res.invoice);
    } catch {
      /* the dialog already carries the message that matters */
    }
  };

  const validate = (): boolean => {
    if (lines.length === 0) {
      toast.error("Scan or search an item to start the bill.");
      return false;
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        toast.error("Every line needs a description.");
        return false;
      }
      if (num(line.net_weight) > num(line.gross_weight) + 0.0005 && num(line.gross_weight) > 0) {
        toast.error(`${line.description}: net weight cannot be more than gross weight.`);
        return false;
      }
      if (line.tax_treatment !== "taxable" && !line.exempt_reason) {
        toast.error(`${line.description}: a reason is needed when a line is not taxed.`);
        return false;
      }
    }
    return true;
  };

  const saveDraft = async (): Promise<number | null> => {
    if (!validate()) return null;
    setSaving("draft");
    try {
      const res = await billingApi.draftSave(buildPayload());
      setDraftId(res.id);
      hydratedFor.current = res.id;
      void queryClient.invalidateQueries({ queryKey: ["billing", "held"] });
      return res.id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the draft.");
      return null;
    } finally {
      setSaving("");
    }
  };

  const onSaveDraft = async () => {
    const id = await saveDraft();
    if (id) toast.success("Bill held. You can start another one.");
  };

  const onSaveAndPrint = async () => {
    if (!validate()) return;
    setSaving("final");
    // state updates are async — keep the id in a local so the 409 path can use it
    let savedId = draftId;
    try {
      const res = await billingApi.draftSave(buildPayload());
      savedId = res.id;
      setDraftId(res.id);
      hydratedFor.current = res.id;

      const paymentPayload = payments
        .filter((p) => num(p.amount) > 0)
        .map((p) => ({
          mode: p.mode,
          amount: num(p.amount),
          bank_account_id: p.bank_account_id,
          ref_no: p.ref_no.trim() || null,
        }));

      await billingApi.finalize(res.id, paymentPayload);
      invalidate();
      toast.success("Bill saved.");
      router.push(`/invoices/detail?id=${res.id}&print=1`);
    } catch (e) {
      // 409 = another counter took the same piece first. Expected, not an error
      // to shrug at — show exactly what the server said and refresh the lines.
      if (e instanceof ApiError && e.status === 409) {
        setConflict(e.message);
        if (savedId) void refreshFromServer(savedId);
        invalidate();
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save the bill.");
      }
    } finally {
      setSaving("");
    }
  };

  const discardHeld = async (id: number) => {
    try {
      await billingApi.draftDiscard(id);
      toast.success("Draft discarded.");
      void queryClient.invalidateQueries({ queryKey: ["billing", "held"] });
      if (id === draftId) startNew();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not discard that draft.");
    }
  };

  /* ----------------------------------------------------------------- view */

  if (permissionsLoading) return <SkeletonCard lines={8} />;
  if (!can("invoices.create")) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">You do not have permission to create bills.</p>
      </Card>
    );
  }
  if (urlId !== null && loadingExisting) return <SkeletonCard lines={10} />;

  const ratesBlock = !ratesSetToday && !ratesAcknowledged;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/invoices"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to bills"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h2 className="text-xl font-bold text-foreground">New bill</h2>
        {draftId ? <Badge tone="purple">Held draft #{draftId}</Badge> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {draftId ? (
            <Button variant="ghost" size="sm" type="button" onClick={startNew}>
              Start another bill
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" type="button" onClick={() => setHeldOpen(true)}>
            <Files className="h-4 w-4" aria-hidden /> Bills on hold
            <span className="ml-1 rounded-pill bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-strong">{held.length}</span>
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------- rates not set */}
      {!ratesSetToday ? (
        <div className="flex flex-wrap items-center gap-4 rounded-card border border-warning-strong/30 bg-warning-soft p-4">
          <AlertTriangle className="h-6 w-6 shrink-0 text-warning-strong" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warning-strong">Today&apos;s rates are not set yet</p>
            <p className="text-xs text-warning-strong/80">
              Items will be priced from the last rate entered, which may be yesterday&apos;s. Set today&apos;s gold and silver
              rates before billing.
            </p>
          </div>
          <Link
            href="/rates"
            className="inline-flex h-9 items-center gap-2 rounded-pill bg-card px-4 text-xs font-semibold text-warning-strong shadow-card"
          >
            <TrendingUp className="h-4 w-4" aria-hidden /> Set today&apos;s rates
          </Link>
          {ratesBlock ? (
            <Button variant="ghost" size="sm" type="button" onClick={() => setRatesAcknowledged(true)}>
              Bill anyway
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------------------------------- customer */}
      <Card className="p-4">
        <CustomerStrip
          customer={customer}
          onCustomerChange={setCustomer}
          walkinName={walkin.name}
          walkinPhone={walkin.phone}
          onWalkinChange={(patch) => setWalkin((current) => ({ ...current, ...patch }))}
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* -------------------------------------------------- items + lines */}
        <div className="space-y-5">
          <Card className="p-4">
            <ItemSearch
              disabled={ratesBlock}
              onPick={(item, picked) => addLine(lineFromStockItem(item, purities, defaultTaxRate, picked))}
            />
            <div className="mt-4">
              <LineItemsTable
                lines={lines}
                priceMode={priceMode}
                canOverride={canOverride}
                onChange={patchLine}
                onRemove={removeLine}
                emptyState={
                  <EmptyState
                    icon={Gem}
                    title="Scan the first item"
                    hint="Point the scanner at the tag, or type a few letters of the item name and press Enter."
                  />
                }
              />
            </div>
            {!canOverride && lines.length > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Rates and making charges come from today&apos;s rates and the item tag. Ask a manager to change them.
              </p>
            ) : null}
          </Card>

          <OldMetalPanel
            rows={oldMetal}
            purities={purities}
            onChange={patchOldMetal}
            onAdd={() => setOldMetal((current) => [...current, blankOldMetal(purities)])}
            onRemove={(key) => setOldMetal((current) => current.filter((row) => row.key !== key))}
          />

          <Card className="p-4">
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <div>
                <Label htmlFor="bill_date">Bill date</Label>
                <Input id="bill_date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="h-10" />
              </div>
              <div>
                <Label htmlFor="bill_notes">Note on the bill</Label>
                <Textarea
                  id="bill_notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the customer should see on the printed bill"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------- totals + payment */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <Card className="p-5">
            <TotalsPanel
              totals={totals}
              priceMode={priceMode}
              onPriceModeChange={setPriceMode}
              discount={discount}
              onDiscountChange={setDiscount}
            />
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Money received</p>
            <PaymentRow
              payments={payments}
              total={totals.grand}
              bankAccounts={bankAccounts}
              onAdd={addPayment}
              onChange={patchPayment}
              onRemove={(key) => setPayments((current) => current.filter((p) => p.key !== key))}
            />
            <div className="mt-5 flex flex-col gap-2">
              <Button
                variant="cta"
                type="button"
                className="h-12 text-base"
                disabled={ratesBlock || lines.length === 0}
                loading={saving === "final"}
                onClick={() => void onSaveAndPrint()}
              >
                <Printer className="h-5 w-5" aria-hidden /> Save &amp; Print
              </Button>
              <Button
                variant="secondary"
                type="button"
                disabled={ratesBlock || lines.length === 0}
                loading={saving === "draft"}
                onClick={() => void onSaveDraft()}
              >
                Save draft
              </Button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              The final figures are recalculated by the shop system when the bill is saved.
            </p>
          </Card>
        </div>
      </div>

      <HeldBillsDialog
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
        held={held}
        currentId={draftId}
        onResume={(id) => {
          setHeldOpen(false);
          hydratedFor.current = null;
          router.push(`/invoices/create?id=${id}`);
        }}
        onDiscard={(id) => void discardHeld(id)}
      />

      {/* ------------------------------------------------- counter conflict */}
      <Dialog
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="Another counter got there first"
        maxWidth={480}
        footer={<Button onClick={() => setConflict(null)}>Back to the bill</Button>}
      >
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-attention-soft">
            <AlertTriangle className="h-6 w-6 text-attention-strong" aria-hidden />
          </span>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{conflict}</p>
            <p className="text-sm text-muted-foreground">
              Nothing was billed and nothing was charged. The lines below have been refreshed from stock — remove the piece that
              was sold, or pick a different one, and save again.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default function NewBillPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <BillBuilder />
    </Suspense>
  );
}
