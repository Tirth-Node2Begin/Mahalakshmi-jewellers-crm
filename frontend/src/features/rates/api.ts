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

export interface RatesResponse {
  date: string;
  purities: Purity[];
  /** true only when EVERY active purity has a rate for the date */
  rates_set: boolean;
  /** last 30 days, newest first */
  history: RateHistoryRow[];
}

/** Stable key for a purity across `purities` and `history` (history has no purity_id). */
export const purityKey = (metal: string, code: string) => `${metal}:${code}`;

export const ratesApi = {
  get: (date?: string) => api.get<RatesResponse>("rates.php", { date }),
  /** rates arrives server-side as { purity_id: rate_per_gram } */
  set: (date: string, rates: Record<number, number>) =>
    api.post<{ message: string }>("rates.php", { action: "set", date, rates }),
};
