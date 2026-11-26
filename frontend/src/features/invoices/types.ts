export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "cancelled";
export type PaymentMode = "cash" | "upi" | "bank" | "card" | "cheque";
export type ChequeStatus = "pending" | "deposited" | "cleared" | "bounced";

export interface Invoice {
  id: number;
  invoice_no: string;
  customer_id: number;
  customer_name?: string;
  customer_code?: string;
  work_id: number | null;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  sale_type: "ready" | "custom";
  subtotal: string;
  discount_total: string;
  old_gold_adjustment: string;
  tax_total: string;
  cgst: string;
  sgst: string;
  igst: string;
  grand_total: string;
  paid_amount: string;
  hallmark_no: string | null;
  huid: string | null;
  warranty_months: number | null;
  notes: string | null;
  terms: string | null;
  created_at: string;
  // linked custom order (detail)
  order_id?: number | null;
  order_no?: string | null;
  // print fields (detail)
  customer_company?: string | null;
  customer_address?: string | null;
  customer_city?: string | null;
  customer_state?: string | null;
  customer_gstin?: string | null;
  customer_mobile?: string | null;
  customer_email?: string | null;
}

export interface InvoiceItem {
  id?: number;
  item_type: "service" | "stock" | "custom";
  service_id: number | null;
  inventory_item_id: number | null;
  description: string;
  qty: string | number;
  unit: string | null;
  rate: string | number;
  discount: string | number;
  tax_rate: string | number;
  tax_amount?: string;
  line_total?: string;
  // jewellery descriptive fields
  metal_type?: string | null;
  gross_wt?: string | number;
  net_wt?: string | number;
  stone_wt?: string | number;
  purity?: string | null;
  making_charge?: string | number;
  wastage_pct?: string | number;
  hsn_code?: string | null;
  diamond_wt?: string | number;
  diamond_grade?: string | null;
}

export interface InvoicePayment {
  id: number;
  receipt_no: string;
  amount: string;
  payment_date: string;
  payment_mode: PaymentMode;
  bank_name: string | null;
  cheque_number: string | null;
  cheque_date: string | null;
  cheque_bank: string | null;
  cheque_status: ChequeStatus | null;
  notes: string | null;
}

export interface InvoiceStats {
  total_billed: number;
  total_paid: number;
  outstanding: number;
  overdue_count: number;
  draft_count: number;
  this_month_billed: number;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  stats: InvoiceStats;
}

export interface InvoiceDetailResponse {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  company: Record<string, string>;
}

export interface StockItemOption {
  id: number;
  item_code: string;
  name: string;
  current_stock: string;
  selling_price: string | null;
  gross_wt: string | null;
  net_wt: string | null;
  purity: string | null;
  making_charge: string | null;
  metal_type: string | null;
  hsn_code: string | null;
}

export interface BillableOrder {
  id: number;
  order_no: string;
  title: string;
  status: string;
}

export interface InvoiceHelpers {
  customers: { id: number; name: string; customer_code: string }[];
  services: { id: number; name: string; default_rate: string | null }[];
  bank_accounts: { id: number; account_name: string }[];
  default_tax_rate: string | null;
  stock_items: StockItemOption[];
  orders: BillableOrder[];
}

export interface OrderItemsResponse {
  order: { id: number; order_no: string; title: string; status: string };
  items: InvoiceItem[];
}

// ------------------------------------------------------------- payments module

export interface PaymentRow {
  id: number;
  receipt_no: string;
  amount: string;
  payment_date: string;
  payment_mode: PaymentMode;
  bank_name: string | null;
  bank_account_id: number | null;
  cheque_number: string | null;
  cheque_status: ChequeStatus | null;
  cheque_cleared_at: string | null;
  notes: string | null;
  // null on an on-account receipt (an advance with no bill behind it)
  invoice_id: number | null;
  invoice_no: string | null;
  invoice_status: InvoiceStatus | null;
  customer_name: string;
}

export interface PaymentStats {
  total_collected: number;
  collected_this_month: number;
  payment_count: number;
  cheque_pending_count: number;
  total_outstanding: number;
}

export interface PaymentListResponse {
  payments: PaymentRow[];
  stats: PaymentStats;
  bank_accounts: { id: number; account_name: string }[];
}

export interface OpenInvoiceOption {
  id: number;
  invoice_no: string;
  customer_name: string;
  grand_total: string;
  paid_amount: string;
  balance: string;
}

export interface PaymentHelpers {
  open_invoices: OpenInvoiceOption[];
  bank_accounts: { id: number; account_name: string }[];
}
