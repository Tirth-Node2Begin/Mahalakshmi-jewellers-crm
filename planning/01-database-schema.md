# 01 — Database Schema (authoritative)

> Single source of truth for `database/schema.sql`. MySQL/MariaDB, InnoDB, `utf8mb4_unicode_ci`.
> Conventions: snake_case plural tables · `id INT UNSIGNED PK AUTO_INCREMENT` · money
> `DECIMAL(12,2)` (run totals 14,2) · quantities `DECIMAL(12,3)` · `created_at TIMESTAMP DEFAULT
> CURRENT_TIMESTAMP`, `updated_at … ON UPDATE CURRENT_TIMESTAMP` where rows mutate · FK naming
> `fk_<table>_<col>` · every FK indexed. **No `branch_id`, no `organization_id` anywhere.**
> 61 tables (59 at launch + meeting_customers/meeting_users, added 2026-07-03).
> Module rationale lives in docs 05–13; this file is the column truth.
> Payment-mode vocabulary is unified across invoice_payments / expenses / purchases:
> `('cash','upi','bank','card','cheque')` — the UI label "Bank Transfer" always normalizes to `bank`.

Legend: `→T` = FK to table T (`ON DELETE` noted: C=CASCADE, SN=SET NULL, R=RESTRICT).

---

## A. Auth, RBAC & Audit (10) — rationale [08](08-module-rbac.md)

```sql
users (
  id, username VARCHAR(60) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL, email VARCHAR(150) NULL UNIQUE, mobile VARCHAR(20),
  avatar_color VARCHAR(7), is_active TINYINT(1) DEFAULT 1,
  must_change_password TINYINT(1) DEFAULT 0,
  last_login_at DATETIME, password_changed_at DATETIME, created_at, updated_at )

roles (
  id, name VARCHAR(60) NOT NULL UNIQUE, display_name VARCHAR(100) NOT NULL,
  description VARCHAR(255), data_scope ENUM('all','own') DEFAULT 'all',
  is_system TINYINT(1) DEFAULT 0, is_active TINYINT(1) DEFAULT 1, created_at )

permissions (
  id, resource VARCHAR(60) NOT NULL, action VARCHAR(40) NOT NULL,
  description VARCHAR(255), is_active TINYINT(1) DEFAULT 1,
  UNIQUE uq_permission (resource, action) )

role_permission_grants (
  id, role_id →roles C, permission_id →permissions C,
  UNIQUE uq_grant (role_id, permission_id) )

user_role_assignments (
  id, user_id →users C, role_id →roles C, is_active TINYINT(1) DEFAULT 1,
  expires_at DATETIME NULL, assigned_by →users SN, assigned_at TIMESTAMP,
  UNIQUE uq_assignment (user_id, role_id) )

auth_sessions (
  id, user_id →users C, refresh_token_hash CHAR(64) NOT NULL UNIQUE,
  previous_refresh_token_hash CHAR(64), ip_address VARCHAR(45), user_agent VARCHAR(255),
  revoked_at DATETIME, revoke_reason VARCHAR(60), expires_at DATETIME NOT NULL,
  last_used_at DATETIME, created_at )

password_reset_otps (
  id, user_id →users C, otp_hash CHAR(64) NOT NULL, reset_token_hash CHAR(64),
  attempts TINYINT DEFAULT 0, expires_at DATETIME NOT NULL, used_at DATETIME, created_at )

api_rate_limits (
  id, rate_key CHAR(64) NOT NULL UNIQUE, bucket VARCHAR(60) NOT NULL,
  attempts INT DEFAULT 0, window_started_at DATETIME NOT NULL )

audit_logs (
  id, user_id →users SN, action VARCHAR(100) NOT NULL, entity_type VARCHAR(80),
  entity_id INT, old_values JSON, new_values JSON, ip_address VARCHAR(45), created_at,
  INDEX (entity_type, entity_id), INDEX (user_id), INDEX (created_at) )

security_audit_logs (
  id, user_id INT NULL, event VARCHAR(60) NOT NULL, ip_address VARCHAR(45),
  user_agent VARCHAR(255), meta JSON, created_at, INDEX (user_id), INDEX (event) )
```

## B. Core shared (3) — rationale [02](02-backend-architecture.md)

```sql
settings ( id, skey VARCHAR(60) NOT NULL UNIQUE, svalue TEXT, updated_by →users SN, updated_at )

number_sequences (
  id, seq_key VARCHAR(30) NOT NULL, period VARCHAR(10) NOT NULL DEFAULT '',
  prefix VARCHAR(10) NOT NULL, next_number INT NOT NULL DEFAULT 1, padding TINYINT DEFAULT 5,
  UNIQUE uq_sequence (seq_key, period) )
  -- seq_keys: invoice/receipt/purchase (period=FY code '2627'), customer/work/employee/
  --           item_rm/item_st (period='')

notifications (
  id, user_id →users C, type VARCHAR(80) NOT NULL, title VARCHAR(150) NOT NULL,
  body VARCHAR(500), entity_type VARCHAR(40), entity_id INT, link_url VARCHAR(255),
  is_read TINYINT(1) DEFAULT 0, read_at DATETIME, created_at,
  INDEX (user_id, is_read), INDEX (created_at) )
```

## C. Leads (7) — rationale [05](05-module-leads.md)

```sql
lead_sources ( id, name VARCHAR(100) NOT NULL UNIQUE, is_active TINYINT(1) DEFAULT 1, created_at )

leads (
  id, name VARCHAR(120) NOT NULL, mobile VARCHAR(20), email VARCHAR(150),
  company VARCHAR(150), city VARCHAR(100),
  source_id →lead_sources SN, source_detail VARCHAR(255),
  channel_type ENUM('walk_in','phone','website','whatsapp','facebook','instagram','google',
                    'referral','other') DEFAULT 'other',
  entry_type ENUM('manual','import','api','webhook') DEFAULT 'manual',
  platform_lead_id VARCHAR(150) NULL UNIQUE,
  service_interest VARCHAR(255), expected_value DECIMAL(12,2),
  status ENUM('New','Contacted','Qualified','Meeting Scheduled','Meeting Done','Proposal Sent',
              'Negotiation','Converted','Dropped','Lost') DEFAULT 'New',
  assigned_to →users SN, created_by →users SN,
  referred_by_customer_id →customers SN, referred_by_lead_id →leads SN,
  customer_id →customers SN, converted_at DATETIME,
  dropped_at DATETIME, drop_reason VARCHAR(255), drop_reason_desc TEXT,
  tags_json JSON, ai_score DECIMAL(5,2), ai_classification VARCHAR(100),
  notes TEXT, lead_date DATE, created_at, updated_at,
  INDEX (status), (mobile), (email), (source_id), (assigned_to), (created_at), (created_by) )

lead_services ( id, lead_id →leads C, service_id →services C, UNIQUE (lead_id, service_id) )

lead_followups (
  id, lead_id →leads C, scheduled_date DATE NOT NULL, scheduled_time TIME,
  status ENUM('Pending','Completed','Cancelled') DEFAULT 'Pending',   -- Overdue is computed, never stored
  completed_at DATETIME, outcome VARCHAR(150), notes TEXT,
  is_auto TINYINT(1) DEFAULT 0, auto_step TINYINT DEFAULT 0,
  created_by →users SN, created_at,
  INDEX (scheduled_date, status), INDEX (lead_id) )

lead_meetings (  -- 2026-07-03: lead optional (standalone meetings), title, created_by, participants
  id, lead_id →leads C NULL, title VARCHAR(200), meeting_date DATE NOT NULL, start_time TIME, end_time TIME,
  mode ENUM('in_person','call','video') DEFAULT 'in_person', location VARCHAR(255),
  assigned_to →users SN, attended TINYINT(1) DEFAULT 0, outcome_notes TEXT, created_by →users SN, created_at,
  INDEX (meeting_date), (lead_id), (assigned_to) )
  -- standalone meetings (lead_id NULL) require a title; own-scope visibility =
  -- creator / organiser / team participant / owner of the attached lead

meeting_customers (  -- "clients" attending a meeting
  id, meeting_id →lead_meetings C, customer_id →customers C,
  UNIQUE (meeting_id, customer_id), INDEX (customer_id) )

meeting_users (  -- team members attending a meeting
  id, meeting_id →lead_meetings C, user_id →users C,
  UNIQUE (meeting_id, user_id), INDEX (user_id) )

lead_activities (
  id, lead_id →leads C, activity_type VARCHAR(80) NOT NULL, description TEXT,
  old_status VARCHAR(80), new_status VARCHAR(80), created_by →users SN, created_at,
  INDEX (lead_id), INDEX (created_at) )

lead_drop_reasons ( id, name VARCHAR(150) NOT NULL UNIQUE, is_active TINYINT(1) DEFAULT 1, created_at )
```

## D. Customers & Works (5) — rationale [06](06-module-customers-lifecycle.md)

```sql
services (
  id, name VARCHAR(150) NOT NULL UNIQUE, description VARCHAR(255),
  default_rate DECIMAL(12,2), is_active TINYINT(1) DEFAULT 1, created_at )

customers (
  id, customer_code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  company VARCHAR(150), gstin VARCHAR(20), mobile VARCHAR(20), email VARCHAR(150),
  address VARCHAR(255), city VARCHAR(100), state VARCHAR(100), pincode VARCHAR(10),
  stage ENUM('onboarding','active','inactive','churned') DEFAULT 'onboarding',
  assigned_to →users SN, source_lead_id →leads SN, referred_by_customer_id →customers SN,
  notes TEXT, tags_json JSON, is_active TINYINT(1) DEFAULT 1,
  created_by →users SN, created_at, updated_at,
  INDEX (stage), (mobile), (email), (assigned_to), (created_at) )

works (
  id, work_code VARCHAR(20) NOT NULL UNIQUE, customer_id →customers C,
  title VARCHAR(200) NOT NULL, description TEXT, service_id →services SN,
  status ENUM('pending','in_progress','on_hold','review','completed','cancelled')
         DEFAULT 'pending',
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  assigned_to →users SN, start_date DATE, due_date DATE, completed_at DATETIME,
  estimated_amount DECIMAL(12,2), created_by →users SN, created_at, updated_at,
  INDEX (customer_id), (status), (assigned_to), (due_date) )

work_comments ( id, work_id →works C, comment TEXT NOT NULL, created_by →users SN, created_at,
  INDEX (work_id) )

customer_events (
  id, customer_id →customers C, event_type VARCHAR(60) NOT NULL, description VARCHAR(500),
  ref_table VARCHAR(40), ref_id INT, created_by →users SN, created_at,
  INDEX (customer_id), INDEX (created_at) )
```

## E. Invoices (3) — rationale [09](09-module-invoices-billing.md)

```sql
invoices (
  id, invoice_no VARCHAR(30) NOT NULL UNIQUE, customer_id →customers R, work_id →works SN,
  invoice_date DATE NOT NULL, due_date DATE,
  status ENUM('draft','sent','partially_paid','paid','cancelled') DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0, discount_total DECIMAL(12,2) DEFAULT 0,
  tax_total DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0, notes VARCHAR(500), terms VARCHAR(1000),
  created_by →users SN, created_at, updated_at,
  INDEX (customer_id), (status), (invoice_date), (due_date) )

invoice_items (
  id, invoice_id →invoices C,
  item_type ENUM('service','stock','custom') DEFAULT 'service',
  service_id →services SN, inventory_item_id →inventory_items SN,
  description VARCHAR(255) NOT NULL, qty DECIMAL(12,3) NOT NULL DEFAULT 1, unit VARCHAR(20),
  rate DECIMAL(12,2) NOT NULL DEFAULT 0, discount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0, tax_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0, sort_order INT DEFAULT 0, INDEX (invoice_id) )

invoice_payments (
  id, invoice_id →invoices R, receipt_no VARCHAR(30) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL, payment_date DATE NOT NULL,
  payment_mode ENUM('cash','upi','bank','card','cheque') DEFAULT 'cash',
  bank_account_id →bank_accounts SN,
  cheque_number VARCHAR(50), cheque_date DATE, cheque_bank VARCHAR(100),
  cheque_status ENUM('pending','deposited','cleared','bounced') NULL,
  cheque_cleared_at DATETIME, notes VARCHAR(500), created_by →users SN, created_at,
  INDEX (invoice_id), INDEX (payment_date) )
```

## F. Expenses (6) — rationale [10](10-module-expenses.md)

```sql
expense_categories (
  id, name VARCHAR(120) NOT NULL UNIQUE, type ENUM('fixed','variable') DEFAULT 'variable',
  is_active TINYINT(1) DEFAULT 1, is_system TINYINT(1) DEFAULT 0,
  system_key VARCHAR(50) NULL UNIQUE, created_at )
  -- seeded system rows: (SALARY, fixed), (INVENTORY_PURCHASE, variable)

fixed_cost_items (
  id, category_id →expense_categories C, employee_id →employees C NULL,
  name VARCHAR(120) NOT NULL, amount DECIMAL(12,2) DEFAULT 0, notes TEXT,
  is_system TINYINT(1) DEFAULT 0, status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0, created_at,
  UNIQUE (category_id, name), UNIQUE (category_id, employee_id) )

expenses (
  id, expense_date DATE NOT NULL, category_id →expense_categories R,
  fixed_cost_item_id →fixed_cost_items SN,
  type ENUM('fixed','variable') DEFAULT 'variable', amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255), paid_to VARCHAR(150), notes TEXT,
  payment_mode ENUM('cash','bank','upi','cheque','card') DEFAULT 'cash',
  bank_account_id →bank_accounts SN, ref_table VARCHAR(40), ref_id INT,
  created_by →users SN, created_at,
  INDEX (expense_date, category_id), (fixed_cost_item_id), (bank_account_id) )

fixed_cost_monthly_payments (
  id, fixed_cost_item_id →fixed_cost_items R, month TINYINT NOT NULL, year SMALLINT NOT NULL,
  paid_amount DECIMAL(12,2) DEFAULT 0, payment_status ENUM('paid','pending') DEFAULT 'pending',
  payment_date DATE, expense_id →expenses SN, payroll_item_id →payroll_items SN,
  UNIQUE uq_tracker (fixed_cost_item_id, month, year) )

expense_reminders (
  id, category_id →expense_categories C, fixed_cost_item_id →fixed_cost_items SN,
  due_day TINYINT NOT NULL, amount DECIMAL(12,2) DEFAULT 0, description VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1 )

bank_accounts (
  id, account_name VARCHAR(120) NOT NULL, bank_name VARCHAR(120), account_number VARCHAR(40),
  ifsc_code VARCHAR(20), upi_id VARCHAR(120), qr_code_path VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1, created_at )
```

## G. Inventory (7) — rationale [11](11-module-inventory.md)

```sql
inventory_categories (
  id, name VARCHAR(100) NOT NULL, item_type ENUM('raw_material','stock') NOT NULL,
  is_active TINYINT(1) DEFAULT 1, created_at, UNIQUE (name, item_type) )

units ( id, name VARCHAR(30) NOT NULL UNIQUE, short_name VARCHAR(10) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1 )

suppliers (
  id, name VARCHAR(150) NOT NULL, company VARCHAR(150), gstin VARCHAR(20), mobile VARCHAR(20),
  email VARCHAR(150), address VARCHAR(255), city VARCHAR(100), notes TEXT,
  is_active TINYINT(1) DEFAULT 1, created_by →users SN, created_at )

inventory_items (
  id, item_code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
  item_type ENUM('raw_material','stock') NOT NULL, category_id →inventory_categories SN,
  unit_id →units R, current_stock DECIMAL(12,3) DEFAULT 0, avg_cost DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2), reorder_level DECIMAL(12,3) DEFAULT 0,
  description VARCHAR(255), is_active TINYINT(1) DEFAULT 1,
  created_by →users SN, created_at, updated_at,
  INDEX (item_type), (category_id), (name) )
-- Unit rules (2026-07): stock items are ALWAYS unit pcs (whole numbers — server-enforced);
-- raw materials use g/kg (metals) or ct (diamonds). diamond_ct/diamond_pcs (jewellery ALTER
-- block) hold per-piece diamond content on stock items, or stones-in-lot for ct raw lots.

inventory_transactions (
  id, item_id →inventory_items R, type ENUM('in','out') NOT NULL,
  reason ENUM('purchase','production','adjustment_in','sale_reversal',       -- in
              'sale','work_issue','production_consume','adjustment_out',     -- out
              'damage','purchase_reversal') NOT NULL,
  -- sale_reversal (in): invoice cancel / sent-edit qty decrease, invoice_id set,
  --   unit_cost = original sale row's avg-cost snapshot
  -- purchase_reversal (out): cancelling a received purchase, purchase_id set
  qty DECIMAL(12,3) NOT NULL, unit_cost DECIMAL(12,2) DEFAULT 0,
  purchase_id →purchases SN, invoice_id →invoices SN, work_id →works SN,
  production_batch VARCHAR(30), notes VARCHAR(255), created_by →users SN, created_at,
  INDEX (item_id, created_at), (reason), (work_id), (invoice_id), (purchase_id) )

purchases (
  id, purchase_no VARCHAR(30) NOT NULL UNIQUE, supplier_id →suppliers R,
  purchase_date DATE NOT NULL, status ENUM('draft','received','cancelled') DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0, tax_total DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  payment_status ENUM('unpaid','paid') DEFAULT 'unpaid',
  payment_mode ENUM('cash','bank','upi','cheque','card') NULL, bank_account_id →bank_accounts SN,
  expense_id →expenses SN, invoice_ref VARCHAR(60), notes TEXT,
  created_by →users SN, created_at, updated_at,
  INDEX (supplier_id), (status), (purchase_date) )

purchase_items (
  id, purchase_id →purchases C, item_id →inventory_items R, qty DECIMAL(12,3) NOT NULL,
  rate DECIMAL(12,2) NOT NULL, tax_rate DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL, INDEX (purchase_id) )
```

## H. HRMS (11) — rationale [07](07-module-hrms.md)

```sql
departments ( id, name VARCHAR(100) NOT NULL UNIQUE, head_employee_id →employees SN,
  is_active TINYINT(1) DEFAULT 1, created_at )

designations ( id, name VARCHAR(100) NOT NULL, department_id →departments SN,
  level INT DEFAULT 0, is_active TINYINT(1) DEFAULT 1, created_at )

shifts (
  id, name VARCHAR(100) NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
  grace_minutes INT DEFAULT 10, working_days VARCHAR(60) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
  week_off_days VARCHAR(60) DEFAULT 'Sun', is_default TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1, created_at )

employees (
  id, employee_code VARCHAR(20) NOT NULL UNIQUE, user_id →users SN NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL, last_name VARCHAR(80), email VARCHAR(150),
  phone VARCHAR(20), gender ENUM('male','female','other'), date_of_birth DATE,
  date_of_joining DATE NOT NULL, department_id →departments SN, designation_id →designations SN,
  shift_id →shifts SN, reporting_manager_id →employees SN,
  employee_type ENUM('full_time','part_time','contract','intern') DEFAULT 'full_time',
  address VARCHAR(255), city VARCHAR(100),
  emergency_contact_name VARCHAR(100), emergency_contact_phone VARCHAR(20),
  bank_name VARCHAR(120), bank_account_no VARCHAR(40), bank_ifsc VARCHAR(20),
  pan_number VARCHAR(20), aadhar_number VARCHAR(20), basic_salary DECIMAL(12,2) DEFAULT 0,
  status ENUM('active','on_leave','terminated','resigned') DEFAULT 'active',
  photo_path VARCHAR(500), created_by →users SN, created_at, updated_at,
  INDEX (status), (department_id) )

employee_attendance (
  id, employee_id →employees C, attendance_date DATE NOT NULL, check_in TIME, check_out TIME,
  status ENUM('present','absent','half_day','late','on_leave','holiday','week_off') NOT NULL,
  worked_minutes INT DEFAULT 0, late_minutes INT DEFAULT 0,
  source ENUM('punch','manual') DEFAULT 'manual', remarks VARCHAR(255),
  marked_by →users SN, created_at, updated_at,
  UNIQUE uq_attendance (employee_id, attendance_date), INDEX (attendance_date) )

leave_types ( id, name VARCHAR(80) NOT NULL UNIQUE, code VARCHAR(10) NOT NULL UNIQUE,
  is_paid TINYINT(1) DEFAULT 1, max_days_per_year DECIMAL(5,1) DEFAULT 12,
  is_active TINYINT(1) DEFAULT 1 )

leave_requests (
  id, employee_id →employees C, leave_type_id →leave_types R,
  start_date DATE NOT NULL, end_date DATE NOT NULL, total_days DECIMAL(5,1) NOT NULL,
  reason VARCHAR(500), status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  approved_by →users SN, approved_at DATETIME, rejection_reason VARCHAR(255), created_at,
  INDEX (employee_id), (status), (start_date) )

leave_balances ( id, employee_id →employees C, leave_type_id →leave_types C, year SMALLINT NOT NULL,
  allocated DECIMAL(5,1) DEFAULT 0, used DECIMAL(5,1) DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year) )

holidays ( id, name VARCHAR(120) NOT NULL, holiday_date DATE NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1, created_by →users SN )

payroll_runs (
  id, pay_period CHAR(7) NOT NULL UNIQUE, status ENUM('draft','completed','paid') DEFAULT 'draft',
  total_employees INT DEFAULT 0, total_gross DECIMAL(14,2) DEFAULT 0,
  total_deductions DECIMAL(14,2) DEFAULT 0, total_net DECIMAL(14,2) DEFAULT 0,
  created_by →users SN, created_at, computed_at DATETIME )

payroll_items (
  id, payroll_run_id →payroll_runs C, employee_id →employees R,
  basic_salary DECIMAL(12,2), working_days DECIMAL(5,1), payable_days DECIMAL(5,1),
  present_days DECIMAL(5,1), half_days INT, paid_leave_days DECIMAL(5,1),
  unpaid_leave_days DECIMAL(5,1), late_count INT, gross DECIMAL(12,2),
  bonus DECIMAL(12,2) DEFAULT 0, deduction DECIMAL(12,2) DEFAULT 0,
  deduction_note VARCHAR(255), override_net DECIMAL(12,2) NULL, net DECIMAL(12,2),
  status ENUM('draft','finalized','paid') DEFAULT 'draft', paid_at DATETIME,
  expense_id →expenses SN, UNIQUE (payroll_run_id, employee_id) )
```

## I. Integrations (7) — rationale [12](12-dashboard-google.md) / [13](13-dashboard-facebook.md)

```sql
integration_accounts (
  id, provider ENUM('google','facebook') NOT NULL, user_id →users SN,   -- who connected
  -- ONE ROW PER LOGIN IDENTITY: external_account_id = Google `sub` (openid) / FB user id.
  -- A Google identity may own several GBP accounts — those live on the locations
  -- (integration_locations.extra.gbp_account), not as extra rows here.
  external_account_id VARCHAR(128) NOT NULL, account_name VARCHAR(150),
  email VARCHAR(150),                -- from openid email (google) / email permission (facebook)
  access_token TEXT NULL,            -- encrypted; google: 1h token cache; fb: long-lived user token
  access_token_expires_at DATETIME NULL,
  refresh_token TEXT NULL,           -- encrypted; google only
  scopes TEXT, status ENUM('active','revoked','error') DEFAULT 'active',
  last_synced_at DATETIME, created_at, updated_at,
  UNIQUE (provider, external_account_id) )

integration_locations (               -- GBP locations & FB pages
  id, integration_account_id →integration_accounts C, external_id VARCHAR(128) NOT NULL,
  name VARCHAR(200), address VARCHAR(255),
  asset_token TEXT NULL,              -- encrypted; fb: page access token; google: NULL
                                      -- (never serialized into any API response — structural guarantee)
  extra JSON,                         -- DISPLAYABLE metadata only (safe to echo):
                                      -- fb: {category, fan_count, picture_url, last_error?}
                                      -- google: {gbp_account: 'accounts/123', category, maps_uri}
  is_enabled TINYINT(1) DEFAULT 1, created_at, updated_at,
  UNIQUE (integration_account_id, external_id) )

integration_metrics_daily (
  id, integration_location_id →integration_locations C, metric VARCHAR(64) NOT NULL,
  date DATE NOT NULL, value BIGINT DEFAULT 0,
  UNIQUE uq_metric (integration_location_id, metric, date) )

integration_keywords (
  id, integration_location_id →integration_locations C, month DATE NOT NULL,
  keyword VARCHAR(255) NOT NULL, impressions INT DEFAULT 0, is_threshold TINYINT(1) DEFAULT 0,
  UNIQUE (integration_location_id, month, keyword) )

integration_reviews (
  id, integration_location_id →integration_locations C, external_review_id VARCHAR(128) UNIQUE,
  rating TINYINT, reviewer_name VARCHAR(150), comment TEXT, reply TEXT,
  reviewed_at DATETIME, replied_at DATETIME, synced_at DATETIME )

integration_posts (
  id, integration_location_id →integration_locations C, external_post_id VARCHAR(128) UNIQUE,
  message TEXT, media_type VARCHAR(32), permalink VARCHAR(512),
  posted_at DATETIME,                 -- stored in app timezone (TIMEZONE env, Asia/Kolkata):
                                      -- sync converts Graph's UTC created_time before insert
                                      -- (same rule for integration_reviews.reviewed_at)
  views_unique INT DEFAULT 0, clicks INT DEFAULT 0, reactions INT DEFAULT 0,
  comments INT DEFAULT 0, shares INT DEFAULT 0, engagement INT DEFAULT 0, synced_at DATETIME )

integration_sync_log (
  id, integration_account_id →integration_accounts C,
  kind ENUM('metrics','keywords','reviews','locations','posts','token','backfill') NOT NULL,
  status ENUM('pending','running','success','error') NOT NULL, message TEXT, ran_at DATETIME,
  INDEX (integration_account_id, ran_at) )
  -- status='running' row = the per-account concurrency lock (12 §9)
  -- kind='backfill' status='pending' rows = the first-connect backfill cursor drained by the
  -- 5-minute cron (message tracks chunk progress, e.g. 'chunks 3/8 done') — see 02 §6
```

---

## J. Relationship Map (cross-module glue)

```
leads.customer_id ──────────────► customers (conversion)
customers ◄─ works ◄─ work_comments        customers ◄─ customer_events (timeline)
works.service_id / leads↔lead_services / invoice_items.service_id ──► services (one catalog)
invoices.customer_id / invoices.work_id    invoice_payments.bank_account_id ─► bank_accounts
invoice_items.inventory_item_id ─► inventory_items (stock sale)
inventory_transactions.{purchase_id, invoice_id, work_id} (ledger provenance)
purchases.expense_id ─► expenses (system INVENTORY_PURCHASE)
payroll_items.expense_id ─► expenses (system SALARY) ◄─ fixed_cost_monthly_payments.payroll_item_id
employees.user_id ─► users (optional login)   *.assigned_to / created_by ─► users
integration_* chain: accounts ► locations ► metrics/keywords/reviews/posts
```

Circular-reference note: `leads.customer_id → customers` and `customers.source_lead_id → leads`
— create `leads` first without the customer FKs, `customers` next, then add the two FKs via
`ALTER TABLE` at the end of schema.sql (same for `departments.head_employee_id ↔ employees`).

## K. Seed Data (`database/seed.php`)

1. Permissions catalog (from [03-api-list.md](03-api-list.md) §8) + 8 roles + grants matrix.
2. `super admin` user (`admin` / `admin123`, must_change_password=0 — ready to use).
3. Masters: units (pcs/kg/g/l/m/box/set), leave types (CL/SL/LWP), default shift (10:00–19:00,
   Sun off), lead drop reasons, starter lead sources (Website, Referral, Walk-in, Facebook,
   Google), expense system categories (SALARY fixed, INVENTORY_PURCHASE variable) + starter
   categories (Rent fixed, Utilities fixed, Travel, Office Supplies, Marketing).
4. `number_sequences` rows — explicit seed set:
   | seq_key | period | prefix | padding | example |
   |---|---|---|---|---|
   | invoice | current FY code ('2627') | INV- | 5 | INV-2627-00001 |
   | receipt | current FY code | RCPT- | 5 | RCPT-2627-00001 |
   | purchase | current FY code | PO- | 5 | PO-2627-00001 |
   | customer | '' | CUST- | 4 | CUST-0001 |
   | work | '' | WRK- | 4 | WRK-0001 |
   | employee | '' | EMP- | 4 | EMP-0001 |
   | item_rm | '' | RM- | 4 | RM-0001 |
   | item_st | '' | ST- | 4 | ST-0001 |

   Fiscal sequences roll by inserting the next FY's row on first allocation of the new year.
5. `settings` defaults (company profile placeholders, default tax 18, invoice terms).
