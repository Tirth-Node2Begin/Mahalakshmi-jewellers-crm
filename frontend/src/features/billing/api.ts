import { api } from "@/shared/api/http-client";
import { useQuery } from "@tanstack/react-query";
import type {
  EstimateDetail,
  EstimateListResponse,
  EstimateStatus,
  HeldBill,
  InvoiceDetail,
  InvoiceListResponse,
  InvoiceStatus,
  StockItem,
} from "./types";

type Params = Record<string, string | number | boolean | undefined | null>;

/** Billing endpoint (api/invoices.php). Drafts touch nothing; finalize is the atomic sale. */
export const billingApi = {
  list: (params: Params) => api.get<InvoiceListResponse>("invoices.php", params),
  detail: (id: number) => api.get<{ invoice: InvoiceDetail }>("invoices.php", { view: "detail", id }),
  held: () => api.get<{ held: HeldBill[] }>("invoices.php", { view: "held" }),
  /** barcode / tag / HUID scan — 404 when nothing in stock matches */
  lookup: (term: string) => api.get<{ item: StockItem }>("invoices.php", { view: "lookup", term }),
  /** Empty term = browse mode — the first items by name, optionally one category. */
  searchItems: (term: string, categoryId?: number | null) =>
    api.get<{ items: StockItem[] }>("invoices.php", {
      view: "search_items",
      term,
      category_id: categoryId ?? undefined,
    }),

  draftSave: (payload: Record<string, unknown>) =>
    api.post<{ id: number; invoice: InvoiceDetail; message: string }>("invoices.php", {
      action: "draft_save",
      ...payload,
    }),
  draftDiscard: (id: number) => api.post<{ message: string }>("invoices.php", { action: "draft_discard", id }),
  finalize: (id: number, payments: Array<Record<string, unknown>>) =>
    api.post<{ id: number; invoice: InvoiceDetail; message: string }>("invoices.php", {
      action: "finalize",
      id,
      payments,
    }),
  cancel: (id: number, reason: string) => api.post<{ message: string }>("invoices.php", { action: "cancel", id, reason }),
  /** logged so a duplicate print is always attributable */
  reprint: (id: number) => api.post<{ invoice: InvoiceDetail }>("invoices.php", { action: "reprint", id }),
};

/** Estimates / quotations (api/estimates.php). A price slip — never a bill. */
export const estimatesApi = {
  list: (params: Params) => api.get<EstimateListResponse>("estimates.php", params),
  detail: (id: number) => api.get<{ estimate: EstimateDetail }>("estimates.php", { view: "detail", id }),
  save: (payload: Record<string, unknown>) =>
    api.post<{ id: number; estimate: EstimateDetail; message: string }>("estimates.php", { action: "save", ...payload }),
  convert: (id: number, holdQuotedRate: boolean) =>
    api.post<{ invoice_id: number; message: string }>("estimates.php", {
      action: "convert",
      id,
      hold_quoted_rate: holdQuotedRate,
    }),
  cancel: (id: number) => api.post<{ message: string }>("estimates.php", { action: "cancel", id }),
};

/* --------------------------------------------------------------- settings */

export interface CompanySettings {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_gstin?: string;
  company_logo_path?: string;
  invoice_terms?: string;
  invoice_footer_note?: string;
  default_tax_rate?: string;
}

/**
 * Shop details for the printed header. A counter user without `settings.read`
 * only receives the public subset (name + logo), so every field is optional.
 */
export function useCompanySettings() {
  const { data } = useQuery({
    queryKey: ["settings", "company"],
    queryFn: () => api.get<{ settings: CompanySettings }>("settings.php"),
    staleTime: 10 * 60_000,
  });
  return data?.settings ?? {};
}

/** GST rate a fresh line starts at. Falls back to the jewellery default of 3%. */
export function useDefaultTaxRate(): number {
  const settings = useCompanySettings();
  const rate = Number(settings.default_tax_rate);
  return Number.isFinite(rate) && rate > 0 ? rate : 3;
}

/* ------------------------------------------------------------ status chips */

export function invoiceStatusTone(status: InvoiceStatus | string): "purple" | "green" | "gray" {
  if (status === "final") return "green";
  if (status === "cancelled") return "gray";
  return "purple";
}

export function invoiceStatusLabel(status: InvoiceStatus | string): string {
  if (status === "final") return "Final";
  if (status === "cancelled") return "Cancelled";
  return "Draft";
}

export function estimateStatusTone(status: EstimateStatus | string): "purple" | "green" | "amber" | "gray" {
  if (status === "converted") return "green";
  if (status === "expired") return "amber";
  if (status === "cancelled") return "gray";
  return "purple";
}

export function estimateStatusLabel(status: EstimateStatus | string): string {
  if (status === "converted") return "Converted";
  if (status === "expired") return "Expired";
  if (status === "cancelled") return "Cancelled";
  return "Open";
}

export const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank: "Bank transfer",
  cheque: "Cheque",
};
