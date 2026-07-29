# Jewellers CRM — Project Memory

> Read this first every session. Update the **Current Status** section whenever a phase/module lands, so anyone (or any AI session) instantly knows where the project stands.

## What this project is
Jewellery store management system (gold + silver) for an Indian retailer. MVP = accounting with accurate P&L, weight-first inventory, vendor management, RBAC, and collision-proof multi-counter billing. Full vision + deferred features: `plan/info.md`.

## The specs are law
`plan/` is the single source of truth. When code and spec disagree, fix the code or update the spec deliberately — never silently diverge.
- `plan/info.md` — overview + MVP scope + deferred phases
- `plan/01-database-schema.md` — authoritative schema (~30 tables); `database/schema.sql` must match
- `plan/02` backend conventions · `plan/03` API list + permission catalog §8 (seed.php must match) · `plan/04` frontend + UI simplicity rules
- `plan/05` accounting/voucher posting map · `plan/06` inventory · `plan/07` billing & concurrency · `plan/08` vendors · `plan/09` RBAC/audit · `plan/10` build phases + standing tests

## Stack (locked — do not substitute)
- **Backend:** core PHP 8.2+, no framework, PSR-4 `src/` (`Jewel\` namespace), **PDO prepared statements ONLY**, thin `api/*.php` endpoints, envelope `{success:true,...}` / `{success:false,error:{code,message}}`
- **Database:** MySQL/MariaDB, InnoDB, utf8mb4
- **Frontend:** Next.js (npm) App Router, TypeScript, **CSR-only static export** (no SSR/middleware/dynamic segments; detail pages = `?id=`), Tailwind, TanStack Query v5, react-hook-form + zod, feature folders `features/<domain>/{api,keys,types,schemas,hooks,components}`
- **Auth:** JWT access cookie (15 min) + rotating refresh w/ reuse detection + CSRF double-submit + DB rate limiting

## Non-negotiable conventions
- Fiscal year Apr 1–Mar 31 · timezone `Asia/Kolkata` · currency ₹ (Indian formatting) · weights DECIMAL(10,3) grams
- **Money/stock mutations in one `Database::transaction()`**; derived values (paid_amount, stock, balances) recomputed from ledgers, never incremented
- Numbering via `number_sequences` with `SELECT … FOR UPDATE` (INV/PUR/RCPT/PAY fiscal-coded pad 5; CUST/VEN/ITM global pad 4)
- Tagged items row-locked at bill finalize; second counter gets clean 409 — never a double sale
- **Cancel, never delete** — reversals + audit_log on every sensitive action
- RBAC = flat `resource.action` strings, `Permission::require()` on **every** endpoint action branch; cost values hidden from cashiers
- Every voucher balanced (ΣDr=ΣCr) — posting maps in `plan/05` §2
- **UI must stay simple** — plain language, big controls, 3-clicks-to-a-bill, no accounting jargon outside the Accounting section (`plan/04` §1)

## Design decisions we will not revisit
**One set of books.** Every finalized sale posts to the ledger and the stock ledger, and appears in the sales register, GST summary, and P&L alike. There is no hidden book, no second login that sees different totals, and no sale that bypasses stock or accounting. A dual-book design (same username + a second password revealing off-GST sales) was requested on 2026-07-28 and declined — it falsifies statutory records. If it comes up again, the legitimate answers are already built into the plan:
- customer wants a price first → **Estimates** (`plan/07` §3a) — no number, no stock, no ledger
- customer won't pay GST on top → **tax-inclusive pricing** (`plan/05` §3a) — tax sits inside the agreed price
- transaction genuinely carries no output tax → **per-line tax treatment** exempt/nil-rated/non-GST/reverse-charge with mandatory reason + audit
- client truly runs two firms with two GSTINs → proper **multi-company** support (both books complete and visible) — still an open question below

## Built code vs `plan/` — deliberate deviations
The specs were written before the Sejal codebase was copied in. Where the inherited code already had a good working convention, the CODE won and the spec is superseded on these points:

| plan/ says | code actually does | why |
|---|---|---|
| namespace `Jewel\` | **`CRM\`** | 74 inherited classes already use it |
| permissions `resource.view` | **`resource.read` / `.manage` / `.create` / `.adjust`** | matches the inherited catalog + `PermissionService` |
| tables `vendors`, `items`, `stock_ledger`, `audit_log`, `role_permissions` | **`suppliers`, `inventory_items`, `inventory_transactions`, `audit_logs`, `role_permission_grants` + `user_role_assignments`** | extended the inherited tables instead of duplicating them |
| one role per user | **many roles per user** (`user_role_assignments`) | inherited RBAC engine; `super_admin` wildcard-bypasses in `PermissionService` |
| routes `/billing/*` | **`/invoices/*`** (label "Bills" in nav) | avoids churning 146 frontend files for zero user benefit |
| `number_sequences(seq_key, fiscal_year)` | **`(seq_key, period)`** with keys `invoice/estimate/receipt/purchase/vendor_payment/voucher/customer/vendor/item_st/item_rm/adjustment` | inherited `NumberSequence` already row-locks correctly |
| accounting reports in `reports.php` | **`api/books.php`** (P&L, trial balance, GST, outstanding, stock, registers) | keeps ledger-derived reports separate from operational analytics |
| jewellery item CRUD in `inventory.php` | **`api/stock.php`** | inherited `inventory.php` stayed for generic lists |

Everything else in `plan/` still stands as written.

## Where the code lives
- **Accounting core**: `src/Accounting/` — `Ledgers` (resolves system/party ledgers), `VoucherService` (balanced posting + cancel), `AccountingRepository` (trial balance, P&L, ledger statement, day book, outstanding)
- **Jewellery core**: `src/Jewellery/` — `RateService`, `Pricing`, `StockService`, `InvoiceDraft`, `BillingService` (the atomic finalize), `BillingRepository`, `PaymentService`, `PurchaseService`, `EstimateService`
- **Endpoints**: `api/invoices.php`, `estimates.php`, `purchases.php`, `vendor_payments.php`, `stock.php`, `rates.php`, `accounting.php`, `books.php`, `audit.php` (+ inherited customers/vendors/expenses/users/rbac/settings)
- **DB**: `database/schema.sql` (inherited) → `database/migrations/2026_07_28_jewellery_erp.sql` (drops old modules, adds jewellery + accounting) → `database/seed.php`
- **Verification**: `cli/verify-ledger.php`, `cli/stress-billing.php`

## Reference project (patterns only, NOT domain)
`E:\EB projects\sejal-jewellers CRM\leadspark-crm` — lift auth/RBAC/transaction/sequence patterns; do NOT copy its lead-CRM schema or features.

## Standing tests (run before calling anything done)
`cli/stress-billing.php` (parallel billing guarantees) · `cli/verify-ledger.php` (trial balance zero + stock drift) · permission sweep per role matrix `plan/03` §8. Details: `plan/10`.

---

## Verified working (2026-07-28, local MariaDB 10.4 via XAMPP)
Everything below was actually run, not assumed:
- `schema.sql` → jewellery migration → `seed.php` all apply cleanly on a fresh DB (69 tables → 44). 49 permissions, 4 roles, 5 purities, full COA seeded.
- **Concurrency proof**: `php cli/stress-billing.php 24 8` — 24 counters raced for 8 tagged pieces. Exactly **8 finalised, 16 clean conflicts, 0 hard errors**; invoice numbers unique and gap-free; no piece sold twice; trial balance ₹17,97,200 dr = cr.
- `php cli/verify-ledger.php` — all 9 checks pass, both empty and with real transactions.
- **P&L computes true gross profit**: ₹5,80,000 gold sales + ₹40,000 making − ₹5,20,000 COGS = ₹1,00,000.
- All 19 API endpoints return 200 for the owner; CSRF rejection works; **cashier correctly gets 403** on P&L, trial balance, GST, accounting, purchases, audit and vendor payments; cost values stripped from their responses.
- Expenses post `Dr <category ledger> / Cr Cash-Bank` and appear in the P&L by category name; deleting or editing one cancels its voucher and takes it back out.
- Local `.env` written with generated secrets, DB `jewellers_crm`. Login `admin` / `admin123`.

### Bug found and fixed by that testing (worth remembering)
`AccountingRepository::profitAndLoss()` and `outstanding()` had the voucher `status`/date test in the **LEFT JOIN condition**. A failed LEFT JOIN still leaves the entry row in the group, so cancelled vouchers — and entries outside the requested date range — were still being summed: the P&L silently ignored its own date range. The filter now lives **inside the SUM's CASE**. `trialBalance()` and `ledgerStatement()` were already safe (they test `v.vdate`, which is NULL on a failed join). **Never put a voucher status/date filter in a LEFT JOIN's ON clause when the aggregate reads the entry table.**

## Current Status  ← UPDATE ME
- **2026-07-28** — Planning complete: `plan/info.md` + specs 01–10 written. **No code yet.** Next step: Phase 0 (repo skeleton, schema.sql, seed.php, auth core) per `plan/10-build-phases.md`.
- **2026-07-28 (later)** — Added Estimates/quotations module, GST-inclusive pricing, and per-line tax treatments across specs 01/03/04/05/07/10, following the dual-book decision above.
- **2026-07-28 (latest)** — **Codebase copied in** from `E:\EB projects\sejal-jewellers\sejal_jewellers_crm` and rebuilt as the jewellery ERP. Stripped leads/HRMS/integrations/website/orders/repairs (backend + frontend + tables). Built the accounting core, the jewellery engine (rates, weight stock, billing with locking, purchases, estimates, payments), 9 new/rewritten endpoints, the seeder, and both CLI verification tools. **All verified against a real database — see "Verified working" above.** Frontend pages for rates, P&L, audit and accounting are done; billing/estimates and purchases/stock/vendor-payments pages were built last.

  **Discovery worth remembering:** the inherited schema was ALREADY jewellery-aware (`inventory_items.metal_type/gross_wt/net_wt/stone_wt/purity/making_charge/hsn_code/barcode/jw_status`, `invoices.cgst/sgst/igst/old_gold_adjustment/huid/hallmark_no`, `invoice_items` weights, `suppliers.vendor_type/karigar_rate`). The migration RENAMES those to one convention (`gross_weight`, `metal`, `status`, `old_metal_value`, `purity_code`…) rather than duplicating them. Don't re-add parallel columns.

## Known gaps (built backend, missing or partial UI)
- **Non-taxable lines have no UI.** `invoice_items.tax_treatment` + `exempt_reason` are validated, posted and permission-gated (`invoices.override`) end-to-end, but the bill screen always sends `taxable`. Add the picker when the client's CA confirms which treatments they actually use.
- **Making scheme not recoverable from a saved draft.** `invoice_items` stores the computed making charge, not whether it was per-gram/fixed/percent, so reopening a draft shows it as `fixed`. Same rupee value; only the scheme label is lost. Fix by storing `making_type` on the line if it matters.
- **Stock summary groups by metal × purity × tagged/bulk, not by category** — `StockService::summary()` would need the category axis added.
- `/inventory/items/detail` has no page; item rows open a history dialog instead.
- Old dashboard deep links `/inventory?add=1` / `?low=1` no longer do anything now that `/inventory` is the stock summary — re-point them at `/inventory/items`.
- `ExpenseService::assertFixedItemPayable()` still blocks system fixed-cost items (Salaries) while `api/monthly.php` now allows paying them — decide which behaviour is wanted.

## Open decisions / questions for client
- **Does the client actually operate two firms (two GSTINs, or one registered + one composition/below-threshold)?** If yes, build proper multi-company support (separate numbering, COA, reports per company; per-user access). If no, single company stands.
- GST treatment of making charges (3% bundled vs 5% separate) — confirm with client's CA before go-live (`plan/05` §4)
- Final accent colour / branding for `style.md` (deep-gold family proposed, `plan/04` §2)
- Back-dating window for bills (default 3 days) and discount cap settings
- Estimate validity default (7 days) and whether quoted rates may be held on conversion
- Which extra features from the DataCare research doc the client wants in Phase 2 (client said they will specify)
