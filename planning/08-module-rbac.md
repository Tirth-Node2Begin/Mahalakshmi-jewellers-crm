# 08 — Role-Based Access Control (RBAC) & Users

> Direct port of the Extrabits CRM's proven **flat 4-table RBAC** (`resource.action` permission
> strings, DB-driven, permission-gated nav) with every branch/organization/hierarchy concept
> removed. One new simplification: a per-role `data_scope` replaces the old branch/ownership
> scoping system.

---

## 1. Model

- **Permission** = `resource.action` string (e.g. `leads.create`, `hr.payroll.pay`,
  `integrations.google.view`). Catalog lives in the `permissions` table; the full list is in
  [03-api-list.md](03-api-list.md) §permission-matrix.
- **Role** = named bundle of permission grants. Roles are editable at runtime (admin UI);
  `is_system=1` roles (super_admin) can't be deleted.
- **Assignment** = user ↔ role rows (multi-role supported, optional expiry).
- **Wildcards**: `*` (super admin) and `resource.*` supported by the checker (ported `matches()`).
- **data_scope** (on role): `all` | `own`. `own` restricts *record visibility* on ownable
  resources (leads, customers, works) to rows where `assigned_to = me OR created_by = me`.
  Implemented as a reusable SQL predicate helper `ScopeSql::owned($user, 'l')` — the branch-free
  replacement for the old `getBranchConditionSql`.
  **Invoices scope through their customer**: a second helper `ScopeSql::ownedVia($user,
  'customers c', 'i.customer_id')` yields
  `(i.created_by = :me OR EXISTS (SELECT 1 FROM customers c WHERE c.id = i.customer_id AND
  (c.assigned_to = :me OR c.created_by = :me)))` — applied to invoice list/detail queries when
  the effective data_scope is `own` (so a `sales` user sees only invoices of their customers).
  All other non-ownable resources (expenses, inventory, HR) ignore data_scope; their access is
  purely permission-based.
- **Effective permissions query** (ported verbatim, minus branch):

```sql
SELECT DISTINCT CONCAT(p.resource,'.',p.action)
FROM user_role_assignments ura
JOIN roles r  ON r.id = ura.role_id
JOIN role_permission_grants g ON g.role_id = r.id
JOIN permissions p ON p.id = g.permission_id
WHERE ura.user_id = :uid AND ura.is_active = 1
  AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
  AND r.is_active = 1 AND p.is_active = 1
```

Explicitly dropped from old CRM: H-RBAC hierarchy engine (role_parents, inheritance rules,
delegation, caches), grant-level scopes, `organization_id`, `branch_*`, `reports_to_role_id`.

---

## 2. Database Tables

```sql
users
  id PK, username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,              -- password_hash() bcrypt
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NULL UNIQUE, mobile VARCHAR(20) NULL,
  avatar_color VARCHAR(7) NULL,
  is_active TINYINT(1) DEFAULT 1,
  must_change_password TINYINT(1) DEFAULT 0,
  last_login_at DATETIME NULL, password_changed_at DATETIME NULL,
  created_at TIMESTAMP, updated_at TIMESTAMP

roles
  id PK, name VARCHAR(60) NOT NULL UNIQUE,          -- slug: 'admin'
  display_name VARCHAR(100) NOT NULL, description VARCHAR(255),
  data_scope ENUM('all','own') DEFAULT 'all',
  is_system TINYINT(1) DEFAULT 0, is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP

permissions
  id PK, resource VARCHAR(60) NOT NULL, action VARCHAR(40) NOT NULL,
  description VARCHAR(255), is_active TINYINT(1) DEFAULT 1
  UNIQUE (resource, action)

role_permission_grants
  id PK, role_id FK roles CASCADE, permission_id FK permissions CASCADE
  UNIQUE (role_id, permission_id)

user_role_assignments
  id PK, user_id FK users CASCADE, role_id FK roles CASCADE,
  is_active TINYINT(1) DEFAULT 1, expires_at DATETIME NULL,
  assigned_by INT NULL FK users SET NULL, assigned_at TIMESTAMP
  UNIQUE (user_id, role_id)

auth_sessions                                       -- ported as-is
  id PK, user_id FK users CASCADE,
  refresh_token_hash CHAR(64) NOT NULL UNIQUE, previous_refresh_token_hash CHAR(64) NULL,
  ip_address VARCHAR(45), user_agent VARCHAR(255),
  revoked_at DATETIME NULL, revoke_reason VARCHAR(60) NULL,
  expires_at DATETIME NOT NULL, last_used_at DATETIME NULL, created_at TIMESTAMP

password_reset_otps                                 -- ported (10-min expiry, 5 attempts)
  id PK, user_id FK users CASCADE, otp_hash CHAR(64), reset_token_hash CHAR(64) NULL,
  attempts INT DEFAULT 0, expires_at DATETIME, used_at DATETIME NULL, created_at TIMESTAMP

api_rate_limits                                     -- ported (login throttle)
  id PK, rate_key CHAR(64) NOT NULL, bucket VARCHAR(60), attempts INT, window_started_at DATETIME
  UNIQUE (rate_key)

audit_logs                                          -- business mutations
  id PK, user_id INT NULL FK users SET NULL, action VARCHAR(100), entity_type VARCHAR(80),
  entity_id INT NULL, old_values JSON NULL, new_values JSON NULL,
  ip_address VARCHAR(45), created_at TIMESTAMP
  INDEX (entity_type, entity_id), (user_id), (created_at)

security_audit_logs                                 -- auth events
  id PK, user_id INT NULL, event VARCHAR(60),       -- login.success/login.failed/refresh.reuse/...
  ip_address VARCHAR(45), user_agent VARCHAR(255), meta JSON NULL, created_at TIMESTAMP
```

---

## 3. Seed Roles (starter set — editable later)

| Role | data_scope | Gets (summary) |
|---|---|---|
| `super_admin` (system) | all | `*` |
| `admin` | all | full catalog **minus `rbac.manage`** (role/permission editing reserved to super_admin) |
| `manager` | all | leads/customers/works full (no deletes), reports.read, hr.read + hr.attendance.read + hr.leaves.read/approve, invoices read/create, payments.create, expenses read, inventory read, integrations view |
| `sales` | **own** | leads + customers read/create/update, works read, invoices read (scoped via ownedVia), reports none |
| `hr` | all | hr.* (all), reports.read, users.read |
| `accountant` | all | invoices.*, payments.*, expenses.*, bank_accounts.manage, purchases read/pay, hr.payroll.read/pay, customers.read, reports.read |
| `inventory_manager` | all | inventory.*, suppliers.*, purchases.*, works.read, reports.read |
| `employee` | own | dashboard.read + self-service `/my`, profile, notifications |

This table is a readable summary — **the normative grant matrix is
[03-api-list.md §8](03-api-list.md) and `database/seed.php` (kept identical)**. Per-domain report
permissions (`reports.hr` etc.) deliberately do not exist: `/reports` is gated by `reports.read`
and each tab additionally requires that module's `.read` permission ([14 §4](14-reports-analytics.md)).

---

## 4. Enforcement (backend)

- Every endpoint: `requireApiAuth()` → `requirePermission('resource.action')` at top (read gate),
  again per action branch (write gates). 401 no/invalid token · 403 missing permission ·
  419 CSRF failure · 429 rate limit.
- `PermissionService::can($user,$perm)` — super_admin bypass, wildcard matching, per-request cache.
- Ownable-resource queries append `ScopeSql::owned()` when the user's *effective* data_scope is
  `own` (multi-role: `all` wins).
- Mutations write `audit_logs` (old/new JSON) via `Audit::log()` — ported helper.

## 5. Enforcement (frontend)

- `PermissionProvider` fetches `/api/user_permissions.php` → `can()/canAny()/canAll()` with
  wildcard support + `<PermissionGate>` component (ported).
- Nav is server-driven: `/api/nav.php` filters a single `nav_map.php` source-of-truth through the
  user's permissions → sidebar sections; client guard `routeIsAllowed()` in AppShell redirects
  unauthorized routes to `/` (ported; detail routes inherit parent access via SUB_ROUTE_PARENTS map).
- `must_change_password` blocks the app with a forced-change screen (ported).

---

## 6. API

### `/api/users.php`
| Action | Permission | Notes |
|---|---|---|
| GET list | `users.read` | w/ roles, last_login, status; search/role/status filters |
| POST `create` | `users.manage` | username/email unique checks, temp password w/ must_change flag, role assignment(s) |
| POST `update` | `users.manage` | profile fields |
| POST `toggle_active` | `users.manage` | blocks self-deactivation |
| POST `reset_password` | `users.manage` | sets temp + must_change_password |
| POST `assign_roles` | `users.manage` | replace user's assignment set |

### `/api/rbac.php` (`rbac.manage`)
GET `?module=roles|permissions|role_grants&role_id=` ·
POST `save_role` / `delete_role` (soft; blocked for is_system or when assigned) /
`save_role_grants` (delete-all + re-insert for role, transactional) / `save_permission`.

### `/api/user_permissions.php`
GET → `{permissions:[...]}, data_scope` (super_admin → `["*"]`).

### `/api/nav.php`
GET → permission-filtered `navigation: NavSection[]` from `nav_map.php`.

### `/api/v1/auth/*` (see [02-backend-architecture.md](02-backend-architecture.md) §auth)
`login` · `refresh` · `logout` · `me` · `csrf` · `forgot-password` · `verify-otp` · `reset-password`.

### `/api/profile.php` (self)
GET profile — includes the user's active sessions list (session id, user-agent/device, IP,
last_used_at, `is_current` flag) · POST `update_profile` (name/email/mobile) ·
POST `change_password` (current + new, min 8, rehash, revoke other sessions) ·
POST `revoke_session {session_id}` — own sessions only; revoking the current session behaves
like logout.

---

## 7. Frontend Pages

| Route | Content |
|---|---|
| `/settings/users` | users table (avatar, username, roles chips, last login, active toggle), Add/Edit user modal w/ role multi-select, reset-password action |
| `/settings/roles` | role cards → role editor: grouped permission checkboxes (grouped by resource, "select all" per group), data_scope toggle, live "N users affected" count |
| `/login` | ported showcase login (framer-motion, remember me, forgot-password OTP modal flow) |
| `/profile` | my profile edit + change password + active sessions list (revoke) |

---

## 8. Alignment

- Every module doc references permissions defined here; the union catalog is seeded from
  [03-api-list.md](03-api-list.md) §permission-matrix — **seed.php and that table must stay in sync**.
- `users` are the assignment target for leads/customers/works; `employees.user_id` links HR.
- Integrations dashboards use `integrations.google.view/manage`, `integrations.facebook.view/manage`.
- Notifications are user-owned; assignment/approval flows resolve recipients via users.
