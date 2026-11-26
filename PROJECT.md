# Jewellers CRM / ERP — Complete Project Reference

> One file with everything about the project. Last updated **2026-10-13**.
> Deeper detail lives in: `plan/` (specs), `memory.md` (status + decisions), `SETUP.md` (install), `DEPLOY.md` (hosting), `style.md` (design), `CLAUDE.md` (rules for AI sessions).

---

## 1. What it is

Jewellery store management system (gold, silver, platinum) for an Indian retailer.

| | |
|---|---|
| Purpose | Double-entry accounting with a true P&L, weight-first inventory, billing, purchases, vendors, RBAC |
| Client repo | `github.com/Tirth-Node2Begin/Mahalakshmi-jewellers-crm` (branch `main`) |
| Live URL | https://jeweller-crm.node2begin.com |
| Local path | `E:\EB projects\Jewllers crm` |
| Origin | Copied 2026-07-28 from `E:\EB projects\sejal-jewellers\sejal_jewellers_crm` (auth/RBAC + design system), rebuilt around jewellery |
| Fiscal year | 1 Apr – 31 Mar · timezone `Asia/Kolkata` · currency ₹ (Indian formatting) |

**MVP pillars:** accounting + P&L · weight-based inventory · vendor management · RBAC + audit · collision-proof multi-counter billing · estimates · old-metal exchange.

---

## 2. Tech stack (locked)

| Layer | Technology |
|---|---|
| Backend | Core PHP 8.2+, no framework, PSR-4 `src/`, namespace `CRM\`, PDO prepared statements only |
| Database | MySQL 8 / MariaDB 10.5+, InnoDB, utf8mb4 (local: XAMPP, DB `jewellers_crm`) |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind, static export (`output:'export'`), CSR only |
| Data/forms | TanStack Query v5, react-hook-form + zod, sonner (toasts) |
| UI libs | lucide-react, recharts, framer-motion, cmdk, react-day-picker, date-fns, next-themes, lenis |
| Auth | JWT access cookie (15 min) + rotating refresh token with reuse detection + CSRF double-submit + DB rate limiting |

**Frontend rules:** no SSR, no `middleware.ts`, no dynamic route segments (detail pages use `?id=`). Feature folders `features/<domain>/{api,types,components}`, primitives in `shared/ui/`, HTTP through `shared/api/http-client.ts`.

**API envelope:** `{success:true,...}` or `{success:false,error:{code,message,details?}}`.
Every endpoint starts with `require_once .../src/Support/api_bootstrap.php`, then `requireApiAuth()`, `requirePermission()`, `requireMethod()`.

---

## 3. Folder structure

```
Jewllers crm/
├── api/                 thin PHP endpoints (one file per resource) + api/cron/
├── src/                 PSR-4 classes (CRM\)
│   ├── Accounting/      Ledgers, VoucherService, AccountingRepository
│   ├── Jewellery/       RateService, Pricing, StockService, InvoiceDraft, BillingService,
│   │                    BillingRepository, PaymentService, PurchaseService, EstimateService, Metals
│   │   └── RateFeed/    IbjaSource, CbicSource, HttpFetcher, PurityMapper, Quote,
│   │                    SanityCheck, SourceResult, RateFeedService
│   ├── Auth/ Security/  AuthService, PermissionService, JwtService, CsrfToken, Cookie, TokenCrypto, AuditLogger
│   ├── Core/            Env, Request, Response, ErrorHandler, SecurityHeaders
│   ├── Database/        Database (PDO + transaction())
│   ├── Middleware/      CorsMiddleware, RateLimitMiddleware
│   ├── Customers/ Vendors/ Expenses/ Inventory/ Invoices/ Reports/
│   ├── Support/         api_bootstrap, Audit, FiscalYear, NumberSequence, NavMap, Notify, Mailer,
│   │                    ScopeSql, CustomerTimeline, GstVisibility
│   └── Validation/      Validator
├── database/            schema.sql, migrations/, seed.php, reset-admin.php
├── cli/                 verify-ledger.php, stress-billing.php, seed_demo.php, check-rate-feed.php
├── frontend/            Next.js app (src/app, src/features, src/shared, src/components)
├── deploy/              build-live.ps1 (builds the upload bundle)
├── live/                generated upload bundle (frontend export + api/src/database/cli/.htaccess/.env)
├── plan/                specs for THIS product (info.md + 01–10)
├── planning/            inherited lead-CRM docs — reference only
├── backups/             DB backups
├── start.bat            one-click local start (backend + frontend tabs)
└── CLAUDE.md, memory.md, SETUP.md, DEPLOY.md, style.md, PROJECT.md
```

---

## 4. Modules and features

| Module | What it does |
|---|---|
| **Billing (Bills)** | New bill in 3 clicks: customer → items (tag/barcode search) → payment. Auto price = net weight × rate × purity + making + GST. Drafts, split payment modes, partial payment → outstanding, old-metal exchange, cancel (never delete), printed GST invoice with HUID |
| **Estimates** | Quotation — no number from the invoice series, no stock, no ledger. Convertible to a bill |
| **Payments** | Money received from customers (receipts), cancel |
| **Rates** | Daily per-gram rate per purity; rate stamped on each bill; history kept. Auto-fetch from IBJA, staged for approval |
| **Inventory** | Tagged pieces (unique, row-locked on sale) + bulk stock (by weight). Stock ledger, weighted-average cost, opening stock, adjustments (reason mandatory), movements register |
| **Purchases** | Purchase against a vendor → stock in + purchase voucher + vendor payable, in one transaction. Cancel |
| **Vendors** | Suppliers / Jewellery Makers / Services & Others, custom vendor types, vendor payments, vendor ledger, outstanding |
| **Customers** | Master, ledger, timeline, outstanding |
| **Accounting** | Chart of accounts (group → subgroup → ledger), vouchers, manual journal (permission-gated), ledger statement with Dr/Cr and To/By particulars |
| **Books (reports)** | P&L, trial balance, GST summary, outstanding (AR/AP), day book, stock report, sales/purchase registers |
| **Expenses** | Expenses by category (post Dr category / Cr cash-bank), fixed monthly costs, insights |
| **HR** | Employees, payroll (restored 2026-08-03) |
| **Leads** | Lead list (restored 2026-08-03) |
| **Settings** | Company (GSTIN, tax rates), users, roles/permissions, bank accounts, audit log |
| **Dashboard / notifications / profile** | Role-based dashboard variants, in-app notifications, change password |

### Pricing rules
- `price = net metal weight × daily rate × purity factor + making charge + GST`
- Making charge: per gram / fixed / percent — a separate income line.
- GST: CGST+SGST in-state, IGST inter-state (decided by GSTIN state code). Seeded `default_tax_rate` 3%, `making_tax_rate` 5% — **placeholders, confirm with the CA**.
- Tax-inclusive or exclusive pricing; per-line tax treatment (taxable / exempt / nil-rated / non-GST / reverse charge) with a mandatory reason, gated by `invoices.override`.
- Old metal taken in exchange reduces the payable and enters its own stock bucket.

### Voucher posting map (auto, user never does double entry)
| Transaction | Debit | Credit |
|---|---|---|
| Cash sale | Cash/Bank | Metal Sales + Making Income + GST Payable |
| Credit sale | Customer (AR) | Sales + GST Payable |
| Customer payment | Cash/Bank | Customer |
| Purchase | Inventory + Input GST | Vendor (AP) |
| Vendor payment | Vendor | Cash/Bank |
| Expense | Expense ledger | Cash/Bank |
| Old metal exchange | Old Metal Inventory | Customer |
| Sale cost | COGS | Inventory |

---

## 5. Non-negotiable rules

1. **One set of books.** Every finalised sale posts to the ledger and the stock ledger and appears in the sales register, GST summary and P&L alike. No hidden book, no login that sees different totals. (See §13 — the current code violates this.)
2. Money/stock mutations run inside one `Database::transaction()`.
3. Derived values (`paid_amount`, stock, balances) are **recomputed from their ledgers**, never incremented.
4. Numbering through `NumberSequence::next()` (`SELECT … FOR UPDATE`) — gap-free, unique under concurrency.
5. Tagged pieces are row-locked at finalize (`StockService::lockTaggedForSale`, ascending id) — the second counter gets a clean 409, never a double sale.
6. Every voucher balances (ΣDr = ΣCr) — `VoucherService::post()` throws otherwise.
7. **Cancel, never delete** — reversal rows + cancelled voucher + `Audit::log()`.
8. `requirePermission()` on every endpoint action branch. Cost values (`avg_cost`, COGS) stripped for users without `reports.stock` / `accounting.read`.
9. Weights are `DECIMAL(10,3)` grams everywhere.
10. UI stays simple: plain language, big controls, no accounting jargon outside the Accounting page.
11. Never put a voucher status/date filter in a LEFT JOIN's ON clause when the aggregate reads the entry table (it silently breaks date ranges).
12. A round-off entry's sign follows the side carrying the rounded figure — sales and purchases are opposite.

---

## 6. Database

59 tables in the local DB.

| Area | Tables |
|---|---|
| Auth / RBAC | `users`, `roles`, `permissions`, `role_permission_grants`, `user_role_assignments`, `auth_sessions`, `password_reset_otps`, `api_rate_limits` |
| Audit | `audit_logs`, `security_audit_logs` |
| Accounting | `account_groups`, `ledger_accounts`, `vouchers`, `voucher_entries`, `bank_accounts` |
| Metals / rates | `metals`, `purities`, `metal_rates`, `rate_feed_runs`, `rate_feed_quotes` |
| Inventory | `inventory_items`, `inventory_categories`, `inventory_transactions` (stock ledger), `units` |
| Sales | `invoices`, `invoice_items`, `invoice_old_metal`, `invoice_payments`, `estimates`, `estimate_items` |
| Purchases / vendors | `purchases`, `purchase_items`, `suppliers` (vendors), `vendor_types`, `vendor_payments` |
| Customers | `customers`, `customer_events`, `family_members` |
| Expenses | `expenses`, `expense_categories`, `expense_reminders`, `fixed_cost_items`, `fixed_cost_monthly_payments` |
| HR | `employees`, `employee_attendance`, `departments`, `designations`, `shifts`, `holidays`, `payroll_runs`, `payroll_items` |
| Leads | `leads`, `lead_activities`, `lead_sources` |
| System | `settings`, `number_sequences`, `notifications`, `message_log`, `message_templates` |

**Naming to remember:** vendors table is `suppliers`; items = `inventory_items`; stock ledger = `inventory_transactions`; audit = `audit_logs`.

**Metals:** gold, silver, platinum (master table — a new metal can be added from the app; `Metals::create()` also creates its inventory + sales ledgers and first purity).
**Purities:** gold 24K (0.999), 22K (0.916), 18K (0.750) · silver 999, 925 · platinum PT950.
**Chart of accounts:** Assets (Cash & Bank, Inventory, Accounts Receivable, Tax Assets) · Liabilities (Accounts Payable, Tax Liabilities, Opening Balances) · Income (Sales, Other Income) · Expenses (Cost of Goods Sold, Operating Expenses).

**Number sequences**
| Key | Format | Scope |
|---|---|---|
| invoice | `INV-2627-00001` | per fiscal year, pad 5 |
| estimate / receipt / purchase / vendor_payment / voucher | `EST-` `RCPT-` `PUR-` `PAY-` `VCH-` | per fiscal year, pad 5 |
| customer / vendor / employee | `CUST-0001` `VEN-0001` `EMP-0001` | global, pad 4 |
| item_st / item_rm / adjustment | `ST-0001` `RM-0001` `ADJ-0001` | global, pad 4 |

**Migrations (apply in this order after `schema.sql`):**
1. `2026_07_28_jewellery_erp.sql` — drops old modules, adds jewellery + accounting
2. `2026-07-29-case-sensitive-usernames.sql` — only for DBs created before 2026-07-29
3. `2026_07_30_platinum.sql`
4. `2026_07_30_metals_master.sql`
5. `2026_08_01_vendor_types.sql`
6. `2026_08_01_non_gst_billing_permission.sql`
7. `2026_08_02_vendor_type_category.sql`
8. `2026_08_03_restore_hr_payroll.sql`
9. `2026_08_03_restore_leads.sql`
10. `2026_08_04_rate_feed.sql`
11. `2026_08_05_performance_indexes.sql`

Then `php database/seed.php`. (`SETUP.md` / `DEPLOY.md` list only some of these — they are behind.)

---

## 7. API endpoints (`api/*.php`)

| Endpoint | Purpose |
|---|---|
| `invoices.php` | bills: draft, finalize, cancel, list, detail |
| `estimates.php` | quotations |
| `payments.php` | customer receipts |
| `purchases.php` | purchases |
| `vendor_payments.php` | vendor payments |
| `vendors.php` | vendor master, types, ledger |
| `customers.php` | customer master, ledger, timeline |
| `stock.php` | jewellery item CRUD, opening stock, adjust, movements, summary |
| `inventory.php` | generic inventory lists (inherited) |
| `metals.php` | metals master |
| `rates.php` | daily rates + `feed_*` actions |
| `accounting.php` | COA, vouchers, journal, ledger statement |
| `books.php` | ledger-derived reports: P&L, trial balance, GST, outstanding, registers, stock |
| `reports.php` | operational analytics |
| `dashboard.php` | dashboard data |
| `expenses.php`, `expense_categories.php`, `monthly.php` | expenses, categories, fixed monthly costs |
| `bank_accounts.php` | bank accounts |
| `hr.php` | employees, payroll |
| `leads.php` | leads |
| `users.php`, `rbac.php`, `user_permissions.php` | users, roles, permissions |
| `settings.php`, `nav.php`, `profile.php`, `notifications.php`, `audit.php` | settings, sidebar, profile, notifications, audit log |
| `cron/fetch_rates.php`, `cron/daily_digest.php` | scheduled jobs |
| `v1/` | auth endpoints (login, refresh, logout…) |

---

## 8. Frontend routes

| Section | Routes |
|---|---|
| Home | `/` (dashboard), `/login`, `/profile`, `/notifications` |
| CRM | `/leads`, `/customers`, `/customers/detail` |
| Billing | `/invoices`, `/invoices/create`, `/invoices/detail`, `/estimates`, `/estimates/create`, `/estimates/detail`, `/payments` |
| Stock | `/rates`, `/inventory`, `/inventory/items`, `/inventory/detail`, `/inventory/movements`, `/inventory/adjust` |
| Purchases | `/purchases`, `/purchases/create`, `/purchases/detail` |
| Vendors | `/vendors`, `/vendors/detail`, `/vendors/makers`, `/vendors/services`, `/vendors/payments` |
| HR | `/hr/employees`, `/hr/payroll` |
| Accounts | `/accounting`, `/accounting/ledger`, `/expenses`, `/expenses/monthly`, `/expenses/categories`, `/expenses/insights` |
| Reports | `/reports`, `/reports/pnl`, `/reports/trial-balance`, `/reports/gst`, `/reports/outstanding`, `/reports/stock`, `/reports/daybook`, `/reports/ledger-view` |
| Settings | `/settings/users`, `/settings/roles`, `/settings/bank-accounts`, `/settings/company`, `/settings/audit` |

Sidebar comes from the server (`src/Support/NavMap.php`, filtered by permission). **A page reached only from a button (e.g. `/invoices/create`) must be added to `NavMap::SUB_ROUTE_PARENTS`** or the route guard blocks it.

Feature folders: `accounting, audit, billing, books, customers, dashboard, expenses, hr, inventory, invoices, leads, purchases, rates, reports, settings, stock, vendors`.

---

## 9. Roles and permissions

**Roles:** Owner (`super_admin`, wildcard), Accountant, Cashier, Inventory Manager, HR Manager, Non GST Billing Access. A user can hold many roles.

**Permissions (60, `resource.action`):**

| Resource | Actions |
|---|---|
| accounting | read, manage, journal |
| audit | read |
| bank_accounts | manage |
| customers | read, create, update, delete, ledger |
| dashboard | read |
| estimates | read, create |
| expenses | read, create, update, delete |
| hr / hr.employees / hr.payroll | read · manage · read, manage, pay |
| inventory | read, manage, adjust, issue, opening |
| invoices | read, create, cancel, override, non_gst |
| leads | read, create, update, delete |
| payments | read, create, cancel, vendor |
| purchases | read, create, cancel |
| rates | read, set, feed |
| rbac | manage |
| reports | read, pnl, gst, outstanding, stock, accounting |
| settings | read, manage |
| users | read, manage |
| vendors | read, manage, ledger |

- `reports.pnl` is granted to the Owner only by default.
- Each permission has a plain-language label (seeded) shown on the Roles page.
- Cashier gets 403 on P&L, trial balance, GST, accounting, purchases, audit, vendor payments.

**Seeded logins — change before the client uses them**
| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Super Admin |
| `Admin` | `admin@123` | Super Admin |

Usernames are case-sensitive. Reset: `php database/reset-admin.php [password] [username]`.

---

## 10. Daily rate feed

- Source: **IBJA** (`https://www.ibjarates.com/`) — no government site publishes a daily retail rate. CBIC tariff values are an optional manual cross-check (Settings).
- Flow: `api/cron/fetch_rates.php` → `src/Jewellery/RateFeed/` → rates **staged** on the Rates page → a user with `rates.set` presses **Apply**. Never written straight into `metal_rates`.
- Units: gold and platinum per 10 g, silver per kg. `Quote::perGram()` is the only converter.
- Published: gold 999/995/916/750/585, silver 999, platinum 999. Sterling 925 and PT950 are derived pro-rata (matched by fineness, not code).
- Parser is strict (exact span ids `lblGold999_AM` …; needs ≥3 gold quotes).
- Before publication IBJA shows only `lbl_Message` ("Rates will be uploaded soon") — reported as "not published yet" (fixed 2026-10-12; previously misreported as "layout changed").
- Sanity checks: day-over-day move > `rate_feed_max_move_pct` (8%), purity ordering, implausible per-gram value, gold:silver ratio outside 15–150, unchanged publication token.
- Settings: `rate_feed_enabled`, `rate_feed_max_move_pct`, `rate_feed_cbic_gold_usd_10g`, `rate_feed_cbic_silver_usd_kg`, `rate_feed_cbic_notification`, `rate_feed_cbic_effective_from`, `rate_feed_usd_inr`.
- Dry run (writes nothing): `php cli/check-rate-feed.php`.
- Cron is documented at 09:15 and 15:30, but IBJA publishes around noon and ~5 pm, so the 09:15 run comes back empty — move to about 12:45 and 17:30 (times to be confirmed).

---

## 11. Run locally

**Requirements:** PHP 8.2+ (`pdo_mysql`, curl), MySQL/MariaDB (XAMPP), Node.js 20+.

```
start.bat            # double-click: backend + frontend as two tabs in one Windows Terminal window
```

By hand:
```bash
php -S localhost:8000          # backend, from project root
cd frontend && npm install && npm run dev   # frontend on :3000
```

- App: http://localhost:3000 · API: http://localhost:8000/api
- MySQL must already be running (XAMPP) on port 3306.

**First-time setup**
```bash
mysql -u root -p -e "CREATE DATABASE jewellers_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p jewellers_crm < database/schema.sql
# then every migration in §6, in order
cp .env.example .env            # fill DB + secrets
php database/seed.php
php cli/seed_demo.php           # optional demo data — never in production
```

**`.env` keys:** `APP_ENV, APP_URL, FRONTEND_URL, APP_FORCE_HTTPS, TIMEZONE, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, JWT_ISSUER, JWT_AUDIENCE, JWT_ACCESS_SECRET, JWT_ACCESS_TTL, REFRESH_TTL, REFRESH_TTL_REMEMBER, CSRF_SECRET, COOKIE_SECURE, COOKIE_SAMESITE, COOKIE_DOMAIN, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW, CORS_ALLOWED_ORIGINS, APP_ENC_KEY, CRON_KEY, CURL_CA_BUNDLE, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM`. Never commit `.env`.

---

## 12. Verify, deploy, back up

**Verification (run before every release)**
```bash
php cli/verify-ledger.php              # 9 checks: balanced vouchers, trial balance zero, no stock/paid drift, no hidden sales
php cli/stress-billing.php 20 30       # parallel billing — TEST DATABASE ONLY
php cli/stress-billing.php --cleanup
php cli/check-rate-feed.php            # rate feed dry run
cd frontend && npm run typecheck && npm run build
```
Plus a permission sweep per role (`plan/03` §8).

**Deploy** (frontend export and PHP API share one document root, API called same-origin at `/api/*`)
```powershell
powershell -File deploy\build-live.ps1     # builds frontend/out and assembles live/
```
1. Stop `npm run dev` first (a production build breaks the running dev server).
2. Upload the **contents of `live/`** to the subdomain's `public_html/`.
3. Server `.env` from `.env.production.example`: `APP_ENV=production`, `APP_FORCE_HTTPS=1`, `COOKIE_SECURE=1`, fresh secrets.
4. Import `schema.sql` + migrations in order, then `php database/seed.php`.
5. Cron: `daily_digest.php` 08:00, `fetch_rates.php` twice a day (or URL form with `?key=<CRON_KEY>`).
6. Check `/.env`, `/src/...`, `/database/schema.sql`, `/cli/...` all return 403/404.
7. Do not upload `plan/`, `planning/`, `frontend/` sources, `node_modules/`, `*.md`, `.git/`.
8. **Never keep a zip inside `live/`** — `.htaccess` does not block `.zip`, so it becomes a public download of the source and `.env`.

**Backup:** `mysqldump -u root -p jewellers_crm | gzip > backup-$(date +%F).sql.gz` (nightly).

**First-run checklist for the shop:** company + GSTIN → tax rates confirmed with CA → today's rates → opening stock → opening balances → real users → run the verification tools.

---

## 13. Open issues (as of 2026-10-13)

| # | Issue | State |
|---|---|---|
| 1 | **`src/Support/GstVisibility.php` breaks the one-set-of-books rule.** It hides non-taxable sale lines, their receipts and stock-outs from every username except exact `Admin`, and nets the hidden stock-outs against inward rows. Used across 18 files (`api/books.php`, `invoices.php`, `stock.php`, `reports.php`, `BillingRepository`, `DashboardRepository`, …). This is the dual-book design that was declined on 2026-07-28 and 2026-07-29. | **Must be removed before release** |
| 2 | `php cli/verify-ledger.php` fails **2 of 9** on the local DB: tagged item status vs ledger (ST-0041…ST-0044), and GST turnover 59,28,680.26 vs P&L income 57,78,586.92. | Failing |
| 3 | `live/live.zip` exists inside the upload bundle — would expose source and `.env` if uploaded (§12 rule 8). | Delete before upload |
| 4 | Bill-level discount is not pushed to lines, so GST is charged on the pre-discount value. Needs the CA's answer: discount before or after tax? | Open — CA |
| 5 | GST on making charges (3% bundled vs 5% separate). | Open — CA |
| 6 | Rate-feed cron runs before IBJA publishes (§10). | To reschedule |
| 7 | `SETUP.md` / `DEPLOY.md` migration lists are missing the 08-01 non-GST, 08-03 HR/leads and 08-05 index migrations. | Docs behind |
| 8 | Making scheme (per-gram/fixed/percent) is not stored on the line — a reopened draft shows `fixed`. | Known gap |
| 9 | Stock summary groups by metal × purity × tagged/bulk, not by category. | Known gap |
| 10 | Dashboard deep links `/inventory?add=1` / `?low=1` no longer do anything. | Known gap |
| 11 | `ExpenseService::assertFixedItemPayable()` blocks system fixed-cost items while `api/monthly.php` allows paying them. | Decide |
| 12 | Large uncommitted working tree on `main` (50+ modified files, new HR/leads/rate-feed files). | Uncommitted |
| 13 | Seeded admin passwords are documented defaults. | Change before go-live |

**Questions for the client**
- Does the client run two firms / two GSTINs? If yes → build proper multi-company (both books complete and visible).
- Final accent colour / branding.
- Back-dating window for bills (default 3 days) and discount cap.
- Estimate validity (default 7 days); may quoted rates be held on conversion?
- Which Phase 2 features are wanted.

---

## 14. Not built (Phase 2+)

Manufacturing / karigar work orders · gold saving schemes / EMI · loyalty + campaigns · repairs · RFID / weighing-scale integration · multi-store transfers · bullion trading / money lending · e-invoicing / e-way bill API · mobile app · consignment stock.

---

## 15. History

| Date | Event |
|---|---|
| 2026-07-28 | Specs written (`plan/`); codebase copied in and rebuilt as the jewellery ERP; verified on a real DB (24 counters racing for 8 pieces → 8 sold, 16 clean conflicts, numbers gap-free) |
| 2026-07-29 | Demo seeder rewritten; purchase round-off sign bug fixed; ledger Dr/Cr with particulars; case-sensitive usernames |
| 2026-07-30 | Platinum added; metals became a master table |
| 2026-07-31 | Every new bill must carry a customer (no walk-in on bills) |
| 2026-08-01 / 02 | Custom vendor types, per partner page; non-GST billing permission added |
| 2026-08-03 | HR/payroll and leads modules restored |
| 2026-08-04 | Daily rate auto-fetch (IBJA) built |
| 2026-08-05 | Performance indexes |
| 2026-10-12 | Rate-feed "layout changed" false alarm fixed; `start.bat` added |
