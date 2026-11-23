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
import { ItemDetailsDialog } from "@/features/billing/item-details-dialog";
import { ItemSearch } from "@/features/billing/item-search";
import { LineItemsTable } from "@/features/billing/line-items-table";
import { OldMetalPanel } from "@/features/billing/old-metal-panel";
import { PaymentRow } from "@/features/billing/payment-row";
import { TotalsPanel } from "@/features/billing/totals-panel";
import type {
  BillTaxMode,
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
import { cn } from "@/shared/utils/cn";
import { formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Files, Gem, Printer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { invalidateMoneyQueries } from "@/shared/api/invalidate-money";

/**
 * The four steps of a bill, shown ONE AT A TIME. The counter answers a single
 * question per screen and presses Next; finished steps are a tap away on the
 * rail. Old metal is a full step so it is never missed, but everything on it is
 * optional — Next walks straight past it.
 */
const STEPS = [
  { title: "Customer", heading: "Who is buying?", hint: "Pick a customer already on file, or add them in a moment." },
  { title: "Items", heading: "What are they buying?", hint: "Scan the tag, tap the box to browse, or type to search." },
  {
    title: "Old metal",
    heading: "Old gold or silver given?",
    hint: "Optional — its value comes off the bill. Press Next to skip.",
  },
  { title: "Payment", heading: "Money received", hint: "Tap how they are paying — the amount owed is filled in for you." },
] as const;

const WITHOUT_GST_REASON = "Without GST";

/**
 * The New Bill screen — the most-used page in the shop.
 *
 * Step-by-step, keyboard first: the scanner types into the item box and presses
 * Enter. Everything on screen is a LIVE ESTIMATE; the server recomputes and
 * re-prices on draft_save and again inside the finalize transaction, so a
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
  // Step 1 is answered by picking a customer. Until then step 2 stays shut: staff
  // opening a bare search box could not tell whether it wanted a customer or an
  // item. Set on hydrate too, so a draft saved as a walk-in before walk-in billing
  // was removed still opens on its items instead of demanding a customer.
  const [customerChosen, setCustomerChosen] = useState(false);
  const [walkin, setWalkin] = useState({ name: "", phone: "" });
  const [billDate, setBillDate] = useState(localDateString());
  const [priceMode, setPriceMode] = useState<BillTaxMode>("exclusive");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [oldMetal, setOldMetal] = useState<OldMetalLine[]>([]);
  const [payments, setPayments] = useState<PaymentLine[]>([]);

  /** The line the step-by-step details dialog is showing, if any. */
  const [editing, setEditing] = useState<{ line: BillLine; isNew: boolean } | null>(null);
  /** Which of the four STEPS is on screen. One at a time — this IS the page. */
  const [step, setStep] = useState(0);
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
  const categories = meta?.categories ?? [];
  const bankAccounts = meta?.bank_accounts ?? [];
  const ratesSetToday = meta?.rates_set_today ?? true;
  const canUseNonGstBilling = meta?.can_non_gst_billing ?? false;

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
    // a resumed draft already answered the customer question — open on its items
    setCustomerChosen(true);
    setStep(1);
    const invoiceWithoutGst = invoice.items.length > 0 && invoice.items.every((item) => item.tax_treatment !== "taxable");
    setBillDate(invoice.invoice_date);
    setPriceMode(invoiceWithoutGst ? "without_gst" : invoice.price_mode);
    // the whole-bill box holds only the whole-bill figure; the per-line
    // discounts live on the lines and are summed into discount_total
    setDiscount(num(invoice.bill_discount));
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
          tax_treatment: "taxable",
          exempt_reason: null,
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
  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key));

  /**
   * A scanned TAGGED piece carrying a rate lands on the bill straight away and
   * the scanner keeps its rhythm. Anything sold by weight, or any item with no
   * rate on file, opens the detail dialog so the bill cannot sit at zero.
   */
  const onPickItem = (line: BillLine) => {
    if (line.tracking === "bulk" || num(line.rate_per_gram) <= 0) {
      setEditing({ line, isNew: true });
      return;
    }
    addLine(line);
  };

  const onSaveDetails = (line: BillLine) => {
    if (editing?.isNew) {
      addLine(line);
    } else {
      setLines((current) => current.map((row) => (row.key === line.key ? line : row)));
    }
    setEditing(null);
  };

  const patchOldMetal = (key: string, patch: Partial<OldMetalLine>) =>
    setOldMetal((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const withoutGst = priceMode === "without_gst";
  const serverPriceMode: PriceMode = priceMode === "inclusive" ? "inclusive" : "exclusive";
  const billLines: BillLine[] = lines.map((line) =>
    withoutGst
      ? { ...line, tax_treatment: "non_gst", exempt_reason: WITHOUT_GST_REASON }
      : { ...line, tax_treatment: "taxable", exempt_reason: null },
  );
  const totals = billTotals(billLines, oldMetal, discount, serverPriceMode);

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
    setCustomerChosen(false);
    setWalkin({ name: "", phone: "" });
    setBillDate(localDateString());
    setPriceMode("exclusive");
    setDiscount(0);
    setNotes("");
    setLines([]);
    setOldMetal([]);
    setPayments([]);
    setStep(0);
    router.replace("/invoices/create");
  };

  /* --------------------------------------------------------------- saving */

  const buildPayload = () => ({
    id: draftId ?? undefined,
    customer_id: customer?.id ?? null,
    walkin_name: customer ? null : walkin.name.trim() || null,
    walkin_phone: customer ? null : walkin.phone.trim() || null,
    invoice_date: billDate,
    price_mode: serverPriceMode,
    discount: num(discount),
    notes: notes.trim() || null,
    items: billLines.map(lineToPayload),
    old_metal: oldMetal.filter((row) => num(row.gross_weight) > 0).map(oldMetalToPayload),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["billing"] });
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    invalidateMoneyQueries(queryClient);
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
        // the fix lives on the items step — put the counter back there
        setStep(1);
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
  const step1Done = customer !== null || customerChosen;
  const onLastStep = step === STEPS.length - 1;

  /** Leaving a step checks it; going back never does. */
  const next = () => {
    if (step === 0 && !step1Done) {
      toast.error("Choose the customer first — tap Walk-in if they are not a regular.");
      return;
    }
    if (step === 1 && !validate()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/invoices"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to bills"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
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

      {/* ------------------------------------------------- the step rail */}
      <ol className="flex items-center gap-2 px-1">
        {STEPS.map((s, idx) => {
          const done = idx < step;
          return (
            <li key={s.title} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                // finished steps are a tap away; the future stays behind Next
                onClick={() => (done ? setStep(idx) : undefined)}
                disabled={!done}
                aria-current={idx === step ? "step" : undefined}
                aria-label={done ? `Back to ${s.title}` : s.title}
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  done && "bg-success-soft text-success-strong hover:bg-success-soft/70",
                  idx === step && "bg-primary text-white shadow-card",
                  idx > step && "bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : idx + 1}
              </button>
              <span
                className={cn(
                  "truncate text-sm font-semibold",
                  idx === step ? "text-foreground" : "hidden text-muted-foreground sm:block",
                )}
              >
                {s.title}
              </span>
              {idx < STEPS.length - 1 ? <span className="h-px min-w-3 flex-1 bg-border" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      {/* ------------------------------------------------ the current step */}
      {/* No min-height: the customer step is two cards tall and a fixed floor
          left a slab of empty white under it. */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-foreground">{STEPS[step].heading}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{STEPS[step].hint}</p>
        </div>

        {/* ------------------------------------------- 1. who is buying */}
        {step === 0 ? (
          <CustomerStrip
            customer={customer}
            onCustomerChange={(c) => {
              setCustomer(c);
              // picking a customer IS the answer — walk straight to the items, no
              // Next press. "Change" clears it and puts the two choices back.
              setCustomerChosen(c !== null);
              if (c) setStep(1);
            }}
            walkinName={walkin.name}
            walkinPhone={walkin.phone}
            onWalkinChange={(patch) => setWalkin((current) => ({ ...current, ...patch }))}
            requireChoice
            chosen={customerChosen}
          />
        ) : null}

        {/* ---------------------------------------- 2. what they buy */}
        {step === 1 ? (
          <div className="space-y-4">
            <ItemSearch
              // landing on this step must not grab the caret or open the list —
              // the counter taps the box when they are ready
              autoFocus={false}
              disabled={ratesBlock}
              categories={categories}
              excludeIds={lines.map((l) => l.item_id).filter((id): id is number => id !== null)}
              onPick={(item, picked) => onPickItem(lineFromStockItem(item, purities, defaultTaxRate, picked))}
            />
            <LineItemsTable
              lines={billLines}
              priceMode={serverPriceMode}
              onEdit={(key) => {
                const line = lines.find((row) => row.key === key);
                if (line) setEditing({ line, isNew: false });
              }}
              onRemove={removeLine}
              emptyState={
                <EmptyState
                  icon={Gem}
                  title="Scan the first item"
                  hint="Point the scanner at the tag, tap the box to browse the stock list, or type a few letters and press Enter."
                />
              }
            />
            {!canOverride && lines.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Rates and making charges come from today&apos;s rates and the item tag. Ask a manager to change them.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------- 3. old metal + bill details */}
        {step === 2 ? (
          <div className="space-y-5">
            <OldMetalPanel
              rows={oldMetal}
              purities={purities}
              onChange={patchOldMetal}
              onAdd={() => setOldMetal((current) => [...current, blankOldMetal(purities)])}
              onRemove={(key) => setOldMetal((current) => current.filter((row) => row.key !== key))}
            />
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
          </div>
        ) : null}

        {/* -------------------------------------- 4. totals + payment */}
        {step === 3 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <TotalsPanel
              totals={totals}
              priceMode={priceMode}
              onPriceModeChange={setPriceMode}
              discount={discount}
              onDiscountChange={setDiscount}
              allowWithoutGst={canUseNonGstBilling}
            />
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">Money received</p>
              <PaymentRow
                payments={payments}
                total={totals.grand}
                bankAccounts={bankAccounts}
                onAdd={addPayment}
                onChange={patchPayment}
                onRemove={(key) => setPayments((current) => current.filter((p) => p.key !== key))}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                The final figures are recalculated by the shop system when the bill is saved.
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      {/* -------------------------------- the bar that drives the flow */}
      <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-modal">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-muted-foreground">Grand total</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(totals.grand, true)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lines.length > 0 && !onLastStep ? (
            <Button variant="ghost" type="button" loading={saving === "draft"} onClick={() => void onSaveDraft()}>
              Hold bill
            </Button>
          ) : null}
          {step > 0 ? (
            <Button variant="secondary" type="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {onLastStep ? (
            <>
              <Button variant="secondary" type="button" loading={saving === "draft"} onClick={() => void onSaveDraft()}>
                Save draft
              </Button>
              <Button
                variant="cta"
                type="button"
                className="h-12 px-6 text-base"
                disabled={ratesBlock || lines.length === 0}
                loading={saving === "final"}
                onClick={() => void onSaveAndPrint()}
              >
                <Printer className="h-5 w-5" aria-hidden /> Save &amp; Print
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-12 px-8 text-base"
              disabled={(step === 0 && !step1Done) || (step === 1 && lines.length === 0)}
              onClick={next}
            >
              Next
            </Button>
          )}
        </div>
      </div>

      <ItemDetailsDialog
        line={editing?.line ?? null}
        isNew={editing?.isNew ?? false}
        priceMode={serverPriceMode}
        canOverride={canOverride}
        withoutGst={withoutGst}
        onClose={() => setEditing(null)}
        onSave={onSaveDetails}
      />

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
