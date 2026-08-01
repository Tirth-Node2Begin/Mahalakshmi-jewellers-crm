"use client";

import { ApiError } from "@/shared/api/api-error";
import { Input } from "@/shared/ui/input";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { billingApi } from "./api";
import { formatWeight, num } from "./calc";
import type { ItemCategory, StockItem } from "./types";

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
 * Focus  → the dropdown opens on its own with the first items in stock, so the
 *          counter can pick from a list without knowing what to type. The
 *          category chips (Ring, Chain, …) narrow that list.
 * Pick   → the list closes; the caret stays in the box for the scanner, and a
 *          tap or a keystroke brings the list back for the next item.
 *
 * Tagged pieces already on the bill (`excludeIds`) are hidden from the list and
 * refused on re-scan — a unique piece can only be sold once. Bulk items stay
 * pickable: each pick is a fresh weighing off the same stock.
 *
 * The weighing prompt for bulk stock used to live here as its own dialog. It is
 * now step 1 of `ItemDetailsDialog`, which the billing screen opens for bulk
 * items — one dialog asking for everything, rather than two asking for a piece
 * of it each.
 */
export function ItemSearch({
  onPick,
  categories = [],
  autoFocus = true,
  placeholder = "Scan a tag or type an item name…",
  disabled = false,
  excludeIds = [],
}: {
  onPick: (item: StockItem, picked: PickedItem) => void;
  categories?: ItemCategory[];
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Item ids already on the bill — tagged pieces among them are hidden and refused. */
  excludeIds?: number[];
}) {
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [looking, setLooking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const debounced = useDebouncedValue(term, 250);
  const { data } = useQuery({
    queryKey: ["billing", "search-items", debounced, category],
    queryFn: () => billingApi.searchItems(debounced, category),
    // open = browse mode: an empty term lists the first items in stock
    enabled: open && !disabled,
    staleTime: 30_000,
  });
  // a tagged piece already on the bill must not be offered again; bulk stock can
  // be picked repeatedly — every pick is its own weighing
  const results = (data?.items ?? []).filter(
    (item) => item.tracking === "bulk" || !excludeIds.includes(item.id),
  );

  /**
   * The list on screen lags the keystrokes by a debounce. A scanner types a
   * whole barcode inside that window, so on Enter the visible rows may still
   * belong to the PREVIOUS term — never accept a highlighted row unless the
   * results actually answer what is typed now.
   */
  const resultsAreFresh = debounced.trim() === term.trim();

  // the scanner needs the caret to live here — take it back after every add
  const focus = () => requestAnimationFrame(() => inputRef.current?.focus());
  useEffect(() => {
    if (autoFocus && !disabled) focus();
  }, [autoFocus, disabled]);

  // tapping anywhere outside puts the dropdown away
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const accept = (item: StockItem) => {
    setTerm("");
    setHighlight(0);
    // the pick is done — the list goes away until the box is tapped or typed in again
    setOpen(false);
    inputRef.current?.blur();
    onPick(item, { qty: 1, gross_weight: num(item.gross_weight), net_weight: num(item.net_weight) || num(item.gross_weight) });
    // a bulk item opens the details dialog above us — taking the caret back here
    // would pull it straight out of the weight field
  };

  const lookup = async (value: string) => {
    const scanned = value.trim();
    if (!scanned) return;
    setLooking(true);
    try {
      const res = await billingApi.lookup(scanned);
      if (res.item.tracking !== "bulk" && excludeIds.includes(res.item.id)) {
        toast.error(`${res.item.name} is already on this bill.`);
        setTerm("");
        focus();
        return;
      }
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else if (results.length > 0) setHighlight((h) => Math.min(h + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && results.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Escape") {
      setTerm("");
      setOpen(false);
      return;
    }
    if (e.key !== "Enter") return;
    e.preventDefault();
    // A scanner types faster than the type-ahead can answer, so on Enter with a
    // stale list the term is treated as a scanned tag/barcode. A fresh,
    // highlighted suggestion — typed or browsed — wins.
    const chosen = results[highlight];
    if (chosen && open && resultsAreFresh) {
      accept(chosen);
      return;
    }
    void lookup(term);
  };

  return (
    <div ref={rootRef} className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-strong" aria-hidden />
      <Input
        ref={inputRef}
        value={term}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        // after an add the caret stays here (for the scanner) — a click on an
        // already-focused input fires no focus event, so reopen on click too
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label="Scan or search an item"
        aria-expanded={open}
        autoComplete="off"
        className="h-14 border-2 border-primary/40 pl-12 pr-28 text-base font-medium"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {looking ? "Looking up…" : "Scan or press Enter"}
      </span>

      {open && !disabled ? (
        <div className="absolute z-30 mt-2 w-full rounded-card border border-border bg-card shadow-modal">
          {/* --------------------------------------------- category chips */}
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border p-2.5">
              <CategoryChip selected={category === null} onClick={() => { setCategory(null); setHighlight(0); }}>
                All
              </CategoryChip>
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  selected={category === c.id}
                  onClick={() => {
                    // tapping the active chip clears the filter
                    setCategory(category === c.id ? null : c.id);
                    setHighlight(0);
                    focus();
                  }}
                >
                  {c.name}
                </CategoryChip>
              ))}
            </div>
          ) : null}

          {results.length > 0 ? (
            <ul className="max-h-80 overflow-y-auto p-1.5" data-lenis-prevent>
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
                        {item.category_name ? ` · ${item.category_name}` : ""}
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
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {term.trim()
                ? `Nothing in stock matches “${term.trim()}”.`
                : category !== null
                  ? "Nothing in stock in this category."
                  : "Nothing in stock yet."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CategoryChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown fires before the input's blur, keeping interaction inside the panel
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
        selected
          ? "border-primary bg-primary-soft text-primary-strong"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
