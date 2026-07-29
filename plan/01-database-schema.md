# 01 — Database Schema (MySQL)

> ⚠️ **SUPERSEDED IN PART — read this first.** This document was written before the
> Sejal codebase was copied in. The **implemented** schema is
> `database/schema.sql` + `database/migrations/2026_07_28_jewellery_erp.sql`,
> which reuses the inherited tables instead of creating parallel ones:
> `suppliers` (not `vendors`), `inventory_items` (not `items`),
> `inventory_transactions` (not `stock_ledger`), `audit_logs`,
> `role_permission_grants` + `user_role_assignments`, and
> `number_sequences(seq_key, period)`. The inherited schema already carried
> jewellery columns, which the migration **renames** to one convention
> (`gross_wt → gross_weight`, `metal_type → metal`, `jw_status → status`,
> `old_gold_adjustment → old_metal_value`, `purity → purity_code`).
> The full deviation table is in `memory.md`. Everything below still describes
> the intended *shape* of the data and the rules that govern it.

> Original intent: authoritative schema for the Jewellers CRM MVP.
> Engine: MySQL/MariaDB, InnoDB, `utf8mb4`, timezone `Asia/Kolkata`, currency ₹.
> All money = `DECIMAL(12,2)`. All weights = `DECIMAL(10,3)` grams. All rates = `DECIMAL(10,2)` per gram.
> Every table: `id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`, `created_at DATETIME`, `updated_at DATETIME` unless noted.

---

## A. RBAC & Security (6 tables)

### 1. `users`
| column | type | notes |
|---|---|---|
| name | VARCHAR(100) | |
| username | VARCHAR(50) UNIQUE | login id |
| email | VARCHAR(150) NULL | |
| phone | VARCHAR(15) NULL | |
| password_hash | VARCHAR(255) | `password_hash()` bcrypt |
| role_id | FK → roles | one role per user |
| is_active | TINYINT(1) DEFAULT 1 | deactivate, never delete |
| last_login_at | DATETIME NULL | |

### 2. `roles`
| column | type | notes |
|---|---|---|
| name | VARCHAR(50) UNIQUE | Owner, Accountant, Cashier, Inventory Manager |
| description | VARCHAR(255) NULL | |
| is_system | TINYINT(1) | system roles cannot be deleted (Owner) |

### 3. `permissions`
| column | type | notes |
|---|---|---|
| code | VARCHAR(80) UNIQUE | `resource.action` e.g. `invoices.create` |
| label | VARCHAR(120) | human name shown in roles UI |
| module | VARCHAR(40) | grouping in UI (Billing, Inventory, Accounting…) |

Seeded from the permission catalog in `03-api-list.md` §8. No runtime insert.

### 4. `role_permissions`
`role_id` FK, `permission_id` FK, composite PK. Delete-and-reinsert on role save.

### 5. `refresh_tokens`
| column | type | notes |
|---|---|---|
| user_id | FK | |
| token_hash | CHAR(64) UNIQUE | sha256 of token |
| family_id | CHAR(36) | rotation family; reuse detection kills family |
| expires_at | DATETIME | |
| revoked_at | DATETIME NULL | |
| ip, user_agent | VARCHAR | |

### 6. `rate_limits`
`key` VARCHAR(120) (e.g. `login:{ip}`), `attempts` INT, `window_start` DATETIME. DB-based limiter.

---

## B. Audit (2 tables)

### 7. `audit_log`
| column | type | notes |
|---|---|---|
| user_id | FK NULL | |
| action | VARCHAR(40) | create / update / cancel / adjust / login / rate_set … |
| entity | VARCHAR(40) | invoice, purchase, item, voucher, user, role … |
| entity_id | BIGINT NULL | |
| details | JSON NULL | before/after diff for edits |
| ip | VARCHAR(45) | |
| created_at | DATETIME | no updated_at |

### 8. `login_history`
`user_id`, `ip`, `user_agent`, `success` TINYINT, `created_at`.

---

## C. Config & Sequences (4 tables)

### 9. `settings`
`skey` VARCHAR(60) UNIQUE, `svalue` TEXT. Shop name, address, GSTIN, invoice footer, default GST rates, fiscal-year start.

### 10. `number_sequences`
| column | type | notes |
|---|---|---|
| seq_key | VARCHAR(20) | INV, EST, PUR, RCPT, PAY, EXP, JRN, ADJ, CUST, VEN, ITM |
| fiscal_year | VARCHAR(4) NULL | e.g. `2627`; NULL for global (CUST/VEN/ITM) |
| next_number | INT UNSIGNED | |
| UNIQUE(seq_key, fiscal_year) | | |

**Rule:** read with `SELECT … FOR UPDATE` inside the caller's transaction, format, increment, all before commit. Formats: `INV-2627-00001` (pad 5, fiscal), `CUST-0001` (pad 4, global).

### 11. `purities`
| column | type | notes |
|---|---|---|
| metal | ENUM('gold','silver') | |
| code | VARCHAR(10) | 24K, 22K, 18K, 999, 925 |
| fineness | DECIMAL(6,4) | 22K = 0.9160, 925 = 0.9250 |
| is_active | TINYINT(1) | |

### 12. `metal_rates`
| column | type | notes |
|---|---|---|
| rate_date | DATE | |
| metal | ENUM('gold','silver') | |
| purity_id | FK → purities | |
| rate_per_gram | DECIMAL(10,2) | selling rate |
| created_by | FK users | |
| UNIQUE(rate_date, purity_id) | | re-entry same day = overwrite + audit |

---

## D. Accounting (4 tables)

### 13. `account_groups`
3-level tree: Group → Subgroup (parent_id) → ledgers hang off either level.
| column | type | notes |
|---|---|---|
| name | VARCHAR(80) | |
| parent_id | FK self NULL | max depth 2 (enforced in code) |
| nature | ENUM('asset','liability','income','expense') | inherited by children |
| is_system | TINYINT(1) | seeded groups locked |

### 14. `ledger_accounts`
| column | type | notes |
|---|---|---|
| group_id | FK account_groups | |
| name | VARCHAR(100) | |
| code | VARCHAR(20) UNIQUE NULL | |
| opening_balance | DECIMAL(12,2) DEFAULT 0 | |
| opening_type | ENUM('dr','cr') | |
| linked_type | ENUM('cash','bank','customer','vendor','gst','inventory','sales','making','old_metal','expense') NULL | lets code find system ledgers |
| linked_id | BIGINT NULL | customer_id / vendor_id for party sub-ledgers |
| is_system | TINYINT(1) | seeded ledgers locked (no rename/delete) |

**Party ledgers:** creating a customer/vendor auto-creates its ledger (`linked_type='customer', linked_id=X`) under Accounts Receivable / Payable. Balances always computed from `voucher_entries` + opening, never stored.

### 15. `vouchers`
| column | type | notes |
|---|---|---|
| voucher_no | VARCHAR(20) UNIQUE | from number_sequences per type |
| vtype | ENUM('sale','purchase','receipt','payment','expense','journal','contra','adjustment') | |
| vdate | DATE | |
| narration | VARCHAR(255) NULL | |
| ref_type | VARCHAR(20) NULL | invoice / purchase / expense / stock_adjust |
| ref_id | BIGINT NULL | |
| status | ENUM('active','cancelled') | cancel = reversal, never delete |
| created_by, cancelled_by | FK users | |
| cancelled_at, cancel_reason | | |

### 16. `voucher_entries`
| column | type | notes |
|---|---|---|
| voucher_id | FK CASCADE-forbidden (RESTRICT) | |
| ledger_id | FK ledger_accounts | |
| dr_amount | DECIMAL(12,2) DEFAULT 0 | |
| cr_amount | DECIMAL(12,2) DEFAULT 0 | exactly one of dr/cr non-zero |

**Invariant:** per voucher, `SUM(dr) = SUM(cr)`. Enforced in code before commit; verified by trial-balance test.

---

## E. Parties (2 tables)

### 17. `customers`
`code` (CUST-0001), `name`, `phone` (indexed, lookup key at counter), `whatsapp`, `email`, `address`, `gstin` NULL, `opening_balance`, `opening_type`, `notes`, `is_active`. Walk-in sales use `customer_id NULL` on invoice.

### 18. `vendors`
`code` (VEN-0001), `name`, `firm_name`, `phone`, `whatsapp`, `email`, `address`, `gstin`, `vendor_type` ENUM('metal_supplier','jewellery_supplier','karigar','service'), `opening_balance`, `opening_type`, `notes`, `is_active`.

---

## F. Inventory (4 tables)

### 19. `item_categories`
`name` (Ring, Chain, Necklace, Bangle, Coin, Raw Metal, Old Metal), `metal` ENUM('gold','silver') NULL (NULL = both), `is_system` (Old Metal & Raw Metal categories locked).

### 20. `items`
One row per **tagged piece** OR per **bulk SKU**.
| column | type | notes |
|---|---|---|
| code | VARCHAR(20) UNIQUE | ITM-0001; printed on tag/barcode |
| name | VARCHAR(120) | |
| category_id | FK | |
| metal | ENUM('gold','silver') | |
| purity_id | FK purities | |
| tracking | ENUM('tagged','bulk') | tagged = unique piece; bulk = qty/weight pool |
| gross_weight | DECIMAL(10,3) | tagged: piece weight. bulk: per-unit nominal weight or NULL |
| net_weight | DECIMAL(10,3) | metal weight charged to customer |
| stone_weight | DECIMAL(10,3) DEFAULT 0 | |
| making_type | ENUM('per_gram','fixed','percent') | |
| making_value | DECIMAL(10,2) | |
| huid | VARCHAR(10) NULL | hallmark id, unique when present |
| hsn_code | VARCHAR(10) | default 7113 |
| barcode | VARCHAR(30) NULL UNIQUE | |
| photo_path | VARCHAR(255) NULL | |
| status | ENUM('in_stock','billing','sold','removed') | **tagged only**; `billing` = row-locked mid-sale guard |
| cost_value | DECIMAL(12,2) | tagged: landed cost of piece. bulk: unused (stock_ledger holds costs) |
| is_active | TINYINT(1) | |

### 21. `stock_ledger`
Every physical movement. Current stock = SUM of ledger, never a stored counter.
| column | type | notes |
|---|---|---|
| item_id | FK items | |
| direction | ENUM('in','out') | |
| qty | DECIMAL(10,2) | pieces (tagged: always 1) |
| weight | DECIMAL(10,3) | grams moved |
| rate_per_gram | DECIMAL(10,2) NULL | cost (in) or sale rate (out) |
| value | DECIMAL(12,2) | |
| ref_type | ENUM('opening','purchase','invoice','adjustment','old_metal_in') | |
| ref_id | BIGINT NULL | |
| voucher_id | FK vouchers NULL | the accounting voucher posted with this move |
| created_by | FK users | |

### 22. `stock_adjustments`
`adj_no` (ADJ-…), `item_id`, `direction`, `qty`, `weight`, `reason` VARCHAR(255) **mandatory**, `voucher_id` NULL (value adjustments post to a Stock Adjustment ledger), `created_by`. Writes a `stock_ledger` row.

---

## G. Purchases (3 tables)

### 23. `purchases`
`purchase_no` (PUR-2627-00001), `vendor_id` FK, `pdate`, `bill_ref` (vendor's bill no), `subtotal`, `cgst`, `sgst`, `igst`, `round_off`, `grand_total`, `paid_amount` (recomputed from vendor_payments), `status` ENUM('active','cancelled'), `voucher_id` FK, `created_by`.

### 24. `purchase_items`
`purchase_id` FK, `item_id` FK NULL (filled when receipt creates/points to an item), `description`, `metal`, `purity_id`, `qty`, `weight`, `rate_per_gram`, `amount`, `gst_rate` DECIMAL(4,2), `line_total`. Receiving a tagged piece creates an `items` row + `stock_ledger` in; bulk adds a ledger row to the existing SKU.

### 25. `vendor_payments`
`payment_no` (PAY-…), `vendor_id` FK, `purchase_id` FK NULL (NULL = on-account), `pdate`, `mode` ENUM('cash','upi','bank','card','cheque'), `amount`, `ref_no` (UTR/cheque), `voucher_id` FK, `status`, `created_by`.

---

## H. Sales / Billing (4 tables)

### 26. `invoices`
| column | type | notes |
|---|---|---|
| invoice_no | VARCHAR(20) UNIQUE NULL | **NULL while draft**; assigned at finalize |
| customer_id | FK NULL | NULL = walk-in (name/phone snapshot fields below) |
| walkin_name, walkin_phone | VARCHAR NULL | |
| idate | DATE | |
| status | ENUM('draft','final','cancelled') | drafts touch nothing |
| price_mode | ENUM('exclusive','inclusive') | inclusive = quoted price already contains GST; tax back-calculated |
| estimate_id | FK estimates NULL | set when converted from an estimate |
| metal_total | DECIMAL(12,2) | Σ metal_value |
| making_total | DECIMAL(12,2) | |
| discount | DECIMAL(12,2) DEFAULT 0 | |
| cgst, sgst, igst | DECIMAL(12,2) | |
| old_metal_value | DECIMAL(12,2) DEFAULT 0 | exchange credit |
| round_off | DECIMAL(5,2) | |
| grand_total | DECIMAL(12,2) | |
| paid_amount | DECIMAL(12,2) | **recomputed** from invoice_payments |
| voucher_id | FK NULL | posted at finalize |
| created_by, finalized_at, cancelled_by, cancel_reason | | |

### 27. `invoice_items`
`invoice_id` FK, `item_id` FK, `description` (snapshot), `qty`, `gross_weight`, `net_weight`, `purity_code` (snapshot), `rate_per_gram` (snapshot of that day's rate or override), `metal_value`, `making_charge`, `gst_rate`, `cgst`, `sgst`, `igst`, `line_total`, plus:

| column | type | notes |
|---|---|---|
| tax_treatment | ENUM('taxable','exempt','nil_rated','non_gst','reverse_charge') | default `taxable`; drives GST report bucketing |
| exempt_reason | VARCHAR(120) NULL | **mandatory** when treatment ≠ taxable (audited) |

Non-taxable lines still post full sales income and full stock movement — only the tax component differs. There is no line type that skips the ledger or the stock ledger.

### 28. `invoice_old_metal`
Exchange lines: `invoice_id` FK, `metal`, `purity_id`, `gross_weight`, `deduction_pct` DECIMAL(5,2) (melting deduction), `net_weight`, `rate_per_gram`, `value`. Finalize creates an Old Metal bulk `stock_ledger` in-row.

### 29. `invoice_payments`
`receipt_no` (RCPT-…), `invoice_id` FK NULL (NULL = on-account receipt against customer), `customer_id` FK NULL, `pdate`, `mode`, `amount`, `ref_no`, `voucher_id` FK, `status`, `created_by`.

---

## H2. Estimates / Quotations (2 tables)

Price slips given to a customer before they decide. **No accounting effect, no stock effect, no invoice number** — they are not bills and must never look like one.

### 29a. `estimates`
| column | type | notes |
|---|---|---|
| estimate_no | VARCHAR(20) UNIQUE | `EST-2627-00001` — its own sequence, visibly different from INV |
| customer_id / walkin_name / walkin_phone | | same shape as invoices |
| edate | DATE | |
| valid_until | DATE | default edate + 7 days (rates move) |
| price_mode | ENUM('exclusive','inclusive') | |
| metal_total, making_total, discount, tax_estimate, grand_total | DECIMAL(12,2) | `tax_estimate` = indicative only |
| status | ENUM('open','converted','expired','cancelled') | |
| converted_invoice_id | FK invoices NULL | set on conversion |
| created_by | FK users | |

### 29b. `estimate_items`
Same columns as `invoice_items` minus the posted tax split (`cgst/sgst/igst` are indicative), plus `item_id` FK NULL (an estimate may quote an item not yet in stock).

**Rules:** estimates never touch `stock_ledger` or `vouchers`; they never consume the INV sequence; the printed slip is watermarked `ESTIMATE — NOT A TAX INVOICE`; converting creates a normal invoice (which re-prices at the conversion date's rate unless the estimate is still within `valid_until` and the user opts to hold the quoted rate).

## I. Expenses (1 table)

### 30. `expenses`
`expense_no` (EXP-…), `edate`, `ledger_id` FK (which expense ledger), `paid_from_ledger_id` FK (Cash/Bank), `mode`, `amount`, `notes`, `voucher_id` FK, `status`, `created_by`.

---

## Seeded data (in `database/seed.php`)

1. **Roles + permissions + role_permissions** per `09-rbac-and-audit.md`.
2. **Purities:** gold 24K/22K/18K, silver 999/925.
3. **Account groups & ledgers** (all `is_system=1`):
   - Assets: Cash in Hand, Bank, Inventory – Gold, Inventory – Silver, Inventory – Old Metal, Accounts Receivable, GST Input
   - Liabilities: Accounts Payable, GST Payable (CGST/SGST/IGST sub-ledgers), Customer Advances
   - Income: Gold Sales, Silver Sales, Making Charges Income, Other Income, Discount Given (contra)
   - Expenses: Metal Purchases (COGS), Wages & Karigar, Rent, Salaries, Utilities, Stock Adjustment Loss, Misc Expenses
4. **Item categories** incl. locked `Raw Metal`, `Old Metal`.
5. **Settings** defaults (GST 3% on jewellery HSN 7113, 5% on making if billed separately — confirm with client's CA; configurable).
6. **Admin user** (Owner role) with forced password change on first login.

## Indexing notes
- `stock_ledger(item_id, created_at)`, `voucher_entries(ledger_id, voucher_id)`, `invoices(idate, status)`, `customers(phone)`, `items(status, metal)`, `audit_log(entity, entity_id)`.
- FKs `ON DELETE RESTRICT` everywhere — nothing money-linked is ever hard-deleted.
