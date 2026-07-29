import { api } from "@/shared/api/http-client";
import type { PaymentMode } from "@/features/purchases/api";

/** Money paid out to vendors, and the vendor's running ledger (api/vendor_payments.php). */

export interface VendorPayment {
  id: number;
  payment_no: string;
  payment_date: string;
  payment_mode: PaymentMode;
  amount: string;
  ref_no: string | null;
  status: "active" | "cancelled";
  vendor_name: string;
  purchase_no: string | null;
  account_name: string | null;
  created_by_name: string | null;
}

export interface BankAccount {
  id: number;
  account_name: string;
}

export interface VendorPaymentListResponse {
  payments: VendorPayment[];
  vendors: { id: number; name: string; company: string | null }[];
  bank_accounts: BankAccount[];
}

/** An unpaid (or part-paid) purchase of one vendor. */
export interface DuePurchase {
  id: number;
  purchase_no: string;
  purchase_date: string;
  grand_total: string;
  paid_amount: string;
  balance_due: string;
}

export interface LedgerEntry {
  voucher_id: number;
  voucher_no: string;
  vdate: string;
  vtype: string;
  ref_type: string | null;
  ref_id: number | null;
  narration: string | null;
  dr_amount: string;
  cr_amount: string;
  balance: number;
  balance_type: "dr" | "cr";
}

export interface LedgerStatement {
  ledger: { id: number; name: string; code: string; opening_balance: string; opening_type: "dr" | "cr"; nature: string };
  opening: number;
  opening_type: "dr" | "cr";
  entries: LedgerEntry[];
  closing: number;
  closing_type: "dr" | "cr";
}

export interface CreateVendorPaymentPayload {
  supplier_id: number;
  purchase_id?: number | null;
  amount: number;
  payment_mode: PaymentMode;
  bank_account_id?: number | null;
  ref_no?: string | null;
  payment_date?: string;
  notes?: string | null;
}

export const vendorPaymentsApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api.get<VendorPaymentListResponse>("vendor_payments.php", params),
  due: (supplierId: number) =>
    api.get<{ purchases: DuePurchase[] }>("vendor_payments.php", { view: "due", supplier_id: supplierId }),
  ledger: (supplierId: number, from?: string, to?: string) =>
    api.get<{ statement: LedgerStatement }>("vendor_payments.php", {
      view: "ledger",
      supplier_id: supplierId,
      from,
      to,
    }),
  create: (payload: CreateVendorPaymentPayload) =>
    api.post<{ id: number; message: string }>("vendor_payments.php", { action: "create", ...payload }),
  cancel: (id: number, reason: string) =>
    api.post<{ message: string }>("vendor_payments.php", { action: "cancel", id, reason }),
};

/**
 * A vendor ledger is a creditor: a `cr` balance means we still owe them.
 * Returns a positive number for "we owe", negative for "we have overpaid".
 */
export function payableFromLedger(balance: number, type: "dr" | "cr"): number {
  return type === "cr" ? balance : -balance;
}
