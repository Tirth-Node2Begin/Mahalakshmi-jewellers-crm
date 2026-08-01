-- ============================================================================
-- cleanup.sql — Delete all data EXCEPT:
--   1. Admin/Auth: users, roles, permissions, role_permission_grants, user_role_assignments
--   2. Inventory:  inventory_items, inventory_categories, units
--
-- Run with:  mysql -u root jewellers_crm < database/cleanup.sql
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- A. AUTH (keep users, roles, permissions, role_permission_grants, user_role_assignments)
TRUNCATE TABLE auth_sessions;
TRUNCATE TABLE password_reset_otps;
TRUNCATE TABLE api_rate_limits;

-- B. AUDIT & SYSTEM
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE security_audit_logs;
TRUNCATE TABLE settings;
TRUNCATE TABLE number_sequences;
TRUNCATE TABLE notifications;

-- C. CUSTOMERS
TRUNCATE TABLE customer_events;
TRUNCATE TABLE family_members;
TRUNCATE TABLE customers;

-- D. ESTIMATES
TRUNCATE TABLE estimate_items;
TRUNCATE TABLE estimates;

-- E. FINANCE
TRUNCATE TABLE fixed_cost_monthly_payments;
TRUNCATE TABLE expense_reminders;
TRUNCATE TABLE fixed_cost_items;
TRUNCATE TABLE expenses;
TRUNCATE TABLE expense_categories;
TRUNCATE TABLE bank_accounts;

-- F. SUPPLIERS & PURCHASES
TRUNCATE TABLE purchase_items;
TRUNCATE TABLE purchases;
TRUNCATE TABLE suppliers;

-- G. INVOICES & PAYMENTS
TRUNCATE TABLE invoice_old_metal;
TRUNCATE TABLE invoice_payments;
TRUNCATE TABLE invoice_items;
TRUNCATE TABLE invoices;

-- H. INVENTORY TRANSACTIONS (keep items, categories, units)
TRUNCATE TABLE inventory_transactions;

-- I. MESSAGING
TRUNCATE TABLE message_log;
TRUNCATE TABLE message_templates;

-- J. METALS & RATES
TRUNCATE TABLE metal_rates;
TRUNCATE TABLE metals;
TRUNCATE TABLE purities;

-- K. ACCOUNTING
TRUNCATE TABLE voucher_entries;
TRUNCATE TABLE vouchers;
TRUNCATE TABLE ledger_accounts;
TRUNCATE TABLE account_groups;

-- L. VENDOR PAYMENTS
TRUNCATE TABLE vendor_payments;

-- Reset inventory_items stock to 0 (since all transactions/purchases are deleted)
UPDATE inventory_items SET current_stock = 0, avg_cost = 0;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ Cleanup complete! Preserved: users, roles, permissions, role_permission_grants, user_role_assignments, inventory_items, inventory_categories, units' AS result;
