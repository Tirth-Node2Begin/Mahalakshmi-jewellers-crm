# Jewellers CRM / ERP — Project Info

> **Status:** Planning (MVP scope defined, detailed specs to follow in this `plan/` folder)
> **Date:** 2026-07-28
> **Reference project (patterns only, NOT a copy):** `E:\EB projects\sejal-jewellers CRM\leadspark-crm`
> **Domain research source:** DataCare Softech jewellery ERP analysis document (see "Domain Notes" section at the end)

---

## 1. What this project is

A jewellery store management system for an Indian jewellery retailer dealing in **gold and silver**. The long-term vision is a full jewellery ERP (accounting, inventory, POS billing, vendors, manufacturing/karigar, schemes, CRM). The immediate goal is a focused **MVP** the client can start using day-to-day, built so every later module plugs into the same accounting and inventory core.

This is **not** a lead-management CRM. The reference project (leadspark-crm) is used only for its proven technical patterns — auth, RBAC, API conventions, transaction-safe money handling, numbering sequences — not its domain features.

---

## 2. MVP Scope (Phase 1 — what the client gets first)

The MVP contains exactly these five pillars. Nothing else ships in Phase 1.

### 2.1 Accounting with proper Profit & Loss

The financial backbone. Every money-touching transaction in the system (sale bill, purchase, expense, payment, receipt) posts to a ledger automatically — the user never does manual double-entry, but the books are always double-entry correct underneath.

- **Chart of Accounts (COA):** 3-level structure — Group → Subgroup → Ledger (e.g. `Income → Sales → Gold Sales`). Seeded with a jewellery-ready default COA:
  - Income: Gold Sales, Silver Sales, Making Charges Income, Old Metal Purchase margin, Other Income
  - Expenses: Purchases (metal), Wages/Karigar charges, Rent, Salaries, Utilities, Misc
  - Assets: Cash, Bank(s), Inventory (Gold), Inventory (Silver), Accounts Receivable (customers)
  - Liabilities: Accounts Payable (vendors), GST Payable (CGST/SGST/IGST), Advances from customers
- **Vouchers:** Sales invoice, Purchase invoice, Receipt, Payment, Expense, Journal (manual, admin-only). Each voucher = balanced debit/credit entries.
- **Profit & Loss report:** date-range P&L showing income (metal sales split gold vs silver, making charges) minus COGS and expenses → net profit. This is the report the client explicitly asked for — it must be accurate and simple to read.
- **Other core reports:** Ledger statement (any account, any period), Trial Balance, Day Book (all vouchers of a day), Cash/Bank book, Customer outstanding (receivables), Vendor outstanding (payables).
- **GST:** every invoice line carries HSN + GST rate; CGST/SGST auto-split (IGST for inter-state). GST summary report (output vs input tax) for return filing. *E-invoicing portal integration is NOT in MVP — export/report only.*
- **Rules:**
  - All money mutations run inside a single DB transaction (pattern: `Database::transaction()` + recompute-from-ledger, as proven in the reference project).
  - Vouchers are never hard-deleted — cancel/reverse only, with audit log (who, when, what).
  - Fiscal year Apr 1 – Mar 31, timezone `Asia/Kolkata`, currency ₹.

### 2.2 Inventory (Gold & Silver)

Jewellery inventory is **weight-first**, not just piece-count. This is the biggest difference from a normal CRM/ERP.

- **Item master:** item code, name, category (ring, chain, necklace, bangle, coin, raw metal…), **metal type (Gold / Silver)**, **purity (24K/22K/18K for gold; 999/925 for silver)**, gross weight, net weight, stone/other weight, making charge (per gram or fixed), HUID number (optional field, for hallmarked gold), HSN code, barcode/tag number, photo (optional), status (in-stock / sold / issued).
- **Two tracking modes:**
  - **Tagged pieces** — each jewellery piece is a unique tagged unit (own weight, own HUID). Sold individually.
  - **Bulk/lot stock** — raw metal, coins, small silver items tracked by total weight/quantity.
- **Stock movements:** Stock In (from purchase or opening stock), Stock Out (via sale), manual Adjustment (loss/correction, permission-gated, reason mandatory). Every movement is a row in a stock ledger — current stock is always recomputable from the ledger, never a blindly-updated counter.
- **Daily metal rate:** a simple screen to enter today's gold rate (per gram, per purity) and silver rate. Rates are stamped onto bills; rate history is kept.
- **Valuation:** weighted-average cost per metal/purity bucket (simplest correct method for MVP; FIFO can come later if the client asks).
- **Stock reports:** current stock by metal/purity/category (pieces + total weight + value), stock movement register, low-stock/dead-stock views (dead stock = tagged items in stock beyond N days).

### 2.3 Vendor Management

A dedicated Vendors section — its own pages, its own records.

- **Vendor master page:** list + detail. Fields: vendor code (auto: `VEN-0001`), name, firm name, phone, WhatsApp, email, address, GSTIN, vendor type (metal supplier / finished-jewellery supplier / karigar / service), opening balance, notes.
- **Purchase entry against vendor:** record purchases of raw metal or finished pieces — items, weights, purity, rate, GST → this simultaneously (a) increases inventory, (b) posts the purchase voucher, (c) increases vendor payable.
- **Vendor payments:** pay vendors (cash/bank/UPI/cheque), reducing payable.
- **Vendor ledger:** per-vendor statement (purchases, payments, running balance) and an overall Vendor Outstanding (AP aging) report.

### 2.4 RBAC — Role-Based Access Management

Full role/permission system from day one (the client asked for "RBAM").

- **Model:** flat 4-table RBAC exactly as proven in the reference project — `permissions` (as `resource.action` strings, e.g. `invoices.create`, `inventory.adjust`, `accounting.journal`, `reports.pnl`), `roles`, `role_permissions`, `users` (+ per-user overrides if needed).
- **Default roles (seeded, editable):**
  - **Owner/Admin** — everything, including COA edits, journals, adjustments, user management.
  - **Accountant** — vouchers, all financial reports, vendor payments; no user management.
  - **Sales staff / Cashier** — create bills, receive payments, view stock; cannot see P&L, cannot adjust stock, cannot edit rates of past bills.
  - **Inventory manager** — stock in/out, adjustments, item master; no accounting reports.
- **Enforcement:** `requirePermission()` on **every** API endpoint and every action branch (not just page-level hiding in UI). UI additionally hides what the user can't do.
- **Roles/permissions admin page:** admin can create roles, tick permissions, assign users.
- **Audit trail:** login history + who created/edited/cancelled every voucher and stock movement.

### 2.5 Concurrent Multi-Bill Generation (no breakage)

The client's explicit requirement: **multiple bills being generated at the same time (multiple counters/users) must never collide, corrupt data, or produce duplicate/skipped invoice numbers**, and every entry (stock decrement, ledger post, payment) must land correctly.

How the MVP guarantees this:

- **Invoice numbering:** `number_sequences` table with `SELECT … FOR UPDATE` inside the billing transaction (reference-project pattern) — two counters billing simultaneously get sequential, unique numbers (`INV-2627-00001` style, fiscal-year coded).
- **Atomic billing transaction:** one DB transaction covers: invoice header + lines → stock ledger out-rows → accounting voucher (debit cash/customer, credit sales + GST payable) → payment receipt if paid now. All-or-nothing; a failure rolls back everything.
- **Tagged-item locking:** selling a tagged piece row-locks that item; if two counters scan the same tag, the second gets a clean "already sold/being billed" message instead of a double sale.
- **Draft bills:** each counter can hold multiple in-progress draft bills in parallel; drafts touch nothing (no stock, no ledger) until finalized.
- **Concurrency test plan:** before handover, an automated test hammers the billing endpoint in parallel and verifies zero duplicate numbers, correct stock totals, and a balanced trial balance.

### 2.6 Billing itself (needed to make the above real)

Billing is technically part of MVP because accounting + inventory + multi-bill all hang off it:

- Sale bill screen: pick customer (or walk-in), add items by tag/barcode search or manual pick, auto-price = `net weight × today's rate × purity factor + making charges + GST`, allow manual price/making override (permission-gated), payment mode split (cash/UPI/card/bank/cheque), partial payment → remainder goes to customer outstanding.
- Basic customer master (name, phone, address, GSTIN optional) — enough for billing and receivables; full CRM/loyalty is a later phase.
- GST-compliant printed invoice (A5/A4 + thermal-friendly layout) showing HUID where applicable, weight breakup, making charges, tax split.
- **Old metal exchange (jewellery-specific, in MVP):** a bill can include old gold/silver taken from the customer — its value reduces the payable amount and the old metal enters a separate "Old Metal" stock bucket. This is daily reality in Indian jewellery stores and can't wait for Phase 2.

---

## 3. Explicitly OUT of the MVP (later phases)

Drawn from the DataCare research document — these are known, planned, and the schema should not block them, but they are **not** built in Phase 1:

| Phase 2+ feature | Notes from research doc |
|---|---|
| Manufacturing / Karigar module | Work orders, metal issue to karigar, process tracking (ghat/kundan/polish), wastage reports, tag generation/split |
| Schemes (gold saving schemes, EMI) | Scheme master, installment collection, maturity redemption |
| Loyalty & full CRM | Points, birthday/anniversary reminders, WhatsApp/SMS campaigns |
| Repairs | Repair intake → track → return → bill |
| RFID / hardware integrations | Barcode label printing basic support may land earlier; RFID, weighing-scale auto-fetch later |
| Multi-store / branch transfers | Single store assumed for MVP; no `branch_id` in MVP schema (add via migration only if truly needed) |
| Bullion trading / money lending | Separate heavy modules |
| E-invoicing / e-way bill portal API | MVP does GST reports/export only |
| Mobile app | Web-responsive UI is the MVP answer |
| Consignment stock | Research doc notes even DataCare lacks true consignment; skip |

---

## 4. Technical Direction

Adopt the **proven stack and conventions of the reference project** unless a jewellery-specific reason says otherwise:

- **Backend:** pure PHP 8.2+, no framework, PSR-4 `src/`, PDO prepared statements only, MySQL/MariaDB utf8mb4. JSON envelope `{success:true,...}` / `{success:false,error:{code,message}}`.
- **Auth:** JWT access cookie + rotating refresh token + CSRF double-submit + rate limiting (lift directly from reference implementation).
- **Frontend:** Next.js (App Router, CSR-only static export), TypeScript, Tailwind, TanStack Query, react-hook-form + zod, feature-folder structure `features/<domain>/{api,keys,types,schemas,hooks,components}`.
- **Money safety:** all mutations in DB transactions; derived figures (invoice paid amount, current stock, vendor balance) recomputed from their ledgers, never incremented blindly.
- **Numbering:** `number_sequences` with row locks — `INV` (fiscal-coded), `PUR`, `RCPT`, `PAY`, `VEN`, `CUST`, `ITM`.
- **What NOT to copy from the reference:** leads, campaigns, Google/Facebook integrations, HR/payroll, its schema wholesale. This project's schema is designed fresh around weight-based jewellery inventory and double-entry accounting.

Key domain-specific design decisions locked now:

1. **Weight is decimal(10,3) grams everywhere.** Purity stored as karat/fineness code with a purity factor table.
2. **Stock ledger + accounting ledger are separate but posted together** in the same transaction from one voucher.
3. **Rates:** daily rate table `metal_rates(date, metal, purity, rate_per_gram)`; bills stamp the rate used (historical bills never change when rates change).
4. **Tagged item = one row with lifecycle status**; bulk stock = quantity/weight ledger. Both feed the same stock reports.

---

## 5. Planned `plan/` folder documents

This `info.md` is the overview. Detailed specs to be written next, in order:

1. `01-database-schema.md` — full schema (COA, vouchers, ledger entries, items, stock ledger, metal rates, vendors, purchases, invoices, customers, RBAC tables, sequences, audit log)
2. `02-backend-spec.md` — API conventions, auth, transaction patterns, permission catalog
3. `03-api-list.md` — every endpoint with its `resource.action` permission
4. `04-frontend-spec.md` — pages, navigation, design system
5. `05-accounting-module.md` — voucher posting map (which transaction debits/credits what — seeded from the mapping table in the research doc)
6. `06-inventory-module.md` — item lifecycle, stock ledger, valuation, rates
7. `07-billing-module.md` — bill flow, concurrency design, old-metal exchange, print formats
8. `08-vendor-module.md` — vendor pages, purchase flow, payments
9. `09-rbac-and-audit.md` — roles, permission list, audit events
10. `10-build-phases.md` — MVP build order + test checklist (incl. the parallel-billing stress test)

---

## 6. Domain Notes (from the DataCare research document)

Condensed jewellery-domain facts that shaped the scope above:

- **Pricing formula:** `price = net metal weight × daily rate × purity factor + making charge + GST`. Making charge is a distinct income line (and can carry a different GST treatment) — never lump it into metal value.
- **HUID (Hallmark Unique ID):** BIS-mandated unique ID per hallmarked gold piece; must be stored on the item and printed on the invoice.
- **Gold vs stone weight:** gross vs net weight must be separate fields; customer pays metal rate only on net metal weight.
- **Old metal buy-back/exchange** is a standard counter transaction — value offsets the new purchase on the same bill.
- **Wastage/scrap** is valuable (re-melted); it needs its own stock bucket, not a write-off (fully relevant in the manufacturing phase, but the Old Metal bucket in MVP starts this pattern).
- **Ledger mapping for common transactions** (auto-posted by the system):
  - Cash sale → Dr Cash / Cr Gold(or Silver) Sales + Cr GST Payable
  - Credit sale → Dr Customer (AR) / Cr Sales + GST Payable
  - Customer payment → Dr Cash/Bank / Cr Customer
  - Metal purchase → Dr Inventory + Dr Input GST / Cr Vendor (AP)
  - Vendor payment → Dr Vendor / Cr Cash/Bank
  - Expense → Dr Expense ledger / Cr Cash/Bank
  - Old metal taken in exchange → Dr Old Metal Inventory / Cr Customer (offsets bill)
- **Typical risks the research flagged:** staff learning curve on accounting software (→ keep voucher entry invisible/automatic), tax misconfiguration (→ seed correct GST rates, lock rate edits behind permission), and data-migration errors (→ opening balances + opening stock get their own guided import step).
