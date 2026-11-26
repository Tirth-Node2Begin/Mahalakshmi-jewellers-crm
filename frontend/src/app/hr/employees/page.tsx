"use client";

import { EmployeeFormModal } from "@/features/hr/employee-form-modal";
import { hrApi } from "@/features/hr/api";
import type { Employee, EmployeeStatus } from "@/features/hr/types";
import { PermissionGate, usePermissions } from "@/lib/permissions";
import { Avatar } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { KpiCard } from "@/shared/ui/kpi-card";
import { Pagination, usePagination } from "@/shared/ui/pagination";
import { Select } from "@/shared/ui/select";
import { SkeletonRows } from "@/shared/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { formatCurrency, formatDate } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { CircleDot, Pencil, Plus, UserRoundCheck, UserRoundMinus, UsersRound, Wallet } from "lucide-react";
import { useState } from "react";

const STATUS_TONE: Record<EmployeeStatus, "green" | "amber" | "gray" | "coral"> = {
  active: "green",
  on_leave: "amber",
  terminated: "gray",
  resigned: "coral",
};

export default function EmployeesPage() {
  const { can } = usePermissions();
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [rawSearch, setRawSearch] = useState("");
  const [editing, setEditing] = useState<Employee | null | "new">(null);
  const search = useDebouncedValue(rawSearch, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["hr", "employees", { status, departmentId, search }],
    queryFn: () =>
      hrApi.employees({
        status: status || undefined,
        department_id: departmentId || undefined,
        search: search || undefined,
      }),
  });

  const employees = data?.employees ?? [];
  const stats = data?.stats;
  const { page, totalPages, pageItems, setPage } = usePagination(employees, 10, [status, departmentId, search]);

  const resetFilters = () => {
    setStatus("");
    setDepartmentId("");
    setRawSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard icon={UsersRound} label="Employees" value={stats?.total ?? "-"} tone="purple" active={!status} onClick={resetFilters} />
        <KpiCard icon={UserRoundCheck} label="Active" value={stats?.active ?? "-"} tone="green" active={status === "active"} onClick={() => setStatus("active")} />
        <KpiCard icon={CircleDot} label="On leave" value={stats?.on_leave ?? "-"} tone="amber" active={status === "on_leave"} onClick={() => setStatus("on_leave")} />
        <KpiCard icon={UserRoundMinus} label="Inactive" value={stats?.inactive ?? "-"} tone="gray" active={status === "resigned"} onClick={() => setStatus("resigned")} />
        <KpiCard icon={Wallet} label="Monthly salary" value={stats ? formatCurrency(stats.monthly_salary) : "-"} tone="sky" />
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Input placeholder="Search employee, code, phone..." value={rawSearch} onChange={(e) => setRawSearch(e.target.value)} className="h-10 w-full max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
            <option value="resigned">Resigned</option>
          </Select>
          <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 w-auto">
            <option value="">All departments</option>
            {(data?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
          <PermissionGate permission="hr.employees.manage">
            <Button size="sm" className="ml-auto" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" aria-hidden /> Add employee
            </Button>
          </PermissionGate>
        </div>

        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : employees.length === 0 ? (
          <EmptyState icon={UsersRound} title="No employees found" hint="Add staff members to start using payroll." />
        ) : (
          <>
            <ul>
              {pageItems.map((employee) => (
                <li key={employee.id} className="flex flex-wrap items-center gap-4 border-b border-border/60 px-4 py-4 transition-colors last:border-0 hover:bg-background">
                  <Avatar name={employee.full_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {employee.full_name}
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{employee.employee_code}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {employee.department_name ?? "No department"}
                      {employee.designation_name ? ` - ${employee.designation_name}` : ""}
                      {employee.phone ? ` - ${employee.phone}` : ""}
                    </p>
                  </div>
                  <div className="hidden min-w-[120px] text-right sm:block">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(employee.basic_salary)}</p>
                    <p className="text-xs text-muted-foreground">joined {formatDate(employee.date_of_joining)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[employee.status]}>{employee.status.replace("_", " ")}</Badge>
                  {can("hr.employees.manage") ? (
                    <Button variant="ghost" size="iconSm" aria-label="Edit employee" onClick={() => setEditing(employee)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <EmployeeFormModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        employee={editing && editing !== "new" ? editing : null}
        departments={data?.departments ?? []}
        designations={data?.designations ?? []}
        shifts={data?.shifts ?? []}
        users={data?.users ?? []}
      />
    </div>
  );
}
