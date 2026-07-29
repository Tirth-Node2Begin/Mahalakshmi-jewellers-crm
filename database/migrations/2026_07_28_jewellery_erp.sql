-- =====================================================================
-- Jewellers CRM/ERP — convert the inherited CRM schema into the jewellery
-- ERP defined in plan/01-database-schema.md
--
--   1. drop lead-CRM / HRMS / integration / website / orders / repairs
--   2. RENAME the jewellery columns the base schema already had
--      (gross_wt → gross_weight, metal_type → metal, jw_status → status …)
--      so one naming convention runs through the whole codebase
--   3. add what was genuinely missing: purity master + daily rates, the
--      double-entry accounting core, estimates, old-metal exchange,
--      vendor payments, and the weight-aware stock ledger columns
--
-- Written to run ONCE on a database freshly loaded from schema.sql.
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. DROP — modules removed from this product
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS lead_activities;
DROP TABLE IF EXISTS lead_followups;
DROP TABLE IF EXISTS meeting_customers;
DROP TABLE IF EXISTS meeting_users;
DROP TABLE IF EXISTS lead_meetings;
DROP TABLE IF EXISTS lead_services;
DROP TABLE IF EXISTS lead_drop_reasons;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS lead_sources;
DROP TABLE IF EXISTS work_comments;
DROP TABLE IF EXISTS works;
DROP TABLE IF EXISTS services;

DROP TABLE IF EXISTS payroll_items;
DROP TABLE IF EXISTS payroll_runs;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS leave_types;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS employee_attendance;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS designations;
DROP TABLE IF EXISTS departments;

DROP TABLE IF EXISTS integration_sync_log;
DROP TABLE IF EXISTS integration_posts;
DROP TABLE IF EXISTS integration_reviews;
DROP TABLE IF EXISTS integration_keywords;
DROP TABLE IF EXISTS integration_metrics_daily;
DROP TABLE IF EXISTS integration_locations;
DROP TABLE IF EXISTS integration_accounts;

DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS repair_status_history;
DROP TABLE IF EXISTS repairs;

-- website/marketing (created by website_db_migrations.sql, may not exist)
DROP TABLE IF EXISTS blogs;
DROP TABLE IF EXISTS blog_categories;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS enquiries;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS catalog_products;
DROP TABLE IF EXISTS catalog_categories;

-- ---------------------------------------------------------------------
-- 2. PURITIES & DAILY METAL RATES
-- ---------------------------------------------------------------------
CREATE TABLE purities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  metal ENUM('gold','silver') NOT NULL,
  code VARCHAR(10) NOT NULL,                       -- 24K, 22K, 18K, 999, 925
  label VARCHAR(40) NOT NULL,
  fineness DECIMAL(6,4) NOT NULL,                  -- 22K = 0.9160
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purities_code (metal, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE metal_rates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rate_date DATE NOT NULL,
  purity_id INT UNSIGNED NOT NULL,
  rate_per_gram DECIMAL(12,2) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metal_rates_day (rate_date, purity_id),
  KEY idx_metal_rates_date (rate_date),
  CONSTRAINT fk_metal_rates_purity FOREIGN KEY (purity_id) REFERENCES purities(id) ON DELETE RESTRICT,
  CONSTRAINT fk_metal_rates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. ACCOUNTING CORE — chart of accounts + double-entry vouchers
-- ---------------------------------------------------------------------
CREATE TABLE account_groups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  parent_id INT UNSIGNED NULL,                     -- max depth 2 (enforced in code)
  nature ENUM('asset','liability','income','expense') NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_account_groups_parent (parent_id),
  CONSTRAINT fk_account_groups_parent FOREIGN KEY (parent_id) REFERENCES account_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ledger_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(30) NULL,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  opening_type ENUM('dr','cr') NOT NULL DEFAULT 'dr',
  -- lets services resolve system ledgers without hardcoding ids
  linked_type ENUM('cash','bank','customer','vendor','gst_output','gst_input',
                   'inventory','sales','making','old_metal','expense','cogs',
                   'discount','round_off','opening_equity','stock_adjust') NULL,
  linked_id INT UNSIGNED NULL,                     -- customer_id / supplier_id / bank_account_id
  metal ENUM('gold','silver') NULL,                -- inventory/sales ledgers split by metal
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ledger_accounts_code (code),
  KEY idx_ledger_accounts_group (group_id),
  KEY idx_ledger_accounts_linked (linked_type, linked_id),
  CONSTRAINT fk_ledger_accounts_group FOREIGN KEY (group_id) REFERENCES account_groups(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vouchers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_no VARCHAR(30) NOT NULL,
  vtype ENUM('sale','purchase','receipt','payment','expense','journal','contra','adjustment','opening') NOT NULL,
  vdate DATE NOT NULL,
  narration VARCHAR(255) NULL,
  ref_type VARCHAR(30) NULL,                       -- invoice | purchase | expense | stock_adjustment …
  ref_id INT UNSIGNED NULL,
  status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NULL,
  cancelled_by INT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  cancel_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vouchers_no (voucher_no),
  KEY idx_vouchers_date (vdate, status),
  KEY idx_vouchers_ref (ref_type, ref_id),
  KEY idx_vouchers_type (vtype, status),
  CONSTRAINT fk_vouchers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE voucher_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_id INT UNSIGNED NOT NULL,
  ledger_id INT UNSIGNED NOT NULL,
  dr_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cr_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  narration VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_voucher_entries_voucher (voucher_id),
  KEY idx_voucher_entries_ledger (ledger_id),
  CONSTRAINT fk_voucher_entries_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_voucher_entries_ledger FOREIGN KEY (ledger_id) REFERENCES ledger_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. INVENTORY — rename the existing jewellery columns, add what's missing
-- ---------------------------------------------------------------------
ALTER TABLE inventory_items
  DROP FOREIGN KEY IF EXISTS fk_inventory_vendor;

ALTER TABLE inventory_items
  DROP COLUMN IF EXISTS source_order_id,
  DROP COLUMN IF EXISTS show_on_website,
  DROP COLUMN IF EXISTS purity,                    -- replaced by purity_id
  MODIFY item_type ENUM('raw_material','stock','old_metal') NOT NULL DEFAULT 'stock',
  CHANGE metal_type   metal         ENUM('gold','silver') NULL,
  CHANGE gross_wt     gross_weight  DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE net_wt       net_weight    DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE stone_wt     stone_weight  DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE making_charge making_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  CHANGE jw_status    status        ENUM('in_stock','sold','removed') NOT NULL DEFAULT 'in_stock',
  ADD COLUMN purity_id INT UNSIGNED NULL AFTER metal,
  ADD COLUMN tracking ENUM('tagged','bulk') NOT NULL DEFAULT 'bulk' AFTER purity_id,
  ADD COLUMN making_type ENUM('per_gram','fixed','percent') NOT NULL DEFAULT 'per_gram' AFTER stone_weight,
  ADD COLUMN huid VARCHAR(10) NULL AFTER making_value,
  ADD COLUMN photo_path VARCHAR(255) NULL AFTER barcode,
  ADD UNIQUE KEY uq_inventory_items_huid (huid),
  ADD KEY idx_inventory_items_metal (metal, purity_id),
  ADD KEY idx_inventory_items_status (status, tracking),
  ADD CONSTRAINT fk_inventory_items_purity FOREIGN KEY (purity_id) REFERENCES purities(id) ON DELETE RESTRICT;

-- weight-aware stock ledger + link to the accounting voucher
ALTER TABLE inventory_transactions
  DROP FOREIGN KEY IF EXISTS fk_inv_txn_work;

ALTER TABLE inventory_transactions
  DROP COLUMN IF EXISTS work_id,
  MODIFY reason ENUM('purchase','sale','adjustment','opening','old_metal_in','production','return') NOT NULL,
  ADD COLUMN weight DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER qty,
  ADD COLUMN rate_per_gram DECIMAL(12,2) NULL AFTER weight,
  ADD COLUMN value DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER rate_per_gram,
  ADD COLUMN voucher_id INT UNSIGNED NULL AFTER invoice_id,
  ADD COLUMN adjustment_reason VARCHAR(255) NULL AFTER notes,
  ADD KEY idx_inventory_txn_voucher (voucher_id),
  ADD KEY idx_inventory_txn_item_date (item_id, created_at),
  ADD CONSTRAINT fk_inventory_txn_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 5. PARTIES — accounting fields
-- ---------------------------------------------------------------------
ALTER TABLE suppliers
  ADD COLUMN vendor_code VARCHAR(20) NULL AFTER id,
  ADD COLUMN whatsapp VARCHAR(20) NULL AFTER mobile,
  ADD COLUMN opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER address,
  ADD COLUMN opening_type ENUM('dr','cr') NOT NULL DEFAULT 'cr' AFTER opening_balance,
  ADD UNIQUE KEY uq_suppliers_code (vendor_code);

ALTER TABLE customers
  DROP FOREIGN KEY IF EXISTS fk_customers_source_lead;

ALTER TABLE customers
  DROP COLUMN IF EXISTS source_lead_id,
  ADD COLUMN whatsapp VARCHAR(20) NULL AFTER mobile,
  ADD COLUMN opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER address,
  ADD COLUMN opening_type ENUM('dr','cr') NOT NULL DEFAULT 'dr' AFTER opening_balance;

-- ---------------------------------------------------------------------
-- 6. BILLING — walk-in support, draft lifecycle, old metal, GST treatment
-- ---------------------------------------------------------------------
ALTER TABLE invoices
  DROP FOREIGN KEY IF EXISTS fk_invoices_work;

ALTER TABLE invoices
  DROP COLUMN IF EXISTS work_id,
  MODIFY customer_id INT UNSIGNED NULL,                       -- NULL = walk-in
  MODIFY invoice_no VARCHAR(30) NULL,                         -- NULL while draft
  MODIFY status ENUM('draft','final','cancelled') NOT NULL DEFAULT 'draft',
  CHANGE old_gold_adjustment old_metal_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN walkin_name VARCHAR(150) NULL AFTER customer_id,
  ADD COLUMN walkin_phone VARCHAR(20) NULL AFTER walkin_name,
  ADD COLUMN price_mode ENUM('exclusive','inclusive') NOT NULL DEFAULT 'exclusive' AFTER invoice_date,
  ADD COLUMN estimate_id INT UNSIGNED NULL AFTER price_mode,
  ADD COLUMN metal_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER subtotal,
  ADD COLUMN making_total DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER metal_total,
  ADD COLUMN round_off DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER old_metal_value,
  ADD COLUMN voucher_id INT UNSIGNED NULL AFTER paid_amount,
  ADD COLUMN finalized_at DATETIME NULL AFTER voucher_id,
  ADD COLUMN cancelled_by INT UNSIGNED NULL AFTER finalized_at,
  ADD COLUMN cancelled_at DATETIME NULL AFTER cancelled_by,
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER cancelled_at,
  ADD KEY idx_invoices_voucher (voucher_id),
  ADD CONSTRAINT fk_invoices_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;

ALTER TABLE invoice_items
  DROP FOREIGN KEY IF EXISTS fk_invoice_items_service;

ALTER TABLE invoice_items
  DROP COLUMN IF EXISTS service_id,
  MODIFY item_type ENUM('tagged','bulk','making','custom') NOT NULL DEFAULT 'tagged',
  CHANGE metal_type metal         VARCHAR(30) NULL,
  CHANGE gross_wt   gross_weight  DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE net_wt     net_weight    DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE stone_wt   stone_weight  DECIMAL(10,3) NOT NULL DEFAULT 0,
  CHANGE purity     purity_code   VARCHAR(10) NULL,
  ADD COLUMN rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER net_weight,
  ADD COLUMN metal_value DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER rate_per_gram,
  ADD COLUMN cost_value DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER making_charge,   -- COGS snapshot
  ADD COLUMN tax_treatment ENUM('taxable','exempt','nil_rated','non_gst','reverse_charge')
      NOT NULL DEFAULT 'taxable' AFTER tax_rate,
  ADD COLUMN exempt_reason VARCHAR(120) NULL AFTER tax_treatment,
  ADD COLUMN cgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_amount,
  ADD COLUMN sgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cgst,
  ADD COLUMN igst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sgst;

-- old metal taken in exchange on a bill
CREATE TABLE invoice_old_metal (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  metal ENUM('gold','silver') NOT NULL,
  purity_id INT UNSIGNED NULL,
  description VARCHAR(150) NULL,
  gross_weight DECIMAL(10,3) NOT NULL DEFAULT 0,
  deduction_pct DECIMAL(5,2) NOT NULL DEFAULT 0,     -- melting/refining deduction
  net_weight DECIMAL(10,3) NOT NULL DEFAULT 0,
  rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0,
  value DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_invoice_old_metal_invoice (invoice_id),
  CONSTRAINT fk_invoice_old_metal_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_old_metal_purity FOREIGN KEY (purity_id) REFERENCES purities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE invoice_payments
  MODIFY invoice_id INT UNSIGNED NULL,                        -- NULL = on-account receipt
  ADD COLUMN customer_id INT UNSIGNED NULL AFTER invoice_id,
  ADD COLUMN voucher_id INT UNSIGNED NULL AFTER notes,
  ADD COLUMN status ENUM('active','cancelled') NOT NULL DEFAULT 'active' AFTER voucher_id,
  ADD KEY idx_invoice_payments_customer (customer_id),
  ADD CONSTRAINT fk_invoice_payments_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_invoice_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 7. ESTIMATES / QUOTATIONS — no stock, no ledger, not a bill
-- ---------------------------------------------------------------------
CREATE TABLE estimates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estimate_no VARCHAR(30) NOT NULL,
  customer_id INT UNSIGNED NULL,
  walkin_name VARCHAR(150) NULL,
  walkin_phone VARCHAR(20) NULL,
  estimate_date DATE NOT NULL,
  valid_until DATE NULL,
  price_mode ENUM('exclusive','inclusive') NOT NULL DEFAULT 'exclusive',
  metal_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  making_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_estimate DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  status ENUM('open','converted','expired','cancelled') NOT NULL DEFAULT 'open',
  converted_invoice_id INT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estimates_no (estimate_no),
  KEY idx_estimates_customer (customer_id),
  KEY idx_estimates_status (status, estimate_date),
  CONSTRAINT fk_estimates_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_estimates_invoice FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_estimates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE estimate_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  estimate_id INT UNSIGNED NOT NULL,
  inventory_item_id INT UNSIGNED NULL,             -- may quote an item not yet in stock
  description VARCHAR(255) NOT NULL,
  purity_code VARCHAR(10) NULL,
  qty DECIMAL(12,3) NOT NULL DEFAULT 1,
  gross_weight DECIMAL(10,3) NOT NULL DEFAULT 0,
  net_weight DECIMAL(10,3) NOT NULL DEFAULT 0,
  rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0,
  metal_value DECIMAL(14,2) NOT NULL DEFAULT 0,
  making_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_estimate_items_estimate (estimate_id),
  CONSTRAINT fk_estimate_items_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
  CONSTRAINT fk_estimate_items_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE invoices
  ADD CONSTRAINT fk_invoices_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 8. PURCHASES — weights, GST split, vendor payments
-- ---------------------------------------------------------------------
ALTER TABLE purchases
  MODIFY status ENUM('draft','received','cancelled') NOT NULL DEFAULT 'received',
  ADD COLUMN cgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_total,
  ADD COLUMN sgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cgst,
  ADD COLUMN igst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sgst,
  ADD COLUMN round_off DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER igst,
  ADD COLUMN paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER grand_total,
  ADD COLUMN voucher_id INT UNSIGNED NULL AFTER paid_amount,
  ADD COLUMN cancel_reason VARCHAR(255) NULL AFTER notes,
  ADD KEY idx_purchases_voucher (voucher_id),
  ADD CONSTRAINT fk_purchases_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;

ALTER TABLE purchase_items
  MODIFY item_id INT UNSIGNED NULL,                -- NULL for service / making-charge lines
  ADD COLUMN description VARCHAR(255) NULL AFTER item_id,
  ADD COLUMN metal ENUM('gold','silver') NULL AFTER description,
  ADD COLUMN purity_id INT UNSIGNED NULL AFTER metal,
  ADD COLUMN weight DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER qty,
  ADD COLUMN rate_per_gram DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER weight,
  ADD COLUMN making_charge DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER rate_per_gram,
  ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_rate,
  ADD CONSTRAINT fk_purchase_items_purity FOREIGN KEY (purity_id) REFERENCES purities(id) ON DELETE SET NULL;

CREATE TABLE vendor_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_no VARCHAR(30) NOT NULL,
  supplier_id INT UNSIGNED NOT NULL,
  purchase_id INT UNSIGNED NULL,                   -- NULL = on-account
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash','bank','upi','cheque','card') NOT NULL DEFAULT 'cash',
  bank_account_id INT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  ref_no VARCHAR(60) NULL,                         -- UTR / cheque number
  notes VARCHAR(255) NULL,
  voucher_id INT UNSIGNED NULL,
  status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendor_payments_no (payment_no),
  KEY idx_vendor_payments_supplier (supplier_id, status),
  KEY idx_vendor_payments_purchase (purchase_id),
  CONSTRAINT fk_vendor_payments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_vendor_payments_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  CONSTRAINT fk_vendor_payments_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
  CONSTRAINT fk_vendor_payments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. EXPENSES — link to the accounting voucher
-- ---------------------------------------------------------------------
ALTER TABLE expenses
  ADD COLUMN voucher_id INT UNSIGNED NULL,
  ADD COLUMN ledger_id INT UNSIGNED NULL,
  ADD KEY idx_expenses_voucher (voucher_id),
  ADD CONSTRAINT fk_expenses_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_expenses_ledger FOREIGN KEY (ledger_id) REFERENCES ledger_accounts(id) ON DELETE SET NULL;

-- employee_id sits inside a composite unique index, so the indexes go first
ALTER TABLE fixed_cost_items
  DROP FOREIGN KEY IF EXISTS fk_fixed_items_employee;
ALTER TABLE fixed_cost_items
  DROP INDEX IF EXISTS uq_fixed_items_employee,
  DROP INDEX IF EXISTS idx_fixed_items_employee;
ALTER TABLE fixed_cost_items
  DROP COLUMN IF EXISTS employee_id;

SET FOREIGN_KEY_CHECKS = 1;
