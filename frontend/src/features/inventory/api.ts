import { api } from "@/shared/api/http-client";

export type ItemType = "raw_material" | "stock";

export type JwStatus = "in_stock" | "reserved" | "sold" | "under_repair" | "melting";

export interface InventoryItem {
  id: number;
  item_code: string;
  name: string;
  item_type: ItemType;
  category_id: number | null;
  category_name: string | null;
  unit_id: number;
  unit: string;
  current_stock: string;
  avg_cost: string;
  selling_price: string | null;
  show_on_website: 0 | 1;
  reorder_level: string;
  description: string | null;
  is_active: 0 | 1;
  stock_value: string;
  stock_state: "ok" | "low" | "out";
  // jewellery fields
  barcode: string | null;
  metal_type: string | null;
  gross_wt: string;
  net_wt: string;
  stone_wt: string;
  diamond_ct: string;
  diamond_pcs: number;
  purity: string | null;
  making_charge: string;
  wastage_pct: string;
  hsn_code: string | null;
  location: string | null;
  purchase_price: string;
  vendor_id: number | null;
  vendor_name: string | null;
  jw_status: JwStatus;
}

export interface InventoryCategory {
  id: number;
  name: string;
  item_type: ItemType;
  is_active: 0 | 1;
  item_count: number;
}

export interface Unit {
  id: number;
  name: string;
  short_name: string;
}

export interface InventoryStats {
  raw_count: number;
  stock_count: number;
  raw_value: number;
  stock_value: number;
  low_stock_count: number;
  out_of_stock: number;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  categories: InventoryCategory[];
  units: Unit[];
  stats: InventoryStats;
}

export interface LedgerTx {
  id: number;
  type: "in" | "out";
  reason: string;
  qty: string;
  unit_cost: string;
  value: string;
  purchase_no: string | null;
  invoice_no: string | null;
  work_code: string | null;
  production_batch: string | null;
  notes: string | null;
  by_name: string | null;
  created_at: string;
}

export interface ItemDetailResponse {
  item: InventoryItem & { unit_name: string };
  transactions: LedgerTx[];
  monthly_movement: { month: string; in_qty: string; out_qty: string }[];
}

export interface PickItem {
  id: number;
  item_code: string;
  name: string;
  item_type: ItemType;
  current_stock: string;
  avg_cost: string;
  selling_price: string | null;
  unit: string;
}

export const inventoryApi = {
  list: (params: Record<string, string | undefined>) => api.get<InventoryListResponse>("inventory.php", params),
  detail: (id: number) => api.get<ItemDetailResponse>("inventory.php", { view: "detail", id: String(id) }),
  pick: (itemType?: ItemType) => api.get<{ items: PickItem[] }>("inventory.php", { view: "picklist", item_type: itemType }),
  create: (p: Record<string, unknown>) => api.post("inventory.php", { action: "create", ...p }),
  update: (p: Record<string, unknown>) => api.post("inventory.php", { action: "update", ...p }),
  toggle: (id: number) => api.post("inventory.php", { action: "toggle", id }),
  adjust: (p: Record<string, unknown>) => api.post("inventory.php", { action: "adjust", ...p }),
  saveCategory: (p: Record<string, unknown>) => api.post("inventory.php", { action: "save_category", ...p }),
  toggleCategory: (id: number) => api.post("inventory.php", { action: "toggle_category", id }),
  saveUnit: (p: Record<string, unknown>) => api.post("inventory.php", { action: "save_unit", ...p }),
};

export const STATE_TONE: Record<string, "green" | "amber" | "coral"> = { ok: "green", low: "amber", out: "coral" };
export const REASON_LABEL: Record<string, string> = {
  production: "Produced",
  adjustment_in: "Adjust +",
  sale_reversal: "Sale reversed",
  sale: "Sold",
  adjustment_out: "Adjust −",
  damage: "Damage",
};
