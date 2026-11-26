-- Company logo upload (2026-07-05): settings.svalue widened from TEXT (64 KB)
-- to LONGTEXT so company_logo_path can hold a base64 data URI (~5 MB upload
-- -> ~6.7 MB encoded). Matches the LONGTEXT pattern used for website image
-- columns in database/website_db_migrations.sql.
-- Idempotence: MODIFY COLUMN is safe to re-run.

ALTER TABLE settings
  MODIFY COLUMN svalue LONGTEXT NULL;
