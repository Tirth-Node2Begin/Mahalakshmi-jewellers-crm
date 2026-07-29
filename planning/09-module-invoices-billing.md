# 09 — Invoices / Billing Module

> New module (the old CRM had fee-payments but **no invoice generator and no auto-numbering** —
> confirmed by code audit). Design borrows its proven money patterns: transactional writes,
> recompute-from-ledger balances, cheque lifecycle, bank-account master, browser-print documents.

---

## 1. Concepts

- **Invoice** — billed to a customer, optionally linked to a work. Line items reference the
  shared `services` catalog **or** inventory stock items (selling stock decrements inventory).
- **Auto numbering** — `INV-2627-00001` (fiscal-year-coded, Apr–Mar ⇒ "2627" for FY 2026-27)
  from the shared race-safe `number_sequences` generator. Payments get `RCPT-` numbers.
- **Status flow** (derived, never hand-set except draft/sent/cancelled):
  `draft → sent → partially_paid → paid`, plus `overdue` (computed: balance > 0 && due_date < today)
  and `cancelled` (only when zero payments exist).
- **Amounts** — per line: `qty × rate − discount + tax(%)`. Invoice totals stored
  (subtotal, discount_total, tax_total, grand_total) **and recomputed from lines on every
  mutation** (recompute-from-ledger pattern). `paid_amount`/`balance` recomputed from payments.
- **Partial payments** — multiple payments per invoice; each payment has mode + bank account +
  optional cheque lifecycle (`pending → deposited → cleared | bounced`; bounced reverses the
  payment amount — ported cheque flow).
- **Print/PDF** — client-side: a clean print stylesheet + hidden-iframe `window.print()`
  (ported bank-QR print pattern). Company profile (name, logo, address, GSTIN, bank details,
  invoice footer note) from `settings` table. Server-side PDF (dompdf) = phase 2.

---

## 2. Database Tables

```sql
number_sequences                     -- shared: INV / RCPT / PO / CUST / WRK / EMP / RM / ST
  id PK, seq_key VARCHAR(30) NOT NULL,          -- 'invoice','receipt','purchase','customer',
                                                -- 'work','employee','item_rm','item_st'
                                                -- (full seed table: 01 §K)
  period VARCHAR(10) NOT NULL DEFAULT '',       -- fiscal code '2627' for invoice/receipt; '' for global seqs
  prefix VARCHAR(10) NOT NULL, next_number INT NOT NULL DEFAULT 1, padding TINYINT DEFAULT 5
  UNIQUE (seq_key, period)
  -- allocation: SELECT ... FOR UPDATE inside the caller's transaction

invoices
  id PK,
  invoice_no VARCHAR(30) NOT NULL UNIQUE,
  customer_id INT NOT NULL FK customers,        -- RESTRICT (archive customers instead of delete)
  work_id INT NULL FK works SET NULL,
  invoice_date DATE NOT NULL, due_date DATE NULL,
  status ENUM('draft','sent','partially_paid','paid','cancelled') DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0, discount_total DECIMAL(12,2) DEFAULT 0,
  tax_total DECIMAL(12,2) DEFAULT 0, grand_total DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,          -- maintained from invoice_payments
  notes VARCHAR(500), terms VARCHAR(1000),
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (customer_id), (status), (invoice_date), (due_date)

invoice_items
  id PK, invoice_id FK invoices CASCADE,
  item_type ENUM('service','stock','custom') DEFAULT 'service',
  service_id INT NULL FK services SET NULL,
  inventory_item_id INT NULL FK inventory_items SET NULL,   -- stock lines only
  description VARCHAR(255) NOT NULL,            -- snapshot (survives catalog edits)
  qty DECIMAL(12,3) NOT NULL DEFAULT 1, unit VARCHAR(20) NULL,   -- 3 decimals, matches inventory ledger
  rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,             -- absolute per line
  tax_rate DECIMAL(5,2) DEFAULT 0,              -- % (GST)
  tax_amount DECIMAL(12,2) DEFAULT 0, line_total DECIMAL(12,2) DEFAULT 0,
  sort_order INT DEFAULT 0
  INDEX (invoice_id)

invoice_payments
  id PK, invoice_id FK invoices,                -- RESTRICT
  receipt_no VARCHAR(30) NOT NULL UNIQUE,       -- RCPT-2627-00001
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash','upi','bank','card','cheque') DEFAULT 'cash',
                                                -- unified vocabulary with expenses/purchases;
                                                -- UI label "Bank Transfer" normalizes to 'bank'
  bank_account_id INT NULL FK bank_accounts SET NULL,
  cheque_number VARCHAR(50) NULL, cheque_date DATE NULL, cheque_bank VARCHAR(100) NULL,
  cheque_status ENUM('pending','deposited','cleared','bounced') NULL,
  cheque_cleared_at DATETIME NULL,
  notes VARCHAR(500),
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (invoice_id), (payment_date)
```

Rules mirrored in code:
- Non-cash modes require `bank_account_id` when active bank accounts exist (ported rule).
- **Status derivation** (single formula, re-run after every mutation):
  `paid_amount = Σ payments excluding bounced cheques`; then
  `paid_amount = 0 → sent · 0 < paid < grand_total → partially_paid · paid = grand_total → paid`
  (draft/cancelled are explicit states and never derived).
- **Bounced cheque** → payment excluded from the `paid_amount` recompute (status flips back);
  writes a `payment_bounced` customer event — same reverse-on-bounce semantics as old CRM.
- Cancel invoice: only when `paid_amount = 0`; stock lines restock via `in/sale_reversal`
  ledger rows (invoice_id set, unit_cost = original sale row's cost snapshot).
- Delete payment (`payments.refund` permission): transaction → delete row → recompute
  `paid_amount` + status.

---

## 3. Invoice ↔ Inventory contract (see [11](11-module-inventory.md))

On **finalize** (`draft → sent`), for each `stock` line: check available qty → insert
`inventory_transactions` row (`type='out', reason='sale', ref invoice_id`) → decrement
`current_stock`. All-or-nothing in one transaction; insufficient stock returns 422 listing the
short items. Editing a sent invoice's stock lines reverses + re-issues the delta
(qty decreases write `in/sale_reversal` rows; increases write additional `out/sale` rows).
Cancelled invoice restocks via `in/sale_reversal`. Draft invoices never touch stock.
Reports net `sale_reversal` rows against `sale` rows (matched on invoice_id) so cancelled
documents don't inflate sales/COGS ([14 Tab 5](14-reports-analytics.md)).

---

## 4. API — `/api/invoices.php`

| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list | `invoices.read` | filters `status, customer_id, search(invoice_no/customer), start_date, end_date, overdue=1`; returns `{invoices[], stats{total_billed, total_paid, outstanding, overdue_count, draft_count, this_month_billed}}` |
| GET | `?id=N` | `invoices.read` | `{invoice, items[], payments[], customer, company_profile}` (print-ready) |
| GET | `?next_number=1` | `invoices.create` | preview next INV number (non-allocating) |
| POST | `create` | `invoices.create` | header + `items[]`; computes totals server-side; `status:'draft'`; validates lines (qty>0, rate≥0, stock availability soft-warn) |
| POST | `update` | `invoices.update` | full replace of items (delete+reinsert, transactional); sent/partially_paid invoices: stock delta handling AND guard `new grand_total ≥ paid_amount` (else 422 "delete/refund payments first"); status re-derived after edit; fully paid invoices: blocked |
| POST | `finalize` | `invoices.update` | draft → sent; allocates nothing new (number assigned at create), executes stock OUT, logs `invoice_created` customer event, optional notification |
| POST | `cancel` | `invoices.delete` | guards: no payments; restocks |
| POST | `delete` | `invoices.delete` | drafts only; else use cancel |
| POST | `add_payment` | `payments.create` | `{invoice_id, amount, payment_date, payment_mode, bank_account_id?, cheque_*}` → RCPT no; caps at balance; transaction: insert → recompute paid/status → `payment_received` customer event + notification |
| POST | `delete_payment` | `payments.refund` | transaction + recompute |
| POST | `update_cheque_status` | `payments.update` | pending→deposited (needs bank)→cleared / bounced (reverses) |

Validation (Validator rules): customer_id required int; invoice_date date; items array min 1;
per-item description ≤255, qty numeric>0, rate numeric≥0, tax_rate 0–28.

---

## 5. Frontend Pages

### `/invoices` — list
- KPIs (clickable): Total Billed (FY), Collected, **Outstanding**, Overdue count, Drafts.
- Filters: status tabs (All / Draft / Sent / Partially Paid / Paid / Overdue / Cancelled),
  customer combobox, date range, search by number.
- Table: number, customer, date, due (overdue in rose), grand total, paid, balance,
  status badge, actions (View, Record Payment, Print).

### `/invoices/create` (edit mode via `/invoices/create?id=` — same builder page, no separate route)
- Two-panel builder: left = form, right = **live invoice preview** (updates as you type,
  framer-motion layout).
- Header: customer combobox (+ quick-add), work select (filtered to customer), dates, number
  preview (read-only).
- Lines editor: type toggle (Service / Stock / Custom) per row — service picks from catalog
  (prefills rate), stock picks inventory item (shows available qty, unit; over-qty warning),
  custom is free text. qty/rate/discount/tax% columns, per-line total, add/remove/reorder rows.
- Totals card: subtotal, discount, tax, **grand total** (count-up animation), notes/terms.
- Actions: Save Draft · Save & Finalize (confirm dialog shows stock impact).

### `/invoices/detail?id=`
- Print-styled invoice document (company profile header, customer block, items table, totals,
  amount-in-words, terms) + action bar: Record Payment, Print (iframe pattern), Edit
  (navigates to `/invoices/create?id=`, subject to the §4 rules), Cancel, Mark Sent.
- Payments panel: receipt rows w/ mode chips, cheque status stepper (pending→deposited→cleared,
  bounced in rose), add/delete payment (permission-gated).

### `/settings/company`
Company profile: name, logo upload, address, phone/email, GSTIN, default tax %, default terms,
invoice footer note, bank details shown on invoice → `settings` key-value table.

---

## 6. Permissions

`invoices.read/create/update/delete · payments.create/update/refund · bank_accounts.manage`
(bank accounts shared with expenses — one page, defined in [10](10-module-expenses.md)).

Role defaults: Admin/Accountant all · Manager read/create · Sales read — scoped to invoices of
their own customers via `ScopeSql::ownedVia` (see [08 §1](08-module-rbac.md)) · others none.

---

## 7. Alignment

- **Customers** ([06](06-module-customers-lifecycle.md)): totals on customer detail derive from
  invoices/payments; timeline events on finalize/payment/bounce (drafts log nothing).
- **Works**: "Generate Invoice" from work detail prefills customer + a service line from the
  work's service + estimated amount.
- **Inventory** ([11](11-module-inventory.md)): stock lines move inventory; COGS-style report joins
  invoice_items ↔ inventory_transactions.
- **Expenses** ([10](10-module-expenses.md)): shared `bank_accounts`; P&L = invoice_payments −
  expenses ([14](14-reports-analytics.md)).
- **Reports**: revenue trend, outstanding aging (0-30/31-60/61-90/90+), top customers,
  collection by mode, service-wise revenue.
- **Notifications**: payment received → invoice creator; invoice overdue (daily cron) → creator +
  customer owner.
