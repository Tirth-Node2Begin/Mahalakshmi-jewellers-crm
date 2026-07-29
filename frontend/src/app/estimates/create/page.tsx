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
import { ItemSearch } from "@/features/billing/item-search";
import { LineItemsTable } from "@/features/billing/line-items-table";
import { TotalsPanel } from "@/features/billing/totals-panel";
import type { BillCustomer, BillLine, EstimateDetail, PriceMode } from "@/features/billing/types";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { addDaysStr, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gem, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  const [customer, setCustomer] = useState<BillCustomer | null>(null);
  const [walkin, setWalkin] = useState({ name: "", phone: "" });
  const [estimateDate, setEstimateDate] = useState(localDateString());
  const [validUntil, setValidUntil] = useState(addDaysStr(localDateString(), 7));
  const [priceMode, setPriceMode] = useState<PriceMode>("exclusive");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BillLine[]>([]);
  const [saving, setSaving] = useState(false);

  // rates + purities so a scanned item can be priced at today's rate
  const { data: meta } = useQuery({
    queryKey: ["estimates", "meta"],
    queryFn: () => estimatesApi.list({}),
    staleTime: 60_000,
  });
  const purities = meta?.purities ?? [];

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
      toast.error("This estimate is already a bill — opening it read-only.");
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
    setEstimateDate(estimate.estimate_date);
    setValidUntil(estimate.valid_until ?? addDaysStr(estimate.estimate_date, 7));
    setPriceMode(estimate.price_mode);
    setDiscount(num(estimate.discount_total));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const patchLine = (key: string, patch: Partial<BillLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  // an estimate is never rounded to the rupee — the bill does that
  const totals = billTotals(lines, [], discount, priceMode, false);

  const save = async () => {
    if (lines.length === 0) {
      toast.error("Add at least one item to quote.");
      return;
    }
    if (lines.some((line) => !line.description.trim())) {
      toast.error("Every line needs a description.");
      return;
    }
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/estimates"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to estimates"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h2 className="text-xl font-bold text-foreground">{estimateId ? "Edit estimate" : "New estimate"}</h2>
        <Badge tone="amber">Not a bill</Badge>
        <p className="hidden text-sm text-muted-foreground sm:block">Nothing is sold and no stock moves until this becomes a bill.</p>
      </div>

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
        <div className="space-y-5">
          <Card className="p-4">
            <ItemSearch
              placeholder="Scan a tag or search an item to quote…"
              onPick={(item, picked) =>
                setLines((current) => [...current, lineFromStockItem(item, purities, defaultTaxRate, picked)])
              }
            />
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setLines((current) => [...current, blankLine(defaultTaxRate)])}
              >
                <Plus className="h-4 w-4" aria-hidden /> Quote something not in stock
              </Button>
            </div>
            <div className="mt-1">
              <LineItemsTable
                lines={lines}
                priceMode={priceMode}
                canOverride={canOverride}
                onChange={patchLine}
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
          </Card>

          <Card className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="est_date">Estimate date</Label>
                <Input id="est_date" type="date" value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)} className="h-10" />
              </div>
              <div>
                <Label htmlFor="est_valid">Valid until</Label>
                <Input id="est_valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-10" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="est_notes">Note for the customer</Label>
                <Textarea id="est_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Rates change daily — after the valid-until date the estimate has to be re-priced before it can become a bill.
            </p>
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">
          <Card className="p-5">
            <TotalsPanel
              totals={totals}
              priceMode={priceMode}
              onPriceModeChange={setPriceMode}
              discount={discount}
              onDiscountChange={setDiscount}
              grandLabel="Estimated Total"
              showRoundOff={false}
            />
            <Button
              className="mt-5 w-full"
              type="button"
              disabled={lines.length === 0}
              loading={saving}
              onClick={() => void save()}
            >
              Save estimate
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              This is a quotation. No GST is charged and no stock is reserved.
            </p>
          </Card>
        </div>
      </div>
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
