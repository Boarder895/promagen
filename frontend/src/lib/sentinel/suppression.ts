/**
 * Sentinel Suppression Engine
 *
 * Applies active suppressions to regressions for a run.
 * Suppressed regressions still exist in the DB but are excluded
 * from the Monday report and health score calculation.
 *
 * Authority: sentinel.md v1.2.0 §3.5
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import type { SentinelSuppressionRow } from '@/types/sentinel';

// =============================================================================
// TYPES
// =============================================================================

export interface SuppressionResult {
  suppressionsApplied: number;
  details: Array<{
    regressionId: string;
    url: string;
    regressionType: string;
    suppressionId: string;
    reason: string;
  }>;
}

// =============================================================================
// APPLY SUPPRESSIONS
// =============================================================================

/**
 * Apply all active suppressions to unsuppressed regressions for a run.
 *
 * Matches on exact URL + regression type, or URL + wildcard '*'.
 * Expired suppressions are ignored (filtered by query time, not index).
 */
export async function applySuppressions(runId: string): Promise<SuppressionResult> {
  const sql = db();

  // Get active suppressions
  const suppressions = await sql<SentinelSuppressionRow[]>`
    SELECT * FROM sentinel_suppressions
    WHERE expires_at IS NULL OR expires_at > NOW()
  `;

  if (suppressions.length === 0) {
    return { suppressionsApplied: 0, details: [] };
  }

  // Get unsuppressed regressions for this run
  const regressions = await sql<{
    id: string;
    url: string;
    regression_type: string;
  }[]>`
    SELECT id, url, regression_type FROM sentinel_regressions
    WHERE run_id = ${runId} AND suppressed = FALSE
  `;

  const details: SuppressionResult['details'] = [];

  for (const reg of regressions) {
    // Find matching suppression: exact type match OR wildcard '*'
    const match = suppressions.find(
      (s) =>
        s.url === reg.url &&
        (s.regression_type === reg.regression_type || s.regression_type === '*'),
    );

    if (match) {
      await sql`
        UPDATE sentinel_regressions
        SET suppressed = TRUE, suppression_id = ${match.id}
        WHERE id = ${reg.id}
      `;

      details.push({
        regressionId: reg.id,
        url: reg.url,
        regressionType: reg.regression_type,
        suppressionId: match.id,
        reason: match.reason,
      });
    }
  }

  return {
    suppressionsApplied: details.length,
    details,
  };
}

/**
 * Get a summary of active suppressions for the report.
 */
export async function getSuppressionSummary(): Promise<
  Array<{ url: string; regressionType: string; reason: string; expiresAt: string | null }>
> {
  const sql = db();

  const rows = await sql<{
    url: string;
    regression_type: string;
    reason: string;
    expires_at: string | null;
  }[]>`
    SELECT url, regression_type, reason, expires_at::TEXT
    FROM sentinel_suppressions
    WHERE expires_at IS NULL OR expires_at > NOW()
    ORDER BY url
  `;

  return rows.map((r) => ({
    url: r.url,
    regressionType: r.regression_type,
    reason: r.reason,
    expiresAt: r.expires_at,
  }));
}
