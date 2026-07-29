# 00 — LeadSpark CRM: Master Plan Overview

> A **simple, general-purpose CRM** built from the proven patterns of the Extrabits CRM
> (`E:\Extrabits\Projects\crm`) — keeping what works (lead engine, expense module, RBAC, modern
> PHP auth stack, frontend architecture) and stripping what doesn't apply (branches, academics,
> students, policy engines).

---

## 1. Product Scope (what the user asked for)

| # | Module | Source | Doc |
|---|--------|--------|-----|
| 1 | **Leads** — full pipeline like Extrabits CRM (statuses, follow-ups w/ auto chain, meetings, drop reasons, sources, webhook intake) | ported + generalized | [05](05-module-leads.md) |
| 2 | **Customers & Lifecycle** — converted leads become customers; works/jobs with assignment; simple lifecycle stages | new | [06](06-module-customers-lifecycle.md) |
| 3 | **Basic HRMS** — employees, attendance (punch in/out), leaves, simple payroll, departments, shifts. **No policy engine.** | ported subset | [07](07-module-hrms.md) |
| 4 | **Role-based system** — flat 4-table RBAC (`resource.action` permissions). **No branches.** | ported minus branch | [08](08-module-rbac.md) |
| 5 | **Invoices / Billing** — invoice generator with auto numbering, line items, taxes, partial payments, print/PDF | new (payments patterns ported) | [09](09-module-invoices-billing.md) |
| 6 | **Expenses** — the 4 pages from Extrabits CRM: Daily Expenses, Insights, Fixed-Cost Monthly Tracker, Categories (+ bank accounts) | ported 1:1 minus branch | [10](10-module-expenses.md) |
| 7 | **Inventory** — two main types: **Raw Material** & **Stock** (finished goods); suppliers, purchases, transactions, low-stock alerts | new | [11](11-module-inventory.md) |
| 8 | **Google Dashboard** — Google Business Profile performance analytics; connect once, never log out (refresh tokens) | new | [12](12-dashboard-google.md) |
| 9 | **Facebook Dashboard** — Meta Page Insights analytics; connect once, never log out (long-lived page tokens) | new | [13](13-dashboard-facebook.md) |
| 10 | **Reports & Analytics** — per-module reports + cross-module P&L + main role-based dashboard | ported patterns | [14](14-reports-analytics.md) |

Cross-cutting: auth, notifications, settings, users — in [02-backend-architecture.md](02-backend-architecture.md).

Planning set: [01 database](01-database-schema.md) · [02 backend](02-backend-architecture.md) ·
[03 API list](03-api-list.md) · [04 frontend](04-frontend-architecture.md) · [15 roadmap](15-build-roadmap.md)

---

## 2. Tech Stack (locked)

### Backend — pure PHP (no framework)
- PHP 8.2+, MySQL/MariaDB (InnoDB, utf8mb4), **PDO prepared statements only** (the old CRM's
  mysqli/string-SQL legacy stack is NOT carried over).
- Structure copied from the old CRM's *modern* stack: PSR-4 `src/` autoloader, `Env`, `Request`,
  `Response`, `ErrorHandler`, `Validator`, `Database`, Service + Repository per domain.
- Auth: JWT access token (HttpOnly cookie, 15 min) + rotating refresh token (hashed in DB,
  reuse-detection) + CSRF double-submit cookie + DB-backed rate limiting.
- One `.php` endpoint per resource, dispatching on `?action=` / HTTP method (same style the old
  frontend already consumes).
- Response envelope (single standard, everywhere):
  `{"success":true, ...}` / `{"success":false, "error":{"code","message","details?"}}`.

### Frontend — Next.js static CSR (no SSR)
- Next.js 16 App Router, React 19, TypeScript, `output:'export'` (prod), `images.unoptimized`,
  **no middleware** — all guarding client-side; detail pages use query strings (`/leads/detail?id=`).
- Tailwind CSS v4 (single `globals.css`, oklch tokens, dark mode via next-themes — wired this time),
  shadcn-style primitives on **Base UI**, `cva` variants.
- **Framer Motion** (page/card entrances, modals, count-ups) + **Lenis** (smooth inertia scroll,
  added fresh — not in old CRM) + Recharts (dynamic import, `ssr:false`).
- TanStack Query v5 (server state) · react-hook-form + zod (forms — upgrade over old CRM's raw
  inputs) · sonner (toasts — replaces old CRM's per-page hand-rolled toasts) · lucide-react ·
  date-fns · cmdk · react-day-picker.
- `HttpClient` wrapper ported from old CRM (cookie auth, CSRF header, 401→refresh-retry→
  `auth-expired` event, `ApiError` normalization) — **minus** branch/academic-year scope injection.
- Feature folders: `features/<domain>/{api,keys,types,hooks,components}`.

### Conventions
- Timezone `Asia/Kolkata`, currency ₹ (`formatCurrency`), dates `YYYY-MM-DD` in APIs.
- Fiscal year Apr 1 – Mar 31 (used by invoice numbering + reports; simpler than old CRM's June AY).
- IDs: int auto-increment. Soft-delete only where the old CRM proved it matters (`is_active`
  masters); business rows hard-delete with guards.

---

## 3. How Everything Aligns (the glue)

```
                   webhook / manual / import
                              │
                           [LEAD]──follow-ups──meetings
                              │ convert
                              ▼
[Google/FB dashboards]   [CUSTOMER]──lifecycle stage──timeline
  (marketing side)            │
                              ├──> [WORK] (job/project, assigned to user, status pipeline)
                              │        └── consumes RAW MATERIAL (inventory issue vs work)
                              │
                              ├──> [INVOICE] (auto number, line items = services or STOCK items)
                              │        ├── stock line → inventory OUT
                              │        └── [INVOICE PAYMENTS] → bank_accounts
                              │
                              └──> notifications / reports

[EXPENSES] (4 pages) ── salary category locked ──> [HR PAYROLL] (pay run → expense row)
[INVENTORY] purchases ──> supplier bills can be recorded as expenses (category "Purchases")
[REPORTS] read from ALL of the above; P&L = invoice payments − expenses
[RBAC] gates every endpoint + nav; [USERS] assign/own leads, works; [EMPLOYEES] = HR profile of a user
```

Key alignment decisions (single source of truth each):
1. **`services` catalog** is shared: lead interest (`lead_services`), work type (`works.service_id`),
   invoice line (`invoice_items.service_id`). One taxonomy from first touch to billing.
2. **`users` vs `employees`**: `users` = login + assignment target everywhere (leads, works).
   `employees` = HR profile, optionally linked `user_id`. HR data (attendance/leave/payroll)
   hangs off employees only.
3. **Money flows into two ledgers only**: income = `invoice_payments`; spend = `expenses`.
   Payroll pays through expenses (system-locked Salary category, ported pattern). Inventory
   purchases post an expense row (category "Inventory Purchase") so P&L stays complete.
4. **Inventory movements are transaction-rows** (`inventory_transactions`), never mutate-in-place;
   current stock is a maintained column recomputed from the ledger on adjustment (recompute-from-
   ledger pattern ported from old CRM's installment reallocation).
5. **`bank_accounts`** shared master for expense payments + invoice payments.
6. **`number_sequences`** shared generator: `INV-`, `RCPT-`, `PO-`, `CUST-`, `WRK-`, `EMP-`,
   `RM-`, `ST-` (old CRM had no auto-numbering — new, race-safe via `SELECT ... FOR UPDATE`;
   full seed table in [01 §K](01-database-schema.md)).
7. **`notifications`** generalized (`entity_type`/`entity_id` deep links) — assignment events,
   overdue follow-ups, low stock, leave approvals, invoice overdue.
8. **Integrations cache locally** (`integration_metrics_daily`) so Google/FB dashboards render
   from our DB — fast, quota-safe, works even if provider is temporarily down.

---

## 4. Repository Layout

```
leadspark-crm/
├── api/                      # PHP endpoints (one per resource + v1/auth/*)
│   ├── v1/auth/              # login, refresh, me, csrf, logout, forgot/reset
│   ├── integrations/         # google/*.php, facebook/*.php
│   ├── cron/                 # integrations_sync.php, daily_digest.php
│   └── webhooks/             # lead_intake.php
├── src/                      # PSR-4 CRM\ namespace
│   ├── Core/  Security/  Middleware/  Validation/  Database/  Support/
│   ├── Leads/  Customers/  Works/  HR/  Expenses/  Invoices/  Inventory/
│   ├── Integrations/         # GoogleClient, FacebookClient, TokenService, SyncService
│   └── bootstrap.php
├── database/
│   ├── schema.sql            # full DDL (01-database-schema.md is the spec)
│   ├── seed.php              # roles, permissions, admin user, defaults
│   └── migrations/
├── frontend/                 # Next.js app (04-frontend-architecture.md)
├── uploads/                  # qrs/, company/, employees/ (guarded)
├── planning/                 # ← these docs
└── .env.example
```

---

## 5. Non-Goals (explicitly out, keep it simple)

- No branches / multi-tenant, no academic anything, no chat module, no AI assistant, no 3D mascot,
  no socket server, no HR policy engine / statutory compliance, no H-RBAC hierarchy engine.
- No server-side rendering; no server pagination beyond capped lists (old CRM pattern: server
  returns ≤100–200 rows, client paginates; server accepts `page` for future growth).
- Quotations, multi-currency, Instagram insights, WhatsApp integration → phase 2 backlog
  ([15-build-roadmap.md](15-build-roadmap.md)).
