-- ---------------------------------------------------------------------------
-- Daily metal rate auto-fetch (2026-08-04)
--
-- Rates were manual-entry only. A shop that opens late, or a manager on leave,
-- bills all morning against yesterday's stale rate. This adds a morning fetch
-- from published benchmark sources.
--
-- WHY A STAGING TABLE AND NOT A DIRECT WRITE INTO metal_rates:
-- a finalised bill STAMPS the rate onto its lines (see RateService docblock), so
-- a wrong rate is not correctable after the fact — the bills are already printed
-- and posted. A scraped number therefore never reaches the counter on its own.
-- It lands here as a `staged` quote, gets sanity-flagged, and a human with
-- rates.set presses Apply. Only then does RateService::setRates() run.
--
-- Run:  mysql -u root jewellers_crm < database/migrations/2026_08_04_rate_feed.sql
--       php database/seed.php          (adds the rates.feed permission)
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + idempotent INSERTs.
-- ---------------------------------------------------------------------------

-- One row per cron/manual invocation per source. Keeps a visible trail of a
-- source that quietly started failing — a fetch that returns nothing must look
-- different from a fetch that never ran.
CREATE TABLE IF NOT EXISTS rate_feed_runs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  source VARCHAR(30) NOT NULL,                     -- ibja, cbic
  run_date DATE NOT NULL,
  trigger_type ENUM('cron','manual') NOT NULL DEFAULT 'cron',
  status ENUM('ok','empty','failed') NOT NULL,
  http_status SMALLINT UNSIGNED NULL,
  quote_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  -- publication token from the source (IBJA's HdnRatesAvaliable id). Identical
  -- token across two days = the source has not published anything new.
  source_token VARCHAR(80) NULL,
  message VARCHAR(500) NULL,
  duration_ms INT UNSIGNED NULL,
  triggered_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rate_feed_runs_day (run_date, source),
  CONSTRAINT fk_rate_feed_runs_user FOREIGN KEY (triggered_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per (date, source, purity). The unique key makes a re-run of the same
-- morning an UPDATE, not a second pending card in the manager's face.
CREATE TABLE IF NOT EXISTS rate_feed_quotes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id INT UNSIGNED NULL,
  source VARCHAR(30) NOT NULL,
  rate_date DATE NOT NULL,
  purity_id INT UNSIGNED NOT NULL,
  -- what we would write into metal_rates.rate_per_gram
  rate_per_gram DECIMAL(12,2) NOT NULL,
  -- what the source actually published, kept verbatim so a disputed rate can be
  -- traced back to the page it came from without re-fetching
  raw_label VARCHAR(40) NOT NULL,                  -- Gold 999, Silver 999, Platinum 999
  raw_value DECIMAL(14,3) NOT NULL,                -- 142938
  raw_unit VARCHAR(20) NOT NULL,                   -- per_10g, per_kg, per_g
  session VARCHAR(4) NOT NULL DEFAULT 'AM',        -- IBJA publishes AM and PM
  -- set when this purity is not published by the source and was derived pro-rata
  -- from a coarser one (925 silver from 999, PT950 from PT999)
  derived_from VARCHAR(40) NULL,
  status ENUM('staged','applied','rejected','superseded') NOT NULL DEFAULT 'staged',
  -- sanity findings as a JSON array of {code,message,severity}; empty array = clean
  flags TEXT NULL,
  decided_by INT UNSIGNED NULL,
  decided_at TIMESTAMP NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rate_feed_quote (rate_date, source, purity_id),
  KEY idx_rate_feed_quotes_status (status, rate_date),
  CONSTRAINT fk_rate_feed_quotes_run FOREIGN KEY (run_id) REFERENCES rate_feed_runs(id) ON DELETE SET NULL,
  CONSTRAINT fk_rate_feed_quotes_purity FOREIGN KEY (purity_id) REFERENCES purities(id) ON DELETE CASCADE,
  CONSTRAINT fk_rate_feed_quotes_user FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Settings (all optional — the defaults in RateFeedConfig apply when absent)
-- ---------------------------------------------------------------------------
INSERT INTO settings (skey, svalue) VALUES
  ('rate_feed_enabled', '1'),
  -- reject-and-flag band: a day-over-day move larger than this is almost always
  -- a parser break or a units change at the source, not a real market move
  ('rate_feed_max_move_pct', '8'),
  ('rate_feed_sources', 'ibja'),
  -- CBIC publishes an import tariff value per 10g gold / per kg silver in USD.
  -- It is a fortnightly government reference, NOT a counter rate; used only to
  -- confirm the scraped rate is in the right universe. Kept as settings because
  -- CBIC has no machine-readable feed (see CbicSource) — a 30-second manual
  -- update each fortnight keeps the cross-check alive when the fetch fails.
  ('rate_feed_cbic_gold_usd_10g', ''),
  ('rate_feed_cbic_silver_usd_kg', ''),
  ('rate_feed_cbic_notification', ''),
  ('rate_feed_cbic_effective_from', '')
ON DUPLICATE KEY UPDATE skey = VALUES(skey);

-- ---------------------------------------------------------------------------
-- Permission — seeing/approving the fetched rates is a separate grant from
-- typing a rate in by hand, so a shop can let a counter user watch the feed
-- without giving them the ability to overwrite the day's pricing.
-- ---------------------------------------------------------------------------
-- INSERT IGNORE rather than a NOT EXISTS guard: uq_permission (resource, action)
-- already enforces this, and a bare SELECT … WHERE with no FROM is not portable
-- across the MySQL/MariaDB versions this ships on.
INSERT IGNORE INTO permissions (resource, action, description, is_active)
VALUES ('rates', 'feed', 'See auto-fetched rates awaiting approval', 1);

-- Grant it to every role that can already set rates by hand. INSERT IGNORE +
-- uq_grant handles the re-run; the derived table keeps MySQL from reading the
-- insert target directly.
INSERT IGNORE INTO role_permission_grants (role_id, permission_id)
SELECT src.role_id, (SELECT id FROM permissions WHERE resource = 'rates' AND action = 'feed')
  FROM (SELECT DISTINCT g.role_id
          FROM role_permission_grants g
          JOIN permissions p ON p.id = g.permission_id
         WHERE p.resource = 'rates' AND p.action = 'set') AS src;
