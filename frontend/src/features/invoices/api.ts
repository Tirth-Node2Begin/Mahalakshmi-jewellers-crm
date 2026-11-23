import { api } from "@/shared/api/http-client";
import type {
  InvoiceDetailResponse,
  InvoiceHelpers,
  InvoiceListResponse,
  OrderItemsResponse,
  PaymentHelpers,
  PaymentListResponse,
} from "./types";

export const invoicesApi = {
  list: (params: Record<string, string | undefined>) => api.get<InvoiceListResponse>("invoices.php", params),
  detail: (id: number) => api.get<InvoiceDetailResponse>("invoices.php", { id }),
  helpers: (customerId?: number) =>
    api.get<InvoiceHelpers>("invoices.php", customerId ? { helpers: 1, customer_id: String(customerId) } : { helpers: 1 }),
  orderItems: (orderId: number) => api.get<OrderItemsResponse>("invoices.php", { order_id: String(orderId) }),
  nextNumber: () => api.get<{ next_number: string }>("invoices.php", { next_number: 1 }),
  create: (payload: Record<string, unknown>) => api.post<{ id: number }>("invoices.php", { action: "create", ...payload }),
  update: (payload: Record<string, unknown>) => api.post("invoices.php", { action: "update", ...payload }),
  finalize: (id: number) => api.post("invoices.php", { action: "finalize", id }),
  reopen: (id: number) => api.post("invoices.php", { action: "reopen", id }),
  cancel: (id: number) => api.post("invoices.php", { action: "cancel", id }),
  remove: (id: number) => api.post("invoices.php", { action: "delete", id }),
  addPayment: (payload: Record<string, unknown>) => api.post("payments.php", { action: "receive", ...payload }),
  deletePayment: (payment_id: number) => api.post("invoices.php", { action: "delete_payment", payment_id }),
  updateCheque: (payment_id: number, cheque_status: string, deposit_bank_account_id?: number) =>
    api.post("invoices.php", { action: "update_cheque_status", payment_id, cheque_status, deposit_bank_account_id }),
};

export const paymentsApi = {
  list: (params: Record<string, string | undefined>) => api.get<PaymentListResponse>("payments.php", params),
  helpers: () => api.get<PaymentHelpers>("payments.php", { helpers: 1 }),
  /** the cheque reached the bank — moves it out of Cheques in Hand */
  clearCheque: (payload: { id: number; bank_account_id?: number | null; cleared_on?: string }) =>
    api.post("payments.php", { action: "clear_cheque", ...payload }),
  /** the cheque came back — the receipt is cancelled and the bill is due again */
  bounceCheque: (payload: { id: number; reason: string }) =>
    api.post("payments.php", { action: "bounce_cheque", ...payload }),
};

export function paymentModeLabel(mode: string): string {
  switch (mode) {
    case "bank":
      return "Bank Transfer";
    case "upi":
      return "UPI";
    case "card":
      return "Card";
    case "cheque":
      return "Cheque";
    default:
      return "Cash";
  }
}

export const bankAccountsApi = {
  list: () => api.get<{ accounts: { id: number; account_name: string; bank_name: string | null; upi_id: string | null }[] }>("bank_accounts.php"),
  save: (payload: Record<string, unknown>) => api.post("bank_accounts.php", { action: "save", ...payload }),
  remove: (id: number) => api.post("bank_accounts.php", { action: "delete", id }),
};

export function invoiceStatusTone(status: string): "purple" | "green" | "amber" | "coral" | "gray" {
  switch (status) {
    case "paid":
      return "green";
    case "partially_paid":
    case "sent":
      return "amber";
    case "cancelled":
      return "gray";
    case "draft":
      return "purple";
    default:
      return "gray";
  }
}
