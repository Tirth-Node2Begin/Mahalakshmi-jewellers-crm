# LeadSpark CRM — Implementation Plan

> The executable build plan. Specs live in `planning/` (twice-reviewed, authoritative);
> this file says **what to build, in what order, with which model, and how each phase is
> verified before moving on**. Update the checkboxes as work lands.

---

## 0. Operating rules (apply to every phase)

1. **Spec is law**: schema = `planning/01`, endpoints/permissions = `planning/03`,
   conventions = `CLAUDE.md`. Divergence = fix code or amend spec deliberately.
2. **Model routing** (global rule `~/.claude/CLAUDE.md`):
   - 🟢 *low model (haiku subagents)*: scaffolding, boilerplate endpoints/pages copied from an
     approved pattern, repetitive CRUD, master pages, CSS polish.
   - 🔵 *high model (main loop)*: first-of-a-kind pattern in each layer, schema, auth, RBAC,
     money math (invoices/payroll/inventory ledger), OAuth/token flows, debugging.
   - 🟣 *Codex high verification gate*: at the end of EVERY phase (and after any complex flow),
     spawn `codex:codex-rescue` to independently review the phase's diff against the planning
     docs — correctness, edge cases, security, spec adherence. Fix findings → re-verify → only
     then tick the phase checkbox.
3. **Definition of done per phase**: code matches spec · manual happy-path + edge-path walked in
   the running app · permission gates tested with a non-admin role · Codex gate passed clean.
4. Commit per phase minimum (git init in Phase 0); never commit `.env`.

---

## Phase 0 — Foundations *(planning/00 §4, 01, 02, 03 §8, 04, 08 · ~week 1)*

- [x] `git init` (phase numbers/titles match planning/15; one deliberate scope tweak: the
      reports Marketing tab moved from Phase 7 to Phase 8 — noted in planning/15 too);
      repo scaffold per 00 §4; `.env` from `.env.example` (secrets via API-SETUP-GUIDE §3)
- [x] `database/schema.sql` — all 59 tables from 01 (FK ordering per 01 §J) + `seed.php`
      (permission catalog + 8 roles + grants from 03 §8, masters from 01 §K, super admin)
      ✔ applied to MariaDB 10.4, 59 tables verified; 63 permissions seeded
- [x] 🔵 Backend core: `src/Core|Database|Security|Middleware|Auth|Validation|Support`,
      `api_bootstrap` (incl. `date_default_timezone_set`), `v1/auth/*` (login/refresh/me/csrf/
      logout/OTP chain), `users.php`, `rbac.php`, `user_permissions.php`, `nav.php`,
      `profile.php` (sessions + revoke), `settings.php`, `notifications.php`
      ✔ smoke-tested: reuse-detection breach revocation (bug found in txn rollback, fixed),
      CSRF 419, role-gated 403s, nav filtering with a real sales user
- [x] 🔵 Frontend shell: Next 16 scaffold (export config), tokens/dark mode **from `style.md`**,
      providers stack (Query→Theme→Auth→Permission→Nav→Lenis→Toaster), `HttpClient`+`ApiError`,
      login page, AppShell + nav guard (self-service routes), forced-password-change, `/profile`,
      `/notifications`, `/settings/users`, `/settings/roles`
      ✔ tsc clean · real-browser E2E: login → forced pw change → dashboard
- [x] 🟣 Codex gate: **PASSED** — 9 findings (1 critical privilege-escalation in users.php
      assignRoles, now fixed & verified with attack-path curl tests) all resolved & committed

> **STATUS (2026-07-03):** Phases 0–9 all built and committed (git log `bf736fe`→`272b34d`).
> A full-repo gap audit (2026-07-03) found four deliverables that had slipped through the
> phase commits; all four are now built and Codex-gate verified (findings fixed, re-verified):
> `/my` My Space self-service (P6) · reports Marketing tab 7 (P8) · reports CSV export (P7) ·
> `cron/daily_digest.php` (P7). Meetings module extended the same day (standalone meetings +
> client/team participants + full CRUD — planning/01/03/05 updated accordingly).
> Dev: XAMPP MariaDB `leadspark_crm`, `php -S 127.0.0.1:8000 -t .`, `frontend` on :3000.

## Phase 1 — Lead engine *(planning/05 · ~week 2)* — ✅ DONE (gate passed: 3 fixed, 2 deferred to P2)

- [ ] 🔵 `leads.php` (list/detail/create/update/status/followups incl. cancel/meetings/drop w/
      outcome/assign/bulk/import/export) + auto follow-up chain + `lead_sources.php` +
      `webhooks/lead_intake.php` (fail-closed secret, dedup, enum normalization)
- [ ] 🟢 Pages: `/leads` (KPIs/tabs/filters/bulk), `/leads/detail`, `/leads/meetings`,
      `/settings/lead-sources` — first list-page pattern is 🔵, then reuse is 🟢
- [ ] `ConvertToCustomerModal` **stub** (prefill mapping built, submit disabled behind a flag
      until Phase 2 wires it to `customers.php create` — per planning/15 Phase 1)
- [ ] 🟣 Codex gate: status machine (terminal via drop/convert only), chain roll-forward, webhook
      hardening, scope=own filtering

## Phase 2 — Customers, works, services *(planning/06)* — ✅ DONE (conversion browser-verified; gate running)

- [ ] `services.php` + `/settings/services` 🟢 · `customers.php` + `works.php` 🔵 (conversion
      transaction w/ guarded update + revert-unlink, timeline events, work assignment/kanban)
- [ ] Wire the Phase-1 `ConvertToCustomerModal` to `customers.php create` (flag removed)
- [ ] Pages: `/customers`, `/customers/detail` (tabs+timeline), `/works` (table+kanban), `/works/detail`
- [ ] 🟣 Codex gate: conversion + revert atomicity, customer_events contract,
      `ScopeSql::owned` scoping on customers/works

## Phase 3 — Invoices & payments *(planning/09)*

- [ ] 🔵 `number_sequences` allocator (FOR UPDATE) · `invoices.php` (totals recompute, finalize,
      edit guard grand_total ≥ paid, status derivation, cancel, payments + cheque lifecycle w/
      bounce reversal, RCPT numbers) — stock lines stay OFF until Phase 5
- [ ] Pages: `/invoices`, `/invoices/create` (+`?id=` edit, live preview, print), `/invoices/detail`,
      `/settings/company`, `/settings/bank-accounts` (QR upload hardening)
- [ ] 🟣 Codex gate: money math end-to-end (partial payments, bounce, delete-payment recompute,
      numbering race) + `ScopeSql::ownedVia` invoice scoping (08 §1)

## Phase 4 — Expenses (the 4 pages) *(planning/10)*

- [ ] 🔵 `expenses.php` (FY windows, insights compare, split), `expense_categories.php`
      (+ reminders CRUD), `monthly.php` (tracker upsert, salary 403), system-category guards
- [ ] 🟢 Pages: `/expenses`, `/expenses/insights`, `/expenses/monthly` (+`/category` drill-down),
      `/expenses/categories` — port the old CRM UX 1:1
- [ ] 🟣 Codex gate: tracker↔expense round-trips, system locks, FY quarter math

## Phase 5 — Inventory *(planning/11)*

- [ ] 🔵 `inventory.php` (ledger, avg-cost, adjust, issue_to_work, produce), `suppliers.php`,
      `purchases.php` (receive→stock, pay→expense, cancel→purchase_reversal) ·
      **flip on invoice stock lines** (sale / sale_reversal, availability 422 — Phase 3 built
      invoices with service/custom lines only)
- [ ] Pages: `/inventory` (+detail ledger), `/inventory/purchases` (+detail), `/inventory/production`,
      `/inventory/suppliers`
- [ ] 🟣 Codex gate: no negative stock, reversal netting, avg-cost correctness, invoice↔stock transaction

## Phase 6 — HRMS *(planning/07)*

- [ ] 🔵 `hr.php`: employees (EMP codes, optional login link), attendance (punch + manual + late
      calc), leaves (lazy balances, approve→attendance rows), payroll (documented formula,
      pay/unpay ↔ expense+tracker sync), masters 🟢, `/my` self-service
- [ ] Pages: `/hr` dashboard, `/hr/employees`, `/hr/attendance`, `/hr/leaves`, `/hr/payroll`,
      `/hr/settings`, `/my`
- [ ] 🟣 Codex gate: payroll formula vs 07 §1 worked example, salary↔expense bidirectional sync,
      leave balance edge cases

## Phase 7 — Reports & dashboards *(planning/14)*

- [ ] `dashboard.php` role payloads 🔵 · `/` role-based dashboard pages (widget kit 🔵 first,
      role variants 🟢) · `reports.php` **tabs 1–6** + compare + CSV export (tab 7 Marketing
      lands in Phase 8 — it reads the integration caches) · `/reports` tabbed frontend page ·
      `cron/daily_digest.php`
- [ ] 🟣 Codex gate: revenue=payments not billed, reversal netting in tab 5, per-tab permission gating

## Phase 8 — Google & Facebook dashboards *(planning/12, 13 · needs API-SETUP-GUIDE done)*

- [ ] 🔵 `TokenCrypto`, Google OAuth (openid+GBP, id_token→account row, per-GBP-account locations),
      FB OAuth (FLB config_id → long-lived → page tokens in `asset_token`), sync services +
      5-min cron backfill drainer + nightly branch
- [ ] Google endpoints: `connect` / `callback` / **`accounts` (incl. sync history)** /
      **`locations` toggle** / **`sync`** / `metrics` (location_ids + group_by) / `keywords` /
      `reviews` · Facebook endpoints: `connect` / `callback` / **`accounts`** /
      **`pages` toggle** / **`sync`** / `metrics` / `posts`; error-190 scoping (13 §9)
- [ ] Pages: `/dashboard/google`, `/dashboard/facebook` (shared KpiTile/TrendChart/ConnectCard kit),
      `/settings/integrations` (accounts, toggles, disconnect, sync history) ·
      **reports Marketing tab (7)** now that caches exist
- [ ] 🟣 Codex gate: token lifecycle (never-log-out + revocation paths), encryption at rest,
      no token in any response, backfill resumability

## Phase 9 — Hardening & ship *(planning/15 phase 9)*

- [ ] Permission-matrix audit vs 03 §8 · cross-module transaction tests (convert, finalize-stock,
      pay-salary, receive-purchase, bounce) · empty/loading/error states · mobile pass ·
      Lighthouse budget · backup script · cPanel deploy runbook + cron install
- [ ] 🟣 Final Codex gate: full-repo review, security checklist 02 §9

---

## Verification loop (the strict rule)

After every phase: **build → run it → walk the flows → Codex high review → fix → re-verify** —
repeat until a full pass finds nothing. No phase checkbox is ticked while any finding is open.

## External blockers to start early (don't wait for Phase 9)

- Google GBP API access approval (form — days of lead time) · consent screen published
- Meta app + FLB configuration + Advanced Access review
- Both documented step-by-step in [API-SETUP-GUIDE.md](API-SETUP-GUIDE.md); `.env` placeholders ready.
