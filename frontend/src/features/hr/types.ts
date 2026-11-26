export type EmployeeStatus = "active" | "on_leave" | "terminated" | "resigned";
export type EmployeeType = "full_time" | "part_time" | "contract" | "intern";
export type PayrollRunStatus = "draft" | "completed" | "paid";
export type PayrollItemStatus = "draft" | "finalized" | "paid";
export type PaymentMode = "cash" | "bank" | "upi" | "cheque" | "card";

export interface Department {
  id: number;
  name: string;
}

export interface Designation {
  id: number;
  name: string;
  department_id: number | null;
}

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

export interface UserOption {
  id: number;
  full_name: string;
}

export interface Employee {
  id: number;
  employee_code: string;
  user_id: number | null;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  date_of_birth: string | null;
  date_of_joining: string;
  department_id: number | null;
  department_name: string | null;
  designation_id: number | null;
  designation_name: string | null;
  shift_id: number | null;
  shift_name: string | null;
  employee_type: EmployeeType;
  address: string | null;
  city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  pan_number: string | null;
  aadhar_number: string | null;
  basic_salary: string;
  status: EmployeeStatus;
  created_at: string;
}

export interface EmployeeStats {
  total: number;
  active: number;
  on_leave: number;
  inactive: number;
  monthly_salary: string | number;
}

export interface EmployeeListResponse {
  employees: Employee[];
  stats: EmployeeStats;
  departments: Department[];
  designations: Designation[];
  shifts: Shift[];
  users: UserOption[];
}

export interface PayrollRun {
  id: number;
  pay_period: string;
  status: PayrollRunStatus;
  total_employees: number;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  computed_at: string | null;
  paid_items?: number;
}

export interface PayrollItem {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department_name: string | null;
  designation_name: string | null;
  basic_salary: string;
  working_days: string;
  payable_days: string;
  present_days: string;
  half_days: number;
  paid_leave_days: string;
  unpaid_leave_days: string;
  late_count: number;
  gross: string;
  bonus: string;
  deduction: string;
  deduction_note: string | null;
  override_net: string | null;
  net: string;
  status: PayrollItemStatus;
  paid_at: string | null;
  expense_id: number | null;
}

export interface BankAccount {
  id: number;
  account_name: string;
}

export interface PayrollResponse {
  runs: PayrollRun[];
  run: PayrollRun | null;
  items: PayrollItem[];
  bank_accounts: BankAccount[];
}
