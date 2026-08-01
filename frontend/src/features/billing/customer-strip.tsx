"use client";

import { customersApi } from "@/features/customers/api";
import { CustomerFormModal } from "@/features/customers/customer-form-modal";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input, Label } from "@/shared/ui/input";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { cn } from "@/shared/utils/cn";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BillCustomer } from "./types";

/**
 * The customer search box: type-ahead PLUS a browse list. Tapping into the
 * field opens the dropdown with the first customers on file straight away, so a
 * regular can be picked without remembering how their name is spelled.
 */
function CustomerSearchBox({
  onPick,
  placeholder,
  inputClassName,
  iconClassName = "left-3 h-4 w-4",
  className,
  openOnMount = false,
}: {
  onPick: (customer: BillCustomer) => void;
  placeholder: string;
  inputClassName: string;
  iconClassName?: string;
  className?: string;
  /** Reveal the list and take focus straight away — the box IS the whole step. */
  openOnMount?: boolean;
}) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(openOnMount);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useDebouncedValue(term, 300);

  useEffect(() => {
    if (openOnMount) inputRef.current?.focus();
  }, [openOnMount]);

  const { data } = useQuery({
    queryKey: ["customers", "billing-search", search],
    queryFn: () => customersApi.list({ search }),
    // open = browse mode: an empty search lists the first customers on file
    enabled: open,
    staleTime: 30_000,
  });
  const matches = (data?.customers ?? []).slice(0, 8);

  // tapping anywhere outside puts the dropdown away
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search
        className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground", iconClassName)}
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={term}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setTerm("");
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label="Find a customer"
        aria-expanded={open}
        autoComplete="off"
        className={inputClassName}
      />
      {open ? (
        <div className="absolute z-30 mt-1.5 w-full rounded-card border border-border bg-card shadow-modal">
          {matches.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto p-1.5" data-lenis-prevent>
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick({ id: c.id, name: c.name, mobile: c.mobile ?? null });
                      setTerm("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-input px-3 py-2.5 text-left hover:bg-background"
                  >
                    <span className="min-w-0 truncate text-sm text-foreground">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.mobile ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              {term.trim() ? `No customer matches “${term.trim()}”.` : "No customers on file yet."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Who is buying.
 *
 * With `requireChoice` (the New Bill screen) the counter answers this BEFORE the
 * item box opens, and there are exactly TWO ways to answer: pick a customer
 * already on file, or add one. Answering is the whole step — the page advances to
 * the items on its own, no Next press.
 *
 * Walk-in billing was dropped from this screen on 2026-07-31 at the client's
 * request: every bill now carries a customer. The `walkin*` props stay for the
 * inline strip (estimates) and for a resumed draft that was saved as a walk-in
 * before the change — `chosen` with no customer is that case, and nothing in the
 * new-bill flow can put you there.
 */
export function CustomerStrip({
  customer,
  onCustomerChange,
  walkinName,
  walkinPhone,
  onWalkinChange,
  requireChoice = false,
  chosen = false,
}: {
  customer: BillCustomer | null;
  onCustomerChange: (customer: BillCustomer | null) => void;
  walkinName: string;
  walkinPhone: string;
  onWalkinChange: (patch: { name?: string; phone?: string }) => void;
  requireChoice?: boolean;
  chosen?: boolean;
}) {
  const { can } = usePermissions();
  const [addOpen, setAddOpen] = useState(false);
  /** Step mode: the search box replaces the two cards once "Choose" is tapped. */
  const [picking, setPicking] = useState(false);

  // the salesperson list the full customer form needs — only once it is opened
  const { data: customerMeta } = useQuery({
    queryKey: ["customers", "form-meta"],
    queryFn: () => customersApi.list({}),
    enabled: addOpen,
    staleTime: 5 * 60_000,
  });

  const addCustomerModal = (
    <CustomerFormModal
      open={addOpen}
      onClose={() => setAddOpen(false)}
      onCreated={(created) => onCustomerChange(created)}
      users={customerMeta?.users ?? []}
      title="Add a customer"
      // Only the bill insists on a phone — an estimate may be quoted to someone
      // who has not left a number yet.
      requireMobile={requireChoice}
    />
  );

  if (customer) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-background/60 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
          <UserRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.mobile || "No phone on file"}</p>
        </div>
        <Button variant="ghost" size="sm" type="button" className="ml-auto" onClick={() => onCustomerChange(null)}>
          <X className="h-4 w-4" aria-hidden /> Change
        </Button>
      </div>
    );
  }

  /* --------- step mode, nothing picked yet: exactly two ways forward -------- */
  if (requireChoice && !chosen) {
    // "Choose" swaps the cards for the search rather than sitting under them —
    // three things on screen was one too many, and the card no longer runs on
    // into empty space below.
    if (picking) {
      return (
        <>
          <div className="space-y-3">
            <CustomerSearchBox
              onPick={onCustomerChange}
              placeholder="Type a name or phone number, or tap to see everyone…"
              inputClassName="h-12 pl-12"
              iconClassName="left-4 h-5 w-5"
              openOnMount
            />
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary-strong"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </button>
          </div>
          {addCustomerModal}
        </>
      );
    }

    return (
      <>
        <div className="grid gap-3 md:grid-cols-2">
          {can("customers.read") ? (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex items-center gap-3 rounded-card border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                <Search className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Choose a customer</span>
                <span className="block text-xs text-muted-foreground">Search by name or phone, or browse the list</span>
              </span>
            </button>
          ) : null}

          {can("customers.create") ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-3 rounded-card border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                <UserPlus className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Add a new customer</span>
                <span className="block text-xs text-muted-foreground">Name and phone is enough — the rest can wait</span>
              </span>
            </button>
          ) : null}

          {/* neither permission: say so rather than showing a blank step */}
          {!can("customers.read") && !can("customers.create") ? (
            <p className="rounded-card border border-border bg-background/60 p-4 text-sm text-muted-foreground md:col-span-2">
              You cannot look up or add customers. Ask the owner for customer access before billing.
            </p>
          ) : null}
        </div>

        {addCustomerModal}
      </>
    );
  }

  /* -- step mode, walk-in chosen: optional details, or switch to a regular -- */
  if (requireChoice) {
    return (
      <>
        <div className="space-y-5">
          <div className="rounded-card border border-border bg-background/60 p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="amber">Walk-in</Badge>
              <p className="text-sm text-muted-foreground">Details are optional — fill them only if the bill should carry a name.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="walkin_name">Customer name</Label>
                <Input
                  id="walkin_name"
                  value={walkinName}
                  onChange={(e) => onWalkinChange({ name: e.target.value })}
                  placeholder="Name for the bill (optional)"
                  className="h-11"
                />
              </div>
              <div>
                <Label htmlFor="walkin_phone">Phone</Label>
                <Input
                  id="walkin_phone"
                  value={walkinPhone}
                  onChange={(e) => onWalkinChange({ phone: e.target.value })}
                  placeholder="10-digit number (optional)"
                  aria-label="Walk-in phone"
                  inputMode="tel"
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {can("customers.read") || can("customers.create") ? (
            <>
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">
                  Or a regular customer
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {can("customers.read") ? (
                  <CustomerSearchBox
                    onPick={onCustomerChange}
                    placeholder="Find a customer by phone or name…"
                    inputClassName="h-11 pl-10"
                    iconClassName="left-3.5 h-4 w-4"
                    className="min-w-[240px] flex-1"
                  />
                ) : null}
                {can("customers.create") ? (
                  <Button variant="secondary" type="button" className="h-11" onClick={() => setAddOpen(true)}>
                    <UserPlus className="h-4 w-4" aria-hidden /> New customer
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {addCustomerModal}
      </>
    );
  }

  /* ------------- inline strip (estimates): everything in one row ------------ */
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="amber">Walk-in</Badge>

        {can("customers.read") ? (
          <CustomerSearchBox
            onPick={onCustomerChange}
            placeholder="Find a customer by phone or name…"
            inputClassName="h-10 pl-9"
            className="w-full max-w-xs"
          />
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

      {addCustomerModal}
    </>
  );
}
