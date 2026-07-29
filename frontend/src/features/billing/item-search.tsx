"use client";

import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { billingApi } from "./api";
import { formatWeight, num } from "./calc";
import type { StockItem } from "./types";

export interface PickedItem {
  qty: number;
  gross_weight: number;
  net_weight: number;
}

/**
 * The counter's main input — a barcode scanner types into it and presses Enter.
 *
 * Enter  → ?view=lookup (tag / barcode / HUID). Found → the line is added.
 * Typing → ?view=search_items type-ahead; ↑/↓ to choose, Enter to add.
 * A bulk item asks for the weighed weight and quantity before it is added.
 */
export function ItemSearch({
  onPick,
  autoFocus = true,
  placeholder = "Scan a tag or type an item name…",
  disabled = false,
}: {
  onPick: (item: StockItem, picked: PickedItem) => void;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [looking, setLooking] = useState(false);
  const [bulkItem, setBulkItem] = useState<StockItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebouncedValue(term, 250);
  const { data } = useQuery({
    queryKey: ["billing", "search-items", debounced],
    queryFn: () => billingApi.searchItems(debounced),
    enabled: debounced.trim().length >= 2 && !disabled,
    staleTime: 30_000,
  });
  const results = data?.items ?? [];

  // the scanner needs the caret to live here — take it back after every add
  const focus = () => requestAnimationFrame(() => inputRef.current?.focus());
  useEffect(() => {
    if (autoFocus && !disabled) focus();
  }, [autoFocus, disabled]);

  const accept = (item: StockItem) => {
    setTerm("");
    setHighlight(0);
    if (item.tracking === "bulk") {
      setBulkItem(item);
      return;
    }
    onPick(item, { qty: 1, gross_weight: num(item.gross_weight), net_weight: num(item.net_weight) || num(item.gross_weight) });
    focus();
  };

  const lookup = async (value: string) => {
    const scanned = value.trim();
    if (!scanned) return;
    setLooking(true);
    try {
      const res = await billingApi.lookup(scanned);
      accept(res.item);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        toast.error(`Nothing in stock matches “${scanned}”. Check the tag, or search by name.`);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not look that up.");
      }
      focus();
    } finally {
      setLooking(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setTerm("");
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    // A scanner types faster than the type-ahead can answer, so on Enter there are
    // usually no suggestions yet → the term is treated as a scanned tag/barcode.
    // If suggestions ARE showing, the chosen one wins.
    const chosen = results[highlight];
    if (chosen && term.trim().length >= 2) {
      accept(chosen);
      return;
    }
    void lookup(term);
  };

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-strong" aria-hidden />
        <Input
          ref={inputRef}
          value={term}
          disabled={disabled}
          onChange={(e) => {
            setTerm(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Scan or search an item"
          autoComplete="off"
          className="h-14 border-2 border-primary/40 pl-12 pr-28 text-base font-medium"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {looking ? "Looking up…" : "Scan or press Enter"}
        </span>

        {results.length > 0 && term.trim().length >= 2 ? (
          <ul className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-card border border-border bg-card p-1.5 shadow-modal" data-lenis-prevent>
            {results.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => accept(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left transition-colors",
                    idx === highlight ? "bg-primary-soft" : "hover:bg-background",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.item_code}
                      {item.purity_code ? ` · ${item.purity_code}` : ""}
                      {item.huid ? ` · HUID ${item.huid}` : ""}
                      {item.tracking === "bulk" ? " · sold by weight" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatWeight(item.net_weight || item.gross_weight)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <BulkWeightDialog
        item={bulkItem}
        onClose={() => {
          setBulkItem(null);
          focus();
        }}
        onConfirm={(item, picked) => {
          setBulkItem(null);
          onPick(item, picked);
          focus();
        }}
      />
    </>
  );
}

/** Bulk stock is sold by weight — ask what the scale says before adding it. */
function BulkWeightDialog({
  item,
  onClose,
  onConfirm,
}: {
  item: StockItem | null;
  onClose: () => void;
  onConfirm: (item: StockItem, picked: PickedItem) => void;
}) {
  const [qty, setQty] = useState("1");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");

  useEffect(() => {
    if (item) {
      setQty("1");
      setGross(num(item.gross_weight) > 0 ? String(num(item.gross_weight)) : "");
      setNet(num(item.net_weight) > 0 ? String(num(item.net_weight)) : "");
    }
  }, [item]);

  const confirm = () => {
    if (!item) return;
    const grossWeight = Number(gross) || 0;
    const netWeight = Number(net) || grossWeight;
    if (grossWeight <= 0) {
      toast.error("Enter the weight from the scale.");
      return;
    }
    if (netWeight > grossWeight) {
      toast.error("Net weight cannot be more than gross weight.");
      return;
    }
    onConfirm(item, { qty: Number(qty) || 1, gross_weight: grossWeight, net_weight: netWeight });
  };

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      title={item ? item.name : "Weigh the item"}
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm}>Add to bill</Button>
        </>
      }
    >
      <p className="mb-5 text-sm text-muted-foreground">
        This item is sold by weight. Put it on the scale and enter what it reads.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bulk_qty">Pieces</Label>
          <Input
            id="bulk_qty"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor="bulk_gross" required>
            Gross weight (g)
          </Label>
          <Input
            id="bulk_gross"
            inputMode="decimal"
            value={gross}
            onChange={(e) => {
              setGross(e.target.value);
              if (!net) setNet(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            className="tabular-nums"
            placeholder="0.000"
          />
        </div>
        <div>
          <Label htmlFor="bulk_net">Net weight (g)</Label>
          <Input
            id="bulk_net"
            inputMode="decimal"
            value={net}
            onChange={(e) => setNet(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            className="tabular-nums"
            placeholder="0.000"
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Net weight is the metal only — leave out stones.</p>
    </Dialog>
  );
}
