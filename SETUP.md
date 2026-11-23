# Jewellers CRM/ERP — Setup

Core PHP 8.2+ backend · MySQL/MariaDB · Next.js frontend.

---

## 1. Requirements

- PHP 8.2 or newer with `pdo_mysql`
- MySQL 8 / MariaDB 10.5+
- Node.js 20+ and npm (frontend only)
- A web server pointing at the project root (Apache/Nginx), or PHP's built-in server for local work

## 2. Database

```bash
mysql -u root -p -e "CREATE DATABASE jewellers_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# order matters
mysql -u root -p jewellers_crm < database/schema.sql
mysql -u root -p jewellers_crm < database/migrations/2026_07_28_jewellery_erp.sql

# only needed for a database created before 2026-07-29 — schema.sql already
# declares the column this way for fresh installs
mysql -u root -p jewellers_crm < database/migrations/2026-07-29-case-sensitive-usernames.sql

# platinum as a third metal — widens the `metal` ENUM on five tables.
# Run seed.php afterwards: it adds the PT950 purity and the two platinum ledgers.
mysql -u root -p jewellers_crm < database/migrations/2026_07_30_platinum.sql

# metals become a master table instead of an ENUM, so the shop can add one from
# the app (Purchases → Metal → "Add a new metal…"). Turns the five `metal` columns
# into VARCHAR and creates `metals`, seeded with gold, silver and platinum.
mysql -u root -p jewellers_crm < database/migrations/2026_07_30_metals_master.sql

# custom vendor types — the shop can add its own supplier/maker types from the
# app (Vendors → Add supplier / maker → Type → "+ Add a new type…").
mysql -u root -p jewellers_crm < database/migrations/2026_08_01_vendor_types.sql

# a custom vendor type now belongs to a partner page (Suppliers / Makers /
# Services), so each page can grow its own type list.
mysql -u root -p jewellers_crm < database/migrations/2026_08_02_vendor_type_category.sql

# daily gold/silver/platinum rate fetch — adds rate_feed_runs, rate_feed_quotes
# and the rates.feed permission. Run seed.php afterwards.
mysql -u root -p jewellers_crm < database/migrations/2026_08_04_rate_feed.sql

# billing/receipt accounting corrections: adds invoices.bill_discount and
# estimates.bill_discount (per-line discounts now reach the bill total, and
# discount_total becomes the TOTAL discount), plus the Cheques in Hand ledger
# so a received cheque is not treated as banked before it clears.
mysql -u root -p jewellers_crm < database/migrations/2026_11_23_billing_accounting_fixes.sql
```

After that migration, check for tagged pieces corrupted by the old stock-adjustment
behaviour (a tagged piece could be told it held several pieces, which parked phantom
value on the Inventory ledger). It prints a plan and changes nothing until `--apply`:

```bash
php cli/repair-tagged-stock.php            # dry run — review the plan
php cli/repair-tagged-stock.php --apply    # write the corrections
php cli/verify-ledger.php                  # all 10 checks should pass
```

`schema.sql` is the inherited base schema. The migration then drops the modules this product does not use (leads, HR, integrations, website, orders, repairs) and adds the jewellery + accounting tables: `purities`, `metal_rates`, `account_groups`, `ledger_accounts`, `vouchers`, `voucher_entries`, `estimates`, `estimate_items`, `invoice_old_metal`, `vendor_payments`, plus the weight/purity/HUID columns on items and the GST/old-metal columns on bills.

## 3. Configuration

```bash
cp .env.example .env
```

Set at minimum:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=jewellers_crm
DB_USER=root
DB_PASS=yourpassword

JWT_SECRET=<a long random string>
APP_ENC_KEY=<a long random string>
TIMEZONE=Asia/Kolkata
CORS_ORIGIN=http://localhost:3000
```

Never commit `.env`.

## 4. Seed

```bash
php database/seed.php
```

Creates the permission catalog, four roles (Owner, Accountant, Cashier, Inventory Manager), the owner logins, the five purities (gold 24K/22K/18K, silver 999/925), the full chart of accounts with its system ledgers, item and expense categories, number sequences and default settings.

**Logins — change both before the client uses them:**

| Username | Password   | Role        |
| -------- | ---------- | ----------- |
| `admin`  | `admin123` | Super Admin |
| `Admin`  | `admin@123`| Super Admin |

Usernames are **case-sensitive** (`users.username` is `utf8mb4_bin`), so `admin`
and `Admin` are two separate accounts. They are otherwise identical: same role,
same permissions, same database, same records — only the login differs. Typing
the wrong casing fails the login rather than falling through to the other
account.

`php database/reset-admin.php [password] [username]` resets either one, e.g.
`php database/reset-admin.php 'admin@123' Admin`.

### Demo data (for checking the app, not for a real shop)

```bash
php cli/seed_demo.php            # top up once
php cli/seed_demo.php --force    # add another round
```

Writes customers, purchases (which restock the shelf), bills with mixed
settlement, old-metal exchanges, estimates, held drafts, a cancelled bill,
receipts, vendor payments, expenses and a stock adjustment — all through the
real services, so the books stay true. Skip this on a real installation.

## 5. Run

On Windows, double-click `start.bat` in the project root — it starts both
servers as two tabs in one Windows Terminal window and opens the app. By hand:

```bash
# backend (from the project root)
php -S localhost:8000

# frontend
cd frontend
npm install
npm run dev
```

Frontend at http://localhost:3000, API at http://localhost:8000/api/*.

## 6. First-run checklist for a real shop

1. **Settings → Company**: shop name, address, phone, **GSTIN** (the state code in it decides CGST+SGST vs IGST).
2. **Confirm GST treatment of making charges with the client's CA**, then set `default_tax_rate` and `making_tax_rate` in settings. The seeded 3% / 5% are placeholders.
3. **Today's Rates**: enter gold and silver rates per gram. Billing refuses to price without them.
4. **Opening stock**: create items, then post opening stock (`stock.php` action `opening`) so inventory and the books start in agreement.
5. **Opening balances** for customers and vendors.
6. **Users and roles**: create real logins; keep Owner to the proprietor.
7. Run the verification tools below and confirm they pass.

## 7. Verification tools

```bash
# books consistency — trial balance zero, no stock drift, no hidden sales
php cli/verify-ledger.php

# concurrent billing safety (USE A TEST DATABASE — it writes real rows)
php cli/stress-billing.php 20 30      # 20 parallel counters, 30 items
php cli/stress-billing.php --cleanup

# daily rate feed — dry run, writes nothing
php cli/check-rate-feed.php
```

`verify-ledger.php` exits non-zero if anything drifted. `stress-billing.php` deliberately makes some counters fight over the same piece and asserts that invoice numbers stay unique and gap-free, no piece is sold twice, the losers get a clean conflict rather than a crash, and the trial balance still nets to zero.

Run both before every release. `check-rate-feed.php` is the one to run when the Rates page says the feed came back empty — it shows whether the source simply has not published yet, or whether the page changed and the parser needs updating.

## 8. Daily rate feed

Gold, silver and platinum rates are fetched each morning and **staged for approval** — they are never written straight into `metal_rates`. A finalised bill stamps the rate it used, so an unattended wrong rate could not be corrected afterwards; someone with `rates.set` presses **Apply** on the Rates page.

```bash
# schedule it before the shop opens; twice is fine (IBJA publishes AM and PM)
15 9  * * *  php /path/to/api/cron/fetch_rates.php
30 15 * * *  php /path/to/api/cron/fetch_rates.php
```

On a hosting panel with no CLI cron, call it over HTTP with the `CRON_KEY`:

```
curl -s "https://your-host/api/cron/fetch_rates.php?key=<CRON_KEY>"
```

**Where the numbers come from.** No Government of India site publishes a daily retail metal rate — the only government figure is CBIC's *fortnightly customs tariff value* for gold and silver (USD, an import valuation, no platinum). So the rate itself comes from **IBJA** (`ibjarates.com`), the national trade benchmark that Income-Tax gold valuation and the RBI's Sovereign Gold Bond price are both derived from. IBJA publishes gold 999/995/916/750/585, silver 999 and platinum 999; purities it does not publish (sterling 925, platinum 950) are worked out pro-rata and labelled as such on the review card.

**Safety checks.** Every staged rate is checked for a day-over-day jump beyond `rate_feed_max_move_pct` (default 8%), a purity priced above a purer one, an implausible per-gram figure (which is what a units change at the source looks like), a gold:silver ratio outside 15–150, and a source that has republished nothing since the last run. Anything that fails hard is held out of **Apply all** and has to be ticked individually.

**Optional government cross-check.** Paste the latest CBIC tariff values into Settings and the check switches itself on:

| setting | example |
|---|---|
| `rate_feed_cbic_gold_usd_10g` | `1456` |
| `rate_feed_cbic_silver_usd_kg` | `2603` |
| `rate_feed_cbic_notification` | `37/2026-Customs (N.T.)` |
| `rate_feed_cbic_effective_from` | `2026-04-15` |
| `rate_feed_usd_inr` | `87.20` |

It is manual because CBIC has no machine-readable feed: their notification site is a JavaScript app whose API needs a session, and the old plain-HTML index now 404s. Leave the fields blank and the cross-check simply reports itself unavailable — the day-over-day guard always runs regardless.

Set `rate_feed_enabled` to `0` to turn the whole thing off and go back to typing rates in by hand.

## 9. Backups

Schedule `mysqldump` at least nightly:

```bash
mysqldump -u root -p jewellers_crm | gzip > backup-$(date +%F).sql.gz
```

## 10. Where things are

| what | where |
|---|---|
| specs | `plan/` (`info.md` first) |
| project memory / current status | `memory.md`, `CLAUDE.md` |
| accounting engine | `src/Accounting/` |
| jewellery engine (rates, stock, billing, purchases) | `src/Jewellery/` |
| endpoints | `api/*.php` |
| visual design system | `style.md` |
| inherited docs (reference only) | `planning/` |
