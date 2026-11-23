"use client";

import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PARTNER_CATEGORIES,
  PARTNER_PAGES,
  partnerCategoryOf,
  VENDOR_TYPE_LABEL,
  vendorsApi,
  type CustomVendorType,
  type PartnerCategory,
} from "./api";

/** Sentinel option value — never a real type slug, which is always a-z0-9_. */
const ADD_NEW = "__add_type__";

/**
 * Shop-added vendor types (the vendor_types master) with the helpers every
 * partner screen needs:
 *
 *   labelOf     — built-in label, custom label, or the raw slug as a last resort
 *   categoryOf  — which partner page a type belongs to; a custom type carries
 *                 its own category, so it stays on the page it was added from
 *   typesIn     — the custom types of one page
 */
export function useVendorTypes() {
  const { data } = useQuery({
    queryKey: ["vendors", "types"],
    queryFn: () => vendorsApi.listTypes(),
    staleTime: 30 * 60_000,
  });
  const customTypes = data?.types ?? [];

  const labelOf = (type: string): string =>
    VENDOR_TYPE_LABEL[type] ?? customTypes.find((t) => t.slug === type)?.label ?? type;

  const categoryOf = (type: string): PartnerCategory =>
    customTypes.find((t) => t.slug === type)?.category ?? partnerCategoryOf(type);

  const typesIn = (category: PartnerCategory): CustomVendorType[] =>
    customTypes.filter((t) => t.category === category);

  return { customTypes, labelOf, categoryOf, typesIn };
}

/**
 * Grouped type dropdown with "+ Add a new type…" at the bottom for staff who
 * may manage vendors. Picking it opens the dialog; saving puts the type in the
 * database and selects it here, so the user carries on with the form.
 *
 * `category` narrows the list to one partner page's own types: adding from the
 * Suppliers page must not offer "Jewellery Maker", or the new record would
 * vanish from the page it was created on. A type added here is filed under that
 * same category, so every page can grow its own list.
 */
export function VendorTypeSelect({
  id,
  value,
  onChange,
  category,
}: {
  id: string;
  value: string;
  onChange: (type: string) => void;
  /** Limit the options to this partner category — omit to offer all of them. */
  category?: PartnerCategory;
}) {
  const { can } = usePermissions();
  const { customTypes, typesIn, labelOf } = useVendorTypes();
  const [adding, setAdding] = useState(false);

  const canAdd = can("vendors.manage");
  const groups = category ? PARTNER_CATEGORIES.filter((c) => c.key === category) : PARTNER_CATEGORIES;
  // this page's own shop-added types (all of them when no page is pinned)
  const mineCustom = category ? typesIn(category) : customTypes;

  // A vendor saved with a custom type before this counter's list has loaded
  // would otherwise silently snap to the first option — keep showing it. The
  // same guard keeps an out-of-category type visible while editing.
  const inList =
    groups.some((c) => (c.types as readonly string[]).includes(value)) ||
    mineCustom.some((t) => t.slug === value);
  const missing = !!value && !inList;

  return (
    <>
      <Select
        id={id}
        value={value}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) {
            setAdding(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        {missing ? <option value={value}>{labelOf(value)}</option> : null}
        {groups.map((cat) => (
          <optgroup key={cat.key} label={cat.label}>
            {cat.types.map((t) => (
              <option key={t} value={t}>
                {VENDOR_TYPE_LABEL[t]}
              </option>
            ))}
            {/* shop-added types sit inside their own page's group, not in a
                separate bucket — to the user they are simply more types */}
            {category
              ? mineCustom.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.label}
                  </option>
                ))
              : typesIn(cat.key).map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.label}
                  </option>
                ))}
          </optgroup>
        ))}
        {canAdd ? <option value={ADD_NEW}>+ Add a new type…</option> : null}
      </Select>

      <AddVendorTypeDialog
        open={adding}
        category={category}
        onClose={() => setAdding(false)}
        onCreated={(type) => {
          setAdding(false);
          onChange(type.slug);
        }}
      />
    </>
  );
}

/**
 * Adds a type to the vendor_types master and hands the new slug back.
 *
 * The type is filed under a partner page. Opened from a page, that page is
 * fixed (and simply stated); opened without one, the user picks.
 */
export function AddVendorTypeDialog({
  open,
  category,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** Fixed partner page for the new type — omit to let the user choose. */
  category?: PartnerCategory;
  onClose: () => void;
  onCreated: (type: CustomVendorType) => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [chosen, setChosen] = useState<PartnerCategory>(category ?? "service");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // reopening from another page must not keep the previous page's choice
  useEffect(() => {
    if (open) setChosen(category ?? "service");
  }, [open, category]);

  const target = category ?? chosen;

  const close = () => {
    setLabel("");
    setError(null);
    onClose();
  };

  const save = async () => {
    if (label.trim().length < 2) return setError("Give the type a name, such as Refiner.");

    setBusy(true);
    setError(null);
    try {
      const res = await vendorsApi.addType(label.trim(), target);
      await queryClient.invalidateQueries({ queryKey: ["vendors", "types"] });
      toast.success("Type added.");
      setLabel("");
      setError(null);
      onCreated(res.type);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add the type. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a type"
      maxWidth={440}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Adding…" : "Add type"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="vtype_label" required>
            Type name
          </Label>
          <Input
            id="vtype_label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Refiner"
            maxLength={60}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
          />
        </div>

        {category ? (
          <p className="text-sm text-muted-foreground">
            It will be added under <span className="font-medium text-foreground">{PARTNER_PAGES[category].label}</span> and
            will show in this list straight away.
          </p>
        ) : (
          <div>
            <Label htmlFor="vtype_category">Where does it belong?</Label>
            <Select id="vtype_category" value={chosen} onChange={(e) => setChosen(e.target.value as PartnerCategory)}>
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {PARTNER_PAGES[c.key].label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              People with this type will be listed on that page.
            </p>
          </div>
        )}

        {target === "maker" ? (
          <p className="text-xs text-muted-foreground">
            Makers can be given work to do, so this type will also appear when you send an order out.
          </p>
        ) : null}

        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
