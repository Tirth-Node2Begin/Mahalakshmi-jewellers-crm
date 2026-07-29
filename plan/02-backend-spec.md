# 02 — Backend Spec (Core PHP + MySQL)

> Stack locked: **pure/core PHP 8.2+, no framework**, MySQL via **PDO prepared statements only** (never string-interpolated SQL), PSR-4 autoload under `src/` with namespace `Jewel\`.

---

## 1. Folder layout

```
/api/                  ← public endpoints, one file per resource (thin: parse → permission → service → respond)
  auth.php
  users.php  roles.php
  customers.php  vendors.php
  items.php  stock.php  rates.php
  invoices.php  purchases.php  payments.php  expenses.php
  accounting.php  reports.php
  settings.php  audit.php  nav.php
/src/                  ← PSR-4 Jewel\ namespace (all logic lives here)
  Core/    Database.php  Request.php  Response.php  Auth.php  Csrf.php  RateLimiter.php  Audit.php
  Rbac/    Permission.php  ScopeSql.php
  Service/ InvoiceService.php  PurchaseService.php  StockService.php  VoucherService.php
           PaymentService.php  ExpenseService.php  RateService.php  SequenceService.php
  Report/  PnlReport.php  TrialBalance.php  LedgerStatement.php  StockReport.php  GstReport.php  OutstandingReport.php
/database/ schema.sql  seed.php  migrations/
/config/   config.php (reads .env)
.env       ← never committed (DB creds, JWT secret, APP_ENC_KEY)
```

## 2. Request/response conventions

- **Method mapping:** endpoints accept `GET` (list/detail via `?id=`) and `POST` with `action` field (`create`, `update`, `cancel`, `finalize`…). Keeps hosting simple (no rewrite rules needed beyond `/api/*.php`).
- **Envelope (never deviate):**
  - success: `{"success":true, "data":…, "meta":{page,total}?}`
  - failure: `{"success":false, "error":{"code":"VALIDATION|AUTH|FORBIDDEN|NOT_FOUND|CONFLICT|SERVER", "message":"…", "details":{field:msg}?}}`
- HTTP codes: 200, 400 validation, 401 auth, 403 permission, 404, 409 conflict (e.g. item already sold), 500.
- All input validated server-side (`Request::validate()` helper) regardless of frontend zod validation.

## 3. Auth (lift pattern from reference project)

- Login → **JWT access token in HttpOnly cookie (15 min)** + **rotating refresh token (7 days)** in separate cookie; refresh reuse detection revokes the whole token family.
- **CSRF double-submit cookie** checked on every POST.
- **Rate limiting** via `rate_limits` table: login 5/min/IP, general POST 60/min/user.
- Passwords: `password_hash()` bcrypt; forced change on first login for seeded admin.
- Session invalidation on role change or deactivation (JWT carries `role_rev` claim checked against user row).

## 4. RBAC enforcement

- `Permission::require('invoices.create')` at the **top of every endpoint action branch** — not just per file. UI hiding is cosmetic only; the API is the wall.
- Permission list = flat `resource.action` strings seeded from `03-api-list.md` §8.
- `nav.php` returns the menu filtered by the caller's permissions so the frontend renders only allowed sections.

## 5. Transaction & money rules (non-negotiable)

1. Every mutation that touches money or stock runs inside `Database::transaction(fn)` — one transaction covers the **entire** business event (invoice + stock + voucher + payment).
2. **Recompute, never increment:** `invoices.paid_amount`, vendor/customer balances, current stock are recomputed from their ledgers inside the same transaction after writing.
3. **Sequences:** `SequenceService::next('INV')` does `SELECT next_number FROM number_sequences WHERE seq_key=? AND fiscal_year=? FOR UPDATE`, formats, updates. Must be called inside the caller's transaction so the lock holds until commit → gap-free, duplicate-free numbers under concurrency.
4. **Voucher balance check:** `VoucherService::post()` asserts ΣDr = ΣCr before insert; throws otherwise (bug guard).
5. **Cancel, never delete:** cancelling an invoice/purchase creates reversal stock-ledger rows and marks the voucher cancelled (its entries excluded from all reports). Audit row always written.
6. **Tagged-item concurrency:** billing an item does `SELECT status FROM items WHERE id=? FOR UPDATE`; if not `in_stock` → 409 CONFLICT ("Item already billed"). Status flips `in_stock → sold` at finalize commit.
7. Isolation level: default REPEATABLE READ is fine given row locks above; deadlock retry wrapper (3 attempts) in `Database::transaction`.

## 6. Service responsibilities

| Service | Owns |
|---|---|
| `InvoiceService` | draft CRUD, finalize (number + stock out + voucher + payment, one txn), cancel (reversals), pricing calc (`net_wt × rate × fineness + making + GST − old metal`) |
| `PurchaseService` | purchase entry → items creation/bulk in-rows + voucher + AP |
| `StockService` | stock in/out/adjust rows, current-stock queries, weighted-avg cost per metal+purity bucket |
| `VoucherService` | balanced voucher posting, cancellation, the posting maps from `05-accounting-module.md` |
| `PaymentService` | customer receipts & vendor payments + their vouchers, paid_amount recompute |
| `RateService` | daily rate entry/fetch; "rate for date" lookup for billing |
| `SequenceService` | locked number generation, fiscal-year resolution (Apr 1) |

## 7. Errors, logging, audit

- `Audit::log($action, $entity, $id, $details)` called by every service mutation.
- PHP errors → log file, generic 500 to client (never leak SQL).
- Slow-query awareness: reports use indexed aggregate queries; no N+1 loops in PHP.

## 8. `.env` keys

`DB_HOST, DB_NAME, DB_USER, DB_PASS, JWT_SECRET, APP_ENV, APP_URL, COOKIE_DOMAIN, CORS_ORIGIN`

## 9. Testing hooks

- `cli/stress-billing.php` — spawns N parallel finalize requests against seeded drafts; asserts unique invoice numbers, correct stock sums, balanced trial balance (see `10-build-phases.md`).
- `cli/verify-ledger.php` — recomputes trial balance and stock from ledgers, flags drift.
