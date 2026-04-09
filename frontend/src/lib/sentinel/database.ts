/**
 * Sentinel Database Operations
 *
 * Auto-migration (CREATE IF NOT EXISTS), advisory lock, and core CRUD
 * for sentinel_runs, sentinel_snapshots, and sentinel_link_graph.
 *
 * Regression and suppression operations are in their own modules:
 *   - regression.ts — regression CRUD
 *   - suppression.ts — suppression queries
 *
 * Authority: sentinel.md v1.2.0
 * Existing features preserved: Yes
 */

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';
import {
  SENTINEL_ADVISORY_LOCK_ID,
  type RunType,
  type RunStatus,
  type PageClass,
  type SentinelRunRow,
  type SentinelSnapshotRow,
  type SentinelLinkEdge,
} from '@/types/sentinel';

export { hasDatabaseConfigured };

// =============================================================================
// AUTO-MIGRATION (idempotent — safe to run every cron invocation)
// =============================================================================

export async function ensureSentinelTables(): Promise<void> {
  const sql = db();

  await sql`
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
    )
  `;

  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sentinel_primary_run
        ON sentinel_runs(run_date, run_type)
        WHERE is_rerun = FALSE AND status = 'reported'
    `;
  } catch {
    // Index already exists — safe to ignore
  }

  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_url_date ON sentinel_snapshots(url, crawl_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_run ON sentinel_snapshots(run_id)`;

  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_run ON sentinel_regressions(run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_regressions_url ON sentinel_regressions(url, resolved)`;

  await sql`
    CREATE TABLE IF NOT EXISTS sentinel_suppressions (
      id                  BIGSERIAL   PRIMARY KEY,
      url                 TEXT        NOT NULL,
      regression_type     TEXT        NOT NULL,
      reason              TEXT        NOT NULL,
      expires_at          DATE,
      created_by          TEXT        NOT NULL DEFAULT 'manual',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // v2 FIX: plain composite index — expiry filtering done at query time.
  // NOW() is not immutable and cannot be used in index predicates.
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_suppressions_lookup ON sentinel_suppressions(url, regression_type)`;

  await sql`
    CREATE TABLE IF NOT EXISTS sentinel_link_graph (
      id                  BIGSERIAL   PRIMARY KEY,
      run_id              BIGINT      NOT NULL REFERENCES sentinel_runs(id),
      source_url          TEXT        NOT NULL,
      target_url          TEXT        NOT NULL,
      source_class        TEXT        NOT NULL,
      target_class        TEXT        NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_links_run ON sentinel_link_graph(run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_links_target ON sentinel_link_graph(target_url, run_id)`;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sentinel_crawler_week ON sentinel_crawler_visits(week_date, bot_name)`;
}

// =============================================================================
// ADVISORY LOCK
// =============================================================================

export async function acquireAdvisoryLock(): Promise<boolean> {
  try {
    const result = await db()`
      SELECT pg_try_advisory_lock(${SENTINEL_ADVISORY_LOCK_ID}) AS acquired
    `;
    return result[0]?.acquired === true;
  } catch (error) {
    console.error('[Sentinel] Failed to acquire advisory lock:', error);
    return false;
  }
}

export async function releaseAdvisoryLock(): Promise<void> {
  try {
    await db()`SELECT pg_advisory_unlock(${SENTINEL_ADVISORY_LOCK_ID})`;
  } catch (error) {
    console.error('[Sentinel] Failed to release advisory lock:', error);
  }
}

// =============================================================================
// RUN OPERATIONS
// =============================================================================

export async function findCompletedRun(
  runDate: string,
  runType: RunType,
): Promise<SentinelRunRow | null> {
  const rows = await db()<SentinelRunRow[]>`
    SELECT * FROM sentinel_runs
    WHERE run_date = ${runDate} AND run_type = ${runType} AND status = 'reported'
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function findFailedRun(
  runDate: string,
  runType: RunType,
): Promise<SentinelRunRow | null> {
  const rows = await db()<SentinelRunRow[]>`
    SELECT * FROM sentinel_runs
    WHERE run_date = ${runDate} AND run_type = ${runType} AND status = 'failed'
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function createRun(
  runDate: string,
  runType: RunType,
  isRerun: boolean,
  pagesTotal: number,
): Promise<string> {
  const rows = await db()<{ id: string }[]>`
    INSERT INTO sentinel_runs (run_date, run_type, is_rerun, pages_total)
    VALUES (${runDate}, ${runType}, ${isRerun}, ${pagesTotal})
    RETURNING id
  `;
  return rows[0]!.id;
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus,
  updates: {
    pagesCrawled?: number;
    regressionsFound?: number;
    suppressionsApplied?: number;
    crawlDurationMs?: number;
    diffDurationMs?: number;
    reportSent?: boolean;
    failureReason?: string;
  } = {},
): Promise<void> {
  const completedAt = ['reported', 'failed'].includes(status)
    ? new Date().toISOString()
    : null;

  await db()`
    UPDATE sentinel_runs SET
      status = ${status},
      pages_crawled = COALESCE(${updates.pagesCrawled ?? null}, pages_crawled),
      regressions_found = COALESCE(${updates.regressionsFound ?? null}, regressions_found),
      suppressions_applied = COALESCE(${updates.suppressionsApplied ?? null}, suppressions_applied),
      crawl_duration_ms = COALESCE(${updates.crawlDurationMs ?? null}, crawl_duration_ms),
      diff_duration_ms = COALESCE(${updates.diffDurationMs ?? null}, diff_duration_ms),
      report_sent = COALESCE(${updates.reportSent ?? null}, report_sent),
      failure_reason = COALESCE(${updates.failureReason ?? null}, failure_reason),
      completed_at = COALESCE(${completedAt}, completed_at)
    WHERE id = ${runId}
  `;
}

// =============================================================================
// SNAPSHOT OPERATIONS
// =============================================================================

export async function insertSnapshots(
  runId: string,
  crawlDate: string,
  snapshots: Array<{
    url: string;
    pageClass: PageClass;
    statusCode: number;
    title: string | null;
    metaDesc: string | null;
    h1: string | null;
    canonical: string | null;
    wordCount: number;
    schemaTypes: string[];
    internalLinksOut: number;
    ssotVersion: string | null;
    lastVerified: string | null;
    faqCount: number;
    responseMs: number;
  }>,
): Promise<void> {
  if (snapshots.length === 0) return;
  const sql = db();

  for (const s of snapshots) {
    await sql`
      INSERT INTO sentinel_snapshots (
        run_id, crawl_date, url, page_class, status_code,
        title, meta_desc, h1, canonical, word_count,
        schema_types, internal_links_out,
        ssot_version, last_verified, faq_count, response_ms
      ) VALUES (
        ${runId}, ${crawlDate}, ${s.url}, ${s.pageClass}, ${s.statusCode},
        ${s.title}, ${s.metaDesc}, ${s.h1}, ${s.canonical}, ${s.wordCount},
        ${s.schemaTypes}, ${s.internalLinksOut},
        ${s.ssotVersion}, ${s.lastVerified}, ${s.faqCount}, ${s.responseMs}
      )
    `;
  }
}

export async function updateSnapshotInboundLinks(
  runId: string,
  inboundCounts: Map<string, number>,
): Promise<void> {
  const sql = db();
  for (const [url, count] of inboundCounts) {
    await sql`
      UPDATE sentinel_snapshots SET internal_links_in = ${count}
      WHERE run_id = ${runId} AND url = ${url}
    `;
  }
}

export async function getPreviousSnapshots(
  currentRunDate: string,
  runType: RunType,
): Promise<SentinelSnapshotRow[]> {
  const prevRuns = await db()<SentinelRunRow[]>`
    SELECT id FROM sentinel_runs
    WHERE run_date < ${currentRunDate}
      AND run_type = ${runType}
      AND status IN ('reported', 'crawl_complete', 'diff_complete')
    ORDER BY run_date DESC LIMIT 1
  `;
  if (prevRuns.length === 0) return [];

  return db()<SentinelSnapshotRow[]>`
    SELECT * FROM sentinel_snapshots WHERE run_id = ${prevRuns[0]!.id} ORDER BY url
  `;
}

export async function getSnapshotHistory(
  url: string,
  limit: number,
): Promise<SentinelSnapshotRow[]> {
  return db()<SentinelSnapshotRow[]>`
    SELECT s.* FROM sentinel_snapshots s
    JOIN sentinel_runs r ON r.id = s.run_id
    WHERE s.url = ${url}
      AND r.run_type = 'weekly'
      AND r.status IN ('reported', 'crawl_complete', 'diff_complete')
    ORDER BY s.crawl_date DESC LIMIT ${limit}
  `;
}

/** Get all snapshot URLs for a run (used by orphan detection). */
export async function getAllSnapshotUrls(runId: string): Promise<string[]> {
  const rows = await db()<{ url: string }[]>`
    SELECT url FROM sentinel_snapshots WHERE run_id = ${runId}
  `;
  return rows.map((r) => r.url);
}

export async function getSnapshotsForRun(runId: string): Promise<SentinelSnapshotRow[]> {
  return db()<SentinelSnapshotRow[]>`
    SELECT * FROM sentinel_snapshots WHERE run_id = ${runId} ORDER BY url
  `;
}

// =============================================================================
// LINK GRAPH OPERATIONS
// =============================================================================

export async function insertLinkEdges(
  runId: string,
  edges: SentinelLinkEdge[],
): Promise<void> {
  if (edges.length === 0) return;
  const sql = db();

  for (const e of edges) {
    await sql`
      INSERT INTO sentinel_link_graph (
        run_id, source_url, target_url, source_class, target_class
      ) VALUES (
        ${runId}, ${e.source_url}, ${e.target_url}, ${e.source_class}, ${e.target_class}
      )
    `;
  }
}

export async function getInboundLinkCounts(runId: string): Promise<Map<string, number>> {
  const rows = await db()<{ target_url: string; cnt: string }[]>`
    SELECT target_url, COUNT(*)::TEXT AS cnt
    FROM sentinel_link_graph WHERE run_id = ${runId}
    GROUP BY target_url
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.target_url, parseInt(row.cnt, 10));
  }
  return map;
}

export async function getPrimaryRunForDate(runDate: string): Promise<SentinelRunRow | null> {
  const rows = await db()<SentinelRunRow[]>`
    SELECT * FROM sentinel_runs
    WHERE run_date = ${runDate} AND run_type = 'weekly' AND status = 'reported'
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
}
