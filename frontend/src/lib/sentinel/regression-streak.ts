/**
 * Sentinel Regression Streak Counter (Extra)
 *
 * Tracks consecutive weeks a regression persists unresolved.
 * The Monday report shows "Meta description missing on /platforms (week 3)"
 * instead of just "missing".
 *
 * Auto-escalation: after 4 consecutive weeks, MEDIUM → HIGH.
 * Creates urgency without nagging.
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import type { Severity } from '@/types/sentinel';

// =============================================================================
// TYPES
// =============================================================================

export interface RegressionStreak {
  regressionId: string;
  url: string;
  regressionType: string;
  originalSeverity: Severity;
  effectiveSeverity: Severity;
  consecutiveWeeks: number;
  firstDetected: string;
  escalated: boolean;
}

// =============================================================================
// STREAK COMPUTATION
// =============================================================================

/** Escalation threshold: after this many weeks, MEDIUM → HIGH */
const ESCALATION_WEEKS = 4;

/**
 * Compute regression streaks for all unresolved, non-suppressed regressions.
 *
 * A streak is the number of consecutive weekly runs where the same
 * regression (same URL + same regression_type) has appeared unresolved.
 *
 * Counts by finding the first detection date and calculating weeks elapsed.
 */
export async function computeRegressionStreaks(): Promise<RegressionStreak[]> {
  const sql = db();

  // Get all unresolved, non-suppressed regressions grouped by URL+type
  // with their earliest detection date
  const rows = await sql<{
    id: string;
    url: string;
    regression_type: string;
    severity: string;
    first_detected: string;
    latest_detected: string;
  }[]>`
    SELECT
      r.id,
      r.url,
      r.regression_type,
      r.severity,
      MIN(r.crawl_date)::TEXT AS first_detected,
      MAX(r.crawl_date)::TEXT AS latest_detected
    FROM sentinel_regressions r
    WHERE r.resolved = FALSE AND r.suppressed = FALSE
    GROUP BY r.id, r.url, r.regression_type, r.severity
    ORDER BY MIN(r.crawl_date) ASC
  `;

  const streaks: RegressionStreak[] = [];

  for (const row of rows) {
    const firstDate = new Date(row.first_detected);
    const latestDate = new Date(row.latest_detected);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const consecutiveWeeks = Math.max(
      1,
      Math.round((latestDate.getTime() - firstDate.getTime()) / msPerWeek) + 1,
    );

    const originalSeverity = row.severity as Severity;
    let effectiveSeverity = originalSeverity;
    let escalated = false;

    // Auto-escalation: MEDIUM → HIGH after ESCALATION_WEEKS
    if (originalSeverity === 'MEDIUM' && consecutiveWeeks >= ESCALATION_WEEKS) {
      effectiveSeverity = 'HIGH';
      escalated = true;
    }

    streaks.push({
      regressionId: row.id,
      url: row.url,
      regressionType: row.regression_type,
      originalSeverity,
      effectiveSeverity,
      consecutiveWeeks,
      firstDetected: row.first_detected,
      escalated,
    });
  }

  return streaks.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks);
}

/**
 * Format streak info for the Monday report.
 * Appends "(week N)" to regression descriptions and marks escalations.
 */
export function formatStreakSuffix(streak: RegressionStreak): string {
  const weekLabel = `week ${streak.consecutiveWeeks}`;
  if (streak.escalated) {
    return `(${weekLabel}, auto-escalated MEDIUM → HIGH)`;
  }
  return streak.consecutiveWeeks > 1 ? `(${weekLabel})` : '';
}
