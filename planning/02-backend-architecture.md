# 02 — Backend Architecture (Pure PHP)

> Ported from the Extrabits CRM's **modern stack only** (the PDO+JWT half). The legacy
> mysqli/string-SQL/session half is explicitly NOT carried over. No framework, no Composer
> requirement for runtime (PSR-4 autoloader is hand-rolled, ported) — deployable on plain
> cPanel/Apache PHP hosting.

---

## 1. Runtime & Layout

- PHP ≥ 8.2, MySQL/MariaDB ≥ 10.4, Apache (`.htaccess`) or `php -S` via `router.php` for dev.
- `.htaccess` (ported): force HTTPS, re-inject `Authorization` header, deny `src/`, `database/`,
  `uploads/` direct listing, security headers (nosniff, frame DENY, HSTS), SPA fallback to the
  static Next export via `router.php`; `api/*.php` pass through directly.
- No central API router — **one endpoint file per resource** (`api/leads.php`,
  `api/invoices.php`, …), dispatching internally on HTTP method + `?action=`/JSON `action`
  (matches the frontend HttpClient's expectations, ported convention).

```
api/
├── v1/auth/{login,refresh,logout,me,csrf,forgot-password,verify-otp,reset-password}.php
├── leads.php  lead_sources.php  customers.php  works.php  services.php
├── invoices.php  expenses.php  expense_categories.php  monthly.php  bank_accounts.php
├── inventory.php  suppliers.php  purchases.php
├── hr.php  users.php  rbac.php  user_permissions.php  profile.php  nav.php
├── dashboard.php  reports.php  notifications.php  settings.php
├── integrations/{google,facebook}/{connect,callback,accounts,locations|pages,sync,metrics,…}.php
├── webhooks/lead_intake.php
└── cron/{integrations_sync,daily_digest}.php        # CLI-only guards
src/
├── bootstrap.php                  # PSR-4 autoloader for CRM\, Env::load, ErrorHandler
├── Core/      {Env, Request, Response, ErrorHandler, SecurityHeaders}
├── Database/  {Database}          # PDO singleton
├── Security/  {JwtService, Cookie, CsrfToken, AuditLogger}
├── Middleware/{AuthMiddleware, CorsMiddleware, CsrfMiddleware, RateLimitMiddleware}
├── Auth/      {AuthService, AuthUser, PermissionService}
├── Validation/{Validator, ValidationException}
├── Support/   {api_bootstrap.php, BaseRepository, ScopeSql, FiscalYear,
│               NumberSequence, Notify, Audit, CustomerTimeline}
├── Leads/     {LeadService, LeadRepository}
├── Customers/ {CustomerService, CustomerRepository, WorkService, WorkRepository}
├── Invoices/  {InvoiceService, InvoiceRepository, PaymentService}
├── Expenses/  {ExpenseService, ExpenseRepository, MonthlyTrackerService}
├── Inventory/ {InventoryService, InventoryRepository, PurchaseService, ProductionService}
├── HR/        {HRService, AttendanceService, LeaveService, PayrollService}
└── Integrations/{GoogleAuthService, GoogleSyncService, FacebookAuthService,
                  FacebookSyncService, TokenCrypto, MetricsRepository}
```

---

## 2. Request Lifecycle (ported `api_bootstrap.php`)

Every endpoint starts `require_once __DIR__.'/../src/Support/api_bootstrap.php';` which:
1. Loads autoloader + `.env` (`Env::load`), applies `date_default_timezone_set(TIMEZONE)`,
   registers `ErrorHandler` (display_errors=0, log_errors=1, errors→`ErrorException`).
2. `ob_start()`, `SecurityHeaders::apply()` (JSON CSP `default-src 'none'`),
   `CorsMiddleware::handle()` (origins from `CORS_ALLOWED_ORIGINS`, credentials true, `Vary: Origin`).
3. Global exception handler → typed JSON envelopes: `AuthException`→its status,
   `ValidationException`→422 with `details`, `PermissionException`→403, anything else→500
   `INTERNAL_ERROR` (message hidden, logged). `Cache-Control: no-store` on all responses.

Endpoint body pattern (canonical):
```php
$user = requireApiAuth();                       // AuthMiddleware: cookie JWT → AuthUser + CSRF on mutations
requirePermission('invoices.read');             // PermissionService::assert
if (Request::method() === 'GET') { ... Response::success([...]); }
$body   = Request::json();
$action = $body['action'] ?? 'create';
switch ($action) {
  case 'create':
    requirePermission('invoices.create');
    $data = Validator::validate($body, ['customer_id'=>'required|int', 'items'=>'required|array', ...]);
    Response::success(InvoiceService::create($data, $user));
  ...
  default: Response::error('BAD_REQUEST', 'Unknown action', 400);
}
```

**Envelope (single standard):**
```json
{ "success": true, ...payload }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {"field": "msg"} } }
```
Codes: `BAD_REQUEST, VALIDATION_ERROR, AUTH_ERROR, FORBIDDEN, NOT_FOUND, CONFLICT,
METHOD_NOT_ALLOWED, RATE_LIMITED, CSRF_ERROR, INTERNAL_ERROR`.
HTTP: 200/400/401/403/404/405/409/419(CSRF)/422/429/500.

---

## 3. Auth (ported wholesale — see [08](08-module-rbac.md) for tables)

- **JWT access token** (HS256, 15 min TTL) in HttpOnly cookie `crm_access_token`; claims:
  `iss, aud, iat, nbf, exp, jti, sub, sid, username, roles[]` (branch claims dropped).
- **Refresh token**: opaque 96-hex, sha256-hashed in `auth_sessions`, HttpOnly cookie scoped to
  path `/api/v1/auth`; **rotation with reuse-detection** (reused old token → revoke all user
  sessions, log `refresh.reuse`); remember-me 90d vs 30d.
- **CSRF**: double-submit — readable cookie `crm_csrf_token` (HMAC-signed) mirrored in
  `X-CSRF-Token` header on every mutation; 419 on mismatch.
- **Login**: username OR email OR mobile + password (`password_verify`, auto-rehash);
  rate limited (DB bucket, 15/300s per IP); `security_audit_logs` events; `must_change_password`
  flow.
- **Password reset**: OTP (6-digit, hashed, 10-min, 5 attempts) → reset token → new password.
  OTP delivery via mail() initially (SMTP creds in .env; provider-agnostic `Mailer` helper).
- `me.php` never 401s (returns `{authenticated:false}`) so the client can probe quietly (ported).

## 4. Authorization

`requirePermission('resource.action')` per endpoint/action; `PermissionService` with super_admin
bypass + `*`/`resource.*` wildcards; effective-permission SQL and `data_scope` ownership predicate
(`ScopeSql::owned`) per [08-module-rbac.md](08-module-rbac.md). Mutations log to `audit_logs`
(old/new JSON) via `Audit::log()`.

---

## 5. Data Access

- `Database` PDO singleton: `utf8mb4`, `ERRMODE_EXCEPTION`, `FETCH_ASSOC`,
  `EMULATE_PREPARES=false` (real prepares — don't reuse a named placeholder twice);
  helpers `fetchOne/fetchAll/insert/execute/transaction(callable)`.
- **Prepared statements only.** The old CRM's `sanitize()`-interpolation pattern is banned.
- Repository per domain extends `BaseRepository` (table name, common finders); Services own
  business rules + transactions; endpoints stay thin.
- Filters built as AND-joined predicate arrays with named params (ported convention).
- List endpoints: `ORDER BY created_at DESC LIMIT 200` default cap, client paginates;
  accept `page/per_page` for future server paging (ported behavior, documented).
- **Money mutations always in `Database::transaction()`** with recompute-from-ledger where a
  stored total exists (invoice paid_amount, inventory current_stock/avg_cost).

### Shared Support services
- **`NumberSequence::next($key)`** — `SELECT … FOR UPDATE` on `number_sequences` row inside the
  caller's transaction; fiscal-period keys for INV/RCPT/PO; global for CUST/WRK/EMP/RM/ST.
- **`FiscalYear`** — `range(?date)`, `code()` ("2627"), quarter windows (Apr–Mar).
- **`Notify::send($userId, $type, $title, $body, $entityType, $entityId)`** — best-effort insert
  into `notifications` (failures swallowed — never breaks the calling flow; ported).
- **`CustomerTimeline::log($customerId, $event, $desc, $refTable, $refId, $userId)`**.
- **`TokenCrypto`** — AES-256-GCM encrypt/decrypt for integration tokens (key = `APP_ENC_KEY`).

---

## 6. Cross-cutting Endpoints

### `/api/notifications.php` (ported, generalized)
GET → latest 30 + unread count for the session user · POST `mark_read {id}` / `mark_all_read`.
```sql
notifications
  id PK, user_id FK users CASCADE, type VARCHAR(80), title VARCHAR(150), body VARCHAR(500),
  entity_type VARCHAR(40) NULL, entity_id INT NULL, link_url VARCHAR(255) NULL,
  is_read TINYINT(1) DEFAULT 0, read_at DATETIME NULL, created_at TIMESTAMP
  INDEX (user_id, is_read), (created_at)
```
Producers: lead assigned/overdue follow-ups digest, work assigned/status, invoice payment/overdue,
low stock, leave request/approval, payroll paid, integration sync errors.

### `/api/settings.php`
Key-value store (company profile, invoice defaults, notification toggles):
`settings(id, skey VARCHAR(60) UNIQUE, svalue TEXT, updated_by, updated_at)`.
GET (`settings.read` → public subset for all authed users: company name/logo for invoice print)
· POST `save` (`settings.manage`).

### `/api/dashboard.php` + `/api/reports.php`
Per [14-reports-analytics.md](14-reports-analytics.md).

### Webhook + Cron
- `webhooks/lead_intake.php`: bearer-secret (`hash_equals`), fail-closed — per [05](05-module-leads.md).
- `cron/*.php`: refuse non-CLI unless `?key=<CRON_KEY>`. Two entries (documented in `.env.example`):
  - `integrations_sync.php` — **every 5 minutes**. Drains first-connect backfills: OAuth
    callbacks only insert an `integration_sync_log` row (`kind='backfill', status='pending'`);
    each cron run processes a bounded number of chunks per account (FB insights 90-day chunks +
    cursor-paginated posts; GBP per-quarter chunks), resumable and quota-safe — this is the
    async mechanism on plain cPanel hosting (no queue infra). A nightly branch (first run after
    00:30) does the trailing-window upserts + token re-exchange ([12 §6](12-dashboard-google.md),
    [13 §6](13-dashboard-facebook.md)). `status='running'` rows act as per-account locks.
  - `daily_digest.php` — overdue follow-ups/invoices, low stock, expense reminders → notifications.

---

## 7. File Uploads

Ported hardened pattern: `finfo` real-MIME whitelist, size caps, `random_bytes` filenames,
never trust client name/type. Targets: `uploads/qrs/` (bank QR ≤5MB image),
`uploads/company/` (logo), `uploads/employees/` (photo). `router.php` guards non-public upload
paths behind auth.

---

## 8. `.env` Keys

```
APP_ENV, APP_URL, FRONTEND_URL, APP_FORCE_HTTPS
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
JWT_ISSUER, JWT_AUDIENCE, JWT_ACCESS_SECRET, JWT_ACCESS_TTL=900
REFRESH_TTL=2592000, REFRESH_TTL_REMEMBER=7776000
CSRF_SECRET, COOKIE_SECURE=1, COOKIE_SAMESITE=Lax, COOKIE_DOMAIN
CORS_ALLOWED_ORIGINS, LOGIN_RATE_LIMIT=15, LOGIN_RATE_WINDOW=300
APP_ENC_KEY                       # 32-byte base64 — integration token encryption
LEAD_WEBHOOK_SECRET, CRON_KEY
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
FB_APP_ID, FB_APP_SECRET, FB_REDIRECT_URI, FB_GRAPH_VERSION=v25.0, FB_LOGIN_CONFIG_ID
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
TIMEZONE=Asia/Kolkata
```

---

## 9. Security Checklist (carry-overs + fixes)

- ✅ prepared statements everywhere (fixes old `lead_sources.php`/`categories.php` interpolation)
- ✅ JWT+rotation+reuse detection, CSRF double-submit, rate-limited login, bcrypt+rehash
- ✅ permission gate on every endpoint AND every action branch
- ✅ integration tokens AES-256-GCM at rest; never serialized into any API response
- ✅ webhook fail-closed bearer secret; cron key-guarded
- ✅ upload MIME/size/name hardening; upload dir non-executable + guarded serving
- ✅ security headers + JSON CSP; `no-store`; HTTPS forced in prod
- ✅ audit trails: `audit_logs` (business), `security_audit_logs` (auth), plus module activity
  tables (lead_activities, customer_events)
