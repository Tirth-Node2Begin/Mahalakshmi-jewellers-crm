# Jewellers CRM — Project Memory

> Read this first every session. Update the **Current Status** section whenever a phase/module lands, so anyone (or any AI session) instantly knows where the project stands.

## What this project is
Jewellery store management system (gold + silver) for an Indian retailer. MVP = accounting with accurate P&L, weight-first inventory, vendor management, RBAC, and collision-proof multi-counter billing. Full vision + deferred features: `plan/info.md`.

## The specs are law
`plan/` is the single source of truth. When code and spec disagree, fix the code or update the spec deliberately — never silently diverge.
- `plan/info.md` — overview + MVP scope + deferred phases
- `plan/01-database-schema.md` — intended data shape. **Superseded in part**: the live schema is `database/schema.sql` + `database/migrations/2026_07_28_jewellery_erp.sql` (44 tables). See the deviations table below.
- `plan/02` backend conventions · `plan/03` API list + permission catalog §8 (seed.php must match) · `plan/04` frontend + UI simplicity rules
- `plan/05` accounting/voucher posting map · `plan/06` inventory · `plan/07` billing & concurrency · `plan/08` vendors · `plan/09` RBAC/audit · `plan/10` build phases + standing tests

## Stack (locked — do not substitute)
- **Backend:** core PHP 8.2+, no framework, PSR-4 `src/` (**`CRM\` namespace** — the `Jewel\` in `plan/02` was never used), **PDO prepared statements ONLY**, thin `api/*.php` endpoints, envelope `{success:true,...}` / `{success:false,error:{code,message}}`
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
**One set of books.** Every finalized sale posts to the ledger and the stock ledger, and appears in the sales register, GST summary, and P&L alike. There is no hidden book, no second login that sees different totals, and no sale that bypasses stock or accounting.

A dual-book design was requested and **declined on 2026-07-28, and again on 2026-07-29** after being re-asked four times in different wordings ("two passwords one username", "1st account GST only / 2nd account everything", "two ledgers", "build it"). It falsifies statutory records, so it will not be built — not as a toggle, a second login, a hidden ledger, or any partial version that produces the same effect. `cli/verify-ledger.php` checks 7/8 actively assert that the sales register, GST turnover and P&L income agree, so a sale hidden from the books fails the build. If asked again, decline plainly and briefly; the reasoning does not need repeating a fifth time. The legitimate answers, all already built:
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
| `invoices.discount_total` = the whole-bill discount | **`discount_total` = whole-bill + Σ per-line discounts; new `bill_discount` holds the whole-bill figure alone** | a per-line discount was priced into the line's taxable value but never left the grand total — the customer was overcharged and Discount Given was never debited for it. `discount_total` is now the one figure the bill prints and the voucher debits (`2026_11_23_billing_accounting_fixes.sql`) |
| `plan/06` bulk sale checks qty + weight | **weight only** (`StockService::lockBulkForSale`) | bulk pools are weight-first; the piece count beside the grams is a loose tally, and gating on it refused real stock (a silver pool holding 6,393 g with ledger qty 0 could not be sold at all) |
| `plan/05` cheque receipt → Bank | **cheque receipt → new `cheques_in_hand` ledger, moved to the bank only when marked cleared** | a cheque is not in the bank until it clears; posting it straight to Bank made a bank ledger impossible to reconcile against its statement. Issued cheques still credit the bank at once |
| `plan/05` one `bank` ledger | **one ledger per `bank_accounts` row**, created on first use (`Ledgers::bankAccount`) | every non-cash rupee (upi/card/transfer/cleared cheque) used to land in a single shared ledger, so no account could be reconciled on its own |
| metal is a fixed `ENUM('gold','silver')` | **`metals` master table + `VARCHAR(30)` columns**, added to from the app via `api/metals.php` → `Metals::create()` | platinum (2026-07-30) needed an ALTER on five tables; the shop must be able to add a metal without a migration. `Metals::create()` writes the metal, its `inventory` + `sales` ledgers and its first purity in one transaction — a metal missing either is unbillable |
| bills can be raised for a **walk-in** with no customer record (`plan/07`) | **every new bill carries a customer** — step 1 of New Bill offers exactly two answers, "Choose a customer" and "Add a new customer" (2026-07-31, client's call). The backend is untouched: `invoices.customer_id` stays nullable, `walkin_name/phone` still post, and a draft saved as a walk-in before the change still opens and finalises. Estimates keep the walk-in strip | client wants a name and number against every sale. Adding a customer mid-bill uses the full `CustomerFormModal` with **name + phone required, everything else optional** |
| vendor type is the fixed ten-value `VendorService::TYPES` list | **`vendor_types` master table** (2026-08-01) on top of the built-ins, added to from the app via the Type dropdown's "+ Add a new type…" (`vendors.php` `action=add_type` / `view=types`, `features/vendors/vendor-type-select.tsx`) | same move as metals: the shop wants its own types (refiner, courier…) without a code change. Built-ins stay in code — the category tabs and the maker picklist depend on them; custom-typed vendors sit under "All" on the tabs and an "Other" group in the inventory vendor picker |

| daily rates are typed in by hand only (`plan/06` §3) | **auto-fetched each morning and STAGED for approval** (2026-08-04) — `api/cron/fetch_rates.php` → `src/Jewellery/RateFeed/` → a review card on the Rates page. Manual entry is untouched and still the fallback | the shop bills all morning on a stale rate when the manager is late or away. A fetched rate is never written straight into `metal_rates`: a finalised bill stamps its rate, so a wrong one cannot be corrected afterwards — someone with `rates.set` presses Apply |

Everything else in `plan/` still stands as written.

### The daily rate feed — what to know before touching it (2026-08-04)
- **There is no government source.** No GoI site publishes a daily retail metal rate. CBIC's customs tariff value is *fortnightly*, in USD, an import valuation, and has **no platinum** — and it has no machine-readable feed either (their notification site is an SPA whose API 401s; the old plain-HTML index 404s, both confirmed 2026-08-04). So the rate comes from **IBJA** (`ibjarates.com`), the national trade benchmark behind Income-Tax gold valuation and RBI's SGB pricing. CBIC survives only as an optional cross-check whose two USD figures an admin types into Settings. Do not "fix" this by pointing it at a government URL — there isn't one.
- **The parser is strict on purpose.** It matches the exact span ids (`lblGold999_AM`… `lblPlatinum999_AM`) and needs at least three gold quotes or it reports nothing. A loose regex that quietly matched some other number on the page is the dangerous failure; an empty run is the safe one.
- **Units:** gold and platinum are published per 10 g, silver per kg. `Quote::perGram()` is the only place that converts.
- IBJA does not publish sterling 925 or platinum 950 — `PurityMapper` derives them pro-rata from the finest published quote of that metal and labels them as derived. Matching is by **fineness, not code**.
- `php cli/check-rate-feed.php` is a dry run that writes nothing — use it to tell "IBJA hasn't published yet" apart from "their page changed".

## Where the code lives
- **Accounting core**: `src/Accounting/` — `Ledgers` (resolves system/party ledgers), `VoucherService` (balanced posting + cancel), `AccountingRepository` (trial balance, P&L, ledger statement, day book, outstanding)
- **Jewellery core**: `src/Jewellery/` — `RateService`, `Pricing`, `StockService`, `InvoiceDraft`, `BillingService` (the atomic finalize), `BillingRepository`, `PaymentService`, `PurchaseService`, `EstimateService`
- **Endpoints**: `api/invoices.php`, `estimates.php`, `purchases.php`, `vendor_payments.php`, `payments.php`, `stock.php`, `rates.php`, `accounting.php`, `books.php`, `audit.php` (+ inherited customers/vendors/expenses/users/rbac/settings/nav/dashboard/reports)
- **DB**: `database/schema.sql` (inherited) → `database/migrations/2026_07_28_jewellery_erp.sql` (drops old modules, adds jewellery + accounting) → `database/seed.php`
- **Frontend**: 45 routes. Jewellery-specific pages: `/rates`, `/invoices` + `/create` + `/detail`, `/estimates` (+create/detail), `/purchases` (+create/detail), `/inventory` (stock summary) + `/items` + `/movements` + `/adjust`, `/vendors/payments`, `/accounting` + `/ledger`, `/reports/pnl|trial-balance|gst|outstanding|stock|daybook`, `/settings/audit`. Shared billing components in `features/billing/`, report shell in `features/books/report-shell.tsx`.
- **Verification**: `cli/verify-ledger.php`, `cli/stress-billing.php`, `cli/seed_demo.php` (demo data through the real services)

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
- **2026-11-23 (later)** — **Checked the Accounting page's ledgers for live/dynamic behaviour.** The data layer was already right: `ledgerStatement` derives everything from active voucher entries, so a cash sale appears the instant it is posted, with the correct running balance and "To <customer>" particulars — verified live (cash bill → Cash in Hand moves by exactly the bill; unpaid bill → cash does not move; part cash receipt → exactly that; cheque → Cheques in Hand, then the bank on clearing). Three real gaps fixed:
  1. **The Accounts page showed only each ledger's setup-time opening balance** — never what it stands at now, so the owner could not see how much cash was in the drawer without opening every statement. `chartOfAccounts()` now takes `as_on` (default today, honouring GST visibility) and returns a live `balance` / `balance_type` per ledger, cross-checked against `trialBalance()` (computed a different way) — every shown ledger agrees. The page's "To" date now moves the balances.
  2. **The chart of accounts hid every ledger with a `linked_id`**, meaning to hide the per-party sub-ledgers. That also hid the five named expense ledgers (Rent, Utilities, Karigar Charges, Marketing, Office Supplies) and would have hidden the new per-bank-account ledgers. Now only `customer`/`vendor` sub-ledgers are hidden.
  3. **Nothing refreshed the ledger views after money moved.** Queries are 60s-stale with `refetchOnWindowFocus: false`, and only the journal dialog invalidated `["accounting"]` — so after billing a sale the Accounts page could sit on a minute-old figure with no way to force a refresh. New `shared/api/invalidate-money.ts` refreshes `accounting`/`books`/`dashboard`/`reports`, called from every screen that finalises a bill, takes or cancels a payment, clears or bounces a cheque, records a purchase or expense, or posts a stock correction.
  **Note on the demo data:** the shared catch-all "Bank Account" ledger carries a large credit balance from before fix #4 above — all historical non-cash money was dumped there. New money routes per account; that historical pile stays where it is unless someone reclassifies it.
- **2026-11-23** — **Audited the bill → payment → ledger path end to end and fixed 7 defects.** Verified against the live DB with voucher dumps for walk-in, credit, split payments across all five modes, old-metal exchange, advance receipt, exempt line, and cancellation.
  1. *Per-line discount never left the bill total* — priced into the taxable value (so GST was right) but not deducted from `grand_total`, and never debited to Discount Given. A ₹5,000 line discount printed on the line while the customer was charged the full amount. Fixed in `InvoiceDraft`, `BillingService::totalsFromLines`, `EstimateService` and `features/billing/calc.ts`; see the deviations table for the `discount_total` / `bill_discount` split.
  2. *Inclusive price + line discount could not be billed at all* — `Pricing::line` derived making as `net − metal`, which went negative once the discount outweighed the making charge; the voucher map skipped negative making (`if making > 0`) so the sale voucher came out unbalanced and finalize threw `Unbalanced sale voucher` at the counter. Metal, making and discount are now scaled by the same factor, remainder on the larger component. **Never derive one component by subtraction when another can exceed it.**
  3. *Bulk sales gated on qty* — see the deviations table.
  4. *All non-cash money landed in one Bank ledger*, and cheques were treated as banked on the spot. Per-account ledgers + Cheques in Hand + `clearCheque`/`bounceCheque` (`payments.php` actions `clear_cheque` / `bounce_cheque`, buttons on the Payments screen). `Ledgers::forPaymentMode` now takes a `$flow` so issued cheques still credit the bank.
  5. *Old metal came IN to Inventory — Old Metal but was relieved from Inventory — <metal>* on resale: totals balanced, so no check caught it, while Old Metal inflated and Inventory — Gold drifted negative. All inventory postings now go through `Ledgers::inventoryForItem()`. No historical drift existed in this DB (no old-metal bucket had been resold yet).
  6. *Counter over-payment was uncapped* (₹50,000 over a ₹61,086 bill was accepted) and the later-payment cap sat outside the transaction. The cap now runs inside `PaymentService::receive` with the invoice row locked.
  7. *Tagged-stock integrity* — the adjust screen accepted an "in" correction on a tagged piece (one ring told it was six rings and 100 g, carrying ₹734,000 of phantom inventory), and billing checked only `status`, so a piece created but never received could be sold at zero cost. Both closed; `cli/repair-tagged-stock.php` (dry run by default) corrected the 5 pieces already affected.
  **New checks:** `cli/verify-ledger.php` is now 10 checks — check 6 retightened to the true invariant (a tagged piece's ledger position is 0 or 1; an item created but not yet received is legitimate), and new check 8 asserts every inventory ledger matches the stock mapped to it, which is what would have caught #5. Check 7's P&L leg now adds line discounts back, since turnover nets them but the Sales ledgers carry the gross.
  **Verified:** `verify-ledger` all 10 pass (the tagged check had been failing before this work), `stress-billing` passes, `tsc --noEmit` clean, every changed page renders. **Not verified:** no browser walk-through (the SEO Browser control server would not stay up) and no Codex review (its configured model is not available on this account).
- **2026-08-04** — **Daily gold/silver/platinum rate auto-fetch** built (see the deviations table). New: `database/migrations/2026_08_04_rate_feed.sql` (`rate_feed_runs`, `rate_feed_quotes`, `rates.feed` permission), `src/Jewellery/RateFeed/` (7 classes), `api/cron/fetch_rates.php`, `cli/check-rate-feed.php`, four `feed_*` actions on `api/rates.php`, and `features/rates/feed-card.tsx` on the Rates page. **Verified:** parser against the live IBJA page (all 7 purities, correct units), mapping + every sanity check (move / ordering / ratio / envelope / stale-token) against those live quotes, PHP lint, `tsc --noEmit` and `next build` clean. **Not yet run against a database** — the local XAMPP MariaDB crashes on startup in `ha_open` on `mysql.gtid_slave_pos` (a pre-existing problem with that data directory, unrelated to this work). Run the migration + `php cli/check-rate-feed.php` on a working DB before shipping.
- **2026-07-28** — Planning complete: `plan/info.md` + specs 01–10 written. **No code yet.** Next step: Phase 0 (repo skeleton, schema.sql, seed.php, auth core) per `plan/10-build-phases.md`.
- **2026-07-28 (later)** — Added Estimates/quotations module, GST-inclusive pricing, and per-line tax treatments across specs 01/03/04/05/07/10, following the dual-book decision above.
- **2026-07-28 (latest)** — **Codebase copied in** from `E:\EB projects\sejal-jewellers\sejal_jewellers_crm` and rebuilt as the jewellery ERP. Stripped leads/HRMS/integrations/website/orders/repairs (backend + frontend + tables). Built the accounting core, the jewellery engine (rates, weight stock, billing with locking, purchases, estimates, payments), 9 new/rewritten endpoints, the seeder, and both CLI verification tools. **All verified against a real database — see "Verified working" above.** Frontend pages for rates, P&L, audit and accounting are done; billing/estimates and purchases/stock/vendor-payments pages were built last.

  **Discovery worth remembering:** the inherited schema was ALREADY jewellery-aware (`inventory_items.metal_type/gross_wt/net_wt/stone_wt/purity/making_charge/hsn_code/barcode/jw_status`, `invoices.cgst/sgst/igst/old_gold_adjustment/huid/hallmark_no`, `invoice_items` weights, `suppliers.vendor_type/karigar_rate`). The migration RENAMES those to one convention (`gross_weight`, `metal`, `status`, `old_metal_value`, `purity_code`…) rather than duplicating them. Don't re-add parallel columns.

## 2026-07-29 — demo data seeder + a real bug it flushed out

`cli/seed_demo.php` was still the **inherited lead-CRM seeder** (imported `CRM\Leads`, `CRM\HR`, `CRM\Orders`, `CRM\Repairs`, `CRM\Automation` — all stripped modules), so it was dead code that fatal-errored on run. Rewritten as a **jewellery top-up seeder** that writes everything through the real services (`PurchaseService`, `InvoiceDraft` + `BillingService`, `EstimateService`, `PaymentService`, `ExpenseService`) so stock moves, vouchers balance and numbers come from `NumberSequence`. Safe to run against a database that already has data; `--force` runs another round. Marker: `settings.demo_seeded_at`.

### Bug found and fixed: purchase round-off was posted with the wrong sign
`Pricing::roundOff()` returns `roundOff = grandTotal − beforeRounding`. On a **sale** the grand total is the *debit* (customer) and the components are credits, so a positive round-off needs a **credit** — `BillingService` is correct. On a **purchase** the grand total is the *credit* (vendor) and the components are debits, so the sign must **invert**. `PurchaseService` had copied the sales convention verbatim, throwing the voucher out by *twice* the round-off and making `VoucherService::post()` reject the whole purchase with "Unbalanced purchase voucher" whenever `subtotal + tax` was not a whole rupee. Fixed at `src/Jewellery/PurchaseService.php` (`roundOff > 0` → **dr**). **Lesson: a round-off entry's sign follows which side of the voucher carries the rounded figure — never copy it between the sales and purchase maps.**

### Open: bill-level discount is invisible to the GST summary (pre-existing, NOT introduced by the seeder)
`verify-ledger.php` checks 7 and 8 fail: register 1,92,06,345.68 vs GST turnover 1,92,80,745.68 — a gap of exactly ₹74,400, the entire `SUM(invoices.discount_total)`. Verified against a restore of the pre-seed database: the baseline was **already** off by its own header-discount total (₹68,400), so this predates the seeding.

Cause: a header discount is stored on `invoices.discount_total` and posted to the ledger as **contra-income "Discount Given"** (it shows correctly in the P&L), but it is never pushed down to `invoice_items.discount` — and `BillingRepository::gstSummary()` derives taxable value from the *lines*. Line tax was therefore charged on the **pre-discount** value.

This is a **CA question, not a clear code bug** — deliberately left unfixed because either side can be the correct one:
- **Discount charged after tax** (what the code does today): GST turnover of 1,92,80,745.68 is right, and the *verify-ledger check* is what needs to allow for a post-tax discount.
- **Discount before tax** (GST s.15(3)(a), allowed when the discount is on the face of the invoice): push the header discount down to the lines pro-rata and recompute tax on the net — turnover *and* output tax both drop.

Ask alongside the existing making-charges GST question. Do not "fix" this by silently changing what tax is charged.

## 2026-07-29 — UI changes (all typechecked, `next build` passing, 45 routes)

- **"New Bill" and "New Purchase" removed from the sidebar.** Billing is now one row (Bills → Estimates → Money Received) and Purchases is one row. Each list page carries its own full-size primary button **top-right** (`/invoices` → "+ New Bill" beside an "Estimates" link; `/purchases` → "+ New Purchase"), both wrapped in `PermissionGate`. **Because they are no longer nav items, `/invoices/create` and `/purchases/create` had to be added to `NavMap::SUB_ROUTE_PARENTS`** — without that the route guard blocks the page and the button leads nowhere. Same trap applies to any future create screen reached only from a button.
- **Ledger now shows proper Dr/Cr with particulars.** `AccountingRepository::ledgerStatement()` returns, per entry, the **contra accounts** (the other side of the voucher) as `contra[]` plus a ready-made `particulars` string using classic wording — `To …` for a debit, `By …` for a credit — and the statement carries `total_debit` / `total_credit`. Previously "Particulars" showed only the voucher narration, so you could not see what an entry was against. Debit and Credit are visually separated columns with a period totals row. Applied in three places off the same payload: the Accounts ledger view, the vendor ledger panel (`features/vendors/ledger-panel.tsx`, which keeps plain wording "You paid (Debit)" / "You were billed (Credit)"), and the customer ledger.
- **`/accounting/ledger` is now a real page** (a COA row links to it rather than opening a dialog) and is registered in `SUB_ROUTE_PARENTS`.
- **Platinum is a third metal** (added 2026-07-30, `migrations/2026_07_30_platinum.sql`). The `metal` ENUM was widened on `purities`, `inventory_items`, `invoice_old_metal`, `purchase_items` and `ledger_accounts`; `seed.php` now adds the **PT950** purity and the `Inventory — Platinum` + `Platinum Sales` ledgers. **Adding a fourth metal means doing all three: enum, ledgers, `Metals::ALL`** — `Ledgers::system('sales', $metal)` throws at finalize if the metal has no ledger. New `src/Jewellery/Metals.php` replaced the `=== 'silver' ? 'silver' : 'gold'` ternaries that used to sit in `BillingService` (×2), `InvoiceDraft` and `PurchaseService`; those silently posted any third metal to the GOLD ledgers. Platinum needs a daily rate on the Rates page like any other purity, or nothing platinum can be priced.
- **The bill lines are cards, not a table** (`features/billing/line-items-table.tsx`). The old `table-fixed min-w-[1040px]` could never fit — that grid column gets ~800px even on a large monitor — so the counter always scrolled sideways. Each line is now a card: name + amount + delete on top, figures in a `grid-cols-2 / sm:4 / lg:7` that reflows. Keep any new per-line field inside that grid; do not reintroduce a min-width.
- **Per-line tax treatment now has a UI** (plan/05 §3a), in the same component. A "GST" dropdown per line offers Charge GST / Exempt / Nil-rated / Outside GST / Reverse charge, and anything but the first reveals a **mandatory** reason box. Shown only with `invoices.override`; without it the treatment is read-only text. `api/invoices.php` re-checks the permission server-side, so hiding the control is convenience, not the control itself. Validation for the missing reason lives in BOTH create screens (`invoices/create` `validate()` and `estimates/create` `save()`). A non-taxable line is still a full sale — same income, same COGS, same stock movement, only the tax component is zero.
- **`shared/ui/password-input.tsx`** — a `PasswordInput` primitive with a show/hide eye, drop-in for `Input` (forwards ref, so `{...register()}` works). Used on **every** password field: login, forgot-password, profile change-password, Settings → Users temp password, and the forced password-change screen. There are no raw `type="password"` inputs left. The eye is `tabIndex={-1}` so Tab still goes password → submit.

## Role defaults worth knowing
- **`reports.pnl` is granted to the Owner only.** Profit & loss is deliberately withheld from the seeded Accountant, Cashier and Inventory roles. The owner can grant it to any role from Settings → Roles. Enforced in three places: the nav hides it, the page shows a plain "not open to you" message, and `books.php` returns 403.
- Every permission now carries a plain-language `description` (seeded in `database/seed.php`), and the Roles page shows that label instead of the raw code — "See profit & loss", not "pnl". The raw `resource.action` is still on hover. Adding a new permission means adding its label there too.

## Known gaps (built backend, missing or partial UI)
- **Making scheme not recoverable from a saved draft.** `invoice_items` stores the computed making charge, not whether it was per-gram/fixed/percent, so reopening a draft shows it as `fixed`. Same rupee value; only the scheme label is lost. Fix by storing `making_type` on the line if it matters.
- **Stock summary groups by metal × purity × tagged/bulk, not by category** — `StockService::summary()` would need the category axis added.
- `/inventory/items/detail` has no page; item rows open a history dialog instead.
- Old dashboard deep links `/inventory?add=1` / `?low=1` no longer do anything now that `/inventory` is the stock summary — re-point them at `/inventory/items`.
- `ExpenseService::assertFixedItemPayable()` still blocks system fixed-cost items (Salaries) while `api/monthly.php` now allows paying them — decide which behaviour is wanted.

## Open decisions / questions for client
- **Does the client actually operate two firms (two GSTINs, or one registered + one composition/below-threshold)?** If yes, build proper multi-company support (separate numbering, COA, reports per company; per-user access). If no, single company stands.
- GST treatment of making charges (3% bundled vs 5% separate) — confirm with client's CA before go-live (`plan/05` §4)
- **Is a bill-level discount given before or after GST?** Decides whether the header discount is pushed down to the lines (turnover and tax both drop) or stays post-tax as it is today. See the 2026-07-29 section above — `verify-ledger.php` checks 7/8 fail until this is settled.
- Final accent colour / branding for `style.md` (deep-gold family proposed, `plan/04` §2)
- Back-dating window for bills (default 3 days) and discount cap settings
- Estimate validity default (7 days) and whether quoted rates may be held on conversion
- Which extra features from the DataCare research doc the client wants in Phase 2 (client said they will specify)
