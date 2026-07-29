# 10 — Build Phases & Test Checklist (MVP)

> Build order chosen so every step is testable on top of the previous one. Money core first, screens second, polish last.

---

## Phase 0 — Foundation (backend skeleton)
- [ ] Repo layout per 02 §1; `.env`, config, PSR-4 autoload
- [ ] `schema.sql` + `seed.php` matching 01 exactly (roles, permissions, COA, purities, categories, admin user)
- [ ] Core: Database (txn + deadlock retry), Request/Response envelope, Auth (JWT+refresh+CSRF+rate limit), Permission, Audit, SequenceService
- [ ] `auth.php`, `nav.php`, `users.php`, `roles.php`
- **Gate:** login/refresh/logout works; permission denial returns 403; sequence generator passes a 50-parallel-call uniqueness test

## Phase 1 — Accounting core
- [ ] VoucherService (balanced posting + cancel), accounting.php, expenses.php
- [ ] Reports: trial balance, ledger statement, day book, cash/bank book
- **Gate:** manual journals + expenses post; trial balance nets to zero; `cli/verify-ledger.php` green

## Phase 2 — Parties + Inventory
- [ ] customers.php / vendors.php (+ auto party ledgers), items.php, stock.php, rates.php
- [ ] StockService (ledger rows, avg-cost, current-stock queries), opening stock flow (V7)
- **Gate:** opening stock entered → stock summary matches; adjustments post V6 and appear in trial balance

## Phase 3 — Purchases
- [ ] PurchaseService (items creation + IN rows + V3, cancel), vendor payments (V4)
- **Gate:** purchase → item appears in stock with cost; vendor outstanding correct; cancel fully reverses

## Phase 4 — Billing (the critical phase)
- [ ] InvoiceService: drafts, pricing calc (exclusive + inclusive modes), per-line tax treatments, finalize txn per 07 §2, cancel, receipts (V2), old-metal exchange
- [ ] EstimateService + `estimates.php`: quotation numbering, print watermark, convert-to-draft-invoice (asserts zero ledger/stock effect)
- [ ] **`cli/stress-billing.php`**: seed 200 tagged items + drafts, fire 20 parallel finalize workers, several deliberately targeting the same items. Assert: ① invoice numbers unique & gap-free ② no item sold twice (conflicts got clean 409) ③ stock ledger sums = expected ④ trial balance = 0 ⑤ paid_amounts match receipts
- **Gate:** stress test green 5 consecutive runs. This test re-runs before every release forever.

## Phase 5 — Frontend
- [ ] Next.js scaffold (npm), Tailwind, ui primitives, layout/sidebar (nav-driven), login
- [ ] Screens in order: Rates → Items/Stock → New Bill (+held bills, print) → Bill list/receipts → Purchases → Vendors → Customers → Expenses → Accounting → Reports (P&L first) → Admin (users/roles/settings/audit)
- **Gate:** simplicity checkpoints from 04 §6 pass with a non-technical tester

## Phase 6 — Reports & polish
- [ ] P&L, GST summary, outstanding (aged), sales/purchase registers, stock reports, dashboard, dead stock
- [ ] Print CSS (A4/A5 + thermal), CSV exports, Indian number formatting sweep
- **Gate:** P&L for a scripted week of test transactions matches a hand-computed sheet exactly

## Phase 7 — Handover
- [ ] Guided opening-balance + opening-stock import with the client's real data; verify totals with the client
- [ ] Confirm GST treatment of making charges with client's CA; set settings accordingly
- [ ] Create real users/roles; owner password set; backup routine (mysqldump cron) configured
- [ ] 1-page cheat-sheets per role (cashier billing steps, rate entry, day-close checklist)

---

## Standing test checklist (run before every release)
1. `cli/stress-billing.php` — concurrency guarantees
2. `cli/verify-ledger.php` — trial balance zero, stock ledger vs summaries, paid_amount recompute drift
3. Permission sweep — scripted calls per role asserting 403s exactly per matrix 03 §8
4. Cancel-everything drill — bill/purchase/payment cancel each fully reverses stock + ledgers
5. Rate-missing, negative-weight, over-stock-bulk-sale, duplicate-HUID rejections
6. **Completeness check** — every finalized sale appears in exactly one place: sales register total = GST-summary outward turnover total = P&L sales total, and stock-out rows reconcile piece-for-piece with invoice lines. Any sale recorded anywhere must be visible in all of them (see `memory.md` → Design decisions we will not revisit)

## Definition of done (MVP)
Owner sees an accurate P&L; counters bill in parallel without collisions; stock (pieces + grams + value) always matches the ledgers; vendors have clean statements; every user is boxed by their role; every sensitive action is in the audit log.
