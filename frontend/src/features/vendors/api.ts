import { api } from "@/shared/api/http-client";

export type VendorType =
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
export type VendorStatus = "active" | "inactive" | "blacklisted";
export type PartnerCategory = "supplier" | "maker" | "service";

export interface Vendor {
  id: number;
  name: string;
  vendor_type: VendorType;
  company: string | null;
  contact_person: string | null;
  gstin: string | null;
  pan_no: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
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
  jw_status: string;
  current_stock: string;
}

export interface VendorLinkedOrder {
  id: number;
  order_no: string;
  title: string;
  status: string;
}

export interface VendorLinkedRepair {
  id: number;
  repair_no: string;
  item_description: string;
  status: string;
}

export interface VendorPurchase {
  id: number;
  purchase_no: string;
  purchase_date: string;
  status: "draft" | "received" | "cancelled";
  grand_total: string;
  payment_status: "unpaid" | "paid";
}

export interface VendorSpendSummary {
  total_purchased: number;
  unpaid_amount: number;
  purchase_count: number;
  item_count: number;
  order_count: number;
  open_order_count: number;
}

export interface VendorListResponse {
  vendors: Vendor[];
  stats: VendorStats;
}

export interface VendorDetailResponse {
  vendor: Vendor;
  items: VendorLinkedItem[];
  orders: VendorLinkedOrder[];
  repairs: VendorLinkedRepair[];
  purchases: VendorPurchase[];
  summary: VendorSpendSummary;
}

export const vendorsApi = {
  list: (params: Record<string, string | undefined>) => api.get<VendorListResponse>("vendors.php", params),
  detail: (id: number) => api.get<VendorDetailResponse>("vendors.php", { view: "detail", id: String(id) }),
  pick: () => api.get<{ vendors: { id: number; name: string; vendor_type: VendorType }[] }>("vendors.php", { view: "picklist" }),
  save: (payload: Record<string, unknown>) => api.post<{ id: number }>("vendors.php", { action: "save", ...payload }),
  toggle: (id: number) => api.post("vendors.php", { action: "toggle", id }),
  remove: (id: number) => api.post("vendors.php", { action: "delete", id }),
};

export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
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

/** Which business category each partner type belongs to. */
export const PARTNER_CATEGORY_OF: Record<VendorType, PartnerCategory> = {
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
export const PARTNER_CATEGORIES: { key: PartnerCategory; label: string; types: VendorType[] }[] = [
  { key: "supplier", label: "Material Suppliers", types: ["bullion", "diamond", "stone", "packaging"] },
  { key: "maker", label: "Jewellery Makers", types: ["karigar", "manufacturer"] },
  { key: "service", label: "Services", types: ["hallmark", "cad", "service", "other"] },
];

export function vendorStatusTone(status: VendorStatus): "green" | "gray" | "coral" {
  return status === "active" ? "green" : status === "blacklisted" ? "coral" : "gray";
}
