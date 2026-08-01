"use client";

import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { num, priceLine } from "./calc";
import type { BillLine, MakingType, PriceMode } from "./types";

const MAKING_LABELS: Record<MakingType, string> = {
  per_gram: "per gram",
  fixed: "fixed per piece",
  percent: "% of metal value",
};

const STEPS = ["The piece", "Price"] as const;

interface Draft {
  description: string;
  qty: string;
  gross_weight: string;
  net_weight: string;
  rate_per_gram: string;
  making_type: MakingType;
  making_value: string;
  discount: string;
  tax_rate: number;
}

const toDraft = (line: BillLine): Draft => ({
  description: line.description,
  qty: String(line.qty),
  gross_weight: String(line.gross_weight),
  net_weight: String(line.net_weight),
  rate_per_gram: String(line.rate_per_gram),
  making_type: line.making_type,
  making_value: String(line.making_value),
  discount: String(line.discount),
  tax_rate: line.tax_rate,
});

const applyDraft = (line: BillLine, draft: Draft): BillLine => ({
  ...line,
  description: draft.description.trim(),
  qty: num(draft.qty) || 1,
  gross_weight: num(draft.gross_weight),
  net_weight: num(draft.net_weight) || num(draft.gross_weight),
  rate_per_gram: num(draft.rate_per_gram),
  making_type: draft.making_type,
  making_value: num(draft.making_value),
  discount: num(draft.discount),
  tax_rate: draft.tax_rate,
  tax_treatment: "taxable",
  exempt_reason: null,
});

export function ItemDetailsDialog({
  line,
  priceMode,
  canOverride,
  withoutGst,
  isNew,
  onClose,
  onSave,
}: {
  line: BillLine | null;
  priceMode: PriceMode;
  canOverride: boolean;
  withoutGst?: boolean;
  isNew: boolean;
  onClose: () => void;
  onSave: (line: BillLine) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    if (line) {
      setDraft(toDraft(line));
      setStep(line.tracking !== "bulk" && num(line.rate_per_gram) <= 0 ? 1 : 0);
    }
  }, [line]);

  if (!line || !draft) return null;

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const isBulk = line.tracking === "bulk";
  const editedLine = applyDraft(line, draft);
  const previewLine: BillLine = withoutGst
    ? { ...editedLine, tax_treatment: "non_gst", exempt_reason: "Without GST" }
    : editedLine;
  const priced = priceLine(previewLine, priceMode);

  const validateStep1 = (): boolean => {
    if (!draft.description.trim()) {
      toast.error("Give the piece a description.");
      return false;
    }
    const gross = num(draft.gross_weight);
    const net = num(draft.net_weight);
    if (gross <= 0) {
      toast.error("Enter the weight from the scale.");
      return false;
    }
    if (net > gross + 0.0005) {
      toast.error("Net weight cannot be more than gross weight.");
      return false;
    }
    return true;
  };

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const save = () => {
    if (!validateStep1()) return;
    onSave(applyDraft(line, draft));
  };

  const onLast = step === STEPS.length - 1;

  return (
    <Dialog
      open
      onClose={onClose}
      title={line.description || "Add item"}
      maxWidth={760}
      footer={
        <>
          <div className="mr-auto text-left">
            <p className="text-[11px] uppercase tracking-[0.4px] text-muted-foreground">This line</p>
            <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(priced.line_total, true)}</p>
          </div>
          {step > 0 ? (
            <Button variant="ghost" type="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
          )}
          {onLast ? (
            <Button type="button" onClick={save}>
              {isNew ? "Add to bill" : "Save changes"}
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              Next
            </Button>
          )}
        </>
      }
    >
      <StepDots step={step} />

      {step === 0 ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="d_description" required>
              What is it?
            </Label>
            {line.item_id === null ? (
              <Input
                id="d_description"
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="e.g. Gold chain 22K"
              />
            ) : (
              <ReadBox>
                {draft.description}
                <span className="block text-xs text-muted-foreground">
                  {[line.item_code, line.purity_code, line.huid ? `HUID ${line.huid}` : null]
                    .filter(Boolean)
                    .join(" - ")}
                </span>
              </ReadBox>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="d_qty">Pieces</Label>
              {isBulk ? (
                <Input
                  id="d_qty"
                  inputMode="decimal"
                  value={draft.qty}
                  onChange={(e) => set({ qty: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="tabular-nums"
                />
              ) : (
                <ReadBox>{draft.qty}</ReadBox>
              )}
            </div>
            <div>
              <Label htmlFor="d_gross" required={isBulk}>
                Gross weight (g)
              </Label>
              {isBulk ? (
                <Input
                  id="d_gross"
                  inputMode="decimal"
                  value={draft.gross_weight}
                  onChange={(e) => {
                    const sameAsGross = draft.net_weight === draft.gross_weight || !draft.net_weight;
                    set(
                      sameAsGross
                        ? { gross_weight: e.target.value, net_weight: e.target.value }
                        : { gross_weight: e.target.value },
                    );
                  }}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.000"
                  className="tabular-nums"
                />
              ) : (
                <ReadBox>{draft.gross_weight} g</ReadBox>
              )}
            </div>
            <div>
              <Label htmlFor="d_net">Net weight (g)</Label>
              {isBulk ? (
                <Input
                  id="d_net"
                  inputMode="decimal"
                  value={draft.net_weight}
                  onChange={(e) => set({ net_weight: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.000"
                  className="tabular-nums"
                />
              ) : (
                <ReadBox>{draft.net_weight} g</ReadBox>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isBulk
              ? "Net weight is the metal only. Leave out stones. The price is worked out on the net weight."
              : "This piece is tagged, so its weights come from the tag and cannot be changed here."}
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="d_rate">Rate per gram</Label>
            {canOverride ? (
              <Input
                id="d_rate"
                inputMode="decimal"
                value={draft.rate_per_gram}
                onChange={(e) => set({ rate_per_gram: e.target.value })}
                onFocus={(e) => e.target.select()}
                className="tabular-nums"
              />
            ) : (
              <ReadBox>{num(draft.rate_per_gram) > 0 ? formatCurrency(draft.rate_per_gram, true) : "No rate on file"}</ReadBox>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {canOverride ? "Filled in from today's rate for this purity." : "Today's rate for this purity. Ask a manager to change it."}
            </p>
          </div>

          <div>
            <Label htmlFor="d_making">Making charge</Label>
            {canOverride ? (
              <div className="flex gap-2">
                <Input
                  id="d_making"
                  inputMode="decimal"
                  value={draft.making_value}
                  onChange={(e) => set({ making_value: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="tabular-nums"
                />
                <select
                  aria-label="How the making charge is worked out"
                  value={draft.making_type}
                  onChange={(e) => set({ making_type: e.target.value as MakingType })}
                  className="h-11 w-[190px] shrink-0 rounded-input border border-border bg-card px-3 text-sm transition-colors focus:border-primary focus:outline-none"
                >
                  {(Object.keys(MAKING_LABELS) as MakingType[]).map((t) => (
                    <option key={t} value={t}>
                      {MAKING_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <ReadBox>{formatCurrency(priced.making_charge, true)}</ReadBox>
            )}
          </div>

          {canOverride ? (
            <div>
              <Label htmlFor="d_discount">Discount on this line</Label>
              <Input
                id="d_discount"
                inputMode="decimal"
                value={draft.discount}
                onChange={(e) => set({ discount: e.target.value })}
                onFocus={(e) => e.target.select()}
                className="tabular-nums"
              />
            </div>
          ) : null}

          <div className="space-y-1.5 rounded-input bg-background p-3 text-sm">
            <Money label="Metal value" value={priced.metal_value} />
            <Money label="Making charges" value={priced.making_charge} />
            {priced.discount > 0 ? <Money label="Less discount" value={-priced.discount} /> : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((title, idx) => (
        <li key={title} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              idx < step && "bg-success-soft text-success-strong",
              idx === step && "bg-primary text-white",
              idx > step && "bg-background text-muted-foreground",
            )}
          >
            {idx < step ? <Check className="h-4 w-4" aria-hidden /> : idx + 1}
          </span>
          <span className={cn("truncate text-xs font-semibold", idx === step ? "text-foreground" : "text-muted-foreground")}>
            {title}
          </span>
          {idx < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

function ReadBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-11 flex-col justify-center rounded-input border border-border bg-background px-3 py-2 text-sm text-foreground">
      {children}
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{formatCurrency(value, true)}</span>
    </div>
  );
}
