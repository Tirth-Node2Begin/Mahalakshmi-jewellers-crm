import { api } from "@/shared/api/http-client";

/** Metal rates per gram, per purity, per day (api/rates.php + src/Jewellery/RateService.php). */

/** A metal code from the master — see `metalLabel()` in features/stock/api. */
export type Metal = string;

export interface Purity {
  id: number;
  metal: Metal;
  code: string;
  label: string;
  fineness: string;
  /** null when today's rate has not been entered yet */
  rate_per_gram: string | null;
  rate_date: string | null;
}

export interface RateHistoryRow {
  rate_date: string;
  metal: Metal;
  code: string;
  rate_per_gram: string;
}

/** A sanity finding attached to a fetched rate. `block` keeps it out of Apply-all. */
export interface RateFeedFlag {
  code: "move" | "ordering" | "ratio" | "envelope" | "stale_token" | "cbic" | string;
  message: string;
  severity: "warn" | "block";
}

/** One auto-fetched rate awaiting a decision (or already decided). */
export interface RateFeedQuote {
  id: number;
  purity_id: number;
  source: string;
  rate_per_gram: string;
  /** the figure exactly as the source published it, e.g. 142938 */
  raw_label: string;
  raw_value: string;
  raw_unit: "per_10g" | "per_kg" | "per_g";
  session: string;
  /** set when this purity is not published and was worked out pro-rata */
  derived_from: string | null;
  status: "staged" | "applied" | "rejected" | "superseded";
  flags: RateFeedFlag[];
  is_blocked: boolean;
  fetched_at: string;
  metal: Metal;
  code: string;
  label: string;
  fineness: string;
  /** the rate currently saved for this day, if any */
  current_rate: string | null;
  /** fetched vs current, as a percentage; null when nothing is saved yet */
  change_pct: number | null;
}

export interface RateFeedStatus {
  enabled: boolean;
  date: string;
  /** how many quotes are still waiting for a decision */
  pending: number;
  quotes: RateFeedQuote[];
  last_run: {
    source: string;
    status: "ok" | "empty" | "failed";
    message: string | null;
    quote_count: number;
    created_at: string;
    trigger_type: "cron" | "manual";
  } | null;
  cbic: {
    available: boolean;
    reason: string | null;
    notification: string | null;
    effective_from: string | null;
  };
  source_url: string;
}

export interface RatesResponse {
  date: string;
  purities: Purity[];
  /** true only when EVERY active purity has a rate for the date */
  rates_set: boolean;
  /** last 30 days, newest first */
  history: RateHistoryRow[];
  /** null when the user lacks rates.feed */
  feed: RateFeedStatus | null;
}

export interface RateFeedActionResponse {
  message: string;
  feed: RateFeedStatus;
  staged?: number;
  applied?: number;
  dismissed?: number;
  skipped?: number[];
}

/** Stable key for a purity across `purities` and `history` (history has no purity_id). */
export const purityKey = (metal: string, code: string) => `${metal}:${code}`;

export const ratesApi = {
  get: (date?: string) => api.get<RatesResponse>("rates.php", { date }),
  /** rates arrives server-side as { purity_id: rate_per_gram } */
  set: (date: string, rates: Record<number, number>) =>
    api.post<{ message: string }>("rates.php", { action: "set", date, rates }),

  /** Pull the published benchmark rates now instead of waiting for the morning cron. */
  feedFetch: (date: string) => api.post<RateFeedActionResponse>("rates.php", { action: "feed_fetch", date }),
  /** Omit `purityIds` to apply everything that is not flagged as needing a check. */
  feedApply: (date: string, purityIds?: number[]) =>
    api.post<RateFeedActionResponse>("rates.php", {
      action: "feed_apply",
      date,
      ...(purityIds && purityIds.length > 0 ? { purity_ids: purityIds } : {}),
    }),
  feedDismiss: (date: string) => api.post<RateFeedActionResponse>("rates.php", { action: "feed_dismiss", date }),
};

/** "per 10 g" — how the source quoted the number, for the review card. */
export const rawUnitLabel = (unit: RateFeedQuote["raw_unit"]) =>
  unit === "per_10g" ? "per 10 g" : unit === "per_kg" ? "per kg" : "per g";
