# 15 — Build Roadmap

> Order of implementation, chosen so every phase ships something usable and later modules land on
> stable foundations. Estimates assume one developer + AI assistance; adjust freely.

## Phase 0 — Foundations (week 1)
- Repo scaffold per [00 §4](00-overview.md); `.env.example`; `database/schema.sql` from
  [01](01-database-schema.md) + `seed.php`.
- Backend core: `src/Core|Database|Security|Middleware|Auth|Validation|Support`,
  `api_bootstrap`, auth endpoints, users/rbac/nav/user_permissions/profile/settings/notifications.
- Frontend shell: Next scaffold, tokens/theme (light+dark), providers (Query/Auth/Permission/
  Nav/Lenis/Toaster), HttpClient, login page, AppShell + sidebar, guard, forced-password-change.
- ✅ Exit: login → empty permission-gated dashboard, users & roles manageable.

## Phase 1 — Lead engine (week 2)
[05](05-module-leads.md): tables, `leads.php` + `lead_sources.php` + webhook, auto follow-up
chain, list/detail/meetings pages, sources settings page, convert-modal stub (customer create
comes next phase — modal hidden behind flag until then).
✅ Exit: full lead pipeline usable end-to-end incl. webhook intake.

## Phase 2 — Customers, works, services (week 3)
[06](06-module-customers-lifecycle.md): services catalog, customers + lifecycle + timeline,
works board/kanban + comments, conversion wired (lead → customer transactional), notifications
for assignment. ✅ Exit: lead → customer → assigned work flows.

## Phase 3 — Invoices & payments (week 4)
[09](09-module-invoices-billing.md): number_sequences, invoices/items/payments, builder UI w/
live preview, print, cheque lifecycle, company settings page. Stock lines deferred (type
service/custom only until Phase 5 flips on stock). ✅ Exit: billing + collections + outstanding.

## Phase 4 — Expenses (week 5)
[10](10-module-expenses.md): the 4 pages + bank accounts + drill-down, ported logic (split,
tracker upsert, system-category guards, FY windows). ✅ Exit: complete spend tracking; P&L
possible.

## Phase 5 — Inventory (week 6)
[11](11-module-inventory.md): items/categories/units/suppliers, ledger + adjust, purchases
(receive → stock, pay → expense), production, issue-to-work; **flip on invoice stock lines**
(finalize → stock out; cancel → restock). ✅ Exit: raw material + stock cycles closed.

## Phase 6 — HRMS (week 7)
[07](07-module-hrms.md): employees/departments/designations/shifts, attendance + punch,
leaves + balances, holidays, simple payroll + salary↔expense integration (SALARY system
category + tracker lock), self-service `/my`. ✅ Exit: basic HRMS live.

## Phase 7 — Reports & dashboards (week 8)
[14](14-reports-analytics.md): dashboard.php role payloads + widgets; reports.php tabs 1–6 +
CSV export (tab 7 Marketing lands in Phase 8 — it reads the integration caches);
daily_digest cron (overdue follow-ups/invoices, low stock, reminders).
✅ Exit: analysis surfaces complete except the Marketing tab.

## Phase 8 — Google & Facebook dashboards (week 9)
[12](12-dashboard-google.md) + [13](13-dashboard-facebook.md): OAuth flows (Google openid+GBP;
Facebook Login for Business config), token crypto, sync services + 5-min cron backfill drainer,
metrics/keywords/reviews/posts endpoints, the two dashboard pages (shared
KpiTile/TrendChart/ConnectCard kit), and the shared `/settings/integrations` page (spec: 12 §7).
⚠ External prerequisites (start early, they gate this phase): Google Cloud project + GBP API
access approval; Meta app + Advanced Access review. Both documented in docs 12/13 §2.
✅ Exit: connect once, analytics render from local cache, cron keeps tokens alive, and the
reports Marketing tab (14 §Tab 7) goes live on top of the caches.

## Phase 9 — Hardening & polish (week 10)
Permission-matrix audit vs [03 §8](03-api-list.md) · cross-module transaction tests (convert,
finalize-invoice-stock, pay-salary, receive-purchase, bounce-cheque) · empty/loading/error
states everywhere · mobile pass · Lighthouse budget · backup script · deploy runbook
(cPanel: upload api+src, `out/` static, cron entries, .env).

## Backlog (phase 2+, explicitly deferred)
Quotations · server-side PDF (dompdf) · Instagram insights · WhatsApp/email campaigns ·
BOM master for production · barcode/stock-take · attachments on expenses/works · multi-currency ·
GST e-invoice · task module beyond works · import/export everywhere · webhooks out.
