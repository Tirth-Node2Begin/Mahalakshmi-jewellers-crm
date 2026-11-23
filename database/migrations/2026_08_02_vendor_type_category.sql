-- ---------------------------------------------------------------------------
-- Custom vendor types belong to a partner page (2026-08-02)
--
-- 2026_08_01_vendor_types.sql let the shop add its own types, but every one of
-- them was treated as a Service, because partnerCategoryOf() had nowhere else to
-- put them. The vendor book is now three pages — Material Suppliers, Jewellery
-- Makers, Services & Others — and a shop-added type has to live on the page it
-- was created from, or the vendor saved with it disappears from that page.
--
-- `category` is the partner page: supplier | maker | service. A custom type with
-- category='maker' also joins the outsourcing picklist (VendorService::makerTypes()),
-- so a shop-added "Casting Unit" can be given a job like a karigar can.
--
-- Run:  mysql -u root jewellers_crm < database/migrations/2026_08_02_vendor_type_category.sql
--
-- Safe to re-run: the ADD COLUMN is guarded, so a second run is a no-op.
-- ---------------------------------------------------------------------------

SET @sql = (
  SELECT IF(
    COUNT(*) = 0,
    "ALTER TABLE vendor_types ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'service' AFTER label",
    'SELECT ''vendor_types.category already exists'''
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vendor_types' AND COLUMN_NAME = 'category'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
