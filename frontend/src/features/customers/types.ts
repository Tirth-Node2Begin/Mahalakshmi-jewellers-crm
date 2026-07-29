export type CustomerStage = "onboarding" | "active" | "inactive" | "churned";
export const STAGES: CustomerStage[] = ["onboarding", "active", "inactive", "churned"];

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  company: string | null;
  gstin: string | null;
  pan_no: string | null;
  mobile: string | null;
  alt_mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gender: "male" | "female" | "other" | null;
  dob: string | null;
  anniversary: string | null;
  occupation: string | null;
  vip: 0 | 1;
  stage: CustomerStage;
  assigned_to: number | null;
  assigned_to_name: string | null;
  notes: string | null;
  created_at: string;
  outstanding?: string;
}

export interface FamilyMember {
  id?: number;
  relation: string | null;
  name: string;
  dob: string | null;
  anniversary: string | null;
}

export interface CustomerStats {
  total: number;
  onboarding: number;
  active: number;
  dormant: number;
  new_this_month: number;
  outstanding: number;
}

export interface CustomerEvent {
  id: number;
  event_type: string;
  description: string | null;
  ref_table: string | null;
  ref_id: number | null;
  created_by_name: string | null;
  created_at: string;
}

export interface CustomerInvoiceRow {
  id: number;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  grand_total: string;
  paid_amount: string;
}

export interface CustomerOrderRow {
  id: number;
  order_no: string;
  title: string;
  status: string;
  quoted_price: string;
  advance_paid: string;
  order_date: string;
  expected_date: string | null;
}

export interface CustomerRepairRow {
  id: number;
  repair_no: string;
  item_description: string;
  status: string;
  estimated_cost: string;
  final_cost: string;
  received_date: string;
  expected_date: string | null;
}

export interface UserOption {
  id: number;
  full_name: string;
}

export interface CustomerListResponse {
  customers: Customer[];
  stats: CustomerStats;
  users: UserOption[];
}

export interface CustomerDetailResponse {
  customer: Customer;
  family: FamilyMember[];
  invoices: CustomerInvoiceRow[];
  orders: CustomerOrderRow[];
  repairs: CustomerRepairRow[];
  events: CustomerEvent[];
  totals: { billed: number; paid: number; outstanding: number };
  users: UserOption[];
}
