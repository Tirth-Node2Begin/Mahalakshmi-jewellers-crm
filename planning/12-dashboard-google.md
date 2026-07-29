# 12 — Google Dashboard (Google Business Profile Performance)

> Standalone dashboard module. User connects their Google account **once**; the system stores a
> refresh token and keeps the connection alive forever (no re-login). The dashboard then shows
> Google My Business (Business Profile) performance analytics for every location the user manages.

---

## 1. Goal

- One-time "Connect Google Account" flow (OAuth 2.0).
- Never logs out: refresh token stored encrypted in DB, access tokens minted server-side on demand.
- Pulls **Business Profile performance metrics** per location, caches them in our DB, renders
  charts/insights on the frontend.
- Multiple Google accounts can be connected (e.g. agency managing several clients), each with
  multiple business locations.

---

## 2. Google Cloud Setup (one-time, documented for deployment)

| Step | Detail |
|------|--------|
| 1 | Create Google Cloud project → **request GBP API access via Google's access-request form FIRST** (GBP APIs are gated; approval is per-project and takes days) |
| 2 | After approval: enable **Business Profile Performance API**, **My Business Account Management API**, **My Business Business Information API** |
| 3 | OAuth consent screen: External, scopes `https://www.googleapis.com/auth/business.manage` + `openid email` (email identifies the connected account in the UI) |
| 4 | Create OAuth 2.0 Client ID (Web application). Authorized redirect URI → `https://<api-domain>/api/integrations/google/callback.php` |
| 5 | Store `client_id` / `client_secret` in backend `.env` (never in frontend) |

**Quota note:** default GBP quota is low (~300 QPM); all metric reads go through our cache table,
never directly from the browser to Google.

---

## 3. OAuth Flow (never-log-out design)

```
[Frontend]  "Connect Google" button
    → GET /api/integrations/google/connect.php   (returns Google auth URL)
    → window.location = auth URL
        https://accounts.google.com/o/oauth2/v2/auth
          ?client_id=...
          &redirect_uri=https://<api>/api/integrations/google/callback.php
          &response_type=code
          &scope=openid email https://www.googleapis.com/auth/business.manage
          &access_type=offline          ← gives refresh_token
          &prompt=consent               ← forces refresh_token on re-connect
          &state=<signed CSRF token + user_id>

[Google]   user consents → redirects to callback.php?code=...&state=...

[Backend]  callback.php:
    1. verify state (HMAC, expiry 10 min)
    2. POST https://oauth2.googleapis.com/token  (code → access_token + refresh_token + id_token)
    3. decode id_token → sub (Google user id) + email
    4. store ONE integration_accounts row per Google identity
       (provider='google', external_account_id = sub, email, refresh_token AES-256-GCM encrypted)
    5. GET mybusinessaccountmanagement.googleapis.com/v1/accounts → for EVERY GBP account
       (personal + location groups), GET its locations and store each in
       integration_locations with extra.gbp_account = 'accounts/{id}' (needed later to build
       the v4 reviews path accounts/{a}/locations/{l})
    6. enqueue the backfill (integration_sync_log kind='backfill' status='pending' — see §6)
    7. redirect → frontend /dashboard/google?connected=1
```

**Token refresh (why it never logs out):**
- `access_token` lives ~1 hour. Backend helper `GoogleTokenService::getAccessToken($accountId)`:
  1. if cached access token valid (>5 min left) → return it
  2. else POST `oauth2.googleapis.com/token` with `grant_type=refresh_token` → new access token,
     cache in `integration_accounts.access_token` + `access_token_expires_at`
- Refresh tokens don't expire unless the user revokes access or the app is in "testing" mode
  (testing-mode tokens die in 7 days → **consent screen must be Published/In production**).
- If refresh fails with `invalid_grant` → mark row `status='revoked'`, surface a "Reconnect"
  banner on the dashboard (the only case where the user must log in again).

---

## 4. Google APIs Used

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| List accounts | `GET mybusinessaccountmanagement.googleapis.com/v1/accounts` | after OAuth |
| List locations | `GET mybusinessbusinessinformation.googleapis.com/v1/{account}/locations?readMask=name,title,storefrontAddress,metadata` | paginated |
| Daily metrics (main) | `GET businessprofileperformance.googleapis.com/v1/locations/{id}:fetchMultiDailyMetricsTimeSeries?dailyMetrics=...&dailyRange.*` | up to all metrics in one call |
| Search keywords | `GET businessprofileperformance.googleapis.com/v1/locations/{id}/searchkeywords/impressions/monthly` | monthly, paginated |
| Reviews | `GET mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews` | legacy v4, still live; gives rating, comments, replies |

### DailyMetric enum (all fetched)

| Metric | Dashboard label |
|--------|-----------------|
| `BUSINESS_IMPRESSIONS_DESKTOP_MAPS` | Views — Maps (desktop) |
| `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH` | Views — Search (desktop) |
| `BUSINESS_IMPRESSIONS_MOBILE_MAPS` | Views — Maps (mobile) |
| `BUSINESS_IMPRESSIONS_MOBILE_SEARCH` | Views — Search (mobile) |
| `BUSINESS_CONVERSATIONS` | Messages received |
| `BUSINESS_DIRECTION_REQUESTS` | Direction requests |
| `CALL_CLICKS` | Calls |
| `WEBSITE_CLICKS` | Website clicks |
| `BUSINESS_BOOKINGS` | Bookings |
| `BUSINESS_FOOD_ORDERS` | Food orders |
| `BUSINESS_FOOD_MENU_CLICKS` | Menu clicks |

Derived KPIs: **Total impressions** (sum of 4 impression metrics), **Total interactions**
(calls + website clicks + directions + conversations + bookings), **Interaction rate**
(interactions / impressions), **Search vs Maps split**, **Mobile vs Desktop split**.

---

## 5. Database Tables (shared with Facebook module — see 01-database-schema.md §integrations)

```sql
integration_accounts        -- one row per connected Google account
  id, provider ENUM('google','facebook'), user_id (who connected),
  external_account_id, account_name, email,
  access_token TEXT (encrypted), access_token_expires_at DATETIME,
  refresh_token TEXT (encrypted),          -- google only
  scopes TEXT, status ENUM('active','revoked','error'),
  last_synced_at, created_at, updated_at

integration_locations       -- GBP locations / FB pages (provider-agnostic "assets")
  id, integration_account_id FK, external_id,  -- 'locations/12345' or fb page id
  name, address, extra JSON,                   -- category, phone, maps URI…
  is_enabled TINYINT(1) DEFAULT 1,             -- user can hide locations
  created_at, updated_at

integration_metrics_daily   -- normalized cache of every daily metric point
  id, integration_location_id FK, metric VARCHAR(64), date DATE, value BIGINT,
  UNIQUE KEY (integration_location_id, metric, date)

integration_keywords        -- GBP monthly search keywords
  id, integration_location_id FK, month DATE (first of month),
  keyword VARCHAR(255), impressions INT,       -- Google returns threshold "<15" → store 15, flag
  is_threshold TINYINT(1) DEFAULT 0,
  UNIQUE KEY (integration_location_id, month, keyword)

integration_reviews
  id, integration_location_id FK, external_review_id VARCHAR(128) UNIQUE,
  rating TINYINT, reviewer_name, comment TEXT, reply TEXT NULL,
  reviewed_at DATETIME, replied_at DATETIME NULL, synced_at

integration_sync_log        -- authoritative definition: 01 §I
  id, integration_account_id FK,
  kind ENUM('metrics','keywords','reviews','locations','posts','token','backfill'),
  status ENUM('pending','running','success','error'), message TEXT, ran_at
  -- 'running' row = the per-account concurrency lock (§9)
  -- kind='backfill' status='pending' rows = first-connect backfill cursor (§6)
```

---

## 6. Backend Endpoints (PHP) — see 03-api-list.md

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/google/connect.php` | GET | build + return Google auth URL (`state` signed) |
| `/api/integrations/google/callback.php` | GET | OAuth code exchange, store tokens, redirect to frontend |
| `/api/integrations/google/accounts.php` | GET/DELETE | list connected accounts incl. `sync_status`, backfill progress and the last 20 `integration_sync_log` entries per account / disconnect (revoke + delete tokens) |
| `/api/integrations/google/locations.php` | GET/PATCH | list locations, toggle `is_enabled` |
| `/api/integrations/google/sync.php` | POST | manual "Sync now" → pulls metrics/keywords/reviews |
| `/api/integrations/google/metrics.php` | GET | dashboard data: `?location_ids=1,2,3&from=&to=&compare=1&group_by=location?` — `location_ids` optional (default: all enabled locations of the account); default response aggregates the selected locations into one series+KPIs+deltas; `group_by=location` returns one row per location (impressions, interactions, trend series, avg rating joined from integration_reviews) for the per-location table |
| `/api/integrations/google/keywords.php` | GET | top keywords by month (`?location_ids=` same semantics) |
| `/api/integrations/google/reviews.php` | GET | reviews list + rating distribution (`?location_ids=` same semantics) |
| `/api/cron/integrations_sync.php` | CLI/cron | **every 5 minutes** — see sync strategy below |

**Sync strategy (no queue infra needed — cron-drained cursor):**
- **First connect**: callback only discovers accounts/locations and inserts an
  `integration_sync_log` row `kind='backfill', status='pending'` (message tracks chunk
  progress). The 5-minute cron picks up pending/incomplete backfills and processes a bounded
  number of chunks per run (GBP: 18 months — max retention — in per-quarter chunks; keywords
  month-by-month) — resumable, quota-safe (~300 QPM), immune to PHP time limits.
- **Nightly branch** of the same cron: GBP metrics lag 3–5 days, so it re-fetches the trailing
  30-day window and upserts (`ON DUPLICATE KEY UPDATE`) so late data self-corrects; keywords
  current month; reviews delta.
- A `status='running'` log row is the per-account lock; `accounts.php` exposes
  `sync_status: 'backfilling'|'ready'` + chunk progress so the frontend "Connected, syncing"
  state has a data source and completion signal.

---

## 7. Frontend — `/dashboard/google` (CSR)

### States
1. **Not connected** → hero card: what it does + "Connect Google Business" button (Framer Motion entrance).
2. **Connected, syncing** → skeleton charts + progress note ("Backfilling 18 months…").
3. **Connected** → full dashboard.
4. **Revoked** → amber "Reconnect" banner, stale data still visible.

### Layout (top → bottom)
| Section | Content |
|---------|---------|
| Header row | Account switcher (if >1), Location multi-select, date-range picker (7/28/90/365d/custom), compare-to-previous toggle, "Sync now" |
| KPI tiles (6) | Total impressions, Interactions, Calls, Website clicks, Direction requests, Avg rating — each with % delta vs previous period + sparkline |
| Impressions trend | Area chart, stacked by surface (Search vs Maps) with mobile/desktop toggle |
| Interactions trend | Multi-line: calls / website clicks / directions / messages |
| Breakdown donuts | Search vs Maps · Mobile vs Desktop |
| Search keywords | Table: keyword, impressions, month-over-month change; "<15" threshold rows shown as "&lt;15" |
| Reviews panel | Rating distribution bar, recent reviews feed, reply status |
| Per-location table (multi-location) | one row per location: impressions, interactions, rating, trend sparkline |

Charts: Recharts. Animations: Framer Motion stagger on tiles, count-up on KPI numbers.
All data via React Query against `/api/integrations/google/*` (cache 5 min).

### `/settings/integrations` (shared Google + Facebook management page)
The dashboards keep only Connect/Reconnect + "Sync now"; account administration lives here
(gated `integrations.google.manage` / `integrations.facebook.manage` per provider section):
- Per-provider connected-accounts list: account name/email, status (active/revoked/error),
  connected by, last_synced_at, backfill progress — with **Connect** and **Disconnect**
  (accounts.php GET/DELETE).
- Expandable rows per account: locations/pages with `is_enabled` switches
  (locations.php / pages.php PATCH).
- Recent sync history panel (last 20 runs + error messages — served by accounts.php's
  sync-log payload, §6).
- Each dashboard shows a "Manage" link that deep-links here. 13 §7 reuses this page as-is.

---

## 8. Permissions

| Permission | Grants |
|------------|--------|
| `integrations.google.view` | see the dashboard |
| `integrations.google.manage` | connect/disconnect accounts, toggle locations, manual sync |

Admin role gets both by default; token values are **never** returned by any API response.

---

## 9. Edge Cases & Rules

- Consent screen must be **published** — testing mode kills refresh tokens after 7 days (breaks "never log out").
- `prompt=consent` on every connect so a re-connect always yields a fresh refresh token.
- Tokens encrypted at rest (AES-256-GCM, key in `.env`, never logged).
- Rate limits → sync worker sleeps between locations; per-account lock in `integration_sync_log` prevents concurrent syncs.
- Deleted/unverified locations → Google returns 404 → mark location `is_enabled=0` with a note.
- All Google calls are server-side; the browser only ever talks to our PHP API.
