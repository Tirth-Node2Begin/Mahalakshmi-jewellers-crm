-- ---------------------------------------------------------------------------
-- Billing / receipt accounting corrections (2026-11-23)
--
-- Part 1 — per-line discounts reach the bill total.
-- Part 2 — a ledger per bank account, and a Cheques in Hand control ledger, so
--          every non-cash rupee no longer lands in one shared "Bank Account"
--          and a cheque is not treated as banked before it clears.
--
-- A discount typed against ONE LINE ("Discount on this line") was priced into
-- the line's taxable value — so the GST was right — but it never reached
-- invoices.grand_total, and it never reached the Discount Given ledger. The
-- customer was charged the undiscounted amount while the printed line showed
-- the discount. Totals now read:
--
--     grand total = metal + making − (bill discount + Σ line discounts)
--                   + tax − old metal ± round off
--
-- `discount_total` therefore becomes the TOTAL discount on the document (what
-- the bill prints and what the voucher debits to Discount Given), and the new
-- `bill_discount` column keeps the whole-bill figure the user typed in the
-- totals panel, so re-opening a draft does not fold the line discounts into
-- that input box.
--
-- Existing rows: bill_discount is backfilled from discount_total, which until
-- now held only the whole-bill figure. discount_total is deliberately NOT
-- recomputed — those bills are already finalised, posted and paid, and
-- re-totalling them would contradict their vouchers. Only drafts re-saved
-- after this migration pick up the corrected arithmetic.
--
-- Run:  mysql -u root -p jewellers_crm < database/migrations/2026_11_23_line_discounts.sql
--
-- Safe to re-run: every statement is guarded.
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS add_column_if_missing;

DELIMITER //
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_ddl TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @sql = p_ddl;
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL add_column_if_missing(
  'invoices',
  'bill_discount',
  'ALTER TABLE invoices
     ADD COLUMN bill_discount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_total'
);

CALL add_column_if_missing(
  'estimates',
  'bill_discount',
  'ALTER TABLE estimates
     ADD COLUMN bill_discount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_total'
);

-- until now discount_total held ONLY the whole-bill discount
UPDATE invoices  SET bill_discount = discount_total WHERE bill_discount = 0 AND discount_total <> 0;
UPDATE estimates SET bill_discount = discount_total WHERE bill_discount = 0 AND discount_total <> 0;

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- ---------------------------------------------------------------------------
-- Part 2: Cheques in Hand
--
-- A received cheque is money in transit, not money in the bank. It now lands in
-- this control ledger and only reaches the bank account when someone marks it
-- cleared on the Payments screen (Dr Bank, Cr Cheques in Hand) — so a bank
-- ledger still reconciles against the bank statement. A cheque we ISSUE is
-- unaffected: it credits the bank the moment it is written.
--
-- Bank-account ledgers themselves need no DDL: Ledgers::bankAccount() creates
-- one under Cash & Bank the first time money moves through that account.
-- ---------------------------------------------------------------------------

ALTER TABLE ledger_accounts
  MODIFY COLUMN linked_type ENUM(
    'cash','bank','cheques_in_hand','customer','vendor','gst_output','gst_input',
    'inventory','sales','making','old_metal','expense','cogs','discount',
    'round_off','opening_equity','stock_adjust'
  ) NULL DEFAULT NULL;

INSERT INTO ledger_accounts (group_id, name, linked_type, opening_type, is_system)
SELECT g.id, 'Cheques in Hand', 'cheques_in_hand', 'dr', 1
  FROM account_groups g
 WHERE g.name = 'Cash & Bank'
   AND NOT EXISTS (
     SELECT 1 FROM ledger_accounts l WHERE l.linked_type = 'cheques_in_hand'
   )
 LIMIT 1;
