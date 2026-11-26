"use client";

import {
  MAKING_TYPE_LABEL,
  stockApi,
  TRACKING_LABEL,
  type MakingType,
  type Metal,
  type Purity,
  type StockCategory,
  type StockItem,
  type Tracking,
} from "@/features/stock/api";
import { MetalSelect } from "@/features/stock/metal-select";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Collapsible } from "@/shared/ui/collapsible";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { formatWeight } from "@/shared/utils/format";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const BLANK = {
  name: "",
  metal: "gold" as Metal,
  purity_id: "",
  tracking: "tagged" as Tracking,
  category_id: "",
  gross_weight: "",
  net_weight: "",
  making_type: "per_gram" as MakingType,
  making_value: "",
  huid: "",
  hsn_code: "",
  barcode: "",
  reorder_level: "",
};

/**
 * Add / edit one item of the jewellery item master.
 *
 * Two rules the shop cares about:
 *  · net weight can never be more than gross weight (stone weight is the gap)
 *  · a gold tagged piece really should carry its HUID — we warn, never block.
 */
export function ItemFormDialog({
  open,
  onClose,
  onSaved,
  item,
  purities,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires after the server accepted the save, so the list can go to the item. */
  onSaved?: (saved: { id: number; isNew: boolean }) => void;
  item?: StockItem | null;
  purities: Purity[];
  categories: StockCategory[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!item;
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [huidWarned, setHuidWarned] = useState(false);
  const [busy, setBusy] = useState(false);

  // read the lookup lists through refs so a background refetch of the item list
  // can never reset a half-typed form (same trap as the Dialog focus effect)
  const purityRef = useRef(purities);
  purityRef.current = purities;
  const categoryRef = useRef(categories);
  categoryRef.current = categories;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setHuidWarned(false);
    if (item) {
      const purity = purityRef.current.find((p) => p.code === item.purity_code && p.metal === item.metal);
      const category = categoryRef.current.find((c) => c.name === item.category_name);
      setForm({
        name: item.name,
        metal: item.metal ?? "gold",
        purity_id: purity ? String(purity.id) : "",
        tracking: item.tracking,
        category_id: category ? String(category.id) : "",
        gross_weight: Number(item.gross_weight) > 0 ? item.gross_weight : "",
        net_weight: Number(item.net_weight) > 0 ? item.net_weight : "",
        making_type: item.making_type ?? "per_gram",
        making_value: Number(item.making_value) > 0 ? item.making_value : "",
        huid: item.huid ?? "",
        hsn_code: item.hsn_code ?? "",
        barcode: item.barcode ?? "",
        reorder_level: Number(item.reorder_level) > 0 ? item.reorder_level : "",
      });
    } else {
      setForm(BLANK);
    }
  }, [open, item]);

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const metalPurities = purities.filter((p) => p.metal === form.metal);
  const gross = Number(form.gross_weight || 0);
  const net = Number(form.net_weight || 0);
  const stone = Math.max(0, gross - net);
  const netTooHeavy = net > gross + 0.0005;

  const needsHuidWarning = form.metal === "gold" && form.tracking === "tagged" && !form.huid.trim();

  const save = async () => {
    setError(null);
    if (form.name.trim().length < 2) return setError("Give the item a name, e.g. “22K Gold Bangle”.");
    if (!form.purity_id) return setError("Choose the purity — 22K, 916, 925 and so on.");
    if (netTooHeavy) return setError("Net weight cannot be more than gross weight.");
    if ([form.gross_weight, form.net_weight, form.making_value].some((v) => v !== "" && Number(v) < 0)) {
      return setError("Weights and making charges cannot be negative.");
    }
    // warn once about a missing hallmark id, then let them save anyway
    if (needsHuidWarning && !huidWarned) {
      setHuidWarned(true);
      return;
    }

    setBusy(true);
    try {
      const saved = await stockApi.saveItem({
        ...(isEdit ? { id: item!.id } : {}),
        name: form.name.trim(),
        metal: form.metal,
        purity_id: Number(form.purity_id),
        tracking: form.tracking,
        category_id: form.category_id ? Number(form.category_id) : null,
        gross_weight: gross,
        net_weight: net,
        making_type: form.making_type,
        making_value: Number(form.making_value || 0),
        huid: form.huid.trim() || null,
        hsn_code: form.hsn_code.trim() || null,
        barcode: form.barcode.trim() || null,
        reorder_level: Number(form.reorder_level || 0),
      });
      toast.success(isEdit ? "Item saved." : "Item created.");
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      onSaved?.({ id: saved.id, isNew: !isEdit });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the item. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={660}
      title={isEdit ? `Edit ${item!.item_code}` : "New item"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={busy}>
            {needsHuidWarning && huidWarned ? "Save without HUID" : isEdit ? "Save item" : "Create item"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="itf_name" required>
            Item name
          </Label>
          <Input
            id="itf_name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. 22K Gold Kada — plain"
            autoFocus
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="itf_metal" required>
              Metal
            </Label>
            <MetalSelect
              id="itf_metal"
              value={form.metal}
              onChange={(metal) => setForm((f) => ({ ...f, metal, purity_id: "" }))}
            />
          </div>
          <div>
            <Label htmlFor="itf_purity" required>
              Purity
            </Label>
            <Select id="itf_purity" value={form.purity_id} onChange={(e) => set("purity_id", e.target.value)}>
              <option value="">Select…</option>
              {metalPurities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="itf_tracking" required>
              How it is kept
            </Label>
            <Select
              id="itf_tracking"
              value={form.tracking}
              onChange={(e) => set("tracking", e.target.value as Tracking)}
            >
              {(Object.keys(TRACKING_LABEL) as Tracking[]).map((t) => (
                <option key={t} value={t}>
                  {TRACKING_LABEL[t]}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {form.tracking === "tagged"
                ? "One unique piece with its own tag."
                : "A pool of loose metal, counted in grams."}
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="itf_gross">Gross weight (g)</Label>
            <Input
              id="itf_gross"
              inputMode="decimal"
              value={form.gross_weight}
              onChange={(e) => set("gross_weight", e.target.value)}
              placeholder="0.000"
            />
          </div>
          <div>
            <Label htmlFor="itf_net">Net metal weight (g)</Label>
            <Input
              id="itf_net"
              inputMode="decimal"
              value={form.net_weight}
              onChange={(e) => set("net_weight", e.target.value)}
              placeholder="0.000"
              aria-invalid={netTooHeavy || undefined}
            />
          </div>
          <div>
            <Label>Stone weight</Label>
            <div className="flex h-12 items-center rounded-input border border-border bg-background px-4 text-sm tabular-nums text-foreground">
              {formatWeight(stone)}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">Gross minus net — worked out for you.</p>
          </div>
        </div>

        {netTooHeavy ? (
          <p role="alert" className="rounded-input bg-attention-soft px-4 py-3 text-sm text-attention-strong">
            Net weight is more than gross weight. The metal cannot weigh more than the whole piece.
          </p>
        ) : null}

        {/* Only a pool can run low. A tagged piece is one of a kind — it is on
            the shelf or it is sold — so the threshold is meaningless there. */}
        {form.tracking === "bulk" ? (
          <div className="sm:w-1/2 sm:pr-2.5">
            <Label htmlFor="itf_reorder">Warn me when this metal falls below (g)</Label>
            <Input
              id="itf_reorder"
              inputMode="decimal"
              value={form.reorder_level}
              onChange={(e) => set("reorder_level", e.target.value)}
              placeholder="0.000"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              The dashboard shows a low-stock warning once the pool drops to this weight. Leave blank for no warning.
            </p>
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="itf_mtype">Making charge type</Label>
            <Select
              id="itf_mtype"
              value={form.making_type}
              onChange={(e) => set("making_type", e.target.value as MakingType)}
            >
              {(Object.keys(MAKING_TYPE_LABEL) as MakingType[]).map((t) => (
                <option key={t} value={t}>
                  {MAKING_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="itf_mvalue">Making charge</Label>
            <Input
              id="itf_mvalue"
              inputMode="decimal"
              value={form.making_value}
              onChange={(e) => set("making_value", e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="itf_huid">HUID (hallmark number)</Label>
          <Input
            id="itf_huid"
            value={form.huid}
            onChange={(e) => {
              setHuidWarned(false);
              set("huid", e.target.value.toUpperCase());
            }}
            maxLength={10}
            placeholder="6-character hallmark id"
          />
          {huidWarned && needsHuidWarning ? (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-input bg-warning-soft px-4 py-3 text-sm text-warning-strong">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                This gold piece has no HUID. Hallmarked gold jewellery normally carries one. Press save again to
                continue without it.
              </span>
            </p>
          ) : null}
        </div>

        <Collapsible label="More details" hint="Category, HSN code and barcode — all optional">
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label htmlFor="itf_cat">Category</Label>
              <Select id="itf_cat" value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="itf_hsn">HSN code (GST)</Label>
              <Input
                id="itf_hsn"
                value={form.hsn_code}
                onChange={(e) => set("hsn_code", e.target.value)}
                placeholder="7113"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="itf_barcode">Barcode</Label>
              <Input
                id="itf_barcode"
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                maxLength={40}
              />
            </div>
          </div>
        </Collapsible>

        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
