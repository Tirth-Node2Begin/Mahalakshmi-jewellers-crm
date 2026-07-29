# 03 — API List & Permission Catalog

> Every endpoint with its required `resource.action` permission. `database/seed.php` §permissions must match §8 here exactly.
> Convention: `GET` = read (list with filters/pagination, `?id=` for detail). `POST` body carries `action`.

---

## 1. Auth — `api/auth.php` (no permission; rate-limited)
| action | notes |
|---|---|
| POST `login` | username+password → cookies |
| POST `refresh` | rotate refresh token |
| POST `logout` | revoke family |
| POST `change_password` | self |
| GET `me` | current user + permissions + nav |

## 2. Users & Roles
`api/users.php` — GET list/detail `users.view` · POST `create` `users.create` · `update` `users.edit` · `toggle_active` `users.edit` · `reset_password` `users.edit`
`api/roles.php` — GET `roles.view` · POST `create/update` `roles.manage` · `delete` `roles.manage` (blocked for is_system) · GET `permissions_catalog` `roles.view`

## 3. Parties
`api/customers.php` — GET `customers.view` (+`?phone=` counter lookup needs only `invoices.create`) · POST `create` `customers.create` · `update` `customers.edit` · GET `ledger` (statement) `customers.ledger`
`api/vendors.php` — GET `vendors.view` · POST `create` `vendors.create` · `update` `vendors.edit` · GET `ledger` `vendors.ledger`

## 4. Inventory
`api/items.php` — GET `items.view` (filters: metal, purity, category, status, search by code/barcode/huid) · POST `create` `items.create` · `update` `items.edit` · `deactivate` `items.edit` · GET `barcode_lookup` needs `invoices.create` OR `items.view`
`api/stock.php` — GET `current` `stock.view` · GET `movements` `stock.view` · POST `adjust` `stock.adjust` (reason mandatory) · POST `opening` `stock.opening` (setup phase)
`api/rates.php` — GET `today`/`history` (any authenticated user) · POST `set` `rates.set`

## 5. Billing
`api/invoices.php`
| action | permission | notes |
|---|---|---|
| GET list/detail | `invoices.view` | cashier sees own drafts + finals per data scope |
| POST `draft_create` / `draft_update` / `draft_delete` | `invoices.create` | drafts touch nothing |
| POST `finalize` | `invoices.create` | THE atomic transaction |
| POST `price_override` (flag on finalize when rate/making manually changed) | `invoices.override` | audit-logged |
| POST `cancel` | `invoices.cancel` | reversal + reason |
| GET `print` | `invoices.view` | print payload |

`api/estimates.php` — GET list/detail `estimates.view` · POST `create`/`update` `estimates.create` · POST `cancel` `estimates.create` · POST `convert` (→ draft invoice) `invoices.create` · GET `print` `estimates.view`. Estimates never post vouchers or stock rows.

`api/payments.php` — POST `receipt_create` `payments.receive` (invoice or on-account) · POST `vendor_payment_create` `payments.vendor` · POST `cancel` `payments.cancel` · GET list `payments.view`

## 6. Purchases & Expenses
`api/purchases.php` — GET `purchases.view` · POST `create` `purchases.create` (creates items/stock/voucher) · `cancel` `purchases.cancel`
`api/expenses.php` — GET `expenses.view` · POST `create` `expenses.create` · `cancel` `expenses.cancel`

## 7. Accounting, Reports, Admin
`api/accounting.php` — GET `coa` `accounting.view` · POST `ledger_create/update` `accounting.manage` (system ledgers locked) · POST `journal_create` `accounting.journal` · GET `voucher` detail `accounting.view`
`api/reports.php` (all GET)
| report | permission |
|---|---|
| `pnl` (date range) | `reports.pnl` |
| `trial_balance` | `reports.accounting` |
| `daybook` | `reports.accounting` |
| `ledger_statement` | `reports.accounting` |
| `cash_bank_book` | `reports.accounting` |
| `customer_outstanding` | `reports.outstanding` |
| `vendor_outstanding` | `reports.outstanding` |
| `gst_summary` | `reports.gst` |
| `sales_register` / `purchase_register` | `reports.sales` |
| `stock_summary` / `stock_movement` / `dead_stock` | `reports.stock` |
| `dashboard` (today's sales, cash, rates, low activity) | `dashboard.view` |

`api/settings.php` — GET `settings.view` · POST `update` `settings.manage`
`api/audit.php` — GET `audit.view`
`api/nav.php` — GET (authenticated) — permission-filtered menu

---

## 8. Permission catalog (seed source of truth)

| code | label | module |
|---|---|---|
| dashboard.view | View dashboard | General |
| users.view / users.create / users.edit | Users | Admin |
| roles.view / roles.manage | Roles & permissions | Admin |
| customers.view / customers.create / customers.edit / customers.ledger | Customers | Parties |
| vendors.view / vendors.create / vendors.edit / vendors.ledger | Vendors | Parties |
| items.view / items.create / items.edit | Items | Inventory |
| stock.view / stock.adjust / stock.opening | Stock | Inventory |
| rates.set | Set daily metal rates | Inventory |
| invoices.view / invoices.create / invoices.override / invoices.cancel | Billing | Billing |
| estimates.view / estimates.create | Estimates & quotations | Billing |
| payments.view / payments.receive / payments.vendor / payments.cancel | Payments | Billing |
| purchases.view / purchases.create / purchases.cancel | Purchases | Purchases |
| expenses.view / expenses.create / expenses.cancel | Expenses | Accounting |
| accounting.view / accounting.manage / accounting.journal | Accounts & COA | Accounting |
| reports.pnl / reports.accounting / reports.outstanding / reports.gst / reports.sales / reports.stock | Reports | Reports |
| settings.view / settings.manage | Settings | Admin |
| audit.view | Audit log | Admin |

**Role matrix (seed):**

| permission group | Owner | Accountant | Cashier | Inventory Mgr |
|---|---|---|---|---|
| dashboard.view | ✔ | ✔ | ✔ | ✔ |
| users.* / roles.* / settings.manage / audit.view | ✔ | – | – | – |
| customers.view/create | ✔ | ✔ | ✔ | – |
| customers.edit/ledger | ✔ | ✔ | – | – |
| vendors.* | ✔ | ✔ | – | view only |
| items.view | ✔ | ✔ | ✔ | ✔ |
| items.create/edit, stock.*, rates.set | ✔ | – | – | ✔ |
| invoices.view/create | ✔ | ✔ | ✔ | – |
| estimates.view/create | ✔ | ✔ | ✔ | – |
| invoices.override/cancel | ✔ | ✔ | – | – |
| payments.receive/view | ✔ | ✔ | ✔ | – |
| payments.vendor/cancel | ✔ | ✔ | – | – |
| purchases.* | ✔ | ✔ | – | create/view |
| expenses.* | ✔ | ✔ | – | – |
| accounting.*, reports.pnl/accounting/gst | ✔ | ✔ | – | – |
| reports.outstanding/sales | ✔ | ✔ | – | – |
| reports.stock | ✔ | ✔ | – | ✔ |
