-- =============================================================================
-- Sentinel Phase 1 — Database Migration
-- =============================================================================
--
-- Authority: sentinel.md v1.2.0
-- Run against: Neon Postgres (Promagen production)
--
-- Tables:
--   1. sentinel_runs           — one row per cron execution
--   2. sentinel_snapshots      — one row per URL per crawl
--   3. sentinel_regressions    — detected regressions (week-over-week)
--   4. sentinel_suppressions   — intentional mutes
--   5. sentinel_link_graph     — edge-level internal links per run
--   6. sentinel_run_summaries  — long-term trend (survives snapshot pruning)
--   7. sentinel_crawler_visits — Phase 2 placeholder (created now, populated later)
--
-- Extra A: forensic_html_gz on sentinel_regressions stores gzipped HTML
--          at the moment a HIGH/CRITICAL regression is detected.
--
-- Idempotent: all statements use IF NOT EXISTS / IF NOT EXISTS patterns.
-- Safe to run multiple times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. sentinel_runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentinel_runs (
  id                    BIGSERIAL   PRIMARY KEY,
  run_date              DATE        NOT NULL,
  run_type              TEXT        NOT NULL DEFAULT 'weekly',
    -- 'weekly' | 'tripwire' | 'manual'
  is_rerun              BOOLEAN     NOT NULL DEFAULT FALSE,
  status                TEXT        NOT NULL DEFAULT 'started',
    -- Lifecycle: started → crawl_complete → diff_complete → reported → failed
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

-- At most one successful primary run per date per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentinel_primary_run
  ON sentinel_runs(run_date, run_type)
  WHERE is_rerun = FALSE AND status = 'reported';

-- ---------------------------------------------------------------------------
-- 2. sentinel_snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentinel_snapshots (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  crawl_date          DATE        NOT NULL,
  url                 TEXT        NOT NULL,
  page_class          TEXT        NOT NULL,
    -- homepage | hub | profile | guide | comparison | use_case | methodology | product
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

CREATE INDEX IF NOT EXISTS idx_sentinel_url_date
  ON sentinel_snapshots(url, crawl_date);

CREATE INDEX IF NOT EXISTS idx_sentinel_run
  ON sentinel_snapshots(run_id);

-- ---------------------------------------------------------------------------
-- 3. sentinel_regressions
-- ---------------------------------------------------------------------------
-- Extra A: forensic_html_gz stores gzipped page HTML at detection time
--          for HIGH and CRITICAL regressions. ~2KB per snapshot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentinel_regressions (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  crawl_date          DATE        NOT NULL,
  url                 TEXT        NOT NULL,
  page_class          TEXT        NOT NULL,
  regression_type     TEXT        NOT NULL,
  severity            TEXT        NOT NULL,
    -- CRITICAL | HIGH | MEDIUM | LOW
  previous_value      TEXT,
  current_value       TEXT,
  resolved            BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_date       DATE,
  suppressed          BOOLEAN     NOT NULL DEFAULT FALSE,
  suppression_id      BIGINT,
  forensic_html_gz    BYTEA,
    -- Extra A: gzipped HTML of the page at detection time.
    -- Only populated for CRITICAL and HIGH severity regressions.
    -- Null for MEDIUM/LOW (not worth the storage).
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_run
  ON sentinel_regressions(run_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_url
  ON sentinel_regressions(url, resolved);

-- ---------------------------------------------------------------------------
-- 4. sentinel_suppressions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentinel_suppressions (
  id                  BIGSERIAL   PRIMARY KEY,
  url                 TEXT        NOT NULL,
  regression_type     TEXT        NOT NULL,
    -- Specific type or '*' for all types on this URL
  reason              TEXT        NOT NULL,
  expires_at          DATE,
    -- Null = until manually removed
  created_by          TEXT        NOT NULL DEFAULT 'manual',
    -- 'manual' | 'auto'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_suppressions_active
  ON sentinel_suppressions(url, regression_type)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- ---------------------------------------------------------------------------
-- 5. sentinel_link_graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sentinel_link_graph (
  id                  BIGSERIAL   PRIMARY KEY,
  run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
  source_url          TEXT        NOT NULL,
  target_url          TEXT        NOT NULL,
  source_class        TEXT        NOT NULL,
  target_class        TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_links_run
  ON sentinel_link_graph(run_id);

CREATE INDEX IF NOT EXISTS idx_sentinel_links_target
  ON sentinel_link_graph(target_url, run_id);

-- ---------------------------------------------------------------------------
-- 6. sentinel_run_summaries (long-term trend storage)
-- ---------------------------------------------------------------------------
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
    -- From Phase 2 (null until Phase 2 active)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. sentinel_crawler_visits (Phase 2 placeholder — schema stable now)
-- ---------------------------------------------------------------------------
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
    -- 'log_drain' | 'cli_extract' | 'manual'
  confidence          TEXT        NOT NULL DEFAULT 'full',
    -- 'full' | 'partial'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_crawler_week
  ON sentinel_crawler_visits(week_date, bot_name);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
