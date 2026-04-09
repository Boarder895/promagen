/**
 * Sentinel Report Archive
 *
 * After the Monday email sends, stores the full report text in
 * sentinel_report_archive. The dashboard can then show the exact
 * email that was sent each week.
 *
 * Storage: one INSERT per week. Report text is ~2–4KB.
 * The table is created alongside other sentinel tables (auto-migration).
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export interface ArchivedReport {
  id: string;
  runId: string;
  runDate: string;
  reportText: string;
  healthScore: number | null;
  regressionsCount: number;
  sentAt: string;
}

// =============================================================================
// TABLE CREATION (bolt onto ensureSentinelTables)
// =============================================================================

/**
 * Ensure the report archive table exists.
 * Called by the cron route after ensureSentinelTables().
 */
export async function ensureReportArchiveTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS sentinel_report_archive (
      id            BIGSERIAL   PRIMARY KEY,
      run_id        BIGINT      NOT NULL,
      run_date      DATE        NOT NULL,
      report_text   TEXT        NOT NULL,
      health_score  NUMERIC(5,2),
      regressions_count INT     NOT NULL DEFAULT 0,
      sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_sentinel_archive_date
    ON sentinel_report_archive(run_date DESC)
  `;
}

// =============================================================================
// WRITE
// =============================================================================

/**
 * Archive a Monday report after successful email send.
 */
export async function archiveReport(
  runId: string,
  runDate: string,
  reportText: string,
  healthScore: number | null,
  regressionsCount: number,
): Promise<void> {
  await db()`
    INSERT INTO sentinel_report_archive (
      run_id, run_date, report_text, health_score, regressions_count
    ) VALUES (
      ${runId}, ${runDate}, ${reportText}, ${healthScore}, ${regressionsCount}
    )
  `;
}

// =============================================================================
// READ (for dashboard)
// =============================================================================

/**
 * Get the last N archived reports for the dashboard.
 */
export async function getArchivedReports(
  limit: number = 12,
): Promise<ArchivedReport[]> {
  const rows = await db()<{
    id: string;
    run_id: string;
    run_date: string;
    report_text: string;
    health_score: string | null;
    regressions_count: string;
    sent_at: string;
  }[]>`
    SELECT
      id, run_id, run_date::TEXT, report_text,
      health_score::TEXT, regressions_count::TEXT, sent_at::TEXT
    FROM sentinel_report_archive
    ORDER BY run_date DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    runId: r.run_id,
    runDate: r.run_date,
    reportText: r.report_text,
    healthScore: r.health_score ? parseFloat(r.health_score) : null,
    regressionsCount: parseInt(r.regressions_count, 10),
    sentAt: r.sent_at,
  }));
}

/**
 * Get a single archived report by run date.
 */
export async function getReportByDate(
  runDate: string,
): Promise<ArchivedReport | null> {
  const rows = await db()<{
    id: string;
    run_id: string;
    run_date: string;
    report_text: string;
    health_score: string | null;
    regressions_count: string;
    sent_at: string;
  }[]>`
    SELECT
      id, run_id, run_date::TEXT, report_text,
      health_score::TEXT, regressions_count::TEXT, sent_at::TEXT
    FROM sentinel_report_archive
    WHERE run_date = ${runDate}
    ORDER BY sent_at DESC
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const r = rows[0]!;
  return {
    id: r.id,
    runId: r.run_id,
    runDate: r.run_date,
    reportText: r.report_text,
    healthScore: r.health_score ? parseFloat(r.health_score) : null,
    regressionsCount: parseInt(r.regressions_count, 10),
    sentAt: r.sent_at,
  };
}
