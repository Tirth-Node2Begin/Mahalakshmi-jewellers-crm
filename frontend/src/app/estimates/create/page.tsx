"use client";

import { estimatesApi, useDefaultTaxRate } from "@/features/billing/api";
import {
  billTotals,
  blankLine,
  lineFromStockItem,
  lineToPayload,
  nextKey,
  num,
} from "@/features/billing/calc";
import { CustomerStrip } from "@/features/billing/customer-strip";
import { ItemDetailsDialog } from "@/features/billing/item-details-dialog";
import { ItemSearch } from "@/features/billing/item-search";
import { LineItemsTable } from "@/features/billing/line-items-table";
import { TotalsPanel } from "@/features/billing/totals-panel";
import type { BillCustomer, BillLine, EstimateDetail, PriceMode } from "@/features/billing/types";
import { usePageHeader } from "@/components/shell/page-header";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { addDaysStr, formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Gem, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const STEPS = [
  {
    title: "Customer",
    heading: "Who is this quote for?",
    hint: "Choose a customer already on file, or add a new customer.",
  },
  {
    title: "Items",
    heading: "What are they asking about?",
    hint: "Scan the tag, tap the box to browse, or type to search.",
  },
  {
    title: "Estimate",
    heading: "Confirm the estimate",
    hint: "Set validity, discount and notes before saving the quotation.",
  },
] as const;

/**
 * New / edit estimate. Same line-entry components as the billing screen, minus
 * everything a bill needs and a quotation does not: no payments, no old-metal
 * exchange, no stock movement. Nothing here touches inventory or the ledger.
 */
function EstimateBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const urlId = Number(params.get("id")) || null;
  const queryClient = useQueryClient();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const canOverride = can("invoices.override");
  const defaultTaxRate = useDefaultTaxRate();

  const [estimateId, setEstimateId] = useState<number | null>(urlId);
  usePageHeader(
    estimateId ? "Edit Estimate" : "New Estimate",
    "Nothing is sold and no stock moves until this becomes a bill.",
  );
  const [customer, setCustomer] = useState<BillCustomer | null>(null);
  const [customerChosen, setCustomerChosen] = useState(false);
  const [walkin, setWalkin] = useState({ name: "", phone: "" });
  const [estimateDate, setEstimateDate] = useState(localDateString());
  const [validUntil, setValidUntil] = useState(addDaysStr(localDateString(), 7));
  const [priceMode, setPriceMode] = useState<PriceMode>("exclusive");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [editing, setEditing] = useState<{ line: BillLine; isNew: boolean } | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const { data: meta } = useQuery({
    queryKey: ["estimates", "meta"],
    queryFn: () => estimatesApi.list({}),
    staleTime: 60_000,
  });
  const purities = meta?.purities ?? [];
  const categories = meta?.categories ?? [];

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["estimates", "detail", urlId],
    queryFn: () => estimatesApi.detail(urlId!),
    enabled: urlId !== null && urlId > 0,
  });

  const hydratedFor = useRef<number | null>(null);
  useEffect(() => {
    const estimate: EstimateDetail | undefined = existing?.estimate;
    if (!estimate || hydratedFor.current === estimate.id) return;
    if (estimate.status === "converted") {
      toast.error("This estimate is already a bill - opening it read-only.");
      router.replace(`/estimates/detail?id=${estimate.id}`);
      return;
    }
    hydratedFor.current = estimate.id;
    setEstimateId(estimate.id);
    setCustomer(
      estimate.customer_id
        ? { id: estimate.customer_id, name: estimate.customer_name ?? "Customer", mobile: estimate.customer_mobile }
        : null,
    );
    setWalkin({ name: estimate.walkin_name ?? "", phone: estimate.walkin_phone ?? "" });
    setCustomerChosen(true);
    setEstimateDate(estimate.estimate_date);
    setValidUntil(estimate.valid_until ?? addDaysStr(estimate.estimate_date, 7));
    setPriceMode(estimate.price_mode);
    // the whole-estimate box holds only the whole-estimate figure
    setDiscount(num(estimate.bill_discount));
    setNotes(estimate.notes ?? "");
    setLines(
      estimate.items.map((item) => {
        const qty = num(item.qty) || 1;
        return {
          key: nextKey(),
          item_id: item.inventory_item_id,
          item_code: item.item_code,
          description: item.description,
          huid: null,
          purity_id: null,
          purity_code: item.purity_code,
          tracking: "bulk",
          qty,
          gross_weight: num(item.gross_weight),
          net_weight: num(item.net_weight),
          rate_per_gram: num(item.rate_per_gram),
          // estimate_items store the computed charge, so it comes back as a fixed amount
          making_type: "fixed",
          making_value: qty > 0 ? num(item.making_charge) / qty : num(item.making_charge),
          discount: num(item.discount),
          tax_rate: num(item.tax_rate),
          tax_treatment: "taxable",
          exempt_reason: null,
        } satisfies BillLine;
      }),
    );
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const onPickItem = (line: BillLine) => {
    if (line.tracking === "bulk" || num(line.rate_per_gram) <= 0) {
      setEditing({ line, isNew: true });
      return;
    }
    setLines((current) => [...current, line]);
  };

  const onSaveDetails = (line: BillLine) => {
    setLines((current) =>
      editing?.isNew ? [...current, line] : current.map((row) => (row.key === line.key ? line : row)),
    );
    setEditing(null);
  };

  const validate = () => {
    if (lines.length === 0) {
      toast.error("Add at least one item to quote.");
      return false;
    }
    if (lines.some((line) => !line.description.trim())) {
      toast.error("Every line needs a description.");
      return false;
    }
    const untaxed = lines.find((line) => line.tax_treatment !== "taxable" && !line.exempt_reason);
    if (untaxed) {
      toast.error(`${untaxed.description}: a reason is needed when a line is not taxed.`);
      return false;
    }
    return true;
  };

  const totals = billTotals(lines, [], discount, priceMode, false);
  const onLastStep = step === STEPS.length - 1;

  const next = () => {
    if (step === 0 && !customerChosen) {
      toast.error("Choose or add a customer first.");
      return;
    }
    if (step === 1 && !validate()) return;
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await estimatesApi.save({
        id: estimateId ?? undefined,
        customer_id: customer?.id ?? null,
        walkin_name: customer ? null : walkin.name.trim() || null,
        walkin_phone: customer ? null : walkin.phone.trim() || null,
        estimate_date: estimateDate,
        valid_until: validUntil || null,
        price_mode: priceMode,
        discount: num(discount),
        notes: notes.trim() || null,
        items: lines.map(lineToPayload),
      });
      void queryClient.invalidateQueries({ queryKey: ["estimates"] });
      toast.success("Estimate saved.");
      router.push(`/estimates/detail?id=${res.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the estimate.");
    } finally {
      setSaving(false);
    }
  };

  if (permissionsLoading) return <SkeletonCard lines={8} />;
  if (!can("estimates.create")) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">You do not have permission to create estimates.</p>
      </Card>
    );
  }
  if (urlId !== null && loadingExisting) return <SkeletonCard lines={10} />;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/estimates"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to estimates"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <Badge tone="amber">Not a bill</Badge>
      </div>

      <ol className="flex items-center gap-2 px-1">
        {STEPS.map((s, idx) => {
          const done = idx < step;
          return (
            <li key={s.title} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
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

      <Card className="min-h-[300px] p-6 sm:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground">{STEPS[step].heading}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{STEPS[step].hint}</p>
        </div>

        {step === 0 ? (
          <CustomerStrip
            customer={customer}
            onCustomerChange={(picked) => {
              setCustomer(picked);
              setCustomerChosen(picked !== null);
              if (picked) setStep(1);
            }}
            walkinName={walkin.name}
            walkinPhone={walkin.phone}
            onWalkinChange={(patch) => setWalkin((current) => ({ ...current, ...patch }))}
            requireChoice
            chosen={customerChosen}
          />
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <ItemSearch
              autoFocus={false}
              placeholder="Scan a tag or search an item to quote..."
              categories={categories}
              excludeIds={lines.map((l) => l.item_id).filter((id): id is number => id !== null)}
              onPick={(item, picked) => onPickItem(lineFromStockItem(item, purities, defaultTaxRate, picked))}
            />
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setEditing({ line: blankLine(defaultTaxRate), isNew: true })}
              >
                <Plus className="h-4 w-4" aria-hidden /> Quote something not in stock
              </Button>
            </div>
            <LineItemsTable
              lines={lines}
              priceMode={priceMode}
              onEdit={(key) => {
                const line = lines.find((row) => row.key === key);
                if (line) setEditing({ line, isNew: false });
              }}
              onRemove={(key) => setLines((current) => current.filter((line) => line.key !== key))}
              emptyState={
                <EmptyState
                  icon={Gem}
                  title="Nothing quoted yet"
                  hint="Scan a tag, search an item, or add a line for a piece that is not in stock."
                />
              }
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="est_date">Estimate date</Label>
                  <Input
                    id="est_date"
                    type="date"
                    value={estimateDate}
                    onChange={(e) => setEstimateDate(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label htmlFor="est_valid">Valid until</Label>
                  <Input
                    id="est_valid"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="est_notes">Note for the customer</Label>
                <Textarea
                  id="est_notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the customer should see on the estimate"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Rates change daily. After the valid-until date, the estimate has to be re-priced before it can become a bill.
              </p>
            </div>

            <div>
              <TotalsPanel
                totals={totals}
                priceMode={priceMode}
                onPriceModeChange={(mode) => {
                  if (mode !== "without_gst") setPriceMode(mode);
                }}
                discount={discount}
                onDiscountChange={setDiscount}
                grandLabel="Estimated Total"
                showRoundOff={false}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">
                This is a quotation. No GST is charged and no stock is reserved.
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="sticky bottom-4 z-20 flex items-center gap-3 rounded-card border border-border bg-card p-5 shadow-modal">
        <div>
          <p className="text-[11px] uppercase tracking-[0.4px] text-muted-foreground">Estimated total</p>
          <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(totals.grand, true)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {step > 0 ? (
            <Button variant="secondary" type="button" onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          {onLastStep ? (
            <Button
              type="button"
              className="h-12 px-8 text-base"
              disabled={lines.length === 0}
              loading={saving}
              onClick={() => void save()}
            >
              Save estimate
            </Button>
          ) : (
            <Button
              type="button"
              className="h-12 px-8 text-base"
              disabled={(step === 0 && !customerChosen) || (step === 1 && lines.length === 0)}
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
        priceMode={priceMode}
        canOverride={canOverride}
        onClose={() => setEditing(null)}
        onSave={onSaveDetails}
      />
    </div>
  );
}

export default function NewEstimatePage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <EstimateBuilder />
    </Suspense>
  );
}
