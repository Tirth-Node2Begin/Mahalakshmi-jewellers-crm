"use client";

import { accountingApi, NATURE_LABEL, type CoaGroup, type CoaLedger } from "@/features/accounting/api";
import { JournalDialog } from "@/features/accounting/journal-dialog";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Collapsible } from "@/shared/ui/collapsible";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { formatCurrency, localDateString } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ChevronRight, PencilLine } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

/** Indian fiscal year: 1 Apr → 31 Mar. */
function fiscalYear(d = new Date()) {
  const startYear = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export default function AccountingPage() {
  const { can } = usePermissions();
  const fy = fiscalYear();

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebouncedValue(rawSearch, 300);
  const [from, setFrom] = useState(fy.from);
  const [to, setTo] = useState(localDateString());
  const [journalOpen, setJournalOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["accounting", "coa"],
    queryFn: () => accountingApi.coa(),
  });

  const searching = search.trim().length > 0;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (l: CoaLedger) => !q || l.name.toLowerCase().includes(q) || (l.code ?? "").toLowerCase().includes(q);
  }, [search]);

  /** Drop groups (and sub-groups) with nothing left after the search. */
  const tree = useMemo(() => {
    const groups = data?.coa ?? [];
    if (!searching) return groups;
    return groups
      .map((g) => ({
        ...g,
        ledgers: g.ledgers.filter(matches),
        children: (g.children ?? []).map((c) => ({ ...c, ledgers: c.ledgers.filter(matches) })).filter((c) => c.ledgers.length > 0),
      }))
      .filter((g) => g.ledgers.length > 0 || (g.children ?? []).length > 0);
  }, [data, searching, matches]);

  return (
    <div className="space-y-6">
      {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
      {can("accounting.journal") ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button onClick={() => setJournalOpen(true)}>
            <PencilLine className="h-4 w-4" aria-hidden /> Journal Entry
          </Button>
        </div>
      ) : null}

      <Card className="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="w-full max-w-xs">
            <Label htmlFor="coa-search">Find a ledger</Label>
            <Input
              id="coa-search"
              placeholder="Search by name or code…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="coa-from">Statement from</Label>
            <Input id="coa-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-40" />
          </div>
          <div>
            <Label htmlFor="coa-to">To</Label>
            <Input id="coa-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-40" />
          </div>
        </div>

        {isLoading ? (
          <SkeletonRows rows={8} />
        ) : isError ? (
          <EmptyState
            icon={BookOpen}
            title="We could not load the accounts"
            hint="Check your internet connection and try again in a moment."
          />
        ) : tree.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={searching ? "No ledger matches that" : "No accounts set up yet"}
            hint={searching ? "Try a shorter word, or clear the search." : "The chart of accounts is created during setup."}
          />
        ) : (
          <div className="space-y-3 p-4">
            {tree.map((group) => (
              <GroupNode key={`${group.id}-${searching}`} group={group} defaultOpen={searching} range={{ from, to }} />
            ))}
          </div>
        )}
      </Card>

      {can("accounting.journal") ? (
        <JournalDialog open={journalOpen} onClose={() => setJournalOpen(false)} ledgers={data?.ledgers ?? []} />
      ) : null}
    </div>
  );
}

function GroupNode({
  group,
  defaultOpen,
  range,
}: {
  group: CoaGroup;
  defaultOpen: boolean;
  /** Carried into the statement page so it opens on the dates shown here. */
  range: { from: string; to: string };
}) {
  const children = group.children ?? [];
  const count = group.ledgers.length + children.reduce((s, c) => s + c.ledgers.length, 0);

  // Top-level groups are already named after their nature ("Assets", "Income"…),
  // so only show the nature when it adds something the name does not.
  const nature = NATURE_LABEL[group.nature];
  const countLabel = `${count} ${count === 1 ? "ledger" : "ledgers"}`;
  const sameAsName = nature.toLowerCase() === group.name.trim().toLowerCase();

  return (
    <Collapsible
      label={group.name}
      hint={sameAsName ? countLabel : `${nature} · ${countLabel}`}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-2">
        {group.ledgers.map((l) => (
          <LedgerRow key={l.id} ledger={l} range={range} />
        ))}
        {children.map((child) => (
          <div key={child.id} className="rounded-input border border-border bg-card p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.4px] text-muted-foreground">{child.name}</p>
            <div className="space-y-2">
              {child.ledgers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ledgers here yet.</p>
              ) : (
                child.ledgers.map((l) => <LedgerRow key={l.id} ledger={l} range={range} />)
              )}
            </div>
          </div>
        ))}
        {count === 0 ? <p className="text-sm text-muted-foreground">No ledgers here yet.</p> : null}
      </div>
    </Collapsible>
  );
}

function LedgerRow({ ledger, range }: { ledger: CoaLedger; range: { from: string; to: string } }) {
  const opening = Number(ledger.opening_balance);
  return (
    <Link
      href={`/accounting/ledger?id=${ledger.id}&from=${range.from}&to=${range.to}`}
      className="flex w-full items-center gap-3 rounded-input px-3 py-2.5 text-left transition-colors hover:bg-background"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{ledger.name}</span>
        {ledger.code ? <span className="block text-xs text-muted-foreground">{ledger.code}</span> : null}
      </span>
      {ledger.is_system === 1 ? <Badge tone="gray">system</Badge> : null}
      {opening > 0 ? (
        <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
          Opening {formatCurrency(opening, true)} {ledger.opening_type === "cr" ? "Cr" : "Dr"}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
