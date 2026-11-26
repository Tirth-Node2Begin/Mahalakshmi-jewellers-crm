-- ---------------------------------------------------------------------------
-- Custom vendor types (2026-08-01)
--
-- The supplier / maker "Type" dropdown was a fixed ten-value list baked into
-- VendorService::TYPES. The shop wants to add its own (refiner, courier, …)
-- without a code change, so custom types become data — same move as the metals
-- master. The ten built-in types stay in code (they drive the maker picklist
-- and the category tabs); this table holds only what the shop adds on top,
-- via Vendors → Add supplier / maker → Type → "+ Add a new type…".
--
-- `slug` is what suppliers.vendor_type stores (already VARCHAR(30), so no
-- ALTER needed); `label` is what the UI shows.
--
-- Run:  mysql -u root jewellers_crm < database/migrations/2026_08_01_vendor_types.sql
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS only.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendor_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(30) NOT NULL,                       -- stored in suppliers.vendor_type: refiner, courier…
  label VARCHAR(60) NOT NULL,                      -- shown in the UI: Refiner, Courier…
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vendor_types_slug (slug),
  CONSTRAINT fk_vendor_types_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
