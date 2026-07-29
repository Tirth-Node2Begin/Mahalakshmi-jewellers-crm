# 03 — Complete API List

> Every backend endpoint, one place. Conventions ([02](02-backend-architecture.md)): one `.php`
> per resource; GET = reads (query params), POST = mutations dispatched on JSON `action`;
> envelope `{success:true,…}` / `{success:false,error:{code,message,details}}`;
> auth = JWT cookie + CSRF header on mutations; every row below is permission-gated as shown.
> "list" GETs return their reference data + `stats{}` in the same call (one-round-trip, ported).

## 1. Auth — `/api/v1/auth/*` (public, rate-limited)

| Endpoint | Method | Purpose |
|---|---|---|
| `login.php` | POST | `{username, password, remember_me}` → cookies + `{user, csrf_token, expires_in, must_change_password}`; 429 throttle |
| `refresh.php` | POST | rotate refresh token (reuse-detection) → new cookies |
| `logout.php` | POST | revoke session, clear cookies |
| `me.php` | GET | `{authenticated, user}` — never 401s |
| `csrf.php` | GET | fresh CSRF cookie/token |
| `forgot-password.php` / `verify-otp.php` / `reset-password.php` | POST | OTP reset chain |

## 2. Core

| Endpoint | Method/Action | Permission |
|---|---|---|
| `user_permissions.php` | GET | *(any authed)* → `{permissions[], data_scope}` |
| `nav.php` | GET | *(any authed)* → permission-filtered nav sections |
| `profile.php` | GET · POST `update_profile` / `change_password` / `revoke_session` | *(self)* |
| `notifications.php` | GET · POST `mark_read` / `mark_all_read` | *(self)* |
| `dashboard.php` | GET `?months=` | `dashboard.read` (role-shaped payload) |
| `reports.php` | GET `?tab=&from=&to=&compare=&export=csv` · `?tabs=1` | `reports.read` + per-tab resource read |
| `settings.php` | GET · POST `save` | GET *(any authed → public subset: company name/logo; full set requires `settings.read`)* · POST `settings.manage` |
| `users.php` | GET · POST `create/update/toggle_active/reset_password` (credentials: optional `username` rename + optional temp password; ≥1 required — only a password reset revokes sessions) `/assign_roles` | `users.read` · `users.manage` |
| `rbac.php` | GET `?module=roles\|permissions\|role_grants` · POST `save_role/delete_role/save_role_grants/save_permission` (permission's action sent as `perm_action` to avoid colliding with the dispatch `action` key) | `rbac.manage` |

## 3. CRM

### `leads.php`
| Method | Action / Query | Permission |
|---|---|---|
| GET | list `?status&search&tab&source_id&assigned_to&start_date&end_date&filter=action_required` | `leads.read` |
| GET | `?id=` detail · `?meeting_helpers=1` (users + customers) · `?meetings_board=1&from&to` · `?drop_reasons=1` · `?export=csv` | `leads.read` |
| POST | `create` · `check_mobile` · `import` | `leads.create` |
| POST | `update` · `update_status` · `bulk_update_status` · `add_followup` · `complete_followup` · `cancel_followup` · `schedule_meeting` (lead optional; client/team participants) · `update_meeting` · `delete_meeting` · `drop_lead` (`outcome:'Dropped'\|'Lost'`) · `add_drop_reason` · `delete_drop_reason` | `leads.update` |
| POST | `assign` (single/bulk) | `leads.assign` |
| POST | `delete` | `leads.delete` |

### `lead_sources.php`
GET list+kpi (`lead_sources.read`) · POST `add/edit/toggle/delete` (`lead_sources.manage`; delete blocked in-use).

### `customers.php`
GET list / `?id=` (`customers.read`) · POST `create` (+`from_lead_id` conversion) (`customers.create`)
· `update` / `update_stage` / `add_note` (`customers.update`) · `archive` / `restore` (`customers.delete`).

### `works.php`
GET list / `?id=` (`works.read`) · POST `create` (`works.create`) · `update` / `update_status` /
`add_comment` (`works.update`) · `assign` (`works.assign`) · `delete` (`works.delete`).

### `services.php`
GET list+usage (`services.read`) · POST `add/edit/toggle` (`services.manage`; delete blocked in-use).

### `webhooks/lead_intake.php` *(bearer `LEAD_WEBHOOK_SECRET`, no session)*
POST create-lead: dedup `platform_lead_id`, skip-with-200 on missing fields/customer mobile,
enum normalization, auto source, AI fields, auto follow-up chain. 201 created.

## 4. Finance

### `invoices.php`
| Method | Action | Permission |
|---|---|---|
| GET | list `?status&customer_id&search&start_date&end_date&overdue=1` · `?id=` · `?next_number=1` | `invoices.read` (next_number: `invoices.create`) |
| POST | `create` | `invoices.create` |
| POST | `update` · `finalize` | `invoices.update` |
| POST | `cancel` · `delete` (draft) | `invoices.delete` |
| POST | `add_payment` | `payments.create` |
| POST | `update_cheque_status` | `payments.update` |
| POST | `delete_payment` | `payments.refund` |

### `expenses.php`
GET list / `view=daily&date=` / `view=insights&period=&date=&compare_date=` (`expenses.read`) ·
POST `create` (split via `fixed_cost_item_ids[]`) (`expenses.create`) · `update` (`expenses.update`)
· `delete` (`expenses.delete`) — system rows AND creation under a system category (SALARY /
INVENTORY_PURCHASE) → 403.

### `expense_categories.php`
GET list (incl. per-category `reminders[]`) / `?unique_subcategories=1` (`expenses.read`) ·
POST `add/update/toggle/delete/add_sub/update_sub/toggle_sub/delete_sub` +
`save_reminder/toggle_reminder/delete_reminder` (create=`expenses.create`,
edit=`expenses.update`, delete=`expenses.delete`; usage-guarded; system 403).

### `monthly.php` (fixed-cost tracker)
GET `?year=` (`expenses.read`) · POST `mark_paid/mark_bulk/mark_all/unpay` (`expenses.update`;
**salary items rejected 403** → paid only via `hr.php pay_salary`; bulk actions skip salary
items and report `skipped_salary`).

### `bank_accounts.php`
GET (`expenses.read` OR `payments.create`) · POST `save` (multipart QR) / `delete` (soft)
(`bank_accounts.manage`).

## 5. Inventory

### `inventory.php`
GET list `?item_type&category_id&search&low_stock&status` / `?id=` (ledger+chart) (`inventory.read`)
· POST `create/update/toggle/save_category/save_unit` (`inventory.manage`) · `adjust`
(`inventory.adjust`) · `issue_to_work` (`inventory.issue`) · `produce` (`inventory.manage`).

### `suppliers.php`
GET list / `?id=` (`suppliers.read`) · POST `create/update/toggle` (`suppliers.manage`).

### `purchases.php`
GET list / `?id=` (`purchases.read`) · POST `create/update` (`purchases.create`) · `receive`
(`purchases.receive`) · `mark_paid/unpay` (`purchases.pay`) · `cancel/delete` (`purchases.delete`).

## 6. HR — `hr.php` (module/action dispatch)

| GET `?module=` | Permission |
|---|---|
| `stats` / `employees(&id)` / `departments` / `designations` / `shifts` / `leave_types` / `holidays` | `hr.read` |
| `attendance` (`?date=` or `?employee_id=&month=`) | `hr.attendance.read` |
| `leaves` | `hr.leaves.read` |
| `payroll(&run_id)` | `hr.payroll.read` |
| `my` | *(self)* |

| POST action | Permission |
|---|---|
| `save_employee` | `hr.employees.manage` |
| `punch_in` / `punch_out` / `cancel_leave` (while pending) | *(self)* |
| `apply_leave` | *(self)* or `hr.leaves.manage` (HR filing on an employee's behalf) |
| `adjust_leave_balance` | `hr.leaves.manage` |
| `mark_attendance` (bulk ok) | `hr.attendance.manage` |
| `approve_leave` / `reject_leave` | `hr.leaves.approve` |
| `save_department` / `save_designation` / `save_shift` / `save_leave_type` / `save_holiday` (+toggles) | `hr.settings.manage` |
| `create_payroll_run` / `recompute_payroll` / `update_payroll_item` / `finalize_payroll` | `hr.payroll.manage` |
| `pay_salary` / `unpay_salary` | `hr.payroll.pay` |

## 7. Integrations ([12](12-dashboard-google.md) / [13](13-dashboard-facebook.md))

| Endpoint | Method | Permission |
|---|---|---|
| `integrations/google/connect.php` | GET → auth URL | `integrations.google.manage` |
| `integrations/google/callback.php` | GET (OAuth redirect; state-verified) | *(state token)* |
| `integrations/google/accounts.php` | GET (incl. sync_status + last 20 sync-log entries) / DELETE | view / manage |
| `integrations/google/locations.php` | GET / PATCH toggle | view / manage |
| `integrations/google/sync.php` | POST | `integrations.google.manage` |
| `integrations/google/metrics.php` | GET `?location_ids&from&to&compare=1&group_by=location?` (default aggregates all enabled locations; group_by returns per-location rows) | `integrations.google.view` |
| `integrations/google/keywords.php` · `reviews.php` | GET | `integrations.google.view` |
| `integrations/facebook/connect.php` / `callback.php` / `accounts.php` / `pages.php` / `sync.php` | as above | `integrations.facebook.*` |
| `integrations/facebook/metrics.php` `?page_id&from&to&compare=1` · `posts.php` | GET | `integrations.facebook.view` |
| `cron/integrations_sync.php` · `cron/daily_digest.php` | CLI / `?key=CRON_KEY` | — |

## 8. Permission Catalog (seed truth — keep in sync with `database/seed.php`)

| Resource | Actions |
|---|---|
| dashboard | read |
| reports | read |
| leads | read, create, update, delete, assign |
| lead_sources | read, manage |
| customers | read, create, update, delete |
| works | read, create, update, delete, assign |
| services | read, manage |
| invoices | read, create, update, delete |
| payments | create, update, refund |
| expenses | read, create, update, delete |
| bank_accounts | manage |
| inventory | read, manage, adjust, issue |
| suppliers | read, manage |
| purchases | read, create, receive, pay, delete |
| hr | read |
| hr.employees | manage |
| hr.attendance | read, manage |
| hr.leaves | read, manage, approve |
| hr.payroll | read, manage, pay |
| hr.settings | manage |
| users | read, manage |
| rbac | manage |
| settings | read, manage |
| integrations.google | view, manage |
| integrations.facebook | view, manage |

*(Dotted resources like `hr.payroll` are stored as `resource='hr.payroll', action='pay'` —
the checker concatenates `resource.action`, so wildcard `hr.*` still matches via prefix rule.)*

### Role → permission defaults (seed matrix)

| Role | Grants |
|---|---|
| super_admin | `*` |
| admin | full catalog **− rbac.manage** (role/permission editing reserved to super_admin) |
| manager | dashboard, reports, leads.\*(−delete), lead_sources.read, customers.\*(−delete), works.\*(−delete), services.read, invoices.read/create, payments.create, expenses.read, inventory.read, hr.read, hr.attendance.read, hr.leaves.read, hr.leaves.approve, integrations.\*.view |
| sales *(scope own)* | dashboard.read, leads read/create/update, lead_sources.read, customers read/create/update, works.read, services.read, invoices.read *(scoped via ownedVia — 08 §1)* |
| accountant | dashboard, reports, invoices.\*, payments.\*, expenses.\*, bank_accounts.manage, purchases.read/pay, hr.payroll.read/pay, customers.read |
| hr | dashboard, reports, hr.\* (all), users.read |
| inventory_manager | dashboard, inventory.\*, suppliers.\*, purchases.\*, reports.read, works.read |
| employee *(scope own)* | dashboard.read (+ self-service `/my`, profile, notifications implicit) |
