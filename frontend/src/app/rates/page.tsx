"use client";

import {
  purityKey,
  ratesApi,
  type Metal,
  type Purity,
  type RateFeedQuote,
  type RateFeedStatus,
} from "@/features/rates/api";
import { metalLabel } from "@/features/stock/api";
import { useMetals } from "@/features/stock/metal-select";
import { usePermissions } from "@/lib/permissions";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input, Label } from "@/shared/ui/input";
import { Skeleton, SkeletonRows } from "@/shared/ui/skeleton";
import { cn } from "@/shared/utils/cn";
import { formatCurrency, formatDate, localDateString } from "@/shared/utils/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export default function RatesPage() {
  const { can } = usePermissions();
  const canSet = can("rates.set");
  const queryClient = useQueryClient();

  const [date, setDate] = useState(localDateString());
  const [values, setValues] = useState<Record<number, string>>({});
  // only hydrate the inputs once per loaded day — a background refetch must never
  // wipe out what the manager is halfway through typing
  const hydratedFor = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["rates", date],
    queryFn: () => ratesApi.get(date),
  });
  const { data: metalsData } = useMetals();

  /** Fetched-but-not-yet-saved rates, by purity id. */
  const fetched = useMemo(() => {
    const map = new Map<number, RateFeedQuote>();
    for (const q of data?.feed?.quotes ?? []) {
      if (q.status === "staged") map.set(q.purity_id, q);
    }
    return map;
  }, [data]);

  useEffect(() => {
    if (!data || hydratedFor.current === data.date) return;
    hydratedFor.current = data.date;
    // A fetched rate PRE-FILLS the box; it is not saved. Whatever is already
    // saved for the day wins, so a rate someone typed is never overwritten by
    // the feed. Nothing reaches billing until "Save Today's Rates" is pressed.
    setValues(
      Object.fromEntries(
        data.purities.map((p) => {
          const staged = data.feed?.quotes.find((q) => q.purity_id === p.id && q.status === "staged");
          return [p.id, p.rate_per_gram ?? staged?.rate_per_gram ?? ""];
        }),
      ),
    );
  }, [data]);

  /** Latest rate BEFORE this day, per purity — shown as the placeholder hint. */
  const lastKnown = useMemo(() => {
    const map = new Map<string, { rate: string; date: string }>();
    for (const row of data?.history ?? []) {
      if (row.rate_date >= (data?.date ?? date)) continue; // history is newest-first
      const key = purityKey(row.metal, row.code);
      if (!map.has(key)) map.set(key, { rate: row.rate_per_gram, date: row.rate_date });
    }
    return map;
  }, [data, date]);

  const fetchNow = useMutation({
    mutationFn: () => ratesApi.feedFetch(date),
    onSuccess: (r) => {
      if ((r.staged ?? 0) > 0) toast.success(r.message);
      else toast.info(r.message);
      hydratedFor.current = null; // let the new quotes re-fill the boxes
      void queryClient.invalidateQueries({ queryKey: ["rates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not fetch the rates."),
  });

  const save = useMutation({
    mutationFn: () => {
      const rates: Record<number, number> = {};
      for (const [id, raw] of Object.entries(values)) {
        const n = Number(raw);
        if (raw.trim() !== "" && Number.isFinite(n) && n > 0) rates[Number(id)] = n;
      }
      if (Object.keys(rates).length === 0) {
        return Promise.reject(new Error("Enter at least one rate before saving."));
      }
      return ratesApi.set(date, rates);
    },
    onSuccess: () => {
      toast.success("Today's rates saved.");
      hydratedFor.current = null; // re-read the saved values from the server
      void queryClient.invalidateQueries({ queryKey: ["rates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the rates. Please try again."),
  });

  // Grouped by metal, in the order of the metal master — so a metal the shop adds
  // shows up here to have its rate entered instead of being silently dropped.
  const groups = useMemo(() => {
    const byMetal = new Map<Metal, Purity[]>();
    for (const p of data?.purities ?? []) {
      const list = byMetal.get(p.metal) ?? [];
      list.push(p);
      byMetal.set(p.metal, list);
    }
    const ordered = (metalsData?.metals ?? []).map((m) => m.code).filter((m) => byMetal.has(m));
    const rest = [...byMetal.keys()].filter((m) => !ordered.includes(m));
    return [...ordered, ...rest].map((m) => ({ metal: m, purities: byMetal.get(m)! }));
  }, [data, metalsData]);

  const isToday = date === localDateString();
  const anyFilled = Object.values(values).some((v) => v.trim() !== "" && Number(v) > 0);

  // name what is actually missing — "rates are not set" next to cards saying
  // "set" (because only platinum was blank) reads like a contradiction
  const missing = data?.purities.filter((p) => !p.rate_per_gram) ?? [];
  const missingNames = missing.map((p) => `${metalLabel(p.metal, metalsData?.metals)} ${p.code}`).join(", ");
  const allMissing = missing.length > 0 && missing.length === (data?.purities.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Heading lives in the shell header (components/shell/page-header.tsx). */}
      <div className="flex flex-wrap items-center gap-3">
        {/* The cron fills the boxes each morning; this is for the day it has not
            run yet, or when IBJA publishes its afternoon rate. It only fills the
            boxes — saving is still the button at the bottom. */}
        {data?.feed?.enabled && canSet ? (
          <Button variant="secondary" size="sm" loading={fetchNow.isPending} onClick={() => fetchNow.mutate()}>
            <Download className="h-4 w-4" aria-hidden /> Fetch now
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="rate-date" className="mb-0">
            For
          </Label>
          <Input
            id="rate-date"
            type="date"
            value={date}
            max={localDateString()}
            onChange={(e) => {
              hydratedFor.current = null;
              setDate(e.target.value || localDateString());
            }}
            className="h-11 w-44"
          />
        </div>
      </div>

      {!isLoading && data && !data.rates_set ? (
        <div className="flex items-start gap-3 rounded-card border border-warning-strong/30 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" aria-hidden />
          <p className="text-sm font-medium text-warning-strong">
            {allMissing
              ? isToday
                ? "Today's rates are not set yet — billing needs them."
                : `Rates for ${formatDate(date)} are not set — bills made on that day had no rate.`
              : isToday
                ? `Still missing today: ${missingNames}. The other rates are set.`
                : `Missing for ${formatDate(date)}: ${missingNames}. The other rates are set.`}
          </p>
        </div>
      ) : null}

      {/* Fetched rates are sitting in the boxes below, unsaved. This says so and
          points at the one action that commits them. Null when the user lacks
          rates.feed — the server does not send the block at all. */}
      {!isLoading && fetched.size > 0 ? (
        <RateFeedNotice
          count={fetched.size}
          quotes={[...fetched.values()]}
          lastRun={data?.feed?.last_run ?? null}
          sourceUrl={data?.feed?.source_url ?? ""}
          canSave={canSet}
        />
      ) : null}

      {!isLoading && data?.rates_set ? (
        <div className="flex items-center gap-3 rounded-card border border-success-strong/25 bg-success-soft p-4">
          <Check className="h-5 w-5 shrink-0 text-success-strong" aria-hidden />
          <p className="text-sm font-medium text-success-strong">All rates are set for {formatDate(date)}.</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-card" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={TrendingUp} title="No metals set up yet" hint="Gold and silver purities are added during setup." />
        </Card>
      ) : (
        <>
          {groups.map(({ metal, purities }) => (
            <section key={metal} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                {metalLabel(metal, metalsData?.metals)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {purities.map((p) => {
                  const previous = lastKnown.get(purityKey(p.metal, p.code));
                  return (
                    <Card key={p.id} className={cn("flex flex-col gap-3", p.rate_per_gram ? "ring-1 ring-success-strong/20" : null)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-2xl font-bold leading-7 text-foreground">{p.code}</p>
                          <p className="text-xs text-muted-foreground">{p.label}</p>
                        </div>
                        <Badge tone={p.rate_per_gram ? "green" : "gray"}>{p.rate_per_gram ? "set" : "not set"}</Badge>
                      </div>

                      {canSet ? (
                        <>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                              ₹
                            </span>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              aria-label={`Rate per gram for ${p.label}`}
                              value={values[p.id] ?? ""}
                              placeholder={previous ? Number(previous.rate).toFixed(2) : "0.00"}
                              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                              className="h-16 pl-10 pr-4 text-2xl font-semibold tabular-nums"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            per gram
                            {previous ? ` · last set on ${formatDate(previous.date)}` : " · no earlier rate on record"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-3xl font-bold tabular-nums text-foreground">
                            {p.rate_per_gram ? formatCurrency(p.rate_per_gram, true) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            per gram
                            {!p.rate_per_gram && previous
                              ? ` · last set on ${formatDate(previous.date)} at ${formatCurrency(previous.rate, true)}`
                              : ""}
                          </p>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}

          {canSet ? (
            <div className="sticky bottom-4 flex justify-end">
              <Button
                size="lg"
                loading={save.isPending}
                disabled={!anyFilled}
                onClick={() => save.mutate()}
                className="shadow-hero"
              >
                <Check className="h-5 w-5" aria-hidden /> Save {isToday ? "Today's" : formatDate(date)} Rates
              </Button>
            </div>
          ) : null}
        </>
      )}

      <RateHistory purities={data?.purities ?? []} history={data?.history ?? []} isLoading={isLoading} />
    </div>
  );
}

/**
 * "These came from IBJA — check them, then save."
 *
 * The feed used to apply rates itself, behind its own button. It no longer
 * does: the numbers are simply typed into the boxes for you, and the ordinary
 * Save button is the only thing that writes them. One way to commit a rate, not
 * two — and the person saving has seen every figure they are committing.
 */
function RateFeedNotice({
  count,
  quotes,
  lastRun,
  sourceUrl,
  canSave,
}: {
  count: number;
  quotes: RateFeedQuote[];
  lastRun: RateFeedStatus["last_run"];
  sourceUrl: string;
  canSave: boolean;
}) {
  const when = lastRun ? new Date(lastRun.created_at.replace(" ", "T")) : null;
  const time =
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      : null;

  // Anything the sanity checks flagged is stated here rather than buried, since
  // this is the last screen before the rate goes onto a bill.
  const warnings = quotes.flatMap((q) => q.flags.map((f) => ({ ...f, name: `${q.metal} ${q.code}` })));
  const blocking = warnings.filter((w) => w.severity === "block");

  return (
    <div className="flex items-start gap-3 rounded-card border border-primary/25 bg-primary-soft p-4">
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary-strong" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary-strong">
          {count} rate{count === 1 ? "" : "s"} filled in from IBJA{time ? ` at ${time}` : ""} — not saved yet.
        </p>
        <p className="mt-0.5 text-sm text-primary-strong/80">
          {canSave
            ? "Check the amounts below, change anything that looks wrong, then press Save Today's Rates."
            : "Check the amounts below. Someone who can set rates needs to save them."}
        </p>

        {warnings.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {warnings.map((w, i) => (
              <li
                key={`${w.code}-${i}`}
                className={cn(
                  "flex items-start gap-2 text-xs",
                  w.severity === "block" ? "font-medium text-warning-strong" : "text-primary-strong/75",
                )}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {blocking.length > 0 ? (
          <p className="mt-2 text-xs font-semibold text-warning-strong">
            Please correct {blocking.length === 1 ? "that figure" : "those figures"} by hand before saving — a saved rate
            is stamped onto every bill of the day and cannot be changed afterwards.
          </p>
        ) : null}

        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block text-xs text-primary-strong/70 underline hover:text-primary-strong"
          >
            see the source
          </a>
        ) : null}
      </div>
    </div>
  );
}

function RateHistory({
  purities,
  history,
  isLoading,
}: {
  purities: Purity[];
  history: { rate_date: string; metal: Metal; code: string; rate_per_gram: string }[];
  isLoading: boolean;
}) {
  const { data: metalsData } = useMetals();

  // pivot: one row per day, one column per purity
  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, string>>();
    for (const h of history) {
      const cells = byDate.get(h.rate_date) ?? {};
      cells[purityKey(h.metal, h.code)] = h.rate_per_gram;
      byDate.set(h.rate_date, cells);
    }
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [history]);

  return (
    <Card className="p-0">
      <div className="border-b border-border p-4">
        <h2 className="text-base font-semibold text-foreground">Last 30 days</h2>
        <p className="text-xs text-muted-foreground">Rate per gram on each day rates were entered.</p>
      </div>
      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No rate history yet" hint="Rates you save will appear here day by day." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-[0.4px] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Day</th>
                {purities.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-right font-medium">
                    {metalLabel(p.metal, metalsData?.metals)} {p.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([day, cells]) => (
                <tr key={day} className="border-b border-border/60 last:border-0 hover:bg-background">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{formatDate(day)}</td>
                  {purities.map((p) => {
                    const value = cells[purityKey(p.metal, p.code)];
                    return (
                      <td key={p.id} className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {value ? formatCurrency(value, true) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
