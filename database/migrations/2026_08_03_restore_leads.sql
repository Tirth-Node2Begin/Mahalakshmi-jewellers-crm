-- Restore the CRM leads module that was removed during the jewellery ERP cutover.
-- Idempotent: safe on fresh installs and on already-patched databases.

CREATE TABLE IF NOT EXISTS lead_sources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_sources_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  company VARCHAR(150) NULL,
  city VARCHAR(100) NULL,
  source_id INT UNSIGNED NULL,
  source_detail VARCHAR(255) NULL,
  channel_type ENUM('walk_in','phone','website','whatsapp','facebook','instagram','google','referral','other') NOT NULL DEFAULT 'other',
  entry_type ENUM('manual','import','api','webhook') NOT NULL DEFAULT 'manual',
  platform_lead_id VARCHAR(150) NULL,
  service_interest VARCHAR(255) NULL,
  expected_value DECIMAL(12,2) NULL,
  status ENUM('New','Contacted','Qualified','Meeting Scheduled','Meeting Done','Proposal Sent','Negotiation','Converted','Dropped','Lost') NOT NULL DEFAULT 'New',
  assigned_to INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  referred_by_customer_id INT UNSIGNED NULL,
  referred_by_lead_id INT UNSIGNED NULL,
  customer_id INT UNSIGNED NULL,
  converted_at DATETIME NULL,
  dropped_at DATETIME NULL,
  drop_reason VARCHAR(255) NULL,
  drop_reason_desc TEXT NULL,
  notes TEXT NULL,
  lead_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leads_platform (platform_lead_id),
  KEY idx_leads_status (status),
  KEY idx_leads_mobile (mobile),
  KEY idx_leads_email (email),
  KEY idx_leads_source (source_id),
  KEY idx_leads_assigned (assigned_to),
  KEY idx_leads_created (created_at),
  KEY idx_leads_created_by (created_by),
  KEY idx_leads_customer (customer_id),
  KEY idx_leads_referred_customer (referred_by_customer_id),
  KEY idx_leads_referred_lead (referred_by_lead_id),
  CONSTRAINT fk_leads_source FOREIGN KEY (source_id) REFERENCES lead_sources(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_referred_customer FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_referred_lead FOREIGN KEY (referred_by_lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lead_activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NOT NULL,
  activity_type VARCHAR(80) NOT NULL,
  description TEXT NULL,
  old_status VARCHAR(80) NULL,
  new_status VARCHAR(80) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activities_lead (lead_id),
  KEY idx_activities_created (created_at),
  CONSTRAINT fk_activities_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO lead_sources (name, is_active)
VALUES
  ('Walk-in', 1),
  ('Phone', 1),
  ('WhatsApp', 1),
  ('Instagram', 1),
  ('Referral', 1),
  ('Website', 1)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

INSERT INTO permissions (resource, action, description)
VALUES
  ('leads', 'read', 'See leads'),
  ('leads', 'create', 'Add a lead'),
  ('leads', 'update', 'Edit a lead'),
  ('leads', 'delete', 'Remove a lead')
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1;

INSERT INTO role_permission_grants (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'leads' AND p.action IN ('read', 'create', 'update')
WHERE r.name IN ('accountant', 'cashier')
  AND NOT EXISTS (
    SELECT 1
    FROM role_permission_grants g
    WHERE g.role_id = r.id AND g.permission_id = p.id
  );
