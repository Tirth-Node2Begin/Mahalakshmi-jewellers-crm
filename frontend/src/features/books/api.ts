import { api } from "@/shared/api/http-client";
import type { Numeric } from "./report-utils";

/** Ledger-derived financial reports (api/books.php). */

export interface PnlLine {
  ledger_id: number;
  name: string;
  amount: number;
}

export interface Pnl {
  from: string;
  to: string;
  income: PnlLine[];
  total_income: number;
  /** cost of goods sold — ledgers flagged linked_type = 'cogs' */
  cogs: PnlLine[];
  total_cogs: number;
  gross_profit: number;
  expenses: PnlLine[];
  total_expenses: number;
  net_profit: number;
}

/** What we still owe each vendor, as at a date (positive = outstanding). */
export interface OutstandingRow {
  party_id: number;
  name: string;
  mobile: string | null;
  ledger_id: number;
  balance: number;
  last_activity: string | null;
}

/** Account nature, as grouped on the trial balance. */
export type Nature = "asset" | "liability" | "income" | "expense";

export type BalanceSide = "dr" | "cr";

export interface TrialBalanceRow {
  ledger_id: number;
  name: string;
  code: string | null;
  nature: Nature;
  opening: number;
  opening_type: BalanceSide;
  debit: number;
  credit: number;
  closing: number;
  closing_type: BalanceSide;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debit: number;
  total_credit: number;
  /** false = the ledger does not tie. Never hide this from the user. */
  balanced: boolean;
}

export type TaxTreatment = "taxable" | "exempt" | "nil_rated" | "non_gst" | "reverse_charge";

/** Sales, grouped by treatment × rate. Straight out of SQL — read through `num()`. */
export interface GstOutwardRow {
  tax_treatment: TaxTreatment | string;
  tax_rate: Numeric;
  taxable_value: Numeric;
  cgst: Numeric;
  sgst: Numeric;
  igst: Numeric;
  bills: Numeric;
}

/** Purchases, grouped by date — the input tax we can claim back. */
export interface GstInwardRow {
  purchase_date: string;
  taxable_value: Numeric;
  cgst: Numeric;
  sgst: Numeric;
  igst: Numeric;
}

export interface GstSummary {
  outward: GstOutwardRow[];
  inward: GstInwardRow[];
  total_turnover: number;
  output_tax: number;
  input_tax: number;
  net_payable: number;
  /** GST turnover must equal P&L sales — a non-zero difference means something is off. */
  reconciliation: { gst_turnover: number; pnl_income: number; difference: number };
}

export type LedgerViewMode = "full" | "gst";

export interface LedgerRow {
  id: number;
  invoice_no?: string | null;
  purchase_no?: string | null;
  invoice_date?: string;
  purchase_date?: string;
  party_name: string;
  tax_treatments: string | null;
  qty: Numeric;
  weight: Numeric;
  taxable_value: Numeric;
  cgst?: Numeric;
  sgst?: Numeric;
  igst?: Numeric;
  tax_total: Numeric;
  total: Numeric;
  is_adjustment?: boolean;
}

export interface StockBucket {
  qty: number;
  weight: number;
  value: number;
}

export interface LedgerStock {
  visible_purchases: StockBucket;
  visible_sales: StockBucket;
  excluded_purchases: StockBucket;
  excluded_sales: StockBucket;
  other_movements: StockBucket;
  period_net: StockBucket;
  live_balance: StockBucket;
}

export interface LedgerViewReport {
  view: LedgerViewMode;
  sales: LedgerRow[];
  purchases: LedgerRow[];
  stock: LedgerStock;
}

export interface StockSummaryRow {
  metal: "gold" | "silver" | string;
  purity: string | null;
  tracking: "tagged" | "bulk" | string;
  items: Numeric;
  qty: Numeric;
  weight: Numeric;
  value: Numeric;
}

export interface DeadStockItem {
  id: number;
  item_code: string;
  name: string;
  metal: "gold" | "silver" | string;
  purity: string | null;
  net_weight: Numeric;
  avg_cost: Numeric;
  in_since: string | null;
  days_in_stock: Numeric;
}

export type VoucherType =
  | "sale"
  | "purchase"
  | "receipt"
  | "payment"
  | "expense"
  | "journal"
  | "contra"
  | "adjustment"
  | "opening";

export interface DayBookEntry {
  ledger_name: string;
  dr_amount: Numeric;
  cr_amount: Numeric;
}

export interface DayBookVoucher {
  id: number;
  voucher_no: string;
  vtype: VoucherType | string;
  vdate: string;
  narration: string | null;
  ref_type: string | null;
  ref_id: number | null;
  entries: DayBookEntry[];
}

export const booksApi = {
  pnl: (from: string, to: string) => api.get<{ pnl: Pnl }>("books.php", { report: "pnl", from, to }),
  vendorOutstanding: (to?: string) =>
    api.get<{ outstanding: { rows: OutstandingRow[]; total: number } }>("books.php", {
      report: "vendor_outstanding",
      to,
    }),

  /** Every ledger's opening, period debit/credit and closing (permission `reports.accounting`). */
  trialBalance: (from: string, to: string) =>
    api.get<{ trial_balance: TrialBalance }>("books.php", { report: "trial_balance", from, to }),

  /** Outward + inward GST with a P&L reconciliation (permission `reports.gst`). */
  gstSummary: (from: string, to: string) =>
    api.get<{ gst: GstSummary }>("books.php", { report: "gst_summary", from, to }),

  /** Full ledger or GST-facing ledger view, depending on permission. */
  ledgerView: (from: string, to: string, view: LedgerViewMode) =>
    api.get<{ ledger: LedgerViewReport }>("books.php", { report: "ledger_view", from, to, view }),

  /** What customers still owe us, as at a date (permission `reports.outstanding`). */
  customerOutstanding: (to?: string) =>
    api.get<{ outstanding: { rows: OutstandingRow[]; total: number } }>("books.php", {
      report: "customer_outstanding",
      to,
    }),

  /** Live stock by metal × purity × tagged/bulk (permission `reports.stock`). */
  stockSummary: () => api.get<{ summary: StockSummaryRow[] }>("books.php", { report: "stock_summary" }),

  /** Tagged pieces sitting unsold for `days` or longer (permission `reports.stock`). */
  deadStock: (days: number) =>
    api.get<{ days: number; items: DeadStockItem[] }>("books.php", { report: "dead_stock", days }),

  /** Every voucher posted on one day (permission `reports.accounting`). */
  dayBook: (date: string) =>
    api.get<{ date: string; vouchers: DayBookVoucher[] }>("books.php", { report: "daybook", date }),
};
