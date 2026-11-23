import { api } from "@/shared/api/http-client";
import type { EmployeeListResponse, PayrollResponse } from "./types";

export const hrApi = {
  employees: (params: Record<string, string | undefined>) => api.get<EmployeeListResponse>("hr.php", { module: "employees", ...params }),
  saveEmployee: (payload: Record<string, unknown>) => api.post<{ id: number }>("hr.php", { action: "save_employee", ...payload }),
  payroll: (runId?: number) => api.get<PayrollResponse>("hr.php", { module: "payroll", run_id: runId }),
  createPayrollRun: (payPeriod: string) => api.post<{ id: number }>("hr.php", { action: "create_payroll_run", pay_period: payPeriod }),
  recomputePayroll: (runId: number) => api.post("hr.php", { action: "recompute_payroll", run_id: runId }),
  updatePayrollItem: (payload: Record<string, unknown>) => api.post("hr.php", { action: "update_payroll_item", ...payload }),
  finalizePayroll: (runId: number) => api.post("hr.php", { action: "finalize_payroll", run_id: runId }),
  paySalary: (payload: Record<string, unknown>) => api.post("hr.php", { action: "pay_salary", ...payload }),
  unpaySalary: (itemId: number) => api.post("hr.php", { action: "unpay_salary", item_id: itemId }),
};
