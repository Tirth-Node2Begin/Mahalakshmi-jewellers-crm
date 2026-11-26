"use client";

import {
  LINE_KIND_HINT,
  LINE_KIND_LABEL,
  type BulkPoolItem,
  type LineKind,
} from "@/features/purchases/api";
import { type Metal, type Purity, type StockCategory } from "@/features/stock/api";
import { MetalSelect } from "@/features/stock/metal-select";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { cn } from "@/shared/utils/cn";
import { formatCurrency } from "@/shared/utils/format";
import { ChevronDown } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

/** One purchase line while it is being typed — strings so the boxes can be empty. */
export interface LineDraft {
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
export function blankLine(kind: LineKind = "tagged"): LineDraft {
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
export function lineAmount(line: LineDraft): number {
  if (line.kind === "service") return Number(line.amount || 0);
  const weight = line.kind === "tagged" ? Number(line.net_weight || 0) : Number(line.weight || 0);
  const rate = Number(line.rate_per_gram || 0);
  const making = Number(line.making_charge || 0);
  return Math.round((weight * rate + making) * 100) / 100;
}

export function lineTax(line: LineDraft): number {
  return Math.round(((lineAmount(line) * Number(line.tax_rate || 0)) / 100) * 100) / 100;
}

const COMMON_PIECE_NAMES = [
  "Kada - plain",
  "Kada - design",
  "Ring - plain",
  "Ring - CZ",
  "Bangle - single",
  "Bangle Set",
  "Bracelet",
  "Chain",
  "Chain with pendant",
  "Pendant",
  "Pendant Set",
  "Earring",
  "Necklace",
  "Choker Necklace",
  "Mangalsutra",
  "Nose Pin",
  "Anklet",
  "Toe Ring",
  "Coin",
  "Bar",
];

const METAL_LABELS: Record<string, string> = {
  gold: "Gold",
  silver: "Silver",
  platinum: "Platinum",
};

export function metalName(metal: Metal): string {
  const key = String(metal || "").toLowerCase();
  return METAL_LABELS[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Gold");
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const clean = name.trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function pieceNameOptions(categories: StockCategory[], metal: Metal): string[] {
  const label = metalName(metal);
  return uniqueNames([
    ...categories.map((c) => `${label} ${c.name}`),
    ...COMMON_PIECE_NAMES.map((name) => `${label} ${name}`),
  ]);
}

function tokens(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function categoryIdForPieceName(categories: StockCategory[], name: string): string | undefined {
  const nameTokens = tokens(name);
  const match = [...categories]
    .sort((a, b) => b.name.length - a.name.length)
    .find((category) => tokens(category.name).every((token) => nameTokens.includes(token)));
  return match ? String(match.id) : undefined;
}

export interface PurchaseHelpers {
  purities: Purity[];
  categories: StockCategory[];
  bulkItems: BulkPoolItem[];
}

/**
 * The line editor, now a dialog: the purchase page stays a short list and this
 * asks the questions one line at a time — same fields, same rules as before.
 */
export function PurchaseLineDialog({
  draft,
  helpers,
  onClose,
  onSave,
}: {
  /** The line being added/edited, or null when the dialog is closed. */
  draft: { line: LineDraft; isNew: boolean } | null;
  helpers: PurchaseHelpers;
  onClose: () => void;
  onSave: (line: LineDraft) => void;
}) {
  const [line, setLine] = useState<LineDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the dialog edits its own copy — nothing lands on the purchase until "Add"
  useEffect(() => {
    setLine(draft ? { ...draft.line } : null);
    setError(null);
  }, [draft]);

  const patch = (p: Partial<LineDraft>) => setLine((l) => (l ? { ...l, ...p } : l));

  const metalPurities = useMemo(
    () => (line ? helpers.purities.filter((p) => p.metal === line.metal) : []),
    [helpers.purities, line],
  );

  /** Picking a purity fills in today's rate, if we have one and the box is empty. */
  const pickPurity = (purityId: string) => {
    if (!line) return;
    const purity = helpers.purities.find((p) => String(p.id) === purityId);
    const p: Partial<LineDraft> = { purity_id: purityId };
    if (purity?.rate_per_gram && !line.rate_per_gram) p.rate_per_gram = String(Number(purity.rate_per_gram));
    patch(p);
  };

  const problem = (l: LineDraft): string | null => {
    if (l.kind === "service") {
      if (!l.description.trim()) return "Say what the charge is for.";
      if (Number(l.amount || 0) <= 0) return "Enter the amount.";
      return null;
    }
    if (!l.purity_id) return "Choose the purity.";
    if (Number(l.rate_per_gram || 0) <= 0) return "Enter the metal rate per gram.";
    if (l.kind === "tagged") {
      if (!l.description.trim()) return "Give the piece a name.";
      if (Number(l.net_weight || 0) <= 0) return "Enter the net metal weight.";
      if (l.gross_weight.trim() !== "" && Number(l.net_weight || 0) > Number(l.gross_weight || 0) + 0.0005) {
        return "Net weight cannot be more than gross weight.";
      }
    } else {
      if (Number(l.weight || 0) <= 0) return "Enter the weight in grams.";
      if (Number(l.qty || 0) <= 0) return "Enter how many units.";
    }
    if (lineAmount(l) <= 0) return "This line adds up to zero.";
    return null;
  };

  const save = () => {
    if (!line) return;
    const message = problem(line);
    setError(message);
    if (message) return;
    onSave(line);
  };

  if (!line) return null;

  return (
    <Dialog
      open={!!draft}
      onClose={onClose}
      title={draft?.isNew ? "Add to purchase" : "Edit line"}
      maxWidth={680}
      footer={
        <>
          <div className="mr-auto text-sm text-muted-foreground">
            Line total{" "}
            <span className="ml-1 text-base font-bold tabular-nums text-foreground">
              {formatCurrency(lineAmount(line) + lineTax(line), true)}
            </span>
          </div>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{draft?.isNew ? "Add to purchase" : "Save line"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          {/* The ONLY place a line's type is chosen. */}
          <div className="flex flex-wrap gap-1 rounded-pill bg-background p-1">
            {(Object.keys(LINE_KIND_LABEL) as LineKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => patch({ kind: k })}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors",
                  line.kind === k ? "bg-primary-soft text-primary-strong" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LINE_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{LINE_KIND_HINT[line.kind]}</p>
        </div>

        {line.kind === "service" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="pl_desc" required>What is the charge for?</Label>
              <Input
                id="pl_desc"
                value={line.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="e.g. Karigar making charges — 5 bangles"
              />
            </div>
            <div>
              <Label htmlFor="pl_amount" required>Amount (₹)</Label>
              <Input
                id="pl_amount"
                inputMode="decimal"
                value={line.amount}
                onChange={(e) => patch({ amount: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {line.kind === "tagged" ? (
              <div className="sm:col-span-2">
                <Label htmlFor="pl_desc" required>Piece name</Label>
                <PieceNamePicker
                  id="pl_desc"
                  value={line.description}
                  metal={line.metal}
                  categories={helpers.categories}
                  onChange={(description) => patch({ description })}
                  onPick={(description) => {
                    const categoryId = categoryIdForPieceName(helpers.categories, description);
                    patch({ description, ...(categoryId ? { category_id: categoryId } : {}) });
                  }}
                  placeholder="e.g. 22K Gold Kada — plain"
                />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <Label htmlFor="pl_pool">Add to which pool?</Label>
                <Select id="pl_pool" value={line.item_id} onChange={(e) => patch({ item_id: e.target.value })}>
                  <option value="">Match by metal and purity</option>
                  {helpers.bulkItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.item_code} — {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="pl_metal" required>Metal</Label>
              <MetalSelect id="pl_metal" value={line.metal} onChange={(metal) => patch({ metal, purity_id: "" })} />
            </div>

            <div>
              <Label htmlFor="pl_purity" required>Purity</Label>
              <Select id="pl_purity" value={line.purity_id} onChange={(e) => pickPurity(e.target.value)}>
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
                  <Label htmlFor="pl_gross">Gross weight (g)</Label>
                  <Input
                    id="pl_gross"
                    inputMode="decimal"
                    value={line.gross_weight}
                    onChange={(e) => patch({ gross_weight: e.target.value })}
                    placeholder="0.000"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Only if the piece has stones — leave blank for plain metal.
                  </p>
                </div>
                <div>
                  <Label htmlFor="pl_net" required>Net metal weight (g)</Label>
                  <Input
                    id="pl_net"
                    inputMode="decimal"
                    value={line.net_weight}
                    onChange={(e) => patch({ net_weight: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="pl_qty" required>How many units</Label>
                  <Input id="pl_qty" inputMode="decimal" value={line.qty} onChange={(e) => patch({ qty: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="pl_weight" required>Total weight (g)</Label>
                  <Input
                    id="pl_weight"
                    inputMode="decimal"
                    value={line.weight}
                    onChange={(e) => patch({ weight: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="pl_rate" required>Metal rate (₹ / g)</Label>
              <Input
                id="pl_rate"
                inputMode="decimal"
                value={line.rate_per_gram}
                onChange={(e) => patch({ rate_per_gram: e.target.value })}
              />
            </div>

            {line.kind === "tagged" ? (
              <>
                <div>
                  <Label htmlFor="pl_making">Making charge (₹)</Label>
                  <Input
                    id="pl_making"
                    inputMode="decimal"
                    value={line.making_charge}
                    onChange={(e) => patch({ making_charge: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="pl_huid">HUID</Label>
                  <Input
                    id="pl_huid"
                    value={line.huid}
                    onChange={(e) => patch({ huid: e.target.value.toUpperCase() })}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label htmlFor="pl_cat">Category</Label>
                  <Select id="pl_cat" value={line.category_id} onChange={(e) => patch({ category_id: e.target.value })}>
                    <option value="">—</option>
                    {helpers.categories.map((c) => (
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

        <div className="w-28">
          <Label htmlFor="pl_tax">GST %</Label>
          <Input id="pl_tax" inputMode="decimal" value={line.tax_rate} onChange={(e) => patch({ tax_rate: e.target.value })} />
        </div>

        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}

function PieceNamePicker({
  id,
  value,
  metal,
  categories,
  placeholder,
  onChange,
  onPick,
}: {
  id: string;
  value: string;
  metal: Metal;
  categories: StockCategory[];
  placeholder?: string;
  onChange: (value: string) => void;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => pieceNameOptions(categories, metal), [categories, metal]);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options.filter((name) => !q || name.toLowerCase().includes(q)).slice(0, 14);
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (name: string) => {
    onPick(name);
    setOpen(false);
    setHighlight(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "Enter" && open && filtered[highlight]) {
      event.preventDefault();
      choose(filtered[highlight]);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={open}
        aria-controls={`${id}_options`}
        className="pr-11"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label="Show piece names"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          setOpen((current) => !current);
          inputRef.current?.focus();
        }}
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && filtered.length > 0 ? (
        <div
          id={`${id}_options`}
          role="listbox"
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-card border border-border bg-card p-1.5 shadow-modal"
        >
          {filtered.map((name, index) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={index === highlight}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(name)}
              className={cn(
                "block w-full rounded-input px-3 py-2 text-left text-sm transition-colors",
                index === highlight ? "bg-primary-soft text-primary-strong" : "text-foreground hover:bg-background",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
