"use client";

import { metalsApi, type Metal, type MetalOption } from "@/features/stock/api";
import { usePermissions } from "@/lib/permissions";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

/** Sentinel option value — never a real metal code, which is always a-z0-9_. */
const ADD_NEW = "__add_metal__";

/**
 * The metal list is a master the shop can add to, so every metal picker reads it
 * from the server rather than a hardcoded union. Cached hard: it changes maybe
 * twice in the life of the shop.
 */
export function useMetals() {
  return useQuery({
    queryKey: ["metals"],
    queryFn: () => metalsApi.list(),
    staleTime: 30 * 60_000,
  });
}

/**
 * Metal dropdown with "Add a new metal…" at the bottom for staff who may manage
 * inventory. Picking it opens the dialog; saving puts the metal in the database
 * and selects it here, so the user carries on with the line they were filling in.
 */
export function MetalSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Metal;
  onChange: (metal: Metal) => void;
  disabled?: boolean;
}) {
  const { can } = usePermissions();
  const { data } = useMetals();
  const [adding, setAdding] = useState(false);

  const metals = data?.metals ?? [];
  const canAdd = can("inventory.manage");

  // A line saved with a metal that has since been switched off would otherwise
  // silently snap to the first option — keep showing it.
  const missing = value && !metals.some((m) => m.code === value);

  return (
    <>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ADD_NEW) {
            setAdding(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        {metals.length === 0 && !value ? <option value="">Loading…</option> : null}
        {missing ? <option value={value}>{value}</option> : null}
        {metals.map((m) => (
          <option key={m.code} value={m.code}>
            {m.name}
          </option>
        ))}
        {canAdd ? <option value={ADD_NEW}>+ Add a new metal…</option> : null}
      </Select>

      <AddMetalDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(metal) => {
          setAdding(false);
          onChange(metal.code);
        }}
      />
    </>
  );
}

/**
 * Adds a metal to the master.
 *
 * The purity is asked for in the same breath and is not optional: the server
 * creates the metal, its inventory and sales ledgers and this first purity in one
 * transaction, and without a purity nothing can be priced in the new metal.
 */
export function AddMetalDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (metal: MetalOption) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [purityCode, setPurityCode] = useState("");
  const [purityLabel, setPurityLabel] = useState("");
  const [fineness, setFineness] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setPurityCode("");
    setPurityLabel("");
    setFineness("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!name.trim()) return setError("Give the metal a name, such as Palladium.");
    if (!purityCode.trim()) return setError("Give the first purity a code, such as PD950.");
    const fine = Number(fineness);
    if (!(fine > 0 && fine <= 1)) return setError("Purity must be between 0 and 1 — 22K gold is 0.9160.");

    setBusy(true);
    setError(null);
    try {
      const res = await metalsApi.create({
        name: name.trim(),
        purity_code: purityCode.trim().toUpperCase(),
        purity_label: purityLabel.trim() || undefined,
        fineness: fine,
      });
      // the metal list, and every payload that carries purities with it
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["metals"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
        queryClient.invalidateQueries({ queryKey: ["stock"] }),
        queryClient.invalidateQueries({ queryKey: ["rates"] }),
      ]);
      toast.success(res.message);
      reset();
      onCreated(res.metal);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add the metal. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a metal"
      maxWidth={520}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Adding…" : "Add metal"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The new metal gets its own stock and sales accounts, so what you buy and sell in it stays separate
          in your books.
        </p>

        <div>
          <Label htmlFor="metal_name" required>
            Metal name
          </Label>
          <Input
            id="metal_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Palladium"
            maxLength={60}
          />
        </div>

        <div className="rounded-input border border-border p-4">
          <p className="text-sm font-semibold text-foreground">First purity</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every metal needs at least one purity before you can price it — the same way gold has 22K and 24K.
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="metal_purity_code" required>
                Purity code
              </Label>
              <Input
                id="metal_purity_code"
                value={purityCode}
                onChange={(e) => setPurityCode(e.target.value)}
                placeholder="e.g. PD950"
                maxLength={10}
              />
            </div>
            <div>
              <Label htmlFor="metal_fineness" required>
                Purity (0 – 1)
              </Label>
              <Input
                id="metal_fineness"
                inputMode="decimal"
                value={fineness}
                onChange={(e) => setFineness(e.target.value)}
                placeholder="0.9500"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="metal_purity_label">Purity name</Label>
              <Input
                id="metal_purity_label"
                value={purityLabel}
                onChange={(e) => setPurityLabel(e.target.value)}
                placeholder="e.g. Palladium 950 — leave blank to use the code"
                maxLength={40}
              />
            </div>
          </div>
        </div>

        <FieldError message={error ?? undefined} />
      </div>
    </Dialog>
  );
}
