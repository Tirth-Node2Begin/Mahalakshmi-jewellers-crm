-- Meetings upgrade (2026-07-03): manual/standalone meetings + participants.
-- Matches the lead_meetings block in database/schema.sql and planning/01.
--   1. lead_id becomes optional (standalone meetings have no lead)
--   2. title for standalone meetings, created_by for own-scope visibility
--   3. meeting_customers / meeting_users junction tables ("clients" and "team")
-- Idempotence: safe on a fresh schema.sql database (guards below); re-running
-- after success is a no-op for the CREATEs and harmless for the ALTERs.

ALTER TABLE lead_meetings
  MODIFY COLUMN lead_id INT UNSIGNED NULL;

ALTER TABLE lead_meetings
  ADD COLUMN IF NOT EXISTS title VARCHAR(200) NULL AFTER lead_id;

ALTER TABLE lead_meetings
  ADD COLUMN IF NOT EXISTS created_by INT UNSIGNED NULL AFTER outcome_notes;

ALTER TABLE lead_meetings
  ADD CONSTRAINT fk_meetings_creator FOREIGN KEY IF NOT EXISTS (created_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS meeting_customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_customer (meeting_id, customer_id),
  KEY idx_mc_customer (customer_id),
  CONSTRAINT fk_mc_meeting FOREIGN KEY (meeting_id) REFERENCES lead_meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_mc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_user (meeting_id, user_id),
  KEY idx_mu_user (user_id),
  CONSTRAINT fk_mu_meeting FOREIGN KEY (meeting_id) REFERENCES lead_meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_mu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
