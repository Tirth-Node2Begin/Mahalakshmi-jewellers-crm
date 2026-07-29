# 07 — Basic HRMS Module

> Slimmed port of the Extrabits CRM HR module: employees, departments/designations, shifts,
> attendance (punch in/out + manual), leaves (types/requests/balances), and **simple** payroll
> integrated with the expense module's Salary category. **Explicitly no policy engine** — no
> attendance/overtime/incentive/statutory policy tables, no salary structures, no performance
> reviews, no employee lifecycle events.

---

## 1. Concepts & Simplifications vs old CRM

| Old CRM | LeadSpark |
|---|---|
| 218KB EnterpriseHRService, policy engine, statutory | Plain `HRService` + `PayrollService`, fixed simple rules |
| Payroll = components, structures, policies, snapshots | Payroll item = basic salary prorated by attendance + manual bonus/deduction |
| Shifts with rotation, night allowance, JSON dept mapping | Shift = name, in/out time, grace min, working days, week-off days |
| Faculty/teaching categories | employee_type only (full_time/part_time/contract/intern) |
| organization_id + branch_id everywhere | neither |

Fixed payroll rules (documented, hard-coded, no config UI — one consistent model):
- **Working days** of month = days in month − week-offs (from employee's shift) − holidays.
- **Per-day rate** = basic_salary / working days.
- **Payable days** = `present_days (incl. late) + half_days × 0.5 + paid_leave_days − floor(late_count/3) × 0.5`
  (last term = late penalty, see below). Week-offs and holidays are **not** added back: they are
  already paid implicitly via the reduced denominator. A fully-present employee with no lates
  nets exactly `basic_salary`.
- **Net** = per-day rate × payable days + bonus − deduction (bonus/deduction manual per item).
- **Late rule**: check-in later than shift start + `grace_minutes` marks the attendance row
  `late` (still a paid present day). At payroll time, every 3 lates in the pay period deduct
  0.5 payable days (`floor(late_count/3) × 0.5`); the counter resets each pay period.
  `payroll_items.late_count` stores the period's count for the payslip.
- **Worked example**: 30-day month, 4 week-offs + 1 holiday → working days = 25;
  employee present 22 (of which 4 late), 1 half-day, 1 paid leave, 1 absent, rest
  week-off/holiday → payable = 22 + 0.5 + 1 − floor(4/3)×0.5 = 23.0 →
  net = basic × 23.0/25 + bonus − deduction.

Leave balance lifecycle (no cron, no policy engine):
- **Lazy allocation**: whenever `apply_leave` or a balance read touches an
  (employee, leave_type, year) with no `leave_balances` row, the row is created with
  `allocated = leave_type.max_days_per_year`. No proration for mid-year joiners (documented
  simplification). Changing a leave type's quota does **not** retro-update existing year rows.
- HR can adjust an individual allocation via `adjust_leave_balance` (`hr.leaves.manage`).

---

## 2. Database Tables

```sql
departments
  id PK, name VARCHAR(100) NOT NULL UNIQUE, head_employee_id INT NULL FK employees SET NULL,
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP

designations
  id PK, name VARCHAR(100) NOT NULL, department_id INT NULL FK departments SET NULL,
  level INT DEFAULT 0, is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP

shifts
  id PK, name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL, end_time TIME NOT NULL,
  grace_minutes INT DEFAULT 10,
  working_days VARCHAR(60) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
  week_off_days VARCHAR(60) DEFAULT 'Sun',
  is_default TINYINT(1) DEFAULT 0, is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP

employees
  id PK,
  employee_code VARCHAR(20) NOT NULL UNIQUE,        -- EMP-0001 (number_sequences)
  user_id INT NULL UNIQUE FK users SET NULL,        -- optional login link
  first_name VARCHAR(80) NOT NULL, last_name VARCHAR(80),
  email VARCHAR(150), phone VARCHAR(20),
  gender ENUM('male','female','other') NULL, date_of_birth DATE NULL,
  date_of_joining DATE NOT NULL,
  department_id INT NULL FK departments SET NULL,
  designation_id INT NULL FK designations SET NULL,
  shift_id INT NULL FK shifts SET NULL,
  reporting_manager_id INT NULL FK employees SET NULL,
  employee_type ENUM('full_time','part_time','contract','intern') DEFAULT 'full_time',
  address VARCHAR(255), city VARCHAR(100),
  emergency_contact_name VARCHAR(100), emergency_contact_phone VARCHAR(20),
  bank_name VARCHAR(120), bank_account_no VARCHAR(40), bank_ifsc VARCHAR(20),
  pan_number VARCHAR(20), aadhar_number VARCHAR(20),
  basic_salary DECIMAL(12,2) DEFAULT 0,
  status ENUM('active','on_leave','terminated','resigned') DEFAULT 'active',
  photo_path VARCHAR(500) NULL,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (status), (department_id), (user_id)

employee_attendance
  id PK, employee_id FK employees CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIME NULL, check_out TIME NULL,
  status ENUM('present','absent','half_day','late','on_leave','holiday','week_off') NOT NULL,
  worked_minutes INT DEFAULT 0, late_minutes INT DEFAULT 0,
  source ENUM('punch','manual') DEFAULT 'manual',
  remarks VARCHAR(255),
  marked_by INT NULL FK users SET NULL, created_at TIMESTAMP, updated_at TIMESTAMP
  UNIQUE (employee_id, attendance_date)
  INDEX (attendance_date)

leave_types
  id PK, name VARCHAR(80) NOT NULL UNIQUE, code VARCHAR(10) NOT NULL UNIQUE,
  is_paid TINYINT(1) DEFAULT 1, max_days_per_year DECIMAL(5,1) DEFAULT 12,
  is_active TINYINT(1) DEFAULT 1
  -- seed: CL (casual,12), SL (sick,6), LWP (unpaid, 0 quota-free)

leave_requests
  id PK, employee_id FK employees CASCADE, leave_type_id FK leave_types,
  start_date DATE NOT NULL, end_date DATE NOT NULL, total_days DECIMAL(5,1) NOT NULL,
  reason VARCHAR(500),
  status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  approved_by INT NULL FK users SET NULL, approved_at DATETIME NULL,
  rejection_reason VARCHAR(255), created_at TIMESTAMP
  INDEX (employee_id), (status), (start_date)

leave_balances
  id PK, employee_id FK employees CASCADE, leave_type_id FK leave_types, year SMALLINT NOT NULL,
  allocated DECIMAL(5,1) DEFAULT 0, used DECIMAL(5,1) DEFAULT 0
  UNIQUE (employee_id, leave_type_id, year)
  -- rows are lazily created on first touch with allocated = leave_type.max_days_per_year (§1)

holidays
  id PK, name VARCHAR(120) NOT NULL, holiday_date DATE NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1, created_by INT NULL FK users SET NULL

payroll_runs
  id PK, pay_period CHAR(7) NOT NULL UNIQUE,        -- 'YYYY-MM'
  status ENUM('draft','completed','paid') DEFAULT 'draft',
  total_employees INT DEFAULT 0, total_gross DECIMAL(14,2) DEFAULT 0,
  total_deductions DECIMAL(14,2) DEFAULT 0, total_net DECIMAL(14,2) DEFAULT 0,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP, computed_at DATETIME NULL

payroll_items
  id PK, payroll_run_id FK payroll_runs CASCADE, employee_id FK employees,
  basic_salary DECIMAL(12,2), working_days DECIMAL(5,1), payable_days DECIMAL(5,1),
  present_days DECIMAL(5,1), half_days INT, paid_leave_days DECIMAL(5,1),
  unpaid_leave_days DECIMAL(5,1), late_count INT,
  gross DECIMAL(12,2), bonus DECIMAL(12,2) DEFAULT 0, deduction DECIMAL(12,2) DEFAULT 0,
  deduction_note VARCHAR(255), net DECIMAL(12,2),
  status ENUM('draft','finalized','paid') DEFAULT 'draft',
  paid_at DATETIME NULL, expense_id INT NULL FK expenses SET NULL,  -- ← expense-module link
  UNIQUE (payroll_run_id, employee_id)
```

---

## 3. API — `/api/hr.php` (module/action dispatch, ported style)

GET `?module=` · POST `action=` · JSON envelope per [02](02-backend-architecture.md).

| Method | module / action | Permission | Notes |
|---|---|---|---|
| GET | `stats` | `hr.read` | headcount, by dept, present today, on leave today, pending leave requests |
| GET | `employees` (`&id=`) | `hr.read` | list w/ dept/designation/shift joins + search/dept/status filters; detail incl. attendance summary (this month), leave balances, payroll history |
| GET | `attendance` | `hr.attendance.read` | `?date=` day grid (all active employees × status) or `?employee_id=&month=` |
| GET | `leaves` | `hr.leaves.read` | requests w/ filters (status, employee, type); balances per employee |
| GET | `payroll` (`&run_id=`) | `hr.payroll.read` | runs list; run detail with items |
| GET | `departments` / `designations` / `shifts` / `leave_types` / `holidays` | `hr.read` | masters |
| GET | `my` | *(any authenticated employee-linked user)* | self-service: my attendance this month, my leave balances/requests, punch state |
| POST | `save_employee` | `hr.employees.manage` | create/update; create issues EMP code. Login accounts live in Settings → Users: the Add-user modal offers an unlinked-employee picker and links `employees.user_id` atomically with role assignment (amended 2026-07-03 — replaces the in-wizard "create login" step) |
| POST | `punch_in` / `punch_out` | *(self)* | upsert today's attendance from server clock; computes late vs shift + grace |
| POST | `mark_attendance` | `hr.attendance.manage` | manual upsert `{employee_id, date, status, check_in?, check_out?, remarks}` (bulk array supported) |
| POST | `apply_leave` | *(self)* or `hr.leaves.manage` | validates balance (paid types; lazy-creates the balance row per §1), overlap check |
| POST | `approve_leave` / `reject_leave` | `hr.leaves.approve` | approve → writes `on_leave` attendance rows for the span + increments balance.used; notify employee |
| POST | `cancel_leave` | *(self, while pending)* | — |
| POST | `adjust_leave_balance` | `hr.leaves.manage` | `{employee_id, leave_type_id, year, allocated}` — manual per-employee override, audited |
| POST | `save_department` / `save_designation` / `save_shift` / `save_leave_type` / `save_holiday` (+ toggles) | `hr.settings.manage` | masters CRUD; delete blocked when referenced |
| POST | `create_payroll_run` | `hr.payroll.manage` | `{pay_period}` → creates run + computes all items from attendance (draft) |
| POST | `recompute_payroll` | `hr.payroll.manage` | re-derives items (only while draft) |
| POST | `update_payroll_item` | `hr.payroll.manage` | set bonus/deduction/note (draft only) → recompute net |
| POST | `finalize_payroll` | `hr.payroll.manage` | draft → completed (locks items) |
| POST | `pay_salary` | `hr.payroll.pay` | `{item_id(s), payment_date, payment_mode, bank_account_id?}` → **transaction**: insert `expenses` row (system Salary category, `fixed_cost_item` = the employee's system item), upsert the `fixed_cost_monthly_payments` row (paid, amount, date, expense_id, payroll_item_id), link `payroll_items.expense_id`, mark item paid. Mirrors old CRM's bidirectional salary↔expense sync |
| POST | `unpay_salary` | `hr.payroll.pay` | symmetric **transaction**: delete the expense row · clear `payroll_items.expense_id`/`paid_at` and set status back to `finalized` · reset the matching `fixed_cost_monthly_payments` row to `pending` (paid_amount 0, payment_date NULL, expense_id NULL, payroll_item_id NULL) — both ledgers revert together |

Payroll ↔ Expenses contract (ported): the Salary expense category has `is_system=1,
system_key='SALARY'`; each employee gets an auto-managed `fixed_cost_items` row
(`employee_id` FK, unique per category+employee). Paying salary writes the expense +
`fixed_cost_monthly_payments` upsert so the Fixed-Cost Tracker shows salaries paid.
The tracker itself is read-only for salary: `monthly.php` rejects salary items with 403 and a
pointer to `/hr/payroll` — salaries are paid ONLY here
(see [10-module-expenses.md](10-module-expenses.md) §1 Concepts & §4 Page 3; API rule in §3).

---

## 4. Frontend Pages

| Route | Content |
|---|---|
| `/hr` | HR dashboard: headcount KPIs, today's attendance donut (present/absent/leave/late), pending leave approvals list, upcoming holidays, department distribution bar |
| `/hr/employees` (+ `?id=` detail) | list: search/dept/status filters, card-table w/ photo, code, dept/designation, status pill; **Add Employee** wizard (Personal → Job → Salary & Bank → Login account optional). Detail: profile tabs — Overview, Attendance (month calendar grid), Leaves (balances + history), Payroll (items history), Documents (phase 2) |
| `/hr/attendance` | date-picker day view: grid of all employees w/ status cell dropdown (bulk mark), punch times, late highlight; month view per employee; export CSV |
| `/hr/leaves` | pending approvals queue (approve/reject inline), all-requests table w/ filters, balances tab |
| `/hr/payroll` | runs list (period, status, totals); run detail: items table (attendance-derived numbers, editable bonus/deduction while draft), Finalize button, per-item / bulk **Pay** (mode + bank account), payslip print (browser print pattern) |
| `/hr/settings` | tabs: Departments, Designations, Shifts, Leave Types, Holidays — simple CRUD cards |
| `/my` (self-service) | my punch in/out button (big, shows state + today's time), my month attendance, my leave balances + apply-leave form, my payslips |

---

## 5. Permissions

`hr.read · hr.employees.manage · hr.attendance.read · hr.attendance.manage ·
hr.leaves.read · hr.leaves.manage · hr.leaves.approve · hr.payroll.read · hr.payroll.manage ·
hr.payroll.pay · hr.settings.manage`

Role defaults: Admin all · HR all · Manager hr.read + hr.attendance.read + **hr.leaves.read** +
hr.leaves.approve (read is required to load the approvals queue) · Accountant hr.payroll.read/pay ·
every employee-linked user gets self-service (`/my`) implicitly.

---

## 6. Alignment

- **Expenses** ([10](10-module-expenses.md)): salary payments are expense rows (system category);
  Fixed-Cost Tracker shows them; expense analytics include payroll spend automatically.
- **Users/RBAC** ([08](08-module-rbac.md)): employee ↔ user link is optional; creating a login from
  the employee form assigns a role; deactivating an employee offers to deactivate the login.
- **Reports** ([14](14-reports-analytics.md)): attendance %, leave usage, payroll cost trend,
  department cost split.
- **Notifications**: leave request → approvers; approval/rejection → employee; payroll paid → employee.
- **Holidays** feed attendance status + payroll working-day math + can render on works/leads
  meeting pickers (warn when scheduling on a holiday).
