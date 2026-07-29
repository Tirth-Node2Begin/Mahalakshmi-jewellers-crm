# 10 — Expenses Module (the 4 pages, ported)

> Faithful port of the Extrabits CRM expense module — the exact 4-page experience the user asked
> for — minus branches and the academic-year window (replaced by fiscal year Apr–Mar).
> Pages: **Daily Expenses**, **Expense Insights**, **Fixed-Cost Monthly Tracker**, **Categories**
> (+ the shared Bank Accounts page and per-category tracker drill-down, kept as in the original).

---

## 1. Concepts (ported)

- **Two expense types**: `Variable` (daily, ad-hoc; categorized) and `Fixed` (recurring monthly
  obligations: rent, salaries, utilities — tracked month-by-month).
- **Category → items**: Fixed categories contain `fixed_cost_items` (e.g. Rent → "Office rent
  ₹25,000", "Godown rent ₹8,000") with default amounts; Variable categories are flat.
- **Monthly tracker**: matrix of Fixed items × 12 months; "Pay" writes a real `expenses` row AND
  upserts `fixed_cost_monthly_payments` (unique item+month+year) — single source of truth for
  spend stays the `expenses` table.
- **System categories are locked** (`is_system=1`): **SALARY** (managed by payroll,
  [07](07-module-hrms.md)) and **INVENTORY_PURCHASE** (managed by purchases,
  [11](11-module-inventory.md)). Locked means: excluded from every ExpenseModal category
  dropdown, `expenses.php create` returns 403 for a system category_id (only the internal
  writers — PayrollService, PurchaseService — post rows there), category/items non-editable,
  tracker Salary row read-only. UI cards deep-link: Salary → `/hr/payroll`,
  Inventory Purchase → `/inventory/purchases`.
- **Payment modes**: `Cash, UPI, Bank Transfer, Card, Cheque` (UI) → normalized to DB enum
  `cash,upi,bank,card,cheque` (ported normalization); non-cash requires bank account when
  accounts exist.
- **Split expense**: selecting multiple fixed-cost items divides the amount evenly, one row per
  item, in one transaction (ported).
- **Expense reminders**: `due_day`-based recurring reminders feeding the notifications system.

Changes vs old CRM: no `branch_id`; fiscal year Apr 1–Mar 31 replaces June academic year
(quarters Q1=Apr-Jun … Q4=Jan-Mar); prepared statements everywhere (old `categories.php`/
`bank_accounts.php` string-SQL not carried); attachments/approval flows remain out of scope
(same as original).

---

## 2. Database Tables

```sql
expense_categories
  id PK, name VARCHAR(120) NOT NULL UNIQUE,
  type ENUM('fixed','variable') DEFAULT 'variable',
  is_active TINYINT(1) DEFAULT 1,
  is_system TINYINT(1) DEFAULT 0, system_key VARCHAR(50) NULL UNIQUE,  -- 'SALARY','INVENTORY_PURCHASE'
  created_at TIMESTAMP

fixed_cost_items
  id PK, category_id FK expense_categories CASCADE,
  employee_id INT NULL FK employees CASCADE,       -- salary linkage (system rows)
  name VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,                  -- default monthly amount
  notes TEXT NULL, is_system TINYINT(1) DEFAULT 0,
  status ENUM('active','inactive') DEFAULT 'active', sort_order INT DEFAULT 0,
  created_at TIMESTAMP
  UNIQUE (category_id, name), UNIQUE (category_id, employee_id)

expenses
  id PK, expense_date DATE NOT NULL,
  category_id FK expense_categories,               -- RESTRICT (delete guarded anyway)
  fixed_cost_item_id INT NULL FK fixed_cost_items SET NULL,
  type ENUM('fixed','variable') DEFAULT 'variable',
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255), paid_to VARCHAR(150), notes TEXT,
  payment_mode ENUM('cash','bank','upi','cheque','card') DEFAULT 'cash',
  bank_account_id INT NULL FK bank_accounts SET NULL,
  ref_table VARCHAR(40) NULL, ref_id INT NULL,     -- 'payroll_items' / 'purchases' back-links
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (expense_date, category_id), (fixed_cost_item_id), (bank_account_id)

fixed_cost_monthly_payments
  id PK, fixed_cost_item_id FK fixed_cost_items,   -- RESTRICT while payments exist
  month TINYINT NOT NULL, year SMALLINT NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  payment_status ENUM('paid','pending') DEFAULT 'pending',
  payment_date DATE NULL,
  expense_id INT NULL FK expenses SET NULL,        -- the generated spend row
  payroll_item_id INT NULL FK payroll_items SET NULL
  UNIQUE (fixed_cost_item_id, month, year)         -- drives the upsert

expense_reminders
  id PK, category_id FK expense_categories, fixed_cost_item_id INT NULL FK fixed_cost_items SET NULL,
  due_day TINYINT NOT NULL, amount DECIMAL(12,2) DEFAULT 0,
  description VARCHAR(255), is_active TINYINT(1) DEFAULT 1

bank_accounts                                       -- shared with invoice payments
  id PK, account_name VARCHAR(120) NOT NULL, bank_name VARCHAR(120),
  account_number VARCHAR(40), ifsc_code VARCHAR(20), upi_id VARCHAR(120),
  qr_code_path VARCHAR(500) NULL,                   -- uploads/qrs/qr_<hex>.<ext>
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP
```

---

## 3. API (ported endpoint-for-endpoint)

### `/api/expenses.php`
| Method | View/Action | Permission | Notes |
|---|---|---|---|
| GET | default list | `expenses.read` | `type, category_id, search` filters; returns expenses (FY-scoped), categories, subcategories(items), bankAccounts, KPIs (todayTotal, totalYear, fixedTotal, variableTotal), chart data (trend/category/payment) |
| GET | `view=daily&date=` | `expenses.read` | that day's rows + dayTotal + Variable categories + chartCategoryData |
| GET | `view=insights&period=&date=&compare_date=` | `expenses.read` | weekly/monthly/quarterly/yearly windows (FY quarters), dailyBreakdown, categoryBreakdown, paymentBreakdown, optional comparison block |
| POST | `create` | `expenses.create` | fields: category_id*, amount*>0, expense_date, type, description≤255, paid_to≤150, payment_mode, bank_account_id, notes; multi `fixed_cost_item_ids[]` → even split; Fixed type syncs monthly tracker upsert; **system category_id → 403** |
| POST | `update` | `expenses.update` | system-managed rows (salary/purchase-linked via ref_table, or system category) blocked → 403 |
| POST | `delete` | `expenses.delete` | same system guard; fixed rows also reset the corresponding tracker month row (fixed_cost_monthly_payments → pending, paid_amount 0, expense_id NULL — mirrors monthly.php unpay) |

### `/api/expense_categories.php` (old `categories.php`)
GET list (`expenses.read`) — categories w/ expense_count, total_volume, nested items w/ counts,
plus each category's `reminders[]` · `?unique_subcategories=1` ·
POST `add` (name, type, optional CSV subcategories) / `update` / `toggle` / `delete`
(only when zero usage across expenses+tracker+reminders) / `add_sub` / `update_sub` /
`toggle_sub` / `delete_sub` — system rows 403 (ported guards) ·
**reminder CRUD**: `save_reminder {id?, category_id, fixed_cost_item_id?, due_day(1-28), amount,
description}` (create=`expenses.create`, edit=`expenses.update`) / `toggle_reminder` /
`delete_reminder` (`expenses.delete`) — the producer for `expense_reminders`, consumed by the
daily_digest cron.

### `/api/monthly.php` (Fixed-Cost Tracker)
GET `?year=` (`expenses.read`) → categories+items+`tracker[cat][item][month]`+bankAccounts+
KPIs (completion %, paid_count/total_slots, total_paid, overdue, cat_count)+month_totals+year_total.
Salary months without a payroll run are neutral (never overdue) — ported.
POST `mark_paid` / `mark_bulk` / `mark_all` / `unpay` (`expenses.update`) — transactional
expense-write + tracker upsert. **Salary items are rejected with 403** ("managed by payroll →
/hr/payroll"); `mark_bulk`/`mark_all` silently skip salary items and report them in the response
(`skipped_salary: n`). Salaries are paid only via `hr.php pay_salary` ([07](07-module-hrms.md)),
which itself upserts the tracker.

### `/api/bank_accounts.php`
GET (`expenses.read` or `payments.create` — either grants view) ·
POST `save` (multipart; QR upload: finfo MIME whitelist jpeg/png/webp, ≤5MB, random name) /
`delete` (soft) — `bank_accounts.manage`.

---

## 4. Frontend Pages (the 4 + 2 support pages, ported UX)

### Page 1 — `/expenses` (Daily Expenses)
Single cached query (`expenses.php`, whole FY) — date navigation / type filter / search / sort /
"show all grouped-by-day" all client-side (ported). 4 clickable KPI cards (Today, Total,
Fixed→filter, Variable→filter) · proportional category color strip w/ chips + floating tooltip ·
control bar (search, payment-mode select, category select, amount sort, reset) · table + mobile
cards (Paid To, Category+item, type badge, description, payment pill, amount, edit/delete) ·
`ExpenseModal` (date, Variable category select, amount, paid to, mode, conditional bank account,
description) · header link → Insights.

### Page 2 — `/expenses/insights`
Period tabs Weekly/Monthly/Quarterly/Yearly + prev/next navigator + period picker modal
(FY-aware) + **Compare** toggle (side-by-side vs any previous period). KPI cards (Total Spent,
Categories|PrevTotal, Transactions|%Change). Charts (Recharts, dynamic import): TrendChart
(bars, comparison overlay), CategoryDonut (center total; dual in compare mode) w/ scrollable
legend + diff badges. Payment Modes panel (radial % gauges; two-column compare). Category
Comparison table in compare mode.

### Page 3 — `/expenses/monthly` (Fixed-Cost Tracker)
KPIs (Completion %, Total Paid, Overdue, Categories) · FY navigator · 12-month matrix
(rows = Fixed categories expandable to items; StatusButton states paid/partial/overdue-pulse/
upcoming; salary row locked) · tfoot month totals + grand total · `DetailModal` per
category+month: date/mode/bank/notes header, per-item pay/unpay, select-all bulk "Pay N · ₹X";
salary variant shows "Run Payroll" link. Mobile: stacked per-category cards.

### Page 4 — `/expenses/categories`
Tabs Fixed/Variable · KPIs (Total, Active Fixed, Active Variable) · CategoryCard grid (type
badge, ledger/expense counts, monthly estimated / total volume, edit/toggle/delete-guarded;
Fixed cards link "Manage" → drill-down; **both system cards locked**: Salary → `/hr/payroll`,
Inventory Purchase → `/inventory/purchases`) · CategoryModal (name + type toggle +
CSV subcategories on Fixed create).

### Support — `/expenses/monthly/category?id=` (drill-down, ported)
Fiscal-year 12-month tile grid (Apr→Mar order) w/ progress + status per month → PaymentModal;
sidebar item CRUD (add/edit/toggle/delete-guarded) **plus a Reminders section** (list + add/edit/
toggle/delete via the `save_reminder` family — due day, amount, description); salary read-only →
`/hr/payroll`.

### Support — `/settings/bank-accounts`
Account card grid, AccountModal (multipart QR upload), soft delete, ShareModal (QR display +
UPI QR fallback generator + WhatsApp share + **iframe print**) — ported whole.

---

## 5. Permissions

`expenses.read/create/update/delete · bank_accounts.manage`
Role defaults: Admin/Accountant all · Manager read · others none.

---

## 6. Alignment

- **HR Payroll** ([07](07-module-hrms.md)): Salary system category; pay/unpay round-trips both
  ledgers; tracker shows payroll state.
- **Inventory** ([11](11-module-inventory.md)): completed purchases post an expense row under
  system category `INVENTORY_PURCHASE` (`ref_table='purchases'`) so P&L includes procurement —
  editable only from the purchase, not the expense UI.
- **Invoices** ([09](09-module-invoices-billing.md)): shared bank_accounts; P&L pairing.
- **Reports** ([14](14-reports-analytics.md)): expense trend/category/mode charts are reused from
  Insights; P&L combines with invoice payments.
- **Notifications**: expense_reminders (due_day) + tracker overdue items → daily cron digest.
