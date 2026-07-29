# 13 — Facebook Dashboard (Meta Page Insights)

> Standalone dashboard module. User connects their Facebook account **once**; we exchange for a
> long-lived token and store per-Page access tokens (which do not time-expire). The dashboard shows
> Meta insights for every Facebook Page the user manages, plus linked Instagram accounts (phase 2).

---

## 1. Goal

- One-time "Connect Facebook" flow (Facebook Login / OAuth).
- Never logs out: page access tokens derived from a long-lived user token **do not expire on a timer**;
  we also silently re-exchange the user token on every sync so it never hits its ~60-day ceiling.
- Pulls **Page Insights** (post-June-2026 metric set — old reach/video metrics were deprecated
  2026-06-15, this plan only uses live metrics), caches in DB, renders analytics.

---

## 2. Meta App Setup (one-time, documented for deployment)

| Step | Detail |
|------|--------|
| 1 | Create Meta App (type: Business) at developers.facebook.com |
| 2 | Add product **Facebook Login for Business** |
| 3 | Valid OAuth Redirect URI → `https://<api-domain>/api/integrations/facebook/callback.php` |
| 4 | Permissions needed: `pages_show_list`, `read_insights`, `pages_read_engagement`, `pages_read_user_content`, `business_management`, `email` |
| 5 | **Create a Facebook Login for Business configuration** (Business apps cannot use the classic scope-based dialog): token type = **User access token** (required so the long-lived exchange + page-token derivation in §3 work), containing the six permissions above. Copy its **Configuration ID** into `.env` as `FB_LOGIN_CONFIG_ID` |
| 6 | App Review: request Advanced Access for `read_insights` + `pages_read_engagement` against the configuration's permission set (required for non-app-role users; `email` has automatic Advanced Access) |
| 7 | `app_id` / `app_secret` / `config_id` in backend `.env` |

Graph API version pinned in config: **v25.0** (update constant `FB_GRAPH_VERSION` in one place).

---

## 3. OAuth Flow (never-log-out design)

```
[Frontend]  "Connect Facebook" button
    → GET /api/integrations/facebook/connect.php  (returns auth URL)
    → window.location =
        https://www.facebook.com/v25.0/dialog/oauth
          ?client_id=...
          &redirect_uri=https://<api>/api/integrations/facebook/callback.php
          &config_id=<FB_LOGIN_CONFIG_ID>        ← FLB configuration (replaces the scope param;
                                                   permissions are defined in the configuration)
          &state=<signed CSRF token + user_id>

[Meta]     user consents → callback.php?code=...&state=...

[Backend]  callback.php:
    1. verify state
    2. code → short-lived user token   (GET /oauth/access_token)
    3. short-lived → LONG-LIVED user token (~60 days)
         GET /oauth/access_token?grant_type=fb_exchange_token&fb_exchange_token=...
    4. GET /me?fields=id,name,email                → store integration_accounts (provider='facebook')
    5. GET /me/accounts?fields=id,name,access_token,category,fan_count,picture
         → PAGE tokens derived from a long-lived user token have NO expiry
         → store each page in integration_locations: page token encrypted in the dedicated
           asset_token column (01 §I — never in extra, never serialized to any response);
           display data (category, fan_count, picture_url) in extra JSON
    6. enqueue backfill (integration_sync_log kind='backfill' status='pending' — §6)
    7. redirect → frontend /dashboard/facebook?connected=1
```

**Why it never logs out:**
- Page access tokens obtained via a long-lived user token do not expire on time — they die only if
  the user changes their password, revokes the app, or the page role changes.
- Safety net: every nightly sync FIRST re-runs the `fb_exchange_token` exchange with the stored
  user token (refreshes the 60-day window) and re-pulls `/me/accounts` to rotate page tokens,
  THEN pulls per-page insights (rotation-first minimizes transient page-token failures).
- **Error 190 handling is scoped to which token failed** (details §9): user-token failure alone
  does NOT kill the account — page tokens keep working; full "Reconnect" only when both fail.

---

## 4. Meta Graph API Endpoints Used

| Purpose | Endpoint |
|---------|----------|
| Page list | `GET /me/accounts?fields=id,name,access_token,category,fan_count,picture{url}` |
| Page insights (daily) | `GET /{page-id}/insights?metric=<list>&period=day&since=&until=` (page token) |
| Lifetime/day fans | `GET /{page-id}/insights?metric=page_fans&period=day` |
| Recent posts | `GET /{page-id}/published_posts?fields=id,message,created_time,permalink_url,attachments{media_type},shares,comments.summary(true),reactions.summary(true)&since=&until=&limit=25` — **paginated**: always follow `paging.cursors.after`/`paging.next` until the window is exhausted |
| Post insights | `GET /{post-id}/insights?metric=post_total_media_view_unique,post_clicks,post_activity_by_action_type` |
| Token debug | `GET /debug_token?input_token=...` (health check in sync) |

### Page metric set (valid post-June-2026 deprecation)

| Metric | Period | Dashboard label |
|--------|--------|-----------------|
| `page_impressions` | day | Impressions |
| `page_impressions_paid` | day | Paid impressions |
| `page_total_media_view_unique` | day | Media viewers (replaces old "reach") |
| `page_post_engagements` | day | Post engagements |
| `page_actions_post_reactions_total` | day | Reactions (by type) |
| `page_fans` | day (lifetime snapshot) | Total followers |
| `page_fan_adds` / `page_fan_removes` | day | New / lost followers |
| `page_views_total` | day | Page profile views |

> Deliberately **not** used (deprecated 2026-06-15): `page_impressions_unique`,
> `page_video_views*`, `reels_impressions_unique`, all paid/viral reach variants,
> 3-second video view metrics. Replacement family: `*_total_media_view*`.

Derived KPIs: **Engagement rate** (engagements / impressions), **Net follower growth**
(adds − removes), **Avg engagement per post**, **Best posting hour/day** (from post-level data).

Constraints: insights need pages with ≥100 likes; history max 2 years; most metrics update every
24h; the **insights** API returns max 93 days per request → insights backfill loops in 90-day
chunks (the posts feed is cursor-paginated instead — the 90-day chunking does not apply to it).

---

## 5. Database Tables

Reuses the provider-agnostic integration tables (01-database-schema.md §integrations):

- `integration_accounts` — provider='facebook'; `access_token` = long-lived **user** token (encrypted); `refresh_token` NULL (not used by Meta).
- `integration_locations` — one row per Page; `external_id` = page id; encrypted page token in
  the dedicated `asset_token` column (structural never-leak guarantee — endpoints may echo
  `extra` freely); `extra` JSON holds displayable `{category, fan_count, picture_url, last_error?}`.
- `integration_metrics_daily` — same normalized store (`metric` = Graph metric name; reaction breakdown stored as `page_reactions_like`, `page_reactions_love`, … flattened).
- `integration_posts` — Facebook-specific:

```sql
integration_posts
  id, integration_location_id FK, external_post_id VARCHAR(128) UNIQUE,
  message TEXT NULL, media_type VARCHAR(32), permalink VARCHAR(512),
  posted_at DATETIME,
  views_unique INT DEFAULT 0, clicks INT DEFAULT 0,
  reactions INT DEFAULT 0, comments INT DEFAULT 0, shares INT DEFAULT 0,
  engagement INT DEFAULT 0, synced_at DATETIME
```

- `integration_sync_log` — shared.

---

## 6. Backend Endpoints (PHP) — see 03-api-list.md

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/facebook/connect.php` | GET | build auth URL |
| `/api/integrations/facebook/callback.php` | GET | token exchange chain, store account + pages |
| `/api/integrations/facebook/accounts.php` | GET/DELETE | list / disconnect (DELETE also calls `/me/permissions` revoke) |
| `/api/integrations/facebook/pages.php` | GET/PATCH | list pages, toggle enabled |
| `/api/integrations/facebook/sync.php` | POST | manual sync |
| `/api/integrations/facebook/metrics.php` | GET | `?page_id=&from=&to=&compare=1` → series + KPIs + deltas |
| `/api/integrations/facebook/posts.php` | GET | top/recent posts with engagement, sortable |
| `/api/cron/integrations_sync.php` | CLI/cron | shared 5-minute cron (google + facebook) — backfill drainer + nightly branch, see sync strategy below |

**Sync strategy** (cron-drained cursor, same mechanism as [12 §6](12-dashboard-google.md) — no
queue infra): the shared `cron/integrations_sync.php` runs **every 5 minutes**.
- **First connect**: callback inserts `integration_sync_log kind='backfill' status='pending'`;
  the cron drains it in bounded slices per run — insights in 90-day chunks back to 2 years,
  posts by cursor-paginating `published_posts` with `since/until` windows back to 2 years.
- **Nightly branch**: token re-exchange + page-token rotation FIRST, then per page: insights
  trailing 7 days upsert (metrics settle within 24–48h), posts trailing 30 days (paginated),
  `debug_token` health check.
- **Timezone rule**: Graph returns `created_time` in UTC — `FacebookSyncService` converts to the
  app `TIMEZONE` (Asia/Kolkata) before writing `integration_posts.posted_at` (and
  `integration_reviews.reviewed_at` on the Google side), so the posting-time heatmap and
  best-hour KPI bucket in local business hours.
- `accounts.php` exposes `sync_status + progress` for the frontend syncing state.

---

## 7. Frontend — `/dashboard/facebook` (CSR)

Same state machine as Google dashboard (not connected / syncing / connected / reconnect).

| Section | Content |
|---------|---------|
| Header row | Account switcher, Page selector (avatar + name), date range, compare toggle, Sync now |
| KPI tiles (6) | Impressions, Media viewers, Engagements, Engagement rate, Followers (net Δ), Page views — deltas + sparklines |
| Trend chart | Impressions vs Media viewers vs Engagements (multi-line, Recharts) |
| Follower growth | Bar (adds vs removes) + cumulative line |
| Reactions donut | like/love/haha/wow/sad/angry split |
| Top posts table | thumbnail/type, message excerpt, date, views, reactions, comments, shares, engagement rate; sort by any column |
| Posting-time heatmap | day-of-week × hour engagement heatmap (from posts data) |

React Query for data; Framer Motion staggered tiles; identical component kit as Google dashboard
(shared `<KpiTile>`, `<TrendChart>`, `<DateRangePicker>`, `<ConnectCard>` → build once, use twice).
Account/page administration (disconnect, page toggles, sync history) lives on the shared
`/settings/integrations` page — spec in [12 §7](12-dashboard-google.md).

---

## 8. Permissions

| Permission | Grants |
|------------|--------|
| `integrations.facebook.view` | see dashboard |
| `integrations.facebook.manage` | connect/disconnect, toggle pages, manual sync |

---

## 9. Edge Cases & Rules

- **App Review**: until Advanced Access is approved, insights only work for users with a role on the
  app — fine for dev, must be approved before client use. Documented in deployment checklist.
- **Error 190/10 handling — scoped by token, never blanket-revoke**:
  - 190 on a **user-token** call (`fb_exchange_token`, `/me/accounts`) → `status='error'` +
    soft amber notice ("Reconnect to refresh your page list & rotate tokens"); page syncs
    continue with stored page tokens (they have no timed expiry) — new-page discovery and
    rotation pause until reconnect.
  - 190/10 on a **single page token** → per-page failure only: set `extra.last_error`, skip that
    page, let the next successful `/me/accounts` rotation self-heal or prune it. Never revoke
    the account from one page's failure.
  - `status='revoked'` + full "Reconnect" banner only when user-token AND page-token calls both
    fail (password change / app deauthorization kills both).
- Rate limiting (error 4/17/32) → exponential backoff in sync worker, resume next cron run.
- `page_fans < 100` → insights unavailable → show page with "Insights unavailable (<100 likes)" note.
- Reaction breakdown metric returns a JSON map → flattened into per-reaction metric rows at sync time.
- Page tokens live only in the encrypted `integration_locations.asset_token` column (01 §I) —
  never in `extra`, never serialized into any API response (`extra` holds displayable metadata only).
- Instagram insights (linked IG business account) = **phase 2**; schema already fits (`integration_locations` with `extra.platform='instagram'`).
