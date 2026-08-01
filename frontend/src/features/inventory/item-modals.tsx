"use client";

import { inventoryApi, type InventoryCategory, type InventoryItem, type Unit } from "@/features/inventory/api";
import { PARTNER_CATEGORIES, PARTNER_CATEGORY_OF, vendorsApi } from "@/features/vendors/api";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Collapsible } from "@/shared/ui/collapsible";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Raw materials are weighed or counted in these units, in this order. */
const RAW_UNIT_ORDER = ["g", "kg", "ct", "pcs"];

/** Create/edit an inventory item. item_type is fixed after creation. */
export function ItemModal({
  open,
  onClose,
  item,
  defaultType,
  categories,
  units,
}: {
  open: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  defaultType: "raw_material" | "stock";
  categories: InventoryCategory[];
  units: Unit[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!item;
  const type = item?.item_type ?? defaultType;
  const isStock = type === "stock";
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    unit_id: "",
    reorder_level: "",
    selling_price: "",
    show_on_website: true,
    description: "",
    opening_qty: "",
    opening_cost: "",
    metal_type: "",
    purity: "",
    gross_wt: "",
    net_wt: "",
    stone_wt: "",
    diamond_ct: "",
    diamond_pcs: "",
    making_charge: "",
    wastage_pct: "",
    hsn_code: "",
    location: "",
    purchase_price: "",
    barcode: "",
    vendor_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: vendorData } = useQuery({
    queryKey: ["vendors", "pick"],
    queryFn: () => vendorsApi.pick(),
    enabled: open,
  });
  const vendors = vendorData?.vendors ?? [];

  useEffect(() => {
    if (open) {
      setForm({
        name: item?.name ?? "",
        category_id: item?.category_id ? String(item.category_id) : "",
        unit_id: item ? String(item.unit_id) : "",
        reorder_level: item && Number(item.reorder_level) > 0 ? item.reorder_level : "",
        selling_price: item?.selling_price ?? "",
        show_on_website: item ? item.show_on_website !== 0 : true,
        description: item?.description ?? "",
        opening_qty: "",
        opening_cost: "",
        metal_type: item?.metal_type ?? "",
        purity: item?.purity ?? "",
        gross_wt: item && Number(item.gross_wt) > 0 ? item.gross_wt : "",
        net_wt: item && Number(item.net_wt) > 0 ? item.net_wt : "",
        stone_wt: item && Number(item.stone_wt) > 0 ? item.stone_wt : "",
        diamond_ct: item && Number(item.diamond_ct) > 0 ? item.diamond_ct : "",
        diamond_pcs: item && Number(item.diamond_pcs) > 0 ? String(item.diamond_pcs) : "",
        making_charge: item && Number(item.making_charge) > 0 ? item.making_charge : "",
        wastage_pct: item && Number(item.wastage_pct) > 0 ? item.wastage_pct : "",
        hsn_code: item?.hsn_code ?? "",
        location: item?.location ?? "",
        purchase_price: item && Number(item.purchase_price) > 0 ? item.purchase_price : "",
        barcode: item?.barcode ?? "",
        vendor_id: item?.vendor_id ? String(item.vendor_id) : "",
      });
      setError(null);
    }
  }, [open, item]);

  const typeCategories = categories.filter((c) => c.item_type === type && c.is_active === 1);

  const save = async () => {
    setError(null);
    if (form.name.trim().length < 2) return setError("Enter an item name.");
    if (!isStock && !form.unit_id) return setError("Pick how this material is measured (g, kg or ct).");
    if (isStock && form.opening_qty && !Number.isInteger(Number(form.opening_qty))) {
      return setError("Pieces in hand must be a whole number.");
    }
    const numeric = [
      form.reorder_level, form.selling_price, form.opening_qty, form.opening_cost, form.gross_wt, form.net_wt,
      form.stone_wt, form.diamond_ct, form.diamond_pcs, form.making_charge, form.wastage_pct, form.purchase_price,
    ];
    if (numeric.some((v) => v !== "" && Number(v) < 0)) {
      return setError("Prices, weights and quantities can't be negative.");
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        item_type: type,
        category_id: form.category_id ? Number(form.category_id) : null,
        // stock is always counted in pieces — the server enforces it, so only raw sends a unit
        ...(isStock ? {} : { unit_id: Number(form.unit_id) }),
        reorder_level: form.reorder_level ? Number(form.reorder_level) : 0,
        selling_price: isStock && form.selling_price ? Number(form.selling_price) : null,
        show_on_website: form.show_on_website ? 1 : 0,
        description: form.description || null,
        metal_type: form.metal_type || null,
        purity: form.purity || null,
        gross_wt: form.gross_wt || 0,
        net_wt: form.net_wt || 0,
        stone_wt: form.stone_wt || 0,
        diamond_ct: form.diamond_ct || 0,
        diamond_pcs: form.diamond_pcs ? Number(form.diamond_pcs) : 0,
        making_charge: form.making_charge || 0,
        wastage_pct: form.wastage_pct || 0,
        hsn_code: form.hsn_code || null,
        location: form.location || null,
        purchase_price: form.purchase_price || 0,
        barcode: form.barcode || null,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
      };
      if (isEdit) {
        await inventoryApi.update({ id: item!.id, ...payload });
      } else {
        if (form.opening_qty) {
          payload.opening_qty = Number(form.opening_qty);
          payload.opening_cost = form.opening_cost ? Number(form.opening_cost) : 0;
        }
        await inventoryApi.create(payload);
      }
      toast.success(isEdit ? "Item updated." : "Item created.");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save item.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={640}
      title={isEdit ? "Edit item" : type === "raw_material" ? "New raw material" : "New stock item"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>{isEdit ? "Save" : "Create"}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="it_name" required>Name</Label>
          <Input id="it_name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={type === "stock" ? "e.g. 22K Gold Bangle Pair" : "e.g. 22K Gold"} autoFocus />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="it_cat">Category</Label>
            <Select id="it_cat" value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
              <option value="">—</option>
              {typeCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="it_unit" required={!isStock}>Measured in</Label>
            {isStock ? (
              <>
                <div className="flex h-12 items-center rounded-input border border-border bg-background px-4 text-sm text-foreground">
                  Pieces (pcs)
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Finished jewellery is counted — 1, 2, 3 pieces.</p>
              </>
            ) : (
              <>
                <Select id="it_unit" value={form.unit_id} onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value }))}>
                  <option value="">Select…</option>
                  {RAW_UNIT_ORDER.map((short) => {
                    const u = units.find((x) => x.short_name === short);
                    return u ? <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option> : null;
                  })}
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">Gold &amp; silver in grams · diamonds in carats.</p>
              </>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="it_vendor">Supplier {type === "raw_material" ? "(where this material came from)" : "/ Karigar"}</Label>
          <Select id="it_vendor" value={form.vendor_id} onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value }))}>
            <option value="">— none —</option>
            {PARTNER_CATEGORIES.map((cat) => {
              const group = vendors.filter((v) => PARTNER_CATEGORY_OF[v.vendor_type] === cat.key);
              return group.length ? (
                <optgroup key={cat.key} label={cat.label}>
                  {group.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </optgroup>
              ) : null;
            })}
            {/* shop-added types belong to no built-in category — don't lose those vendors */}
            {vendors.some((v) => !PARTNER_CATEGORY_OF[v.vendor_type]) ? (
              <optgroup label="Other">
                {vendors
                  .filter((v) => !PARTNER_CATEGORY_OF[v.vendor_type])
                  .map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
              </optgroup>
            ) : null}
          </Select>
        </div>
        {type === "stock" ? (
          <div>
            <Label htmlFor="it_sp">Selling price (₹)</Label>
            <Input id="it_sp" inputMode="decimal" value={form.selling_price} onChange={(e) => setForm((f) => ({ ...f, selling_price: e.target.value }))} placeholder="Tag price shown to customer" />
          </div>
        ) : null}

        {type === "stock" ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-input border border-border bg-background px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">Show on website</span>
              <span className="block text-xs text-muted-foreground">Turn off to keep it in the CRM but hide it from the public website.</span>
            </span>
            <input
              type="checkbox"
              checked={form.show_on_website}
              onChange={(e) => setForm((f) => ({ ...f, show_on_website: e.target.checked }))}
              className="h-5 w-5 shrink-0 rounded border-border accent-[#4270bf]"
            />
          </label>
        ) : null}

        {!isEdit ? (
          <div className="grid gap-5 rounded-input bg-background p-4 sm:grid-cols-2">
            <div className="sm:col-span-2 -mb-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">
              {isStock ? "Pieces in hand now (optional)" : "Stock in hand now (optional)"}
            </div>
            <div>
              <Label htmlFor="it_oq">{isStock ? "How many pieces" : "Quantity"}</Label>
              <Input id="it_oq" inputMode={isStock ? "numeric" : "decimal"} value={form.opening_qty} onChange={(e) => setForm((f) => ({ ...f, opening_qty: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="it_oc">{isStock ? "Cost / piece (₹)" : "Cost / unit (₹)"}</Label>
              <Input id="it_oc" inputMode="decimal" value={form.opening_cost} onChange={(e) => setForm((f) => ({ ...f, opening_cost: e.target.value }))} placeholder="0" />
            </div>
          </div>
        ) : null}

        {!isStock ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="it_metal_raw">Material</Label>
              <Input id="it_metal_raw" list="metal-options" value={form.metal_type} onChange={(e) => setForm((f) => ({ ...f, metal_type: e.target.value }))} placeholder="Gold / Silver / Diamond" />
            </div>
            <div>
              <Label htmlFor="it_purity_raw">Purity / grade</Label>
              <Input id="it_purity_raw" list="purity-options" value={form.purity} onChange={(e) => setForm((f) => ({ ...f, purity: e.target.value }))} placeholder="22K · 925 · VS1" />
            </div>
            {units.find((u) => String(u.id) === form.unit_id)?.short_name === "ct" ? (
              <div>
                <Label htmlFor="it_dpcs_raw">Stones in lot (pcs)</Label>
                <Input id="it_dpcs_raw" inputMode="numeric" value={form.diamond_pcs} onChange={(e) => setForm((f) => ({ ...f, diamond_pcs: e.target.value }))} placeholder="e.g. 5" />
              </div>
            ) : null}
          </div>
        ) : null}

        <Collapsible
          label={isStock ? "What's inside each piece" : "More details"}
          hint={isStock ? "Gold/silver weight, diamonds, making — all optional" : "Reorder alert & notes"}
        >
          <div className="space-y-5">
            {isStock ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="it_metal">Metal</Label>
                  <Input id="it_metal" list="metal-options" value={form.metal_type} onChange={(e) => setForm((f) => ({ ...f, metal_type: e.target.value }))} placeholder="Gold" />
                </div>
                <div>
                  <Label htmlFor="it_purity">Purity</Label>
                  <Input id="it_purity" list="purity-options" value={form.purity} onChange={(e) => setForm((f) => ({ ...f, purity: e.target.value }))} placeholder="22K" />
                </div>
                <div>
                  <Label htmlFor="it_gross">Gross wt (g)</Label>
                  <Input id="it_gross" inputMode="decimal" value={form.gross_wt} onChange={(e) => setForm((f) => ({ ...f, gross_wt: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_net">Net metal wt (g)</Label>
                  <Input id="it_net" inputMode="decimal" value={form.net_wt} onChange={(e) => setForm((f) => ({ ...f, net_wt: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_stone">Stone wt (g)</Label>
                  <Input id="it_stone" inputMode="decimal" value={form.stone_wt} onChange={(e) => setForm((f) => ({ ...f, stone_wt: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_dct">Diamond (ct)</Label>
                  <Input id="it_dct" inputMode="decimal" value={form.diamond_ct} onChange={(e) => setForm((f) => ({ ...f, diamond_ct: e.target.value }))} placeholder="e.g. 1.25" />
                </div>
                <div>
                  <Label htmlFor="it_dpcs">Diamond stones (pcs)</Label>
                  <Input id="it_dpcs" inputMode="numeric" value={form.diamond_pcs} onChange={(e) => setForm((f) => ({ ...f, diamond_pcs: e.target.value }))} placeholder="e.g. 3" />
                </div>
                <div>
                  <Label htmlFor="it_making">Making charge (₹)</Label>
                  <Input id="it_making" inputMode="decimal" value={form.making_charge} onChange={(e) => setForm((f) => ({ ...f, making_charge: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_wastage">Wastage %</Label>
                  <Input id="it_wastage" inputMode="decimal" value={form.wastage_pct} onChange={(e) => setForm((f) => ({ ...f, wastage_pct: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_purchase">Purchase price (₹)</Label>
                  <Input id="it_purchase" inputMode="decimal" value={form.purchase_price} onChange={(e) => setForm((f) => ({ ...f, purchase_price: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="it_hsn">HSN (GST code)</Label>
                  <Input id="it_hsn" value={form.hsn_code} onChange={(e) => setForm((f) => ({ ...f, hsn_code: e.target.value }))} placeholder="7113" />
                </div>
                <div>
                  <Label htmlFor="it_location">Location</Label>
                  <Input id="it_location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Showcase / locker" />
                </div>
                <div>
                  <Label htmlFor="it_barcode">Barcode</Label>
                  <Input id="it_barcode" value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
                </div>
              </div>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="it_reorder">Alert when stock falls below</Label>
                <Input id="it_reorder" inputMode="decimal" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div>
              <Label htmlFor="it_desc">Notes</Label>
              <Textarea id="it_desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
        </Collapsible>

        <FieldError message={error ?? undefined} />

        <datalist id="metal-options">
          {["Gold", "Silver", "Platinum", "Rose Gold", "White Gold", "Diamond"].map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <datalist id="purity-options">
          {["24K", "22K", "20K", "18K", "14K", "925 Silver", "950 Platinum"].map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
    </Dialog>
  );
}

/** One-tap reason presets so non-technical staff don't have to type. */
const ADD_REASONS = ["New purchase", "Stock count", "Customer return", "Correction"];
const USE_REASONS = ["Used in making", "Damage", "Sold loose", "Correction"];

/** Add stock / use (reduce) stock — writes an audited adjustment ledger row. */
export function AdjustModal({
  open,
  onClose,
  item,
  initialDirection = "in",
}: {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  initialDirection?: "in" | "out";
}) {
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDirection(initialDirection);
      setQty("");
      setUnitCost("");
      setNotes("");
      setError(null);
    }
  }, [open, initialDirection]);

  const save = async () => {
    setError(null);
    if (!item) return;
    if (!Number(qty)) return setError("Enter a quantity.");
    if (Number(qty) < 0) return setError("Quantity can't be negative.");
    if (["pcs", "set", "box"].includes(item.unit) && !Number.isInteger(Number(qty))) {
      return setError(`Quantity must be a whole number of ${item.unit}.`);
    }
    if (unitCost !== "" && Number(unitCost) < 0) return setError("Cost / unit can't be negative.");
    if (!notes.trim()) return setError("Add a reason for the adjustment.");
    setBusy(true);
    try {
      await inventoryApi.adjust({
        item_id: item.id,
        direction,
        qty: Number(qty),
        unit_cost: direction === "in" && unitCost ? Number(unitCost) : undefined,
        notes,
      });
      toast.success("Stock adjusted.");
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not adjust stock.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? `${direction === "in" ? "Add stock" : "Use / reduce"} — ${item.name}` : "Adjust stock"}
      maxWidth={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={busy}>{direction === "in" ? "Add stock" : "Reduce stock"}</Button>
        </>
      }
    >
      {item ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Current stock: <span className="font-semibold text-foreground">{item.current_stock} {item.unit}</span>
          </p>
          <div className="flex rounded-pill bg-background p-1">
            {(["in", "out"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 rounded-pill py-1.5 text-sm font-medium capitalize transition-colors ${direction === d ? "bg-card text-primary-strong shadow-card" : "text-muted-foreground"}`}
              >
                {d === "in" ? "Add stock" : "Use / reduce"}
              </button>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="aj_qty" required>Quantity ({item.unit})</Label>
              <Input id="aj_qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
            </div>
            {direction === "in" ? (
              <div>
                <Label htmlFor="aj_cost">Cost / unit (₹)</Label>
                <Input id="aj_cost" inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="optional" />
              </div>
            ) : null}
          </div>
          <div>
            <Label htmlFor="aj_notes" required>Reason</Label>
            <div className="mb-2 flex flex-wrap gap-2">
              {(direction === "in" ? ADD_REASONS : USE_REASONS).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNotes(r)}
                  className={`rounded-pill border px-3 py-1 text-xs font-medium transition-colors ${
                    notes === r
                      ? "border-primary bg-primary-soft text-primary-strong"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Input
              id="aj_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Or type your own reason…"
            />
          </div>
          <FieldError message={error ?? undefined} />
        </div>
      ) : null}
    </Dialog>
  );
}
