import { getApiBase } from "@/configs/app.config";
import { api } from "@/shared/api/http-client";

// ---- Dashboard payloads (planning/14 §1) — one hand-designed variant per role ----
export interface PaymentRow { id: number; amount: string; payment_date: string; payment_mode: string; invoice_no: string; customer_name: string }
export interface ExpenseRow { id: number; amount: string; expense_date: string; paid_to: string | null; category_name: string }
export interface Occasion { name: string; occasion: string; on_date: string }
export interface LowStockItem { id: number; item_code: string; name: string; item_type: string; current_stock: string; reorder_level: string; avg_cost: string; unit: string | null }

export interface ExecutivePayload {
  variant: "executive";
  alerts: { overdue_invoices: number; low_stock: number };
  kpis: {
    month_revenue: number; month_expenses: number; month_net: number;
    outstanding: number;
  };
  cashflow: { month: string; income: number; expense: number }[];
  upcoming_occasions: Occasion[];
  recent_payments: PaymentRow[];
  recent_expenses: ExpenseRow[];
  low_stock: LowStockItem[];
}

export interface SalesPayload {
  variant: "sales";
  alerts: { overdue_invoices: number; low_stock: number };
  kpis: { month_collections: number; outstanding: number };
  collections: { month: string; collected: number }[];
  upcoming_occasions: Occasion[];
  recent_payments: PaymentRow[];
}

export interface InventoryPayload {
  variant: "inventory";
  alerts: { low_stock: number; orders_in_production: number; dead_stock: number };
  kpis: {
    stock_value: number; raw_value: number; finished_value: number;
    low_stock_count: number; orders_in_production: number; stock_added_value: number;
  };
  stock_by_category: { category: string; value: string }[];
  low_stock: LowStockItem[];
  recent_movements: { id: number; type: string; reason: string; qty: string; unit_cost: string; created_at: string; item_name: string; item_code: string }[];
}

export type DashboardPayload = ExecutivePayload | SalesPayload | InventoryPayload;

export type ReportTab = "revenue" | "expenses" | "customers" | "inventory";

export interface ReportResponse {
  tab: ReportTab;
  range: { from: string; to: string };
  data: Record<string, unknown>;
}

export const dashboardApi = {
  get: (months = 12) => api.get<DashboardPayload>("dashboard.php", { months }),
};

export const reportsApi = {
  tabs: () => api.get<{ tabs: ReportTab[] }>("reports.php", { tabs: "1" }),
  tab: (tab: ReportTab, from?: string, to?: string) => api.get<ReportResponse>("reports.php", { tab, from, to }),

  /** Streamed CSV download (planning/14 §3) — cookie-authenticated fetch → blob → save. */
  exportCsv: async (tab: ReportTab, from: string, to: string): Promise<void> => {
    const url = `${getApiBase()}/reports.php?tab=${encodeURIComponent(tab)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&export=csv`;
    let res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      // one silent refresh retry, mirroring the http-client
      await api.post("v1/auth/refresh.php").catch(() => undefined);
      res = await fetch(url, { credentials: "include", cache: "no-store" });
    }
    if (!res.ok) throw new Error("Export failed — check your access and try again.");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `report-${tab}-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  },
};

export const TAB_META: Record<ReportTab, { label: string; permission: string }> = {
  revenue: { label: "Revenue", permission: "invoices.read" },
  expenses: { label: "Expenses & P&L", permission: "expenses.read" },
  customers: { label: "Customers", permission: "customers.read" },
  inventory: { label: "Inventory", permission: "inventory.read" },
};

// chart palette (planning/14) — kept as literals here since charts render client-only
export const CHART = { income: "#3FD16F", expense: "#FF6DA8", warning: "#F5A623", primary: "#4270bf", secondary: "#FF6DA8" };
