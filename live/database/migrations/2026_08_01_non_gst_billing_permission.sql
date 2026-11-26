-- ---------------------------------------------------------------------------
-- Non GST billing access (2026-08-01)
--
-- Normal Accountant/Cashier roles stay GST-only. This migration adds one
-- explicit billing-only permission and an add-on role the owner can assign to a
-- second login when that account should make/see Non GST bills.
--
-- It does not grant accounting, report, dashboard, stock, customer, or ledger
-- access. Assign it together with an existing billing role.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

INSERT INTO permissions (resource, action, description)
VALUES ('invoices', 'non_gst', 'Make and see Non GST bills in billing only')
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1;

INSERT INTO roles (name, display_name, description, data_scope, is_system, is_active)
VALUES (
  'non_gst_billing',
  'Non GST Billing Access',
  'Add-on role: allows Non GST bills only inside billing screens.',
  'all',
  0,
  1
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  data_scope = VALUES(data_scope),
  is_system = VALUES(is_system),
  is_active = 1;

INSERT INTO role_permission_grants (role_id, permission_id)
SELECT r.id, p.id
  FROM roles r
  JOIN permissions p ON p.resource = 'invoices' AND p.action = 'non_gst'
 WHERE r.name = 'non_gst_billing'
ON DUPLICATE KEY UPDATE role_id = role_id;
