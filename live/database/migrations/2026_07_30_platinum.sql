-- ---------------------------------------------------------------------------
-- Platinum as a third metal (2026-07-30)
--
-- The system was built for gold + silver, so `metal` is a two-value ENUM in five
-- tables. Widening it is the whole schema change; the platinum PURITY and the
-- two platinum LEDGERS are seeded by database/seed.php (idempotent) so a fresh
-- install and an existing database end up identical.
--
-- Run:  mysql -u root jewellers_crm < database/migrations/2026_07_30_platinum.sql
--       php database/seed.php
--
-- Safe to re-run: MODIFY of an already-widened column is a no-op.
-- Nothing here drops or rewrites a row — widening an ENUM keeps every existing
-- value, because 'gold' and 'silver' stay in position 1 and 2.
-- ---------------------------------------------------------------------------

ALTER TABLE purities          MODIFY metal ENUM('gold','silver','platinum') NOT NULL;
ALTER TABLE inventory_items   MODIFY metal ENUM('gold','silver','platinum') NULL;
ALTER TABLE invoice_old_metal MODIFY metal ENUM('gold','silver','platinum') NOT NULL;
ALTER TABLE purchase_items    MODIFY metal ENUM('gold','silver','platinum') NULL;

-- inventory/sales ledgers are split by metal — Ledgers::system() looks a sale up
-- by (linked_type, metal) and throws at finalize if the row is missing
ALTER TABLE ledger_accounts   MODIFY metal ENUM('gold','silver','platinum') NULL;

-- invoice_items.metal is already VARCHAR(30) — it stores a snapshot of the sold
-- line, not a foreign key, so it needs no change.
