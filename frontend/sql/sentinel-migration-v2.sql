-- =============================================================================
-- Sentinel Phase 1 — Database Migration v2
-- =============================================================================
-- Authority: sentinel.md v1.2.0
--
-- v2 fixes:
--   - REMOVED partial index on sentinel_suppressions (NOW() is not immutable)
--   - REPLACED with plain composite index (filtering done at query time)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sentinel_runs (
  id                    BIGSERIAL   PRIMARY KEY,
  run_date              DATE        NOT NULL,
  run_type              TEXT        NOT NULL DEFAULT 'weekly',
  is_rerun              BOOLEAN     NOT NULL DEFAULT FALSE,
  status                TEXT        NOT NULL DEFAULT 'started',
  pages_crawled         INT         NOT NULL DEFAULT 0,
  pages_total           INT         NOT NULL DEFAULT 0,
  regressions_found     INT         NOT NULL DEFAULT 0,
  suppressions_applied  INT         NOT NULL DEFAULT 0,
  crawl_duration_ms     INT,
  diff_duration_ms      INT,
  report_sent           BOOLEAN     NOT NULL DEFAULT FALSE,
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sentinel_primary_run
  ON sentinel_runs(run_date, run_type)
  WHERE is_rerun = FALSE AND status = 'reported';

CREATE TABLE IF NOT EXISTS sentinel_snapshots (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  crawl_date          DATE        NOT NULL,
  url                 TEXT        NOT NULL,
  page_class          TEXT        NOT NULL,
  status_code         INT         NOT NULL,
  title               TEXT,
  meta_desc           TEXT,
  h1                  TEXT,
  canonical           TEXT,
  word_count          INT,
  schema_types        TEXT[],
  internal_links_out  INT,
  internal_links_in   INT,
  ssot_version        TEXT,
  last_verified       TEXT,
  faq_count           INT,
  response_ms         INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_url_date ON sentinel_snapshots(url, crawl_date);
CREATE INDEX IF NOT EXISTS idx_sentinel_run ON sentinel_snapshots(run_id);

CREATE TABLE IF NOT EXISTS sentinel_regressions (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  crawl_date          DATE        NOT NULL,
  url                 TEXT        NOT NULL,
  page_class          TEXT        NOT NULL,
  regression_type     TEXT        NOT NULL,
  severity            TEXT        NOT NULL,
  previous_value      TEXT,
  current_value       TEXT,
  resolved            BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_date       DATE,
  suppressed          BOOLEAN     NOT NULL DEFAULT FALSE,
  suppression_id      BIGINT,
  forensic_html_gz    BYTEA,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_run ON sentinel_regressions(run_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_url ON sentinel_regressions(url, resolved);

CREATE TABLE IF NOT EXISTS sentinel_suppressions (
  id                  BIGSERIAL   PRIMARY KEY,
  url                 TEXT        NOT NULL,
  regression_type     TEXT        NOT NULL,
  reason              TEXT        NOT NULL,
  expires_at          DATE,
  created_by          TEXT        NOT NULL DEFAULT 'manual',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v2 FIX: plain composite index, NOT a partial index with NOW().
-- Expiry filtering is done at query time with WHERE expires_at IS NULL OR expires_at > NOW().
CREATE INDEX IF NOT EXISTS idx_sentinel_suppressions_lookup
  ON sentinel_suppressions(url, regression_type);

-- Drop the broken v1 partial index if it exists
DROP INDEX IF EXISTS idx_sentinel_suppressions_active;

CREATE TABLE IF NOT EXISTS sentinel_link_graph (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  source_url          TEXT        NOT NULL,
  target_url          TEXT        NOT NULL,
  source_class        TEXT        NOT NULL,
  target_class        TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_links_run ON sentinel_link_graph(run_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_links_target ON sentinel_link_graph(target_url, run_id);

CREATE TABLE IF NOT EXISTS sentinel_run_summaries (
  id                    BIGSERIAL     PRIMARY KEY,
  run_date              DATE          NOT NULL UNIQUE,
  pages_total           INT           NOT NULL,
  pages_healthy         INT           NOT NULL,
  meta_desc_count       INT           NOT NULL,
  canonical_count       INT           NOT NULL,
  schema_count          INT           NOT NULL,
  regressions_total     INT           NOT NULL,
  regressions_critical  INT           NOT NULL,
  regressions_high      INT           NOT NULL,
  orphan_count          INT           NOT NULL,
  health_score          NUMERIC(5,2)  NOT NULL,
  avg_response_ms       INT,
  ai_referrals_total    INT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentinel_crawler_visits (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      REFERENCES sentinel_runs(id),
  week_date           DATE        NOT NULL,
  bot_name            TEXT        NOT NULL,
  url                 TEXT        NOT NULL,
  visit_count         INT         NOT NULL DEFAULT 1,
  first_seen          TIMESTAMPTZ,
  last_seen           TIMESTAMPTZ,
  source              TEXT        NOT NULL,
  confidence          TEXT        NOT NULL DEFAULT 'full',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_crawler_week ON sentinel_crawler_visits(week_date, bot_name);
