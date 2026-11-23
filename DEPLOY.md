# Deploy — https://jeweller-crm.node2begin.com

The CRM is served at the **root of its own subdomain**: the Next.js static
export and the PHP API live in the same document root, so the frontend calls
`/api/*` same-origin (see `frontend/src/configs/app.config.ts`).

## 1. Build the frontend (local machine)

```bash
cd frontend
npm run build        # static export -> frontend/out/
```

Or do the build and the bundling in one step:

```powershell
powershell -File deploy\build-live.ps1     # add -SkipBuild to reuse frontend/out/
```

That writes `live/` — the upload bundle: the export's contents at its root with
`api/ src/ database/ cli/ .htaccess .env` beside them. Upload the **contents of
`live/`** into the document root and skip to §3.

The script enforces three rules, each learned the hard way:

- **Stop `npm run dev` first** (it refuses to build while :3000 is listening) —
  a production build overwrites the dev server's `.next/`, and every dev route
  then 404s.
- **Exactly one `.env` in `live/`.** The real one is kept across rebuilds and the
  `.example` template is never copied in beside it, so nobody edits the wrong
  file. It warns about any `CHANGE_ME` left in it.
- **No archive inside `live/`.** `.htaccess` does not block `.zip`, so a bundle
  zipped into its own folder makes `https://…/live.zip` a public download of the
  backend source and the `.env`. Zip it from outside, or not at all.

## 2. Server layout

Upload into the subdomain's document root (e.g. `public_html/` for
jeweller-crm.node2begin.com):

```
public_html/
├── index.html, 404.html, _next/, …   ← CONTENTS of frontend/out/
├── api/                              ← repo api/ (endpoints)
├── src/                              ← repo src/ (blocked from web by .htaccess)
├── database/                         ← repo database/ (blocked; needed once for seeding)
├── cli/                              ← repo cli/ (blocked; verification tools)
├── .env                              ← from .env.production.example, filled in
└── .htaccess                         ← deploy/.htaccess
```

Do **not** upload: `plan/`, `planning/`, `frontend/` sources, `node_modules/`,
`*.md`, `.git/`. The `.htaccess` blocks `src|database|cli|plan|planning|deploy`,
dotfiles, and `*.md|sql|sh|bat` as a second line of defence — keep it in place.

## 3. Production .env

Copy `.env.production.example` → server `.env`. Every `CHANGE_ME` must be
filled: hosting-panel DB credentials plus **freshly generated** secrets
(commands in the file header). Key differences from dev: `APP_ENV=production`,
`APP_FORCE_HTTPS=1`, `COOKIE_SECURE=1`, CORS/URLs on the https domain.

## 4. Database

Create the DB from the hosting panel (utf8mb4), then import **in order** via
phpMyAdmin or SSH (`SETUP.md` §2 for what each does):

1. `database/schema.sql`
2. `database/migrations/2026_07_28_jewellery_erp.sql`
3. `database/migrations/2026_07_30_platinum.sql`
4. `database/migrations/2026_07_30_metals_master.sql`
5. `database/migrations/2026_08_01_vendor_types.sql`
6. `database/migrations/2026_08_02_vendor_type_category.sql`
7. `database/migrations/2026_08_04_rate_feed.sql`

Then over SSH from the document root: `php database/seed.php`.
**Skip `cli/seed_demo.php` in production** — it writes fake trading data.

## 4b. Cron jobs

Add both in the hosting panel. `fetch_rates.php` pulls the day's gold, silver
and platinum rates and stages them for approval on the Rates page — it never
writes a rate straight into the books (`SETUP.md` §8).

```
0  8  * * *   php /home/<user>/<docroot>/api/cron/daily_digest.php
15 9  * * *   php /home/<user>/<docroot>/api/cron/fetch_rates.php
30 15 * * *   php /home/<user>/<docroot>/api/cron/fetch_rates.php
```

If the panel only does URL cron, use the `CRON_KEY` form instead:
`curl -s "https://jeweller-crm.node2begin.com/api/cron/fetch_rates.php?key=<CRON_KEY>"`

The rate fetch needs **outbound HTTPS** to `ibjarates.com`. Shared hosts
sometimes block it — `php cli/check-rate-feed.php` over SSH says so plainly.

## 5. Verify

- `https://jeweller-crm.node2begin.com/` → login page loads over HTTPS.
- Log in (`admin`/`admin123`), open dashboard — API calls hit `/api/...`.
- These must all be **403/404**, not readable:
  `/src/Support/api_bootstrap.php`, `/.env`, `/database/schema.sql`, `/cli/verify-ledger.php`.
- Over SSH: `php cli/verify-ledger.php` exits clean.
- Over SSH: `php cli/check-rate-feed.php` reaches IBJA and parses the day's rates.

## 6. Before handing to the client

Follow `SETUP.md` §6 (company/GSTIN, tax rates with the CA, today's rates,
opening stock/balances, real users). **Change both seeded admin passwords**
(`admin`/`admin123`, `Admin`/`admin@123`) — the app is now on the public
internet and these are documented defaults.
