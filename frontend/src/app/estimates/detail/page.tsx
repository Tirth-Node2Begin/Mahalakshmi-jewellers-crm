"use client";

import { estimateStatusLabel, estimateStatusTone, estimatesApi } from "@/features/billing/api";
import { EstimatePrintSheet, useAutoPrint } from "@/features/billing/print-sheet";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Dialog } from "@/shared/ui/dialog";
import { SkeletonCard } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatDate, localDateString } from "@/shared/utils/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Pencil, Printer, ReceiptIndianRupee } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

/**
 * One estimate, and the slip it prints on — watermarked so it can never be
 * mistaken for a tax invoice. "Turn into a bill" creates a DRAFT bill and hands
 * the counter straight to the billing screen to finalise it.
 */
function EstimateDetail() {
  const params = useSearchParams();
  const id = Number(params.get("id"));
  const autoPrint = params.get("print") === "1";
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [convertOpen, setConvertOpen] = useState(false);
  const [holdRate, setHoldRate] = useState(true);
  const [converting, setConverting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["estimates", "detail", id],
    queryFn: () => estimatesApi.detail(id),
    enabled: Number.isFinite(id) && id > 0,
  });

  const estimate = data?.estimate;
  useAutoPrint(autoPrint, Boolean(estimate));

  const convert = async () => {
    if (!estimate) return;
    setConverting(true);
    try {
      const res = await estimatesApi.convert(estimate.id, holdRate);
      void queryClient.invalidateQueries({ queryKey: ["estimates"] });
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Draft bill created — take the payment to finish it.");
      router.push(`/invoices/create?id=${res.invoice_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn this into a bill.");
    } finally {
      setConverting(false);
    }
  };

  const cancel = async () => {
    if (!estimate) return;
    try {
      await estimatesApi.cancel(estimate.id);
      toast.success("Estimate cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["estimates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel the estimate.");
    }
  };

  if (isLoading) return <SkeletonCard lines={10} />;
  if (isError || !estimate) {
    return (
      <Card>
        <p className="text-sm text-muted-foreground">Estimate not found.</p>
        <Link href="/estimates" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-strong">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to estimates
        </Link>
      </Card>
    );
  }

  const expired = estimate.valid_until !== null && estimate.valid_until < localDateString();
  const badgeStatus = estimate.status === "open" && expired ? "expired" : estimate.status;
  const isOpen = estimate.status === "open";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/estimates"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:shadow-card"
          aria-label="Back to estimates"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h2 className="font-mono text-xl font-bold text-foreground">{estimate.estimate_no}</h2>
        <Badge tone={estimateStatusTone(badgeStatus)}>{estimateStatusLabel(badgeStatus)}</Badge>
        {estimate.invoice_no ? (
          <Link
            href={`/invoices/detail?id=${estimate.converted_invoice_id}`}
            className="text-sm font-medium text-primary-strong hover:underline"
          >
            Billed as {estimate.invoice_no}
          </Link>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
          {isOpen && can("estimates.create") ? (
            <Button variant="secondary" size="sm" onClick={() => router.push(`/estimates/create?id=${estimate.id}`)}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit
            </Button>
          ) : null}
          {isOpen && can("invoices.create") ? (
            <Button
              variant="cta"
              size="sm"
              onClick={() => {
                setHoldRate(!expired);
                setConvertOpen(true);
              }}
            >
              <ReceiptIndianRupee className="h-4 w-4" aria-hidden /> Turn into a bill
            </Button>
          ) : null}
          {isOpen && can("estimates.create") ? (
            <Button variant="ghost" size="sm" className="text-attention-strong hover:bg-attention-soft" onClick={() => void cancel()}>
              <Ban className="h-4 w-4" aria-hidden /> Cancel
            </Button>
          ) : null}
        </div>
      </div>

      {expired && isOpen ? (
        <div className="rounded-card border border-warning-strong/30 bg-warning-soft p-4 text-sm font-medium text-warning-strong">
          This estimate ran out on {formatDate(estimate.valid_until)}. It has to be re-priced at today&apos;s rate before it can
          become a bill.
        </div>
      ) : null}

      <EstimatePrintSheet estimate={estimate} />

      <Dialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Turn this estimate into a bill"
        maxWidth={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConvertOpen(false)}>
              Not now
            </Button>
            <Button loading={converting} onClick={() => void convert()}>
              Create the draft bill
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Metal rates move every day. Which price should the bill use?
        </p>
        <div className="space-y-3">
          <RateChoice
            selected={holdRate}
            disabled={expired}
            onSelect={() => setHoldRate(true)}
            title="Hold the price we quoted"
            hint={
              expired
                ? "Not available — this estimate has expired."
                : `The rates from ${formatDate(estimate.estimate_date)} are kept, so the customer pays what the slip says.`
            }
          />
          <RateChoice
            selected={!holdRate}
            onSelect={() => setHoldRate(false)}
            title="Re-price at today's rate"
            hint="Every line is priced again using today's gold and silver rates."
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          A DRAFT bill is created — nothing is sold and no stock moves until you take the payment and finish it on the billing
          screen.
        </p>
      </Dialog>
    </div>
  );
}

function RateChoice({
  selected,
  disabled,
  onSelect,
  title,
  hint,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-input border p-4 text-left transition-colors",
        selected && !disabled ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-background",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </button>
  );
}

export default function EstimateDetailPage() {
  return (
    <Suspense fallback={<SkeletonCard lines={10} />}>
      <EstimateDetail />
    </Suspense>
  );
}
