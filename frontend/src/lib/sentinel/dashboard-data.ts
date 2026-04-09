/**
 * Sentinel Dashboard Data Layer
 *
 * Server-side data fetching for the /admin/sentinel dashboard.
 * Reads from sentinel_run_summaries (long-term trend storage)
 * and sentinel_regressions (current state).
 *
 * No new database calls beyond what the report already computes.
 *
 * Authority: sentinel.md v1.2.0 §3.11
 * Existing features preserved: Yes
 */

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export interface WeeklyDigest {
  runDate: string;
  pagesTotal: number;
  pagesHealthy: number;
  metaDescCount: number;
  canonicalCount: number;
  schemaCount: number;
  regressionsTotal: number;
  regressionsCritical: number;
  regressionsHigh: number;
  orphanCount: number;
  healthScore: number;
  avgResponseMs: number | null;
}

export interface DashboardData {
  available: boolean;
  weeks: WeeklyDigest[];
  currentHealthScore: number | null;
  healthTrend: 'improving' | 'declining' | 'stable' | 'insufficient';
  regressionTrend: number[];
  topUnresolvedRegressions: Array<{
    url: string;
    regressionType: string;
    severity: string;
    crawlDate: string;
    consecutiveWeeks: number;
  }>;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch the last N weeks of Sentinel data for the dashboard.
 */
export async function fetchDashboardData(weeks: number = 12): Promise<DashboardData> {
  if (!hasDatabaseConfigured()) {
    return {
      available: false, weeks: [], currentHealthScore: null,
      healthTrend: 'insufficient', regressionTrend: [], topUnresolvedRegressions: [],
    };
  }

  const sql = db();

  // Get weekly summaries
  const summaries = await sql<{
    run_date: string;
    pages_total: string;
    pages_healthy: string;
    meta_desc_count: string;
    canonical_count: string;
    schema_count: string;
    regressions_total: string;
    regressions_critical: string;
    regressions_high: string;
    orphan_count: string;
    health_score: string;
    avg_response_ms: string | null;
  }[]>`
    SELECT * FROM sentinel_run_summaries
    ORDER BY run_date DESC
    LIMIT ${weeks}
  `;

  const weeklyDigests: WeeklyDigest[] = summaries.map((s) => ({
    runDate: s.run_date,
    pagesTotal: parseInt(s.pages_total, 10),
    pagesHealthy: parseInt(s.pages_healthy, 10),
    metaDescCount: parseInt(s.meta_desc_count, 10),
    canonicalCount: parseInt(s.canonical_count, 10),
    schemaCount: parseInt(s.schema_count, 10),
    regressionsTotal: parseInt(s.regressions_total, 10),
    regressionsCritical: parseInt(s.regressions_critical, 10),
    regressionsHigh: parseInt(s.regressions_high, 10),
    orphanCount: parseInt(s.orphan_count, 10),
    healthScore: parseFloat(s.health_score),
    avgResponseMs: s.avg_response_ms ? parseInt(s.avg_response_ms, 10) : null,
  }));

  // Current health score
  const currentHealthScore = weeklyDigests[0]?.healthScore ?? null;

  // Health trend (last 4 weeks)
  const recentScores = weeklyDigests.slice(0, 4).map((w) => w.healthScore).reverse();
  const healthTrend = computeTrend(recentScores);

  // Regression count trend (for sparkline)
  const regressionTrend = weeklyDigests
    .slice(0, 12)
    .map((w) => w.regressionsTotal)
    .reverse();

  // Top unresolved regressions with streak info
  const unresolvedRows = await sql<{
    url: string;
    regression_type: string;
    severity: string;
    crawl_date: string;
  }[]>`
    SELECT url, regression_type, severity, MIN(crawl_date)::TEXT AS crawl_date
    FROM sentinel_regressions
    WHERE resolved = FALSE AND suppressed = FALSE
    GROUP BY url, regression_type, severity
    ORDER BY
      CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      MIN(crawl_date) ASC
    LIMIT 10
  `;

  const topUnresolved = unresolvedRows.map((r) => {
    const firstDate = new Date(r.crawl_date);
    const now = new Date();
    const weeksElapsed = Math.max(1, Math.round((now.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    return {
      url: r.url,
      regressionType: r.regression_type,
      severity: r.severity,
      crawlDate: r.crawl_date,
      consecutiveWeeks: weeksElapsed,
    };
  });

  return {
    available: true,
    weeks: weeklyDigests,
    currentHealthScore,
    healthTrend,
    regressionTrend,
    topUnresolvedRegressions: topUnresolved,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function computeTrend(scores: number[]): DashboardData['healthTrend'] {
  if (scores.length < 3) return 'insufficient';
  const first = scores[0]!;
  const last = scores[scores.length - 1]!;
  const diff = last - first;
  if (diff > 2) return 'improving';
  if (diff < -2) return 'declining';
  return 'stable';
}
