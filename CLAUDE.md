# Jewellers CRM / ERP — Project Memory

Jewellery store management system (gold + silver) for an Indian retailer. **MVP = double-entry accounting with a true P&L, weight-first inventory, vendor management, RBAC, and collision-proof multi-counter billing.**

Codebase copied from `E:\EB projects\sejal-jewellers\sejal_jewellers_crm` on 2026-07-28 for its auth/RBAC infrastructure and **visual design system**, then stripped of the lead-CRM/HRMS/integration/website modules and rebuilt around jewellery.

## The specs are law
- **`plan/`** — specs for what we are BUILDING. `plan/info.md` = scope; `01`–`10` = schema, backend, API+permissions, frontend, accounting, inventory, billing, vendors, RBAC, build phases.
- **`memory.md`** — current status, open client questions, and the **deviations table** (where the built code deliberately differs from `plan/` — read it before trusting a spec detail).
- **`SETUP.md`** — install, seed, run, verify.
- **`style.md`** — authoritative visual spec, kept deliberately: the client wants this design language.
- **`planning/`** — inherited docs describing the ORIGINAL lead-CRM. Reference only, NOT our roadmap.

## Stack (locked — do not substitute)
- **Backend**: core PHP 8.2+, no framework, PSR-4 `src/` namespace **`CRM\`**, PDO prepared statements ONLY, MySQL utf8mb4. Envelope `{success:true,...}` / `{success:false,error:{code,message,details?}}`.
- **Auth**: JWT access cookie (15 min) + rotating refresh w/ reuse detection + CSRF double-submit + DB rate limiting. Endpoints start with `require_once .../src/Support/api_bootstrap.php` then `requireApiAuth()`, `requirePermission()`, `requireMethod()`.
- **Frontend**: Next.js App Router, React, TS, `output:'export'` — **CSR only, no SSR, no middleware.ts, no dynamic route segments** (detail pages = `?id=`). Tailwind, TanStack Query v5, react-hook-form + zod, sonner. Feature folders `features/<domain>/{api,types,components}`; primitives in `shared/ui/`; HTTP via `shared/api/http-client.ts`.

## Architecture
- **`src/Accounting/`** — `Ledgers` (resolves system/party ledgers), `VoucherService` (balanced posting, cancel), `AccountingRepository` (trial balance, P&L, ledger statement, day book, outstanding).
- **`src/Jewellery/`** — `RateService` (daily rates), `Pricing` (metal × rate + making, GST split, inclusive/exclusive, old metal), `StockService` (weight ledger, row locks, avg cost), `InvoiceDraft`, `BillingService` (the atomic finalize), `BillingRepository`, `PaymentService`, `PurchaseService`, `EstimateService`.
- **Endpoints**: `invoices, estimates, purchases, vendor_payments, stock, rates, accounting, books, audit` + inherited `customers, vendors, expenses, users, rbac, settings, nav, dashboard, reports`.
- **`api/books.php`** = ledger-derived financial reports (P&L, trial balance, GST, outstanding, registers, stock). `api/reports.php` = operational analytics.

## Non-negotiable conventions
- Fiscal year Apr 1–Mar 31 · `Asia/Kolkata` · ₹ Indian formatting · weights `DECIMAL(10,3)` grams.
- **Money/stock mutations in one `Database::transaction()`**; derived values (`paid_amount`, stock, party balances) **recomputed from their ledgers**, never incremented.
- Numbering via `NumberSequence::next()` — `SELECT … FOR UPDATE` inside the caller's transaction. Gap-free and unique under concurrency.
- **Tagged pieces row-locked at finalize** (`StockService::lockTaggedForSale`, ascending id order); a second counter gets a clean 409, never a double sale.
- Every voucher balanced (ΣDr = ΣCr) — `VoucherService::post()` throws otherwise. Posting maps in `plan/05` §2.
- **Cancel, never delete.** Reversal stock rows + cancelled voucher + `Audit::log()` on every sensitive action.
- `requirePermission()` on **every** endpoint action branch. Cost values (`avg_cost`, COGS) stripped for users without `reports.stock`/`accounting.read`.
- **UI stays simple** — plain language, big controls, 3 clicks to a bill, no accounting jargon outside the Accounting page (`plan/04` §1).

## One set of books (settled — do not revisit)
Every finalised sale posts to the ledger and the stock ledger and appears in the sales register, GST summary and P&L alike. There is no hidden book, no second password revealing different totals, no sale that bypasses stock or accounting. A dual-book design was requested on 2026-07-28 and declined; the legitimate replacements are built: **estimates** (quotation, no ledger/stock), **tax-inclusive pricing** (tax sits inside the agreed price), **per-line tax treatments** (exempt/nil-rated/non-GST with a mandatory reason, permission-gated), and full **multi-company** support if the client genuinely has two GSTINs. `cli/verify-ledger.php` asserts sales register = GST turnover = P&L income, so a hidden sale would fail the build.

## Verify before calling anything done
`php cli/stress-billing.php` (parallel billing: unique gap-free numbers, no double sale, clean conflicts, balanced books) · `php cli/verify-ledger.php` (trial balance zero, no stock/paid drift, no hidden sales) · permission sweep per `plan/03` §8.

## Key paths
- Origin of this copy: `E:\EB projects\sejal-jewellers\sejal_jewellers_crm` (read-only).
- Config: `.env` (never commit) — template `.env.example`.
