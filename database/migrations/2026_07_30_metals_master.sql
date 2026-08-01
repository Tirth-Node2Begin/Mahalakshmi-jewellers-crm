-- ---------------------------------------------------------------------------
-- Metals become data, not schema (2026-07-30)
--
-- `metal` was a two-value ENUM widened to three by 2026_07_30_platinum.sql. Every
-- new metal therefore meant an ALTER TABLE on five tables — a migration, not
-- something a shop owner could do. This turns the metal list into a master table
-- so it can be added to from the app.
--
-- Two things must happen together for a metal to be usable, and Metals::create()
-- does both in one transaction:
--   1. a row here, and
--   2. its own `inventory` + `sales` ledger — Ledgers::system() looks a sale up by
--      (linked_type, metal) and throws at finalize if the row is missing.
-- A metal also needs at least one purity before anything can be priced in it.
--
-- Run:  mysql -u root jewellers_crm < database/migrations/2026_07_30_metals_master.sql
--       php database/seed.php
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, an idempotent INSERT, and MODIFYs
-- that are no-ops once applied. ENUM → VARCHAR keeps every existing value.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS metals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,                       -- stored on every row: gold, silver, platinum
  name VARCHAR(60) NOT NULL,                       -- shown in the UI: Gold, Silver, Platinum
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metals_code (code),
  CONSTRAINT fk_metals_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- the three that were hardcoded in the ENUM
INSERT INTO metals (code, name, sort_order) VALUES
  ('gold', 'Gold', 1),
  ('silver', 'Silver', 2),
  ('platinum', 'Platinum', 3)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), is_active = 1;

-- ENUM → VARCHAR, so adding a metal is an INSERT instead of a schema change.
-- No FK to metals(code): invoice_items.metal is already a free VARCHAR snapshot of
-- a sold line, and a purchase from 2024 must keep reading back even if the shop
-- later stops dealing in that metal.
ALTER TABLE purities          MODIFY metal VARCHAR(30) NOT NULL;
ALTER TABLE inventory_items   MODIFY metal VARCHAR(30) NULL;
ALTER TABLE invoice_old_metal MODIFY metal VARCHAR(30) NOT NULL;
ALTER TABLE purchase_items    MODIFY metal VARCHAR(30) NULL;
ALTER TABLE ledger_accounts   MODIFY metal VARCHAR(30) NULL;
