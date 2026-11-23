-- Performance indexes for high-volume jewellery ERP reads.
-- Safe to run more than once: each index is added only when missing.

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$
CREATE PROCEDURE add_index_if_missing(
  IN table_name_in VARCHAR(64),
  IN index_name_in VARCHAR(64),
  IN ddl_in TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = table_name_in
       AND index_name = index_name_in
  ) THEN
    SET @ddl = ddl_in;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL add_index_if_missing(
  'inventory_items',
  'idx_inventory_items_barcode',
  'ALTER TABLE inventory_items ADD INDEX idx_inventory_items_barcode (barcode)'
);

CALL add_index_if_missing(
  'inventory_items',
  'idx_inventory_items_active_code',
  'ALTER TABLE inventory_items ADD INDEX idx_inventory_items_active_code (is_active, item_code)'
);

CALL add_index_if_missing(
  'inventory_items',
  'idx_inventory_items_sellable_name',
  'ALTER TABLE inventory_items ADD INDEX idx_inventory_items_sellable_name (is_active, status, tracking, name)'
);

CALL add_index_if_missing(
  'inventory_items',
  'idx_inventory_items_filter_code',
  'ALTER TABLE inventory_items ADD INDEX idx_inventory_items_filter_code (is_active, metal, purity_id, category_id, tracking, status, item_code)'
);

CALL add_index_if_missing(
  'inventory_transactions',
  'idx_inventory_txn_created_item',
  'ALTER TABLE inventory_transactions ADD INDEX idx_inventory_txn_created_item (created_at, item_id)'
);

CALL add_index_if_missing(
  'voucher_entries',
  'idx_voucher_entries_ledger_voucher',
  'ALTER TABLE voucher_entries ADD INDEX idx_voucher_entries_ledger_voucher (ledger_id, voucher_id)'
);

CALL add_index_if_missing(
  'vouchers',
  'idx_vouchers_status_date',
  'ALTER TABLE vouchers ADD INDEX idx_vouchers_status_date (status, vdate, id)'
);

CALL add_index_if_missing(
  'invoices',
  'idx_invoices_status_date_id',
  'ALTER TABLE invoices ADD INDEX idx_invoices_status_date_id (status, invoice_date, id)'
);

DROP PROCEDURE IF EXISTS add_index_if_missing;
