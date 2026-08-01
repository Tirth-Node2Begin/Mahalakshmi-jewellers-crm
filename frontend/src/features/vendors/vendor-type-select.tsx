"use client";

import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PARTNER_CATEGORIES, VENDOR_TYPE_LABEL, vendorsApi, type CustomVendorType } from "./api";

/** Sentinel option value — never a real type slug, which is always a-z0-9_. */
const ADD_NEW = "__add_type__";

/**
 * Shop-added vendor types (the vendor_types master) + a label resolver that
 * covers built-ins, custom types and — as a last resort — the raw slug, so a
 * vendor whose type was added on another counter still reads sensibly.
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
  return { customTypes, labelOf };
}

/**
 * Grouped type dropdown with "+ Add a new type…" at the bottom for staff who
 * may manage vendors. Picking it opens the dialog; saving puts the type in the
 * database and selects it here, so the user carries on with the form.
 */
export function VendorTypeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (type: string) => void;
}) {
  const { can } = usePermissions();
  const { customTypes } = useVendorTypes();
  const [adding, setAdding] = useState(false);

  const canAdd = can("vendors.manage");

  // A vendor saved with a custom type before this counter's list has loaded
  // would otherwise silently snap to the first option — keep showing it.
  const missing = value && !VENDOR_TYPE_LABEL[value] && !customTypes.some((t) => t.slug === value);

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
        {missing ? <option value={value}>{value}</option> : null}
        {PARTNER_CATEGORIES.map((cat) => (
          <optgroup key={cat.key} label={cat.label}>
            {cat.types.map((t) => (
              <option key={t} value={t}>
                {VENDOR_TYPE_LABEL[t]}
              </option>
            ))}
          </optgroup>
        ))}
        {customTypes.length ? (
          <optgroup label="Your types">
            {customTypes.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ) : null}
        {canAdd ? <option value={ADD_NEW}>+ Add a new type…</option> : null}
      </Select>

      <AddVendorTypeDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(type) => {
          setAdding(false);
          onChange(type.slug);
        }}
      />
    </>
  );
}

/** Adds a type to the vendor_types master and hands the new slug back. */
export function AddVendorTypeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (type: CustomVendorType) => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      const res = await vendorsApi.addType(label.trim());
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
      title="Add a vendor type"
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
        <p className="text-sm text-muted-foreground">
          The new type appears in every supplier / maker dropdown, next to the built-in ones.
        </p>
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
          />
        </div>
        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
