import { api } from "@/shared/api/http-client";

/**
 * Jewellery stock (api/stock.php + api/books.php?report=stock_movement).
 *
 * Stock here is weight-first: every item carries a metal, a purity and a
 * gross/net weight, and is either a `tagged` unique piece or a `bulk` pool
 * measured in grams.
 *
 * NOTE: `avg_cost` / cost figures are only sent by the server when the user is
 * allowed to see them (reports.stock or accounting.read) — always treat them as
 * optional and use `canSeeCost()` before showing a money column.
 */

export type Metal = "gold" | "silver";
export type Tracking = "tagged" | "bulk";
export type ItemStatus = "in_stock" | "sold" | "removed";
export type MakingType = "per_gram" | "fixed" | "percent";

export interface Purity {
  id: number;
  metal: Metal;
  code: string;
  label: string;
  fineness: string;
  rate_per_gram: string | null;
  rate_date: string | null;
}

export interface StockCategory {
  id: number;
  name: string;
  item_type: string;
}

export interface StockItem {
  id: number;
  item_code: string;
  name: string;
  metal: Metal | null;
  tracking: Tracking;
  status: ItemStatus;
  huid: string | null;
  barcode: string | null;
  gross_weight: string;
  net_weight: string;
  stone_weight: string;
  making_type: MakingType;
  making_value: string;
  hsn_code: string | null;
  current_stock: string;
  is_active: 0 | 1;
  purity_code: string | null;
  category_name: string | null;
  /** only present when the user may see cost figures */
  avg_cost?: string;
}

export interface StockItemListResponse {
  items: StockItem[];
  purities: Purity[];
  categories: StockCategory[];
}

export interface StockSummaryRow {
  metal: Metal | null;
  purity: string | null;
  tracking: Tracking;
  items: string;
  qty: string;
  weight: string;
  value: string;
}

export interface StockSummaryResponse {
  summary: StockSummaryRow[];
  purities: Purity[];
}

export interface StockAvailability {
  qty: number;
  weight: number;
  value: number;
}

/** A movement on one item's own ledger (stock.php?view=detail). */
export interface ItemMovement {
  id: number;
  created_at: string;
  type: "in" | "out";
  reason: string;
  qty: string;
  weight: string;
  rate_per_gram: string | null;
  adjustment_reason: string | null;
  invoice_no: string | null;
  purchase_no: string | null;
  user_name: string | null;
}

export interface StockItemDetail extends StockItem {
  purity_id: number | null;
  purity_label: string | null;
  category_id: number | null;
  availability: StockAvailability;
  movements: ItemMovement[];
}

/** A row of the movement register (books.php?report=stock_movement). */
export interface RegisterMovement extends ItemMovement {
  value: string;
  item_code: string;
  item_name: string;
  metal: Metal | null;
  purity_code: string | null;
}

export interface SaveItemPayload {
  id?: number;
  name: string;
  metal: Metal;
  purity_id: number;
  tracking: Tracking;
  category_id?: number | null;
  gross_weight?: number;
  net_weight?: number;
  making_type?: MakingType;
  making_value?: number;
  huid?: string | null;
  hsn_code?: string | null;
  barcode?: string | null;
}

export interface AdjustPayload {
  item_id: number;
  direction: "in" | "out";
  qty?: number;
  weight: number;
  reason: string;
}

export const stockApi = {
  items: (params: Record<string, string | number | undefined>) =>
    api.get<StockItemListResponse>("stock.php", params),
  summary: () => api.get<StockSummaryResponse>("stock.php", { view: "summary" }),
  detail: (id: number) => api.get<{ item: StockItemDetail }>("stock.php", { view: "detail", id }),
  saveItem: (payload: SaveItemPayload) =>
    api.post<{ id: number; message: string }>("stock.php", { action: "save_item", ...payload }),
  adjust: (payload: AdjustPayload) => api.post<{ message: string }>("stock.php", { action: "adjust", ...payload }),
  opening: (payload: { item_id: number; qty?: number; weight: number; value: number }) =>
    api.post<{ message: string }>("stock.php", { action: "opening", ...payload }),

  /** Stock movement register — every in/out across all items, for a date range. */
  register: (params: { from: string; to: string; item_id?: number }) =>
    api.get<{ movements: RegisterMovement[] }>("books.php", { report: "stock_movement", ...params }),
};

export const METAL_LABEL: Record<Metal, string> = { gold: "Gold", silver: "Silver" };

export const TRACKING_LABEL: Record<Tracking, string> = {
  tagged: "Tagged piece",
  bulk: "Bulk (grams)",
};

export const MAKING_TYPE_LABEL: Record<MakingType, string> = {
  per_gram: "₹ per gram",
  fixed: "Fixed ₹",
  percent: "% of metal value",
};

export const STATUS_LABEL: Record<ItemStatus, string> = {
  in_stock: "In stock",
  sold: "Sold",
  removed: "Removed",
};

/** Why a movement happened, in shop language. */
export const MOVEMENT_REASON_LABEL: Record<string, string> = {
  purchase: "Bought from vendor",
  sale: "Sold to customer",
  adjustment: "Manual adjustment",
  opening: "Opening stock",
  old_metal_in: "Old metal taken in",
  return: "Returned / reversed",
};

export function movementReasonLabel(reason: string): string {
  return MOVEMENT_REASON_LABEL[reason] ?? reason.replace(/_/g, " ");
}

export function itemStatusTone(status: ItemStatus): "green" | "gray" | "coral" {
  if (status === "in_stock") return "green";
  if (status === "sold") return "gray";
  return "coral";
}

/** Making charge shown the way a jeweller writes it. */
export function makingLabel(type: MakingType, value: string | number): string {
  const n = Number(value ?? 0);
  if (!n) return "—";
  if (type === "percent") return `${n}%`;
  if (type === "fixed") return `₹${n.toLocaleString("en-IN")} fixed`;
  return `₹${n.toLocaleString("en-IN")}/g`;
}
