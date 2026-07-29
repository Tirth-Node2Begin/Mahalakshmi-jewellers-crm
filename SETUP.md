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

Creates the permission catalog, four roles (Owner, Accountant, Cashier, Inventory Manager), the owner login, the five purities (gold 24K/22K/18K, silver 999/925), the full chart of accounts with its system ledgers, item and expense categories, number sequences and default settings.

**Login: `admin` / `admin123` — change this before the client uses it.**

## 5. Run

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
```

`verify-ledger.php` exits non-zero if anything drifted. `stress-billing.php` deliberately makes some counters fight over the same piece and asserts that invoice numbers stay unique and gap-free, no piece is sold twice, the losers get a clean conflict rather than a crash, and the trial balance still nets to zero.

Run both before every release.

## 8. Backups

Schedule `mysqldump` at least nightly:

```bash
mysqldump -u root -p jewellers_crm | gzip > backup-$(date +%F).sql.gz
```

## 9. Where things are

| what | where |
|---|---|
| specs | `plan/` (`info.md` first) |
| project memory / current status | `memory.md`, `CLAUDE.md` |
| accounting engine | `src/Accounting/` |
| jewellery engine (rates, stock, billing, purchases) | `src/Jewellery/` |
| endpoints | `api/*.php` |
| visual design system | `style.md` |
| inherited docs (reference only) | `planning/` |
