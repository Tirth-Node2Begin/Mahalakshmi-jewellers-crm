# 09 — RBAC & Audit

> Flat, simple, enforced at the API. One role per user; roles are editable sets of `resource.action` permissions.

---

## 1. Model

4 tables (schema 01 §A): `users` → `roles` → `role_permissions` → `permissions`. No permission trees, no inheritance — a role is literally a checklist. Permission catalog + seeded role matrix live in **03 §8** (single source of truth; seed.php mirrors it).

## 2. Default roles

| role | intent | headline restrictions |
|---|---|---|
| **Owner** (is_system) | the client | everything |
| **Accountant** | books & money | no user/role/settings management |
| **Cashier** | counter billing | bill + receive money + view stock/customers; **no P&L, no cost values, no overrides, no cancels, no stock edits** |
| **Inventory Manager** | stock & rates | items, stock, rates, purchases; no accounting reports, no billing |

Admin can clone/edit roles and create new ones from `/admin/roles` (checkbox grid grouped by module). `is_system` Owner role is uneditable; the last active Owner user cannot be deactivated.

## 3. Enforcement chain

1. **API:** `Permission::require('x.y')` at top of every endpoint action branch (02 §4). This is the real wall.
2. **Nav:** `api/nav.php` returns only permitted menu sections → sidebar renders only those.
3. **UI:** buttons/fields additionally hidden or disabled without permission (e.g. rate-override field absent for cashiers) — cosmetic layer only.
4. **Data sensitivity:** cost values (`cost_value`, avg cost, COGS) are stripped from API responses unless caller has `reports.stock` or `accounting.view` — cashiers see selling prices only.
5. JWT carries `role_rev`; changing a role's permissions bumps `roles.updated_at` → tokens re-validated against it, so permission changes take effect within one request, not next login.

## 4. Audit trail

`audit_log` rows written by every service mutation (02 §7):

| event group | actions logged |
|---|---|
| Auth | login success/fail (also `login_history`), logout, password change/reset |
| Billing | draft finalize, price/making override (with old→new values), cancel (with reason), receipt create/cancel |
| Inventory | item create/edit, stock adjustment (reason), opening stock, rate set (old→new) |
| Purchases/Vendors | purchase create/cancel, vendor create/edit, vendor payment |
| Accounting | journal create, ledger create/edit, COA changes |
| Admin | user create/edit/deactivate, role change (permission diff in `details` JSON), settings change |

`/admin/audit` (permission `audit.view`): filter by user, entity, date; `details` diff rendered readable ("Rate changed 7,250 → 7,310").

## 5. Security posture summary

- JWT HttpOnly cookies + rotating refresh w/ reuse detection; CSRF double-submit; DB rate limiting (02 §3).
- Passwords bcrypt; seeded admin forced password change.
- No hard deletes anywhere money/stock is involved — cancel + reversal only, always attributable.
- `.env` secrets never committed; API never leaks SQL/stack traces.
