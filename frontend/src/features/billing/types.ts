/**
 * Billing / estimates domain types (plan/07).
 *
 * DECIMAL columns come back from PDO as strings, so every money/weight field is
 * typed `Num` and must be wrapped in Number() before arithmetic.
 */

export type Num = number | string;

export type PriceMode = "exclusive" | "inclusive";
export type BillTaxMode = PriceMode | "without_gst";
export type MakingType = "per_gram" | "fixed" | "percent";
export type TaxTreatment = "taxable" | "non_gst";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque" | "card";
export type Metal = "gold" | "silver" | "platinum";
export type Tracking = "tagged" | "bulk";

export type InvoiceStatus = "draft" | "final" | "cancelled";
export type EstimateStatus = "open" | "converted" | "expired" | "cancelled";

/* ------------------------------------------------------------------ helpers */

export interface Purity {
  id: number;
  metal: Metal;
  code: string;
  label: string;
  fineness: Num;
  /** today's rate for this purity — null when the rate has not been entered */
  rate_per_gram: Num | null;
  rate_date: string | null;
}

export interface BankAccount {
  id: number;
  account_name: string;
}

/** A sellable piece returned by ?view=lookup / ?view=search_items. */
export interface StockItem {
  id: number;
  item_code: string;
  name: string;
  metal: Metal | null;
  tracking: Tracking;
  status: string;
  gross_weight: Num;
  net_weight: Num;
  stone_weight?: Num;
  making_type: MakingType;
  making_value: Num;
  huid: string | null;
  hsn_code?: string | null;
  barcode: string | null;
  purity_id: number | null;
  purity_code: string | null;
  category_id?: number | null;
  category_name?: string | null;
}

/** A category with something sellable in it — the filter chips on item search. */
export interface ItemCategory {
  id: number;
  name: string;
}

/* -------------------------------------------------------------- bill: read */

export interface InvoiceListRow {
  id: number;
  invoice_no: string | null;
  invoice_date: string;
  status: InvoiceStatus;
  grand_total: Num;
  paid_amount: Num;
  old_metal_value: Num;
  customer_id: number | null;
  walkin_name: string | null;
  walkin_phone: string | null;
  customer_name: string;
  customer_mobile: string | null;
  created_by_name: string | null;
  balance_due: Num;
}

export interface InvoiceListResponse {
  invoices: InvoiceListRow[];
  can_non_gst_billing: boolean;
  rates_set_today: boolean;
  purities: Purity[];
  categories: ItemCategory[];
  bank_accounts: BankAccount[];
}

export interface HeldBill {
  id: number;
  invoice_date: string;
  grand_total: Num;
  customer_name: string;
  line_count: Num;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: number;
  inventory_item_id: number | null;
  item_type: string;
  description: string;
  purity_code: string | null;
  qty: Num;
  gross_weight: Num;
  net_weight: Num;
  rate_per_gram: Num;
  metal_value: Num;
  making_charge: Num;
  discount: Num;
  tax_rate: Num;
  tax_treatment: TaxTreatment;
  exempt_reason: string | null;
  tax_amount: Num;
  cgst: Num;
  sgst: Num;
  igst: Num;
  line_total: Num;
  cost_value?: Num;
  item_code: string | null;
  huid: string | null;
  hsn_code: string | null;
  metal: Metal | null;
}

export interface InvoiceOldMetalRow {
  id: number;
  metal: Metal;
  purity_id: number | null;
  purity_code: string | null;
  description: string | null;
  gross_weight: Num;
  deduction_pct: Num;
  net_weight: Num;
  rate_per_gram: Num;
  value: Num;
}

export interface InvoicePaymentRow {
  id: number;
  receipt_no: string;
  amount: Num;
  payment_date: string;
  payment_mode: PaymentMode;
  cheque_number: string | null;
  status: string;
  account_name: string | null;
}

export interface TaxSummaryRow {
  tax_rate: Num;
  tax_treatment: TaxTreatment;
  taxable_value: Num;
  cgst: Num;
  sgst: Num;
  igst: Num;
}

export interface InvoiceDetail {
  id: number;
  invoice_no: string | null;
  customer_id: number | null;
  walkin_name: string | null;
  walkin_phone: string | null;
  invoice_date: string;
  price_mode: PriceMode;
  estimate_id: number | null;
  status: InvoiceStatus;
  subtotal: Num;
  metal_total: Num;
  making_total: Num;
  /** total discount on the bill: the whole-bill figure plus every line discount */
  discount_total: Num;
  /** the whole-bill figure alone, as typed in the totals panel */
  bill_discount: Num;
  tax_total: Num;
  cgst: Num;
  sgst: Num;
  igst: Num;
  old_metal_value: Num;
  round_off: Num;
  grand_total: Num;
  paid_amount: Num;
  notes: string | null;
  finalized_at: string | null;
  cancel_reason: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_address: string | null;
  customer_gstin: string | null;
  created_by_name: string | null;
  voucher_no: string | null;
  items: InvoiceItemRow[];
  old_metal: InvoiceOldMetalRow[];
  payments: InvoicePaymentRow[];
  tax_summary: TaxSummaryRow[];
}

/* ---------------------------------------------------------- estimate: read */

export interface EstimateListRow {
  id: number;
  estimate_no: string;
  estimate_date: string;
  valid_until: string | null;
  status: EstimateStatus;
  grand_total: Num;
  customer_name: string;
  converted_invoice_id: number | null;
  invoice_no: string | null;
  /** MySQL boolean expression — 1 when open and past valid_until */
  is_expired: Num | null;
}

export interface EstimateListResponse {
  estimates: EstimateListRow[];
  purities: Purity[];
  categories: ItemCategory[];
}

export interface EstimateItemRow {
  id: number;
  inventory_item_id: number | null;
  description: string;
  purity_code: string | null;
  qty: Num;
  gross_weight: Num;
  net_weight: Num;
  rate_per_gram: Num;
  metal_value: Num;
  making_charge: Num;
  discount: Num;
  tax_rate: Num;
  tax_amount: Num;
  line_total: Num;
  item_code: string | null;
}

export interface EstimateDetail {
  id: number;
  estimate_no: string;
  customer_id: number | null;
  walkin_name: string | null;
  walkin_phone: string | null;
  estimate_date: string;
  valid_until: string | null;
  price_mode: PriceMode;
  metal_total: Num;
  making_total: Num;
  /** total discount: the whole-estimate figure plus every line discount */
  discount_total: Num;
  /** the whole-estimate figure alone */
  bill_discount: Num;
  tax_estimate: Num;
  grand_total: Num;
  status: EstimateStatus;
  converted_invoice_id: number | null;
  notes: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_address: string | null;
  created_by_name: string | null;
  invoice_no: string | null;
  items: EstimateItemRow[];
}

/* --------------------------------------------------------- editor (client) */

/** One editable line in the bill / estimate builder. */
export interface BillLine {
  key: string;
  item_id: number | null;
  item_code: string | null;
  description: string;
  huid: string | null;
  purity_id: number | null;
  purity_code: string | null;
  tracking: Tracking;
  qty: number;
  gross_weight: number;
  net_weight: number;
  rate_per_gram: number;
  making_type: MakingType;
  making_value: number;
  discount: number;
  tax_rate: number;
  tax_treatment: TaxTreatment;
  exempt_reason: string | null;
}

/** One editable old-metal exchange row. */
export interface OldMetalLine {
  key: string;
  metal: Metal;
  purity_id: number | null;
  description: string;
  gross_weight: number;
  deduction_pct: number;
  rate_per_gram: number;
}

/** One split of the money received against a bill. */
export interface PaymentLine {
  key: string;
  mode: PaymentMode;
  amount: number;
  bank_account_id: number | null;
  ref_no: string;
}

/** Who the bill is for. `id === null` means a walk-in. */
export interface BillCustomer {
  id: number;
  name: string;
  mobile: string | null;
}
