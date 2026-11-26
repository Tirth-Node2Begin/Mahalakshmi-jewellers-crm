-- ============================================================================
-- Website content DB (`sejal_jewellers`) migrations applied FROM the CRM.
--
-- The CRM is the single admin panel (Approach A): it connects to the public
-- website's database and manages its content. These ALTERs are additive columns
-- the CRM's Catalog module relies on. The live website reads the same tables and
-- ignores unknown columns, so applying these does not break the site.
--
-- Apply against the WEBSITE database:  mysql sejal_jewellers < website_db_migrations.sql
-- ============================================================================

-- Products: manual stock indicator managed from the CRM (kept separate from
-- CRM inventory for now — a shopkeeper sets availability directly on the listing).
ALTER TABLE `products`
  ADD COLUMN `stock_status` ENUM('in_stock','made_to_order','out_of_stock') NOT NULL DEFAULT 'in_stock' AFTER `status`,
  ADD COLUMN `stock_qty` INT NULL AFTER `stock_status`;

-- Images are uploaded from the CRM and stored inline as base64 data URIs
-- (data:image/png;base64,...). varchar(300) only fits a path, so widen the image
-- columns to LONGTEXT. Transparency is preserved (keep PNG/WebP; JPEG has no alpha).
ALTER TABLE `products` MODIFY COLUMN `cover_image` LONGTEXT NULL;
ALTER TABLE `product_images` MODIFY COLUMN `url` LONGTEXT NOT NULL;
ALTER TABLE `categories` MODIFY COLUMN `image` LONGTEXT NULL;
ALTER TABLE `blogs` MODIFY COLUMN `cover_image` LONGTEXT NULL;

-- Optional link from a website product to a CRM inventory item (cross-DB soft
-- reference to sejal_jewellers_crm.inventory_items.id) so stock can be managed
-- from the product page. No FK (different database).
ALTER TABLE `products` ADD COLUMN `inventory_item_id` INT NULL AFTER `stock_qty`;
