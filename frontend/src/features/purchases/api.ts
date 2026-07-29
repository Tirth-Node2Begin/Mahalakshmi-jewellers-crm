import { api } from "@/shared/api/http-client";
import type { Metal, Purity, StockCategory } from "@/features/stock/api";

/**
 * Buying stock from vendors (api/purchases.php).
 *
 * A purchase line is one of three kinds:
 *   tagged  — a unique new piece; the server creates the inventory item
 *   bulk    — grams added to an existing (or auto-created) metal pool
 *   service — karigar making charges; money only, no stock
 */

export type PurchaseStatus = "draft" | "received" | "cancelled";
export type LineKind = "tagged" | "bulk" | "service";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque" | "card";

export interface PurchaseListRow {
  id: number;
  purchase_no: string;
  purchase_date: string;
  status: PurchaseStatus;
  invoice_ref: string | null;
  subtotal: string;
  tax_total: string;
  grand_total: string;
  paid_amount: string;
  balance_due: string;
  vendor_name: string;
}

export interface PurchaseVendor {
  id: number;
  name: string;
  company: string | null;
  vendor_type: string;
}

export interface BulkPoolItem {
  id: number;
  item_code: string;
  name: string;
  metal: Metal | null;
  purity_id: number | null;
}

export interface PurchaseListResponse {
  purchases: PurchaseListRow[];
  vendors: PurchaseVendor[];
  purities: Purity[];
  categories: StockCategory[];
  bulk_items: BulkPoolItem[];
}

export interface PurchaseLine {
  id: number;
  purchase_id: number;
  item_id: number | null;
  description: string | null;
  metal: Metal | null;
  purity_id: number | null;
  qty: string;
  weight: string;
  rate: string;
  rate_per_gram: string;
  making_charge: string;
  tax_rate: string;
  tax_amount: string;
  line_total: string;
  item_code: string | null;
  item_name: string | null;
  huid: string | null;
  purity_code: string | null;
}

export interface PurchasePayment {
  id: number;
  payment_no: string;
  payment_date: string;
  payment_mode: PaymentMode;
  amount: string;
  ref_no: string | null;
  status: string;
}

export interface PurchaseDetail {
  id: number;
  purchase_no: string;
  supplier_id: number;
  purchase_date: string;
  status: PurchaseStatus;
  invoice_ref: string | null;
  notes: string | null;
  subtotal: string;
  tax_total: string;
  cgst: string;
  sgst: string;
  igst: string;
  round_off: string;
  grand_total: string;
  paid_amount: string;
  cancel_reason: string | null;
  created_at: string;
  vendor_name: string;
  vendor_company: string | null;
  vendor_gstin: string | null;
  created_by_name: string | null;
  voucher_no: string | null;
  items: PurchaseLine[];
  payments: PurchasePayment[];
}

/** One line as posted to the server. Only the fields relevant to `kind` matter. */
export interface PurchaseLinePayload {
  kind: LineKind;
  description?: string | null;
  metal?: Metal;
  purity_id?: number | null;
  category_id?: number | null;
  item_id?: number | null;
  huid?: string | null;
  gross_weight?: number;
  net_weight?: number;
  qty?: number;
  weight?: number;
  rate_per_gram?: number;
  making_charge?: number;
  making_type?: string;
  amount?: number;
  tax_rate?: number;
}

export interface CreatePurchasePayload {
  supplier_id: number;
  purchase_date: string;
  bill_ref?: string | null;
  notes?: string | null;
  items: PurchaseLinePayload[];
  payment?: {
    amount: number;
    mode: PaymentMode;
    bank_account_id?: number | null;
    ref_no?: string | null;
  };
}

export const purchasesApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api.get<PurchaseListResponse>("purchases.php", params),
  detail: (id: number) => api.get<{ purchase: PurchaseDetail }>("purchases.php", { view: "detail", id }),
  create: (payload: CreatePurchasePayload) =>
    api.post<{ id: number; message: string }>("purchases.php", { action: "create", ...payload }),
  cancel: (id: number, reason: string) =>
    api.post<{ message: string }>("purchases.php", { action: "cancel", id, reason }),
};

export const LINE_KIND_LABEL: Record<LineKind, string> = {
  tagged: "Tagged piece",
  bulk: "Bulk metal",
  service: "Making / service charge",
};

export const LINE_KIND_HINT: Record<LineKind, string> = {
  tagged: "One unique piece with its own weight and tag",
  bulk: "Loose gold or silver added to your pool, in grams",
  service: "Karigar labour or any charge that does not add stock",
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  upi: "UPI",
  cheque: "Cheque",
  card: "Card",
};

export function purchaseStatusTone(status: PurchaseStatus): "green" | "amber" | "coral" | "gray" {
  if (status === "received") return "green";
  if (status === "cancelled") return "coral";
  return "gray";
}

/** paid vs balance, in shop language. */
export function paymentStateTone(balanceDue: number, paid: number): "green" | "amber" | "coral" {
  if (balanceDue <= 0.01) return "green";
  return paid > 0.01 ? "amber" : "coral";
}

export function paymentStateLabel(balanceDue: number, paid: number): string {
  if (balanceDue <= 0.01) return "Fully paid";
  return paid > 0.01 ? "Part paid" : "Unpaid";
}
