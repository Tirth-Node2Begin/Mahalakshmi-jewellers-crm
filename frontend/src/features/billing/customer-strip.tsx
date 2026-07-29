"use client";

import { customersApi } from "@/features/customers/api";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { Input, Label } from "@/shared/ui/input";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { BillCustomer } from "./types";

/**
 * Who is buying. Walk-in is the default and needs no typing at all; a phone
 * number finds a regular; "+ New" adds one with just a name and a number.
 */
export function CustomerStrip({
  customer,
  onCustomerChange,
  walkinName,
  walkinPhone,
  onWalkinChange,
}: {
  customer: BillCustomer | null;
  onCustomerChange: (customer: BillCustomer | null) => void;
  walkinName: string;
  walkinPhone: string;
  onWalkinChange: (patch: { name?: string; phone?: string }) => void;
}) {
  const { can } = usePermissions();
  const [term, setTerm] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const search = useDebouncedValue(term, 300);

  const { data } = useQuery({
    queryKey: ["customers", "billing-search", search],
    queryFn: () => customersApi.list({ search }),
    enabled: can("customers.read") && search.trim().length >= 2,
    staleTime: 30_000,
  });
  const matches = (data?.customers ?? []).slice(0, 6);

  if (customer) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.mobile || "No phone on file"}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => {
            onCustomerChange(null);
            setTerm("");
          }}
        >
          <X className="h-4 w-4" aria-hidden /> Change
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="amber">Walk-in</Badge>

        {can("customers.read") ? (
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Find a customer by phone or name…"
              aria-label="Find a customer"
              autoComplete="off"
              className="h-10 pl-9"
            />
            {matches.length > 0 && search.trim().length >= 2 ? (
              <ul className="absolute z-30 mt-1.5 w-full rounded-card border border-border bg-card p-1.5 shadow-modal">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onCustomerChange({ id: c.id, name: c.name, mobile: c.mobile ?? null });
                        setTerm("");
                      }}
                      className={cn("flex w-full items-center justify-between gap-3 rounded-input px-3 py-2 text-left hover:bg-background")}
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">{c.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{c.mobile ?? "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {can("customers.create") ? (
          <Button variant="secondary" size="sm" type="button" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" aria-hidden /> New customer
          </Button>
        ) : null}

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <Input
            value={walkinName}
            onChange={(e) => onWalkinChange({ name: e.target.value })}
            placeholder="Walk-in name (optional)"
            aria-label="Walk-in name"
            className="h-10 w-full max-w-[190px]"
          />
          <Input
            value={walkinPhone}
            onChange={(e) => onWalkinChange({ phone: e.target.value })}
            placeholder="Phone (optional)"
            aria-label="Walk-in phone"
            inputMode="tel"
            className="h-10 w-full max-w-[150px]"
          />
        </div>
      </div>

      <QuickAddCustomer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false);
          onCustomerChange(created);
        }}
      />
    </>
  );
}

/** Name + phone only — anything more can be filled in later from Customers. */
function QuickAddCustomer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: BillCustomer) => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Enter the customer's name.");
      return;
    }
    setSaving(true);
    try {
      const res = await customersApi.create({ name: name.trim(), mobile: mobile.trim() || null });
      toast.success("Customer added.");
      onCreated({ id: res.id, name: name.trim(), mobile: mobile.trim() || null });
      setName("");
      setMobile("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the customer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New customer"
      maxWidth={420}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Add customer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="qa_name" required>
            Name
          </Label>
          <Input id="qa_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <Label htmlFor="qa_mobile">Phone</Label>
          <Input
            id="qa_mobile"
            value={mobile}
            inputMode="tel"
            onChange={(e) => setMobile(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            placeholder="10-digit number"
          />
        </div>
        <p className="text-xs text-muted-foreground">The rest of the details can be filled in later from Customers.</p>
      </div>
    </Dialog>
  );
}
