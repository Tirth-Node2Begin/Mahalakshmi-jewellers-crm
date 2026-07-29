# 11 — Inventory Module

> Simple two-type inventory: **Raw Material** (consumed by customer works) and **Stock**
> (finished goods, sold on invoices). Ledger-first design: every movement is an
> `inventory_transactions` row; `current_stock` is a maintained convenience column that can be
> recomputed from the ledger (recompute-from-ledger pattern ported from the old CRM's money code).

---

## 1. Concepts

- **Item types** (the two main inventories the user asked for):
  - `raw_material` — bought from suppliers, consumed against works (issue) or general use.
  - `stock` — finished goods; bought/produced in, sold out via invoice stock lines.
- **Units**: pcs, kg, g, litre, meter, box, set… (master table, admin-editable).
- **Movements** (`inventory_transactions.type` + `reason`) — every write path has a named reason:
  - `in` — `purchase` (purchase receive), `production` (raw→stock conversion output),
    `adjustment_in` (manual adjust / opening stock / physical returns),
    `sale_reversal` (invoice cancel or sent-edit qty decrease; `invoice_id` set,
    unit_cost = the original sale row's cost snapshot).
  - `out` — `sale` (invoice finalize), `work_issue` (raw material to a work),
    `production_consume` (raw consumed to produce stock), `adjustment_out`, `damage`,
    `purchase_reversal` (cancelling a received purchase; `purchase_id` set — performed
    automatically inside the cancel transaction, blocked if stock would go negative).
  - Reports net reversal rows against their originals (matched on invoice_id/purchase_id) so
    cancelled documents don't inflate movement/COGS totals ([14 Tab 5](14-reports-analytics.md)).
- **Purchases**: PO-numbered supplier purchases with line items; receiving posts `in` transactions
  and (when marked paid) an expense row (system category `INVENTORY_PURCHASE`).
- **Production (simple)**: one action converts raw materials → stock item
  (consume lines + output line, single transaction). No BOM master — quantities entered per run
  (keep simple; BOM = phase 2).
- **Valuation**: weighted-average cost, updated on every `in` with a price
  (`new_avg = (old_qty*old_avg + in_qty*in_price) / (old_qty+in_qty)`); `out` rows snapshot the
  current avg cost → stock value + consumption cost reports come straight off the ledger.
- **Low stock**: `reorder_level` per item; daily cron + on-write check → notification + dashboard
  badge.

---

## 2. Database Tables

```sql
inventory_categories
  id PK, name VARCHAR(100) NOT NULL, item_type ENUM('raw_material','stock') NOT NULL,
  is_active TINYINT(1) DEFAULT 1, created_at TIMESTAMP
  UNIQUE (name, item_type)

units
  id PK, name VARCHAR(30) NOT NULL UNIQUE, short_name VARCHAR(10) NOT NULL UNIQUE,
  is_active TINYINT(1) DEFAULT 1

suppliers
  id PK, name VARCHAR(150) NOT NULL, company VARCHAR(150), gstin VARCHAR(20),
  mobile VARCHAR(20), email VARCHAR(150), address VARCHAR(255), city VARCHAR(100),
  notes TEXT, is_active TINYINT(1) DEFAULT 1,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP

inventory_items
  id PK,
  item_code VARCHAR(30) NOT NULL UNIQUE,           -- RM-0001 / ST-0001 (number_sequences per type)
  name VARCHAR(150) NOT NULL,
  item_type ENUM('raw_material','stock') NOT NULL,
  category_id INT NULL FK inventory_categories SET NULL,
  unit_id INT NOT NULL FK units,
  current_stock DECIMAL(12,3) DEFAULT 0,           -- maintained; recomputable from ledger
  avg_cost DECIMAL(12,2) DEFAULT 0,                -- weighted average
  selling_price DECIMAL(12,2) NULL,                -- stock items: prefills invoice line rate
  reorder_level DECIMAL(12,3) DEFAULT 0,
  description VARCHAR(255), is_active TINYINT(1) DEFAULT 1,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (item_type), (category_id), (name)

inventory_transactions                              -- the ledger (append-only; reversals are new rows)
  id PK, item_id FK inventory_items,                -- RESTRICT
  type ENUM('in','out') NOT NULL,
  reason ENUM('purchase','production','adjustment_in','sale_reversal',
              'sale','work_issue','production_consume','adjustment_out',
              'damage','purchase_reversal') NOT NULL,
  qty DECIMAL(12,3) NOT NULL,                       -- always positive; sign from type
  unit_cost DECIMAL(12,2) DEFAULT 0,                -- in: price paid; out: avg-cost snapshot
  purchase_id INT NULL FK purchases SET NULL,
  invoice_id INT NULL FK invoices SET NULL,
  work_id INT NULL FK works SET NULL,
  production_batch VARCHAR(30) NULL,                -- groups a production run's rows
  notes VARCHAR(255),
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP
  INDEX (item_id, created_at), (reason), (work_id), (invoice_id), (purchase_id)

purchases
  id PK, purchase_no VARCHAR(30) NOT NULL UNIQUE,   -- PO-2627-00001
  supplier_id INT NOT NULL FK suppliers,            -- RESTRICT
  purchase_date DATE NOT NULL,
  status ENUM('draft','received','cancelled') DEFAULT 'draft',
  subtotal DECIMAL(12,2) DEFAULT 0, tax_total DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  payment_status ENUM('unpaid','paid') DEFAULT 'unpaid',
  payment_mode ENUM('cash','bank','upi','cheque','card') NULL,
  bank_account_id INT NULL FK bank_accounts SET NULL,
  expense_id INT NULL FK expenses SET NULL,         -- set when paid
  invoice_ref VARCHAR(60), notes TEXT,
  created_by INT NULL FK users SET NULL, created_at TIMESTAMP, updated_at TIMESTAMP
  INDEX (supplier_id), (status), (purchase_date)

purchase_items
  id PK, purchase_id FK purchases CASCADE, item_id FK inventory_items,
  qty DECIMAL(12,3) NOT NULL, rate DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0, line_total DECIMAL(12,2) NOT NULL
  INDEX (purchase_id)
```

Integrity rules (code-enforced):
- `out` blocked when `qty > current_stock` (422 with available qty) — no negative stock.
- Items with any transactions can't be deleted (deactivate); categories/units/suppliers guarded
  by usage counts (ported master-guard pattern).
- Receiving a purchase (`draft → received`): transaction → per line insert `in/purchase` ledger
  row, update `current_stock` + `avg_cost`. Cancelling a received purchase automatically writes
  the reversing `out/purchase_reversal` rows in the same transaction (blocked with 422 if any
  item's stock would go negative — e.g. already consumed).
- Marking purchase paid: writes `expenses` row (system `INVENTORY_PURCHASE` category,
  `ref_table='purchases'`, paid_to = supplier name) → P&L complete; unpay reverses.
  The category is write-locked in the expense module (manual expenses under it are 403 —
  [10 §1](10-module-expenses.md)), so purchase-paid rows can never be double-entered by hand.

---

## 3. API

### `/api/inventory.php`
| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list | `inventory.read` | filters `item_type, category_id, search, low_stock=1, status`; returns `{items[], categories[], units[], stats{raw_count, stock_count, total_value(Σ qty×avg_cost by type), low_stock_count, out_of_stock}}` |
| GET | `?id=N` | `inventory.read` | `{item, transactions[] (paginated 50), monthly_movement[] (12m in/out series)}` |
| POST | `create` / `update` | `inventory.manage` | item fields; code auto RM-/ST- |
| POST | `toggle` | `inventory.manage` | deactivate instead of delete when ledger exists |
| POST | `adjust` | `inventory.adjust` | `{item_id, direction(in|out), qty, unit_cost?, notes*}` → adjustment ledger row (audited) |
| POST | `issue_to_work` | `inventory.issue` | `{work_id, items:[{item_id, qty}], notes}` → `out/work_issue` rows (raw materials only); shows on work detail |
| POST | `produce` | `inventory.manage` | `{output_item_id(stock), output_qty, consume:[{item_id(raw), qty}], notes}` → single transaction: consume rows + production in-row (cost = Σ consumed value / output qty), batch code |
| POST | `save_category` / `save_unit` (+ toggles) | `inventory.manage` | masters |

### `/api/suppliers.php`
GET list w/ purchase totals (`suppliers.read`) · GET `?id=` detail w/ purchase history ·
POST `create/update/toggle` (`suppliers.manage`); delete blocked with purchases.

### `/api/purchases.php`
| Method | Action | Permission | Notes |
|---|---|---|---|
| GET | list | `purchases.read` | filters `supplier_id, status, payment_status, date range, search(po no)`; stats: month total, unpaid total, draft count |
| GET | `?id=N` | `purchases.read` | header + lines + supplier + linked expense |
| POST | `create` / `update` | `purchases.create` | draft only editable; PO number on create |
| POST | `receive` | `purchases.receive` | draft → received; posts stock (transaction) |
| POST | `mark_paid` / `unpay` | `purchases.pay` | expense row write/reverse |
| POST | `cancel` / `delete` | `purchases.delete` | guards per §2 |

---

## 4. Frontend Pages

### `/inventory` — items overview
- Type tabs: **Raw Materials** | **Stock** (the two main inventories) + All.
- KPIs (clickable): Raw Materials value ₹, Stock value ₹, **Low Stock** (amber), Out of Stock
  (rose), Items count.
- Filters: search, category, low-stock toggle; **Add Item**; quick actions per row:
  Adjust, History, (raw) Issue to Work.
- Table: code, name, category, unit, current stock (badge coloring: ok/low/zero),
  avg cost, value, selling price (stock), reorder level, status.
- `ItemModal` (type, name, category filtered by type, unit, opening stock + opening cost
  (creates an `adjustment_in` row), reorder level, selling price for stock).

### `/inventory/detail?id=` — item ledger
Header (code, name, type badge, current stock big number, value) · 12-month in/out bar chart ·
transactions table (date, type/reason chip, qty ±, unit cost, ref link → purchase/invoice/work,
by whom) · Adjust + Issue buttons.

### `/inventory/purchases` (+ `/inventory/purchases/detail?id=`)
List with KPIs (This Month ₹, Unpaid ₹, Draft count) and status/payment filters ·
`PurchaseModal` builder (supplier combobox + quick-add, date, line rows item/qty/rate/tax,
totals) · detail page: lines, Receive button (confirm shows stock impact), Mark Paid
(mode + bank account), link to generated expense.

### `/inventory/production`
Simple two-panel form: consume list (raw items + qty, live availability check) → output
(stock item + qty, computed unit cost preview) · Produce button · recent production runs table
(batch, output, consumed summary, date).

### `/inventory/suppliers`
Card grid w/ purchase totals + outstanding; SupplierModal; detail drawer with purchase history.

---

## 5. Permissions

`inventory.read · inventory.manage · inventory.adjust · inventory.issue ·
suppliers.read · suppliers.manage · purchases.read · purchases.create · purchases.receive ·
purchases.pay · purchases.delete`

Role defaults (seed slugs per [03 §8](03-api-list.md)): `admin` all · `inventory_manager` all ·
`accountant` purchases.read/pay · `manager` inventory.read · others none. (A works-crew role
needing only inventory.read/issue can be created at runtime via /settings/roles.)

---

## 6. Alignment

- **Invoices** ([09](09-module-invoices-billing.md)): stock lines → `sale` transactions on
  finalize; cancel restocks; selling_price prefills rates; availability shown in the line editor.
- **Works** ([06](06-module-customers-lifecycle.md)): `issue_to_work` rows appear on work detail
  as Materials Used (qty × avg-cost snapshot = material cost of the job).
- **Expenses** ([10](10-module-expenses.md)): paid purchases post system-category expense rows —
  procurement is inside P&L; the expense row is locked (managed from the purchase).
- **Reports** ([14](14-reports-analytics.md)): stock valuation, consumption by work/customer,
  purchase spend by supplier, dead stock (no movement 90d), low-stock list.
- **Notifications**: low stock (cross reorder level on any `out`), purchase received, payment due.
- **Dashboard**: low-stock badge + stock value KPI on the admin dashboard.
