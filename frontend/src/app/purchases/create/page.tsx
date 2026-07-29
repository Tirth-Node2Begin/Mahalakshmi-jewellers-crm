"use client";

import {
  LINE_KIND_HINT,
  LINE_KIND_LABEL,
  PAYMENT_MODE_LABEL,
  purchasesApi,
  type LineKind,
  type PaymentMode,
  type PurchaseLinePayload,
} from "@/features/purchases/api";
import { printItemTags, type TagToPrint } from "@/features/purchases/print-tags";
import { METAL_LABEL, type Metal } from "@/features/stock/api";
import { vendorPaymentsApi } from "@/features/vendors/payments-api";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Collapsible } from "@/shared/ui/collapsible";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatWeight, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Printer, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface LineDraft {
  key: string;
  kind: LineKind;
  description: string;
  metal: Metal;
  purity_id: string;
  category_id: string;
  item_id: string;
  huid: string;
  gross_weight: string;
  net_weight: string;
  qty: string;
  weight: string;
  rate_per_gram: string;
  making_charge: string;
  amount: string;
  tax_rate: string;
}

let lineSeq = 0;
function blankLine(kind: LineKind = "tagged"): LineDraft {
  lineSeq += 1;
  return {
    key: `line-${lineSeq}`,
    kind,
    description: "",
    metal: "gold",
    purity_id: "",
    category_id: "",
    item_id: "",
    huid: "",
    gross_weight: "",
    net_weight: "",
    qty: "1",
    weight: "",
    rate_per_gram: "",
    making_charge: "",
    amount: "",
    tax_rate: "3",
  };
}

/** Mirrors PurchaseService: weight × rate (× qty for tagged) + making, or a flat service amount. */
function lineAmount(line: LineDraft): number {
  if (line.kind === "service") return Number(line.amount || 0);
  const weight = line.kind === "tagged" ? Number(line.net_weight || 0) : Number(line.weight || 0);
  const rate = Number(line.rate_per_gram || 0);
  const making = Number(line.making_charge || 0);
  return Math.round((weight * rate + making) * 100) / 100;
}

function lineTax(line: LineDraft): number {
  return Math.round(((lineAmount(line) * Number(line.tax_rate || 0)) / 100) * 100) / 100;
}

export default function CreatePurchasePage() {
  const { can } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => localDateString());
  const [billRef, setBillRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([blankLine("tagged")]);
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

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  /** Picking a purity fills in today's rate, if we have one and the box is empty. */
  const pickPurity = (line: LineDraft, purityId: string) => {
    const purity = purities.find((p) => String(p.id) === purityId);
    const patch: Partial<LineDraft> = { purity_id: purityId };
    if (purity?.rate_per_gram && !line.rate_per_gram) patch.rate_per_gram = String(Number(purity.rate_per_gram));
    updateLine(line.key, patch);
  };

  const validate = (): string | null => {
    if (!supplierId) return "Choose the vendor you bought from.";
    if (!date) return "Pick the purchase date.";
    if (lines.length === 0) return "Add at least one line.";
    for (const [i, l] of lines.entries()) {
      const where = `Line ${i + 1}`;
      if (l.kind === "service") {
        if (!l.description.trim()) return `${where}: say what the charge is for.`;
        if (Number(l.amount || 0) <= 0) return `${where}: enter the amount.`;
        continue;
      }
      if (!l.purity_id) return `${where}: choose the purity.`;
      if (Number(l.rate_per_gram || 0) <= 0) return `${where}: enter the metal rate per gram.`;
      if (l.kind === "tagged") {
        if (!l.description.trim()) return `${where}: give the piece a name.`;
        if (Number(l.net_weight || 0) <= 0) return `${where}: enter the net metal weight.`;
        if (Number(l.net_weight || 0) > Number(l.gross_weight || 0) + 0.0005) {
          return `${where}: net weight cannot be more than gross weight.`;
        }
      } else {
        if (Number(l.weight || 0) <= 0) return `${where}: enter the weight in grams.`;
        if (Number(l.qty || 0) <= 0) return `${where}: enter how many units.`;
      }
      if (lineAmount(l) <= 0) return `${where}: this line adds up to zero.`;
    }
    if (payNow) {
      const amt = Number(payAmount || 0);
      if (amt <= 0) return "Enter how much you are paying now, or turn off “Pay now”.";
      if (amt > totals.grand + 0.01) return "The payment is more than the bill total.";
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

  const save = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">New purchase</h2>
        <p className="text-sm text-muted-foreground">Record what you bought, and it goes straight into your stock.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Vendor and bill" />
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-3">
                <Label htmlFor="pc_ref">Vendor bill number</Label>
                <Input
                  id="pc_ref"
                  value={billRef}
                  onChange={(e) => setBillRef(e.target.value)}
                  maxLength={60}
                  placeholder="The number printed on their bill"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-5">
            <CardHeader
              title="What you bought"
              action={
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(LINE_KIND_LABEL) as LineKind[]).map((k) => (
                    <Button key={k} variant="secondary" size="sm" onClick={() => setLines((ls) => [...ls, blankLine(k)])}>
                      <Plus className="h-4 w-4" aria-hidden /> {LINE_KIND_LABEL[k]}
                    </Button>
                  ))}
                </div>
              }
            />

            {lines.map((line, index) => {
              const metalPurities = purities.filter((p) => p.metal === line.metal);
              return (
                <div key={line.key} className="rounded-input border border-border bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                      Line {index + 1}
                    </span>
                    <div className="flex flex-wrap gap-1 rounded-pill bg-card p-1">
                      {(Object.keys(LINE_KIND_LABEL) as LineKind[]).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateLine(line.key, { kind: k })}
                          className={cn(
                            "rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors",
                            line.kind === k ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {LINE_KIND_LABEL[k]}
                        </button>
                      ))}
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{LINE_KIND_HINT[line.kind]}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-attention-strong disabled:opacity-30"
                      aria-label={`Remove line ${index + 1}`}
                      title="Remove this line"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  {line.kind === "service" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Label htmlFor={`${line.key}_desc`} required>
                          What is the charge for?
                        </Label>
                        <Input
                          id={`${line.key}_desc`}
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          placeholder="e.g. Karigar making charges — 5 bangles"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${line.key}_amount`} required>
                          Amount (₹)
                        </Label>
                        <Input
                          id={`${line.key}_amount`}
                          inputMode="decimal"
                          value={line.amount}
                          onChange={(e) => updateLine(line.key, { amount: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-3">
                      {line.kind === "tagged" ? (
                        <div className="sm:col-span-2">
                          <Label htmlFor={`${line.key}_desc`} required>
                            Piece name
                          </Label>
                          <Input
                            id={`${line.key}_desc`}
                            value={line.description}
                            onChange={(e) => updateLine(line.key, { description: e.target.value })}
                            placeholder="e.g. 22K Gold Kada — plain"
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-2">
                          <Label htmlFor={`${line.key}_pool`}>Add to which pool?</Label>
                          <Select
                            id={`${line.key}_pool`}
                            value={line.item_id}
                            onChange={(e) => updateLine(line.key, { item_id: e.target.value })}
                          >
                            <option value="">Match by metal and purity</option>
                            {bulkItems.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.item_code} — {b.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label htmlFor={`${line.key}_metal`} required>
                          Metal
                        </Label>
                        <Select
                          id={`${line.key}_metal`}
                          value={line.metal}
                          onChange={(e) => updateLine(line.key, { metal: e.target.value as Metal, purity_id: "" })}
                        >
                          {(Object.keys(METAL_LABEL) as Metal[]).map((m) => (
                            <option key={m} value={m}>
                              {METAL_LABEL[m]}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor={`${line.key}_purity`} required>
                          Purity
                        </Label>
                        <Select
                          id={`${line.key}_purity`}
                          value={line.purity_id}
                          onChange={(e) => pickPurity(line, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {metalPurities.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {line.kind === "tagged" ? (
                        <>
                          <div>
                            <Label htmlFor={`${line.key}_gross`}>Gross weight (g)</Label>
                            <Input
                              id={`${line.key}_gross`}
                              inputMode="decimal"
                              value={line.gross_weight}
                              onChange={(e) => updateLine(line.key, { gross_weight: e.target.value })}
                              placeholder="0.000"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${line.key}_net`} required>
                              Net metal weight (g)
                            </Label>
                            <Input
                              id={`${line.key}_net`}
                              inputMode="decimal"
                              value={line.net_weight}
                              onChange={(e) => updateLine(line.key, { net_weight: e.target.value })}
                              placeholder="0.000"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <Label htmlFor={`${line.key}_qty`} required>
                              How many units
                            </Label>
                            <Input
                              id={`${line.key}_qty`}
                              inputMode="decimal"
                              value={line.qty}
                              onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${line.key}_weight`} required>
                              Total weight (g)
                            </Label>
                            <Input
                              id={`${line.key}_weight`}
                              inputMode="decimal"
                              value={line.weight}
                              onChange={(e) => updateLine(line.key, { weight: e.target.value })}
                              placeholder="0.000"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <Label htmlFor={`${line.key}_rate`} required>
                          Metal rate (₹ / g)
                        </Label>
                        <Input
                          id={`${line.key}_rate`}
                          inputMode="decimal"
                          value={line.rate_per_gram}
                          onChange={(e) => updateLine(line.key, { rate_per_gram: e.target.value })}
                        />
                      </div>

                      {line.kind === "tagged" ? (
                        <>
                          <div>
                            <Label htmlFor={`${line.key}_making`}>Making charge (₹)</Label>
                            <Input
                              id={`${line.key}_making`}
                              inputMode="decimal"
                              value={line.making_charge}
                              onChange={(e) => updateLine(line.key, { making_charge: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${line.key}_huid`}>HUID</Label>
                            <Input
                              id={`${line.key}_huid`}
                              value={line.huid}
                              onChange={(e) => updateLine(line.key, { huid: e.target.value.toUpperCase() })}
                              maxLength={10}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${line.key}_cat`}>Category</Label>
                            <Select
                              id={`${line.key}_cat`}
                              value={line.category_id}
                              onChange={(e) => updateLine(line.key, { category_id: e.target.value })}
                            >
                              <option value="">—</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
                    <div className="w-28">
                      <Label htmlFor={`${line.key}_tax`}>GST %</Label>
                      <Input
                        id={`${line.key}_tax`}
                        inputMode="decimal"
                        value={line.tax_rate}
                        onChange={(e) => updateLine(line.key, { tax_rate: e.target.value })}
                      />
                    </div>
                    <p className="ml-auto text-sm text-muted-foreground">
                      Line total{" "}
                      <span className="ml-2 text-base font-bold tabular-nums text-foreground">
                        {formatCurrency(lineAmount(line) + lineTax(line), true)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>

          <Collapsible label="Note for this purchase" hint="Anything you want to remember later">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="e.g. Old gold exchanged, balance to be settled next week"
            />
          </Collapsible>
        </div>

        <Card className="space-y-5 lg:sticky lg:top-6">
          <CardHeader title="Bill summary" />
          <dl className="space-y-3 text-sm">
            <SummaryRow label="Goods and charges" value={formatCurrency(totals.subtotal, true)} />
            <SummaryRow label="GST" value={formatCurrency(totals.tax, true)} />
            {totals.roundOff !== 0 ? <SummaryRow label="Round off" value={formatCurrency(totals.roundOff, true)} /> : null}
            <div className="flex justify-between gap-4 border-t border-border pt-3">
              <dt className="font-semibold text-foreground">Total to pay</dt>
              <dd className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(totals.grand, true)}</dd>
            </div>
            <SummaryRow
              label="Metal coming in"
              value={formatWeight(
                lines.reduce(
                  (sum, l) =>
                    sum + (l.kind === "tagged" ? Number(l.net_weight || 0) : l.kind === "bulk" ? Number(l.weight || 0) : 0),
                  0,
                ),
              )}
            />
          </dl>

          {canPay ? (
            <div className="rounded-input border border-border p-4">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-foreground">Pay now</span>
                  <span className="block text-xs text-muted-foreground">Paying the vendor at the same time</span>
                </span>
                <input
                  type="checkbox"
                  checked={payNow}
                  onChange={(e) => setPayNow(e.target.checked)}
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

          <FieldError message={error ?? undefined} />

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => router.push("/purchases")}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              Save purchase
            </Button>
          </div>
        </Card>
      </div>

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
