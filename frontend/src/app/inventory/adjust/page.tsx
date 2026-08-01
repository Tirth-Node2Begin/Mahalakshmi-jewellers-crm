"use client";

import { metalLabel, stockApi, TRACKING_LABEL, type StockItem } from "@/features/stock/api";
import { useCanSeeCost } from "@/features/stock/permissions";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatWeight } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const IN_REASONS = ["Found during stock count", "Returned by karigar", "Correction of an earlier entry"];
const OUT_REASONS = ["Short in stock count", "Damaged / broken", "Sent for melting", "Correction of an earlier entry"];

export default function StockAdjustPage() {
  const { can } = usePermissions();
  const canSeeCost = useCanSeeCost();
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [picked, setPicked] = useState<StockItem | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("1");
  const [weight, setWeight] = useState("");
  const [ratePerGram, setRatePerGram] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const allowed = can("inventory.adjust");

  const { data: listData, isFetching: searching } = useQuery({
    queryKey: ["stock", "items", { search, picker: "adjust" }],
    queryFn: () => stockApi.items({ search: search || undefined, status: "in_stock" }),
    enabled: allowed,
  });

  const { data: detailData, isLoading: loadingDetail } = useQuery({
    queryKey: ["stock", "item", picked?.id],
    queryFn: () => stockApi.detail(picked!.id),
    enabled: allowed && !!picked,
  });

  const availability = detailData?.item.availability;
  const results = listData?.items ?? [];
  const purities = listData?.purities ?? [];
  const estimatedValue = Number(weight || 0) * Number(ratePerGram || 0);

  const defaultRateForItem = (item: StockItem): string => {
    const currentCost = Number(item.avg_cost ?? 0);
    if (currentCost > 0) return String(currentCost);
    const purity = purities.find((p) => p.metal === item.metal && p.code === item.purity_code);
    return purity?.rate_per_gram && Number(purity.rate_per_gram) > 0 ? String(Number(purity.rate_per_gram)) : "";
  };

  const reset = () => {
    setPicked(null);
    setDirection("in");
    setQty("1");
    setWeight("");
    setRatePerGram("");
    setReason("");
    setError(null);
  };

  const validate = (): string | null => {
    if (!picked) return "Choose the item you want to correct.";
    const w = Number(weight);
    if (!w || w <= 0) return "Enter the weight being added or removed.";
    if (Number(qty) < 0) return "Quantity cannot be negative.";
    if (direction === "in" && Number(ratePerGram || 0) <= 0) {
      return "Enter the rate per gram so this stock has a value.";
    }
    if (!reason.trim()) return "Write why this correction is being made — it is kept in the records.";
    if (direction === "out" && availability && w > availability.weight + 0.0005) {
      return `Only ${formatWeight(availability.weight)} of this item is in stock.`;
    }
    return null;
  };

  const review = () => {
    const problem = validate();
    setError(problem);
    if (!problem) setConfirmOpen(true);
  };

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await stockApi.adjust({
        item_id: picked.id,
        direction,
        qty: qty ? Number(qty) : undefined,
        weight: Number(weight),
        ...(direction === "in" ? { rate_per_gram: Number(ratePerGram) } : {}),
        reason: reason.trim(),
      });
      toast.success("Stock corrected.");
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setConfirmOpen(false);
      reset();
    } catch (e) {
      setConfirmOpen(false);
      setError(e instanceof ApiError ? e.message : "Could not save the correction. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <Card>
        <EmptyState
          icon={Lock}
          title="You cannot adjust stock"
          hint="Only staff with the stock-adjustment permission can correct stock. Ask the owner for access."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="p-0">
          <CardHeader className="px-6 pt-6" title="1. Pick the item" />
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search name, code, HUID or barcode…"
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="pl-11"
                aria-label="Search items"
              />
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto border-t border-border">
            {searching && results.length === 0 ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No item matched. Try a shorter search.
              </p>
            ) : (
              <ul>
                {results.slice(0, 60).map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => {
                        setPicked(it);
                        setError(null);
                        setQty(it.tracking === "tagged" ? "1" : "");
                        setWeight("");
                        setRatePerGram(defaultRateForItem(it));
                      }}
                      className={cn(
                        "flex w-full flex-wrap items-center gap-3 border-b border-border/60 px-6 py-3 text-left transition-colors hover:bg-background",
                        picked?.id === it.id && "bg-primary-soft",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{it.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {it.item_code}
                          {it.purity_code ? ` · ${it.purity_code}` : ""}
                        </span>
                      </span>
                      <Badge tone={it.metal === "silver" ? "blue" : "gold"}>
                        {metalLabel(it.metal)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="space-y-6">
          <CardHeader title="2. What changed" />

          {!picked ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="Pick an item first"
              hint="Search on the left and tap the item you are correcting."
            />
          ) : (
            <>
              <div className="rounded-input bg-background p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{picked.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{picked.item_code}</span>
                  </span>
                  <Badge tone="gray">{TRACKING_LABEL[picked.tracking]}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Figure
                    label="In stock now"
                    value={loadingDetail ? "…" : formatWeight(availability?.weight ?? 0)}
                  />
                  <Figure
                    label="Pieces"
                    value={loadingDetail ? "…" : String(Number(availability?.qty ?? 0))}
                  />
                  {canSeeCost ? (
                    <Figure
                      label="Value"
                      value={loadingDetail ? "…" : formatCurrency(availability?.value ?? 0, true)}
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex rounded-pill bg-background p-1">
                {(["in", "out"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDirection(d);
                      if (d === "in" && picked && !ratePerGram) setRatePerGram(defaultRateForItem(picked));
                    }}
                    className={cn(
                      "flex-1 rounded-pill py-2 text-sm font-semibold transition-colors",
                      direction === d ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground",
                    )}
                  >
                    {d === "in" ? "Add to stock" : "Remove from stock"}
                  </button>
                ))}
              </div>

              <div className={cn("grid gap-5", direction === "in" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                <div>
                  <Label htmlFor="aj_weight" required>
                    Weight ({direction === "in" ? "added" : "removed"})
                  </Label>
                  <Input
                    id="aj_weight"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0.000"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">In grams, to three decimals.</p>
                </div>
                <div>
                  <Label htmlFor="aj_qty">Pieces</Label>
                  <Input id="aj_qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {picked.tracking === "tagged" ? "A tagged piece is always 1." : "How many units of the pool."}
                  </p>
                </div>
                {direction === "in" ? (
                  <div>
                    <Label htmlFor="aj_rate" required>
                      Rate / g
                    </Label>
                    <Input
                      id="aj_rate"
                      inputMode="decimal"
                      value={ratePerGram}
                      onChange={(e) => setRatePerGram(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Stock value: {formatCurrency(estimatedValue, true)}
                    </p>
                  </div>
                ) : null}
              </div>

              <div>
                <Label htmlFor="aj_reason" required>
                  Reason for this correction
                </Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {(direction === "in" ? IN_REASONS : OUT_REASONS).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={cn(
                        "rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors",
                        reason === r
                          ? "border-primary bg-primary-soft text-primary-strong"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <Textarea
                  id="aj_reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={255}
                  placeholder="Say what happened in your own words…"
                />
              </div>

              <FieldError message={error ?? undefined} />

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={reset}>
                  Clear
                </Button>
                <Button variant={direction === "out" ? "destructive" : "primary"} onClick={review}>
                  Review correction
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth={460}
        title="Confirm this correction"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Go back
            </Button>
            <Button variant={direction === "out" ? "destructive" : "primary"} onClick={() => void submit()} loading={busy}>
              Yes, correct the stock
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="flex items-start gap-3 rounded-input bg-warning-soft px-4 py-3 text-sm text-warning-strong">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>This changes your stock records and your books. It cannot be undone — only corrected again.</span>
          </p>
          <dl className="space-y-2 text-sm">
            <ConfirmRow label="Item" value={picked ? `${picked.item_code} — ${picked.name}` : "—"} />
            <ConfirmRow label="Change" value={direction === "in" ? "Adding to stock" : "Removing from stock"} />
            <ConfirmRow label="Weight" value={formatWeight(weight || 0)} />
            <ConfirmRow label="Pieces" value={qty || "1"} />
            {direction === "in" ? (
              <>
                <ConfirmRow label="Rate / g" value={formatCurrency(ratePerGram, true)} />
                <ConfirmRow label="Stock value" value={formatCurrency(estimatedValue, true)} />
              </>
            ) : null}
            <ConfirmRow label="Reason" value={reason} />
          </dl>
        </div>
      </Dialog>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-0.5 block text-base font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
