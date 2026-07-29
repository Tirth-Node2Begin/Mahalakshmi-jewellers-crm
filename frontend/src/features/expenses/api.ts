import { api } from "@/shared/api/http-client";

export interface Expense {
  id: number;
  expense_date: string;
  category_id: number;
  category_name: string;
  category_is_system: 0 | 1;
  fixed_cost_item_id: number | null;
  item_name: string | null;
  type: "fixed" | "variable";
  amount: string;
  description: string | null;
  paid_to: string | null;
  payment_mode: string;
  bank_name: string | null;
  ref_table: string | null;
}

export interface ExpenseKpis {
  today: number;
  total_year: number;
  fixed_total: number;
  variable_total: number;
}

export interface FixedItem {
  id: number;
  name: string;
  amount: string;
  category_id: number;
  emp_name?: string | null;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  type: "fixed" | "variable";
  is_system: 0 | 1;
  system_key: string | null;
  is_active: 0 | 1;
  expense_count: number;
  total_volume: string;
  items: FixedItem[];
}

export interface ExpenseListResponse {
  expenses: Expense[];
  kpis: ExpenseKpis;
  categories: ExpenseCategory[];
  bank_accounts: { id: number; account_name: string }[];
}

export interface InsightsResponse {
  period: string;
  range: { start: string; end: string; label: string };
  total: number;
  daily: { date: string; total: string }[];
  categories: { name: string; total: string; count: string }[];
  payments: { mode: string; total: string; count: string }[];
  comparison?: {
    range: { start: string; end: string; label: string };
    total: number;
    categories: { name: string; total: string; count: string }[];
    payments: { mode: string; total: string; count: string }[];
  };
}

export interface TrackerRunCell {
  run_id: number;
  payroll_item_id: number;
  status: "draft" | "finalized" | "paid";
  net: string;
}

export interface TrackerResponse {
  year: number;
  categories: Array<{ id: number; name: string; is_system: 0 | 1; system_key: string | null; items: FixedItem[] }>;
  tracker: Record<number, Record<number, Record<number, { paid_amount: string; payment_status: string; payment_date: string | null }>>>;
  /** payroll run state per salary item (fixed_cost_item id → year → month) — unpaid runs show as draft/due */
  payroll: Record<number, Record<number, Record<number, TrackerRunCell>>>;
  bank_accounts: { id: number; account_name: string }[];
}

export const expensesApi = {
  list: (params: Record<string, string | undefined>) => api.get<ExpenseListResponse>("expenses.php", params),
  insights: (period: string, date?: string, compareDate?: string) =>
    api.get<InsightsResponse>("expenses.php", { view: "insights", period, date, compare_date: compareDate }),
  create: (payload: Record<string, unknown>) => api.post("expenses.php", { action: "create", ...payload }),
  update: (payload: Record<string, unknown>) => api.post("expenses.php", { action: "update", ...payload }),
  remove: (id: number) => api.post("expenses.php", { action: "delete", id }),

  categories: () => api.get<{ categories: ExpenseCategory[] }>("expense_categories.php"),
  addCategory: (p: Record<string, unknown>) => api.post("expense_categories.php", { action: "add", ...p }),
  updateCategory: (p: Record<string, unknown>) => api.post("expense_categories.php", { action: "update", ...p }),
  toggleCategory: (id: number) => api.post("expense_categories.php", { action: "toggle", id }),
  deleteCategory: (id: number) => api.post("expense_categories.php", { action: "delete", id }),
  addItem: (p: Record<string, unknown>) => api.post("expense_categories.php", { action: "add_sub", ...p }),
  updateItem: (p: Record<string, unknown>) => api.post("expense_categories.php", { action: "update_sub", ...p }),
  toggleItem: (id: number) => api.post("expense_categories.php", { action: "toggle_sub", id }),
  deleteItem: (id: number) => api.post("expense_categories.php", { action: "delete_sub", id }),

  tracker: (year: number) => api.get<TrackerResponse>("monthly.php", { year }),
  markPaid: (p: Record<string, unknown>) => api.post("monthly.php", { action: "mark_paid", ...p }),
  markBulk: (p: Record<string, unknown>) => api.post("monthly.php", { action: "mark_bulk", ...p }),
  unpay: (p: Record<string, unknown>) => api.post("monthly.php", { action: "unpay", ...p }),
};

export const CATEGORY_COLORS = ["#4270bf", "#FF6DA8", "#3FD16F", "#F5A623", "#4DA6FF", "#BE123C", "#8B84FF", "#F97FB5"];
