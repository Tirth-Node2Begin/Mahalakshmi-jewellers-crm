"use client";

import { hrApi } from "@/features/hr/api";
import type { Department, Designation, Employee, Shift, UserOption } from "@/features/hr/types";
import { ApiError } from "@/shared/api/api-error";
import { Button } from "@/shared/ui/button";
import { Dialog } from "@/shared/ui/dialog";
import { FieldError, Input, Label } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { localDateString } from "@/shared/utils/format";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface FormState {
  id: number | null;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string;
  date_of_joining: string;
  department_id: string;
  designation_id: string;
  shift_id: string;
  employee_type: string;
  status: string;
  basic_salary: string;
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  pan_number: string;
  aadhar_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  city: string;
  address: string;
}

const emptyForm = (): FormState => ({
  id: null,
  user_id: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  date_of_birth: "",
  date_of_joining: localDateString(),
  department_id: "",
  designation_id: "",
  shift_id: "",
  employee_type: "full_time",
  status: "active",
  basic_salary: "",
  bank_name: "",
  bank_account_no: "",
  bank_ifsc: "",
  pan_number: "",
  aadhar_number: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  city: "",
  address: "",
});

function fromEmployee(employee?: Employee | null): FormState {
  if (!employee) return emptyForm();
  return {
    id: employee.id,
    user_id: employee.user_id ? String(employee.user_id) : "",
    first_name: employee.first_name ?? "",
    last_name: employee.last_name ?? "",
    email: employee.email ?? "",
    phone: employee.phone ?? "",
    gender: employee.gender ?? "",
    date_of_birth: employee.date_of_birth ?? "",
    date_of_joining: employee.date_of_joining ?? localDateString(),
    department_id: employee.department_id ? String(employee.department_id) : "",
    designation_id: employee.designation_id ? String(employee.designation_id) : "",
    shift_id: employee.shift_id ? String(employee.shift_id) : "",
    employee_type: employee.employee_type ?? "full_time",
    status: employee.status ?? "active",
    basic_salary: employee.basic_salary ? String(employee.basic_salary) : "",
    bank_name: employee.bank_name ?? "",
    bank_account_no: employee.bank_account_no ?? "",
    bank_ifsc: employee.bank_ifsc ?? "",
    pan_number: employee.pan_number ?? "",
    aadhar_number: employee.aadhar_number ?? "",
    emergency_contact_name: employee.emergency_contact_name ?? "",
    emergency_contact_phone: employee.emergency_contact_phone ?? "",
    city: employee.city ?? "",
    address: employee.address ?? "",
  };
}

export function EmployeeFormModal({
  open,
  onClose,
  employee,
  departments,
  designations,
  shifts,
  users,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
  departments: Department[];
  designations: Designation[];
  shifts: Shift[];
  users: UserOption[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isEdit = !!employee;

  useEffect(() => {
    if (open) {
      setForm(fromEmployee(employee));
      setErrors({});
    }
  }, [employee, open]);

  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      await hrApi.saveEmployee({
        id: form.id,
        user_id: form.user_id ? Number(form.user_id) : null,
        first_name: form.first_name,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        date_of_joining: form.date_of_joining,
        department_id: form.department_id ? Number(form.department_id) : null,
        designation_id: form.designation_id ? Number(form.designation_id) : null,
        shift_id: form.shift_id ? Number(form.shift_id) : null,
        employee_type: form.employee_type,
        status: form.status,
        basic_salary: form.basic_salary ? Number(form.basic_salary) : 0,
        bank_name: form.bank_name || null,
        bank_account_no: form.bank_account_no || null,
        bank_ifsc: form.bank_ifsc || null,
        pan_number: form.pan_number || null,
        aadhar_number: form.aadhar_number || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        city: form.city || null,
        address: form.address || null,
      });
      toast.success(isEdit ? "Employee updated." : "Employee created.");
      void queryClient.invalidateQueries({ queryKey: ["hr", "employees"] });
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.details) {
        setErrors(Object.fromEntries(Object.entries(e.details).map(([k, v]) => [k, String(v)])));
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save employee.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit employee" : "Add employee"}
      maxWidth={860}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save employee
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="emp_first" required>First name</Label>
            <Input id="emp_first" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus />
            <FieldError message={errors.first_name} />
          </div>
          <div>
            <Label htmlFor="emp_last">Last name</Label>
            <Input id="emp_last" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp_phone">Phone</Label>
            <Input id="emp_phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="emp_email">Email</Label>
            <Input id="emp_email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <FieldError message={errors.email} />
          </div>
          <div>
            <Label htmlFor="emp_gender">Gender</Label>
            <Select id="emp_gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="emp_dob">Date of birth</Label>
            <Input id="emp_dob" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-4">
          <div>
            <Label htmlFor="emp_join" required>Joining date</Label>
            <Input id="emp_join" type="date" value={form.date_of_joining} onChange={(e) => set("date_of_joining", e.target.value)} />
            <FieldError message={errors.date_of_joining} />
          </div>
          <div>
            <Label htmlFor="emp_dept">Department</Label>
            <Select id="emp_dept" value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">Not set</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="emp_desig">Designation</Label>
            <Select id="emp_desig" value={form.designation_id} onChange={(e) => set("designation_id", e.target.value)}>
              <option value="">Not set</option>
              {designations.map((designation) => (
                <option key={designation.id} value={designation.id}>{designation.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="emp_shift">Shift</Label>
            <Select id="emp_shift" value={form.shift_id} onChange={(e) => set("shift_id", e.target.value)}>
              <option value="">Default</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-4">
          <div>
            <Label htmlFor="emp_type">Type</Label>
            <Select id="emp_type" value={form.employee_type} onChange={(e) => set("employee_type", e.target.value)}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="emp_status">Status</Label>
            <Select id="emp_status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="terminated">Terminated</option>
              <option value="resigned">Resigned</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="emp_salary">Basic salary</Label>
            <Input id="emp_salary" value={form.basic_salary} onChange={(e) => set("basic_salary", e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label htmlFor="emp_user">Linked login</Label>
            <Select id="emp_user" value={form.user_id} onChange={(e) => set("user_id", e.target.value)}>
              <option value="">No login</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.full_name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="emp_bank">Bank</Label>
            <Input id="emp_bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp_account">Account no.</Label>
            <Input id="emp_account" value={form.bank_account_no} onChange={(e) => set("bank_account_no", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp_ifsc">IFSC</Label>
            <Input id="emp_ifsc" value={form.bank_ifsc} onChange={(e) => set("bank_ifsc", e.target.value.toUpperCase())} />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="emp_city">City</Label>
            <Input id="emp_city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="emp_emergency">Emergency contact</Label>
            <Input id="emp_emergency" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="emp_address">Address</Label>
          <Textarea id="emp_address" value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
        </div>
      </div>
    </Dialog>
  );
}
