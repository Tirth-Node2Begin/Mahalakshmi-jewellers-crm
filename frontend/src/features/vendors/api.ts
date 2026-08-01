import { api } from "@/shared/api/http-client";

/** The ten types baked into the product — they drive the category tabs and the maker picklist. */
export type BuiltInVendorType =
  | "bullion"
  | "diamond"
  | "stone"
  | "packaging"
  | "karigar"
  | "manufacturer"
  | "hallmark"
  | "cad"
  | "service"
  | "other";
/** Built-in or shop-added (vendor_types master) — resolve labels via useVendorTypes().labelOf. */
export type VendorType = string;

/** A type the shop added itself ("+ Add a new type…"). */
export interface CustomVendorType {
  id: number;
  slug: string;
  label: string;
}
export type VendorStatus = "active" | "inactive" | "blacklisted";
export type PartnerCategory = "supplier" | "maker" | "service";

export interface Vendor {
  id: number;
  vendor_code: string | null;
  name: string;
  vendor_type: VendorType;
  company: string | null;
  contact_person: string | null;
  gstin: string | null;
  pan_no: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  opening_balance: string | null;
  opening_type: "dr" | "cr";
  city: string | null;
  state: string | null;
  pincode: string | null;
  bank_name: string | null;
  account_no: string | null;
  ifsc: string | null;
  upi: string | null;
  payment_terms: string | null;
  specialisation: string | null;
  karigar_rate: string | null;
  vendor_status: VendorStatus;
  is_active: 0 | 1;
  notes: string | null;
  created_at: string;
  item_count?: number;
}

export interface VendorStats {
  total: number;
  active: number;
  karigars: number;
  blacklisted: number;
}

export interface VendorLinkedItem {
  id: number;
  item_code: string;
  name: string;
  status: string;
  current_stock: string;
}

export interface VendorPurchase {
  id: number;
  purchase_no: string;
  purchase_date: string;
  status: "draft" | "received" | "cancelled";
  invoice_ref: string | null;
  grand_total: string;
  paid_amount: string;
  balance_due: string;
  payment_status: "unpaid" | "paid";
}

export interface VendorPaymentRow {
  id: number;
  payment_no: string;
  payment_date: string;
  payment_mode: "cash" | "bank" | "upi" | "cheque" | "card";
  amount: string;
  ref_no: string | null;
  status: "active" | "cancelled";
  purchase_no: string | null;
  account_name: string | null;
}

export interface VendorSpendSummary {
  total_purchased: number;
  total_paid: number;
  /** Opening + billed − paid. Positive = we owe them, negative = advance paid. */
  balance_due: number;
  /** Bill-wise arrears only (excludes on-account advances). */
  unpaid_amount: number;
  opening_balance: number;
  purchase_count: number;
  payment_count: number;
  item_count: number;
  last_purchase_date: string | null;
  last_payment_date: string | null;
}

export interface VendorListResponse {
  vendors: Vendor[];
  stats: VendorStats;
}

export interface VendorDetailResponse {
  vendor: Vendor;
  items: VendorLinkedItem[];
  purchases: VendorPurchase[];
  payments: VendorPaymentRow[];
  summary: VendorSpendSummary;
}

export const vendorsApi = {
  list: (params: Record<string, string | undefined>) => api.get<VendorListResponse>("vendors.php", params),
  detail: (id: number) => api.get<VendorDetailResponse>("vendors.php", { view: "detail", id: String(id) }),
  pick: () => api.get<{ vendors: { id: number; name: string; vendor_type: VendorType }[] }>("vendors.php", { view: "picklist" }),
  save: (payload: Record<string, unknown>) => api.post<{ id: number }>("vendors.php", { action: "save", ...payload }),
  toggle: (id: number) => api.post("vendors.php", { action: "toggle", id }),
  remove: (id: number) => api.post("vendors.php", { action: "delete", id }),
  listTypes: () => api.get<{ types: CustomVendorType[] }>("vendors.php", { view: "types" }),
  addType: (label: string) => api.post<{ type: CustomVendorType }>("vendors.php", { action: "add_type", label }),
};

export const VENDOR_TYPE_LABEL: Record<string, string> = {
  bullion: "Gold / Bullion Supplier",
  diamond: "Diamond Supplier",
  stone: "Stone / Gem Supplier",
  packaging: "Packaging Supplier",
  karigar: "Jewellery Maker",
  manufacturer: "Manufacturing Unit",
  hallmark: "Hallmark Centre",
  cad: "CAD Designer",
  service: "Other Service",
  other: "Other",
};

/** Which business category each BUILT-IN partner type belongs to — custom types match none. */
export const PARTNER_CATEGORY_OF: Record<string, PartnerCategory | undefined> = {
  bullion: "supplier",
  diamond: "supplier",
  stone: "supplier",
  packaging: "supplier",
  karigar: "maker",
  manufacturer: "maker",
  hallmark: "service",
  cad: "service",
  service: "service",
  other: "service",
};

/** Ordered categories with their member types — drives tabs + grouped dropdowns. */
export const PARTNER_CATEGORIES: { key: PartnerCategory; label: string; types: BuiltInVendorType[] }[] = [
  { key: "supplier", label: "Material Suppliers", types: ["bullion", "diamond", "stone", "packaging"] },
  { key: "maker", label: "Jewellery Makers", types: ["karigar", "manufacturer"] },
  { key: "service", label: "Services", types: ["hallmark", "cad", "service", "other"] },
];

export function vendorStatusTone(status: VendorStatus): "green" | "gray" | "coral" {
  return status === "active" ? "green" : status === "blacklisted" ? "coral" : "gray";
}
