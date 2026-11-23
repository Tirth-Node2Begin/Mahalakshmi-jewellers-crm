"use client";

import {
  LINE_KIND_LABEL,
  PAYMENT_MODE_LABEL,
  purchasesApi,
  type PaymentMode,
  type PurchaseLinePayload,
} from "@/features/purchases/api";
import {
  blankLine,
  lineAmount,
  lineTax,
  metalName,
  PurchaseLineDialog,
  type LineDraft,
} from "@/features/purchases/line-dialog";
import { printItemTags, type TagToPrint } from "@/features/purchases/print-tags";
import { vendorPaymentsApi } from "@/features/vendors/payments-api";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatWeight, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, Package, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { invalidateMoneyQueries } from "@/shared/api/invalidate-money";

/**
 * The three steps of a purchase, shown ONE AT A TIME — same rhythm as the New
 * Bill page: answer a single question per screen and press Next; finished steps
 * stay a tap away on the rail. Lines are added through a dialog, so the page
 * itself stays a short list.
 */
const STEPS = [
  { title: "Vendor", heading: "Who did you buy from?", hint: "Pick the supplier or maker, the date, and their bill number if they gave one." },
  { title: "Items", heading: "What did you buy?", hint: "One line per piece, per metal pool, or per charge." },
  { title: "Payment", heading: "Check and pay", hint: "Check the totals — and record it if you paid the vendor right now." },
] as const;

export default function CreatePurchasePage() {
  const { can } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => localDateString());
  const [billRef, setBillRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  /** The line the dialog is editing, if any. */
  const [editing, setEditing] = useState<{ line: LineDraft; isNew: boolean } | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("cash");
  const [payBank, setPayBank] = useState("");
  const [payRef, setPayRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tagPrompt, setTagPrompt] = useState<{ purchaseId: number; purchaseNo: string; tags: TagToPrint[] } | null>(null);

  const canCreate = can("purchases.create");
  const canPay = can("payments.vendor");

  const { data: helpers, isLoading: loadingHelpers } = useQuery({
    queryKey: ["purchases", "helpers"],
    queryFn: () => purchasesApi.list({}),
    enabled: canCreate,
  });

  const { data: paymentHelpers } = useQuery({
    queryKey: ["vendor-payments", "helpers"],
    queryFn: () => vendorPaymentsApi.list({}),
    enabled: canCreate && canPay && payNow && payMode !== "cash",
  });

  const vendors = helpers?.vendors ?? [];
  const purities = helpers?.purities ?? [];
  const categories = helpers?.categories ?? [];
  const bulkItems = helpers?.bulk_items ?? [];

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
    const tax = lines.reduce((sum, l) => sum + lineTax(l), 0);
    const before = Math.round((subtotal + tax) * 100) / 100;
    const grand = Math.round(before);
    return { subtotal, tax, roundOff: Math.round((grand - before) * 100) / 100, grand };
  }, [lines]);

  const metalIn = lines.reduce(
    (sum, l) => sum + (l.kind === "tagged" ? Number(l.net_weight || 0) : l.kind === "bulk" ? Number(l.weight || 0) : 0),
    0,
  );

  /** The dialog validated the line — here we only put it in (or back in) the list. */
  const onSaveLine = (line: LineDraft) => {
    setLines((current) =>
      editing?.isNew ? [...current, line] : current.map((l) => (l.key === line.key ? line : l)),
    );
    setEditing(null);
  };

  /** A new line starts as the last line's type — purchases usually arrive as a run of the same thing. */
  const openAdd = () => setEditing({ line: blankLine(lines[lines.length - 1]?.kind ?? "tagged"), isNew: true });

  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const purityCode = (id: string) => purities.find((p) => String(p.id) === id)?.code ?? "";

  const lineTitle = (l: LineDraft): string => {
    if (l.description.trim()) return l.description;
    if (l.kind === "service") return "Service charge";
    if (l.kind === "bulk") {
      const pool = bulkItems.find((b) => String(b.id) === l.item_id);
      return pool ? pool.name : `${metalName(l.metal)} bulk metal`;
    }
    return "Tagged piece";
  };

  const lineMeta = (l: LineDraft): string => {
    const parts = [LINE_KIND_LABEL[l.kind]];
    if (l.kind !== "service") {
      const code = purityCode(l.purity_id);
      if (code) parts.push(code);
      const weight = l.kind === "tagged" ? l.net_weight : l.weight;
      if (Number(weight || 0) > 0) parts.push(formatWeight(Number(weight)));
      if (l.kind === "bulk" && Number(l.qty || 0) > 1) parts.push(`${l.qty} units`);
    }
    return parts.join(" · ");
  };

  type Problem = { message: string; step: number; at?: string; lineKey?: string };

  const validate = (): Problem | null => {
    if (!supplierId) return { message: "Choose the vendor you bought from.", step: 0, at: "pc_vendor" };
    if (!date) return { message: "Pick the purchase date.", step: 0, at: "pc_date" };
    if (lines.length === 0) return { message: "Add at least one line.", step: 1 };
    for (const [i, l] of lines.entries()) {
      // lines were checked by the dialog — this is the belt-and-braces pass
      if (lineAmount(l) <= 0) return { message: `Line ${i + 1} adds up to zero — open it and fill it in.`, step: 1, lineKey: l.key };
    }
    if (payNow) {
      const amt = Number(payAmount || 0);
      if (amt <= 0) return { message: "Enter how much you are paying now, or turn off “Pay now”.", step: 2, at: "pc_pay_amount" };
      if (amt > totals.grand + 0.01) return { message: "The payment is more than the bill total.", step: 2, at: "pc_pay_amount" };
    }
    return null;
  };

  const toPayload = (l: LineDraft): PurchaseLinePayload => {
    if (l.kind === "service") {
      return {
        kind: "service",
        description: l.description.trim(),
        amount: Number(l.amount || 0),
        tax_rate: Number(l.tax_rate || 0),
      };
    }
    if (l.kind === "tagged") {
      return {
        kind: "tagged",
        description: l.description.trim(),
        metal: l.metal,
        purity_id: Number(l.purity_id),
        category_id: l.category_id ? Number(l.category_id) : null,
        huid: l.huid.trim() || null,
        gross_weight: Number(l.gross_weight || l.net_weight || 0),
        net_weight: Number(l.net_weight || 0),
        // the server prices a line off `weight`; for a tagged piece that is its metal weight
        weight: Number(l.net_weight || 0),
        qty: 1,
        rate_per_gram: Number(l.rate_per_gram || 0),
        making_charge: Number(l.making_charge || 0),
        tax_rate: Number(l.tax_rate || 0),
      };
    }
    return {
      kind: "bulk",
      description: l.description.trim() || null,
      item_id: l.item_id ? Number(l.item_id) : null,
      metal: l.metal,
      purity_id: Number(l.purity_id),
      qty: Number(l.qty || 1),
      weight: Number(l.weight || 0),
      rate_per_gram: Number(l.rate_per_gram || 0),
      tax_rate: Number(l.tax_rate || 0),
    };
  };

  const showProblem = (problem: Problem) => {
    toast.error(problem.message);
    setStep(problem.step);
    if (problem.lineKey) {
      const line = lines.find((l) => l.key === problem.lineKey);
      if (line) setEditing({ line, isNew: false });
      return;
    }
    if (problem.at) {
      requestAnimationFrame(() => {
        const target = document.getElementById(problem.at!);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) target.focus({ preventScroll: true });
      });
    }
  };

  const save = async () => {
    const problem = validate();
    setError(problem?.message ?? null);
    if (problem) {
      showProblem(problem);
      return;
    }

    setBusy(true);
    try {
      const created = await purchasesApi.create({
        supplier_id: Number(supplierId),
        purchase_date: date,
        bill_ref: billRef.trim() || null,
        notes: notes.trim() || null,
        items: lines.map(toPayload),
        ...(payNow
          ? {
              payment: {
                amount: Number(payAmount),
                mode: payMode,
                bank_account_id: payMode === "cash" || !payBank ? null : Number(payBank),
                ref_no: payRef.trim() || null,
              },
            }
          : {}),
      });

      toast.success("Purchase saved.");
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-payments"] });
      invalidateMoneyQueries(queryClient);

      // offer to print tags for the pieces that were just created
      const taggedCount = lines.filter((l) => l.kind === "tagged").length;
      if (taggedCount > 0) {
        try {
          const detail = await purchasesApi.detail(created.id);
          // saved lines come back in the order they were entered, so they line up 1:1
          const tags: TagToPrint[] = detail.purchase.items
            .map((line, index): TagToPrint | null =>
              lines[index]?.kind === "tagged" && line.item_code
                ? {
                    item_code: line.item_code,
                    name: line.description ?? line.item_name ?? "Jewellery item",
                    weight: line.weight,
                    purity: line.purity_code,
                    huid: line.huid,
                  }
                : null,
            )
            .filter((t): t is TagToPrint => t !== null);
          if (tags.length > 0) {
            setTagPrompt({ purchaseId: created.id, purchaseNo: detail.purchase.purchase_no, tags });
            return;
          }
        } catch {
          // printing is a nicety — never block the save
        }
      }
      router.push(`/purchases/detail?id=${created.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save this purchase. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!canCreate) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="You cannot record purchases"
          hint="Ask the owner to give you the purchase-entry permission."
        />
      </Card>
    );
  }

  const step1Done = !!supplierId && !!date;
  const onLastStep = step === STEPS.length - 1;

  /** Leaving a step checks it; going back never does. */
  const next = () => {
    if (step === 0 && !step1Done) {
      toast.error("Choose the vendor and the date first.");
      return;
    }
    if (step === 1 && lines.length === 0) {
      toast.error("Add at least one line — tap “Add line”.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="w-full space-y-5 pb-24">
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/purchases"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to purchases"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
      </div>

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
      <Card className="p-5 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-foreground">{STEPS[step].heading}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{STEPS[step].hint}</p>
        </div>

        {/* ------------------------------------------ 1. vendor and bill */}
        {step === 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="pc_vendor" required>
                Vendor
              </Label>
              <Select
                id="pc_vendor"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                disabled={loadingHelpers}
              >
                <option value="">{loadingHelpers ? "Loading…" : "Choose a vendor…"}</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.company ? ` — ${v.company}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pc_date" required>
                Purchase date
              </Label>
              <Input id="pc_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Label htmlFor="pc_ref">Vendor bill number</Label>
              <Input
                id="pc_ref"
                value={billRef}
                onChange={(e) => setBillRef(e.target.value)}
                maxLength={60}
                placeholder="The number printed on their bill"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Optional — leave blank if they did not give a bill.</p>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------- 2. what you bought */}
        {step === 1 ? (
          <div className="space-y-4">
            {lines.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nothing added yet"
                hint="Tap “Add line” — one line per piece, per metal pool, or per charge."
              />
            ) : (
              <ul className="overflow-hidden rounded-input border border-border">
                {lines.map((l, index) => (
                  <li
                    key={l.key}
                    className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-background/40 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{lineTitle(l)}</p>
                      <p className="truncate text-xs text-muted-foreground">{lineMeta(l)}</p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      {formatCurrency(lineAmount(l) + lineTax(l), true)}
                    </span>
                    <Button
                      variant="ghost"
                      size="iconSm"
                      aria-label={`Edit line ${index + 1}`}
                      onClick={() => setEditing({ line: l, isNew: false })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-attention-strong"
                      aria-label={`Remove line ${index + 1}`}
                      title="Remove this line"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Button variant="secondary" className="w-full" onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden /> Add line
            </Button>
          </div>
        ) : null}

        {/* ------------------------------------------ 3. totals + payment */}
        {step === 2 ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <dl className="w-full max-w-md space-y-3 text-sm">
                <SummaryRow label="Goods and charges" value={formatCurrency(totals.subtotal, true)} />
                <SummaryRow label="GST" value={formatCurrency(totals.tax, true)} />
                {totals.roundOff !== 0 ? <SummaryRow label="Round off" value={formatCurrency(totals.roundOff, true)} /> : null}
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <dt className="font-semibold text-foreground">Total to pay</dt>
                  <dd className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(totals.grand, true)}</dd>
                </div>
                <SummaryRow label="Metal coming in" value={formatWeight(metalIn)} />
              </dl>

              {canPay ? (
                <div className="self-start rounded-input border border-border p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold text-foreground">Pay now</span>
                      <span className="block text-xs text-muted-foreground">Paying the vendor at the same time</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={payNow}
                      onChange={(e) => {
                        setPayNow(e.target.checked);
                        // Paying in full is the common case — offer it, still editable.
                        if (e.target.checked && !payAmount && totals.grand > 0) setPayAmount(String(totals.grand));
                      }}
                      className="h-5 w-5 shrink-0 rounded border-border accent-[#4270bf]"
                    />
                  </label>

                  {payNow ? (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="pc_pay_amount" required>
                          Amount (₹)
                        </Label>
                        <Input
                          id="pc_pay_amount"
                          inputMode="decimal"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(totals.grand))}
                          className="mt-2 rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-background"
                        >
                          Pay the full {formatCurrency(totals.grand)}
                        </button>
                      </div>
                      <div>
                        <Label htmlFor="pc_pay_mode">How</Label>
                        <Select
                          id="pc_pay_mode"
                          value={payMode}
                          onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                        >
                          {(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => (
                            <option key={m} value={m}>
                              {PAYMENT_MODE_LABEL[m]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {payMode !== "cash" ? (
                        <>
                          <div>
                            <Label htmlFor="pc_pay_bank">From which account</Label>
                            <Select id="pc_pay_bank" value={payBank} onChange={(e) => setPayBank(e.target.value)}>
                              <option value="">—</option>
                              {(paymentHelpers?.bank_accounts ?? []).map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.account_name}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="pc_pay_ref">Reference number</Label>
                            <Input id="pc_pay_ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} maxLength={60} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="max-w-3xl">
              <Label htmlFor="pc_notes">Note for this purchase</Label>
              <Textarea
                id="pc_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="e.g. Old gold exchanged, balance to be settled next week"
              />
            </div>

            <FieldError message={error ?? undefined} />
          </div>
        ) : null}
      </Card>

      {/* -------------------------------- the bar that drives the flow */}
      <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-modal">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-muted-foreground">Total to pay</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(totals.grand, true)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {step > 0 ? (
            <Button variant="secondary" type="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {onLastStep ? (
            <Button
              variant="cta"
              type="button"
              className="h-12 px-6 text-base"
              disabled={lines.length === 0}
              loading={busy}
              onClick={() => void save()}
            >
              Save purchase
            </Button>
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

      <PurchaseLineDialog
        draft={editing}
        helpers={{ purities, categories, bulkItems }}
        onClose={() => setEditing(null)}
        onSave={onSaveLine}
      />

      <Dialog
        open={!!tagPrompt}
        onClose={() => {
          const id = tagPrompt?.purchaseId;
          setTagPrompt(null);
          if (id) router.push(`/purchases/detail?id=${id}`);
        }}
        maxWidth={440}
        title="Purchase saved"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                const id = tagPrompt?.purchaseId;
                setTagPrompt(null);
                if (id) router.push(`/purchases/detail?id=${id}`);
              }}
            >
              Not now
            </Button>
            <Button
              onClick={() => {
                if (tagPrompt) printItemTags(tagPrompt.tags, `Tags — ${tagPrompt.purchaseNo}`);
              }}
            >
              <Printer className="h-4 w-4" aria-hidden /> Print tags
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {tagPrompt?.tags.length === 1
            ? "One new piece was added to your stock."
            : `${tagPrompt?.tags.length ?? 0} new pieces were added to your stock.`}{" "}
          Would you like to print their tags now?
        </p>
      </Dialog>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
