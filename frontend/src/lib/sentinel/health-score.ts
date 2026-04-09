/**
 * Sentinel Health Score Calculator
 *
 * Computes the composite 0–100 health score from crawl data.
 * Formula defined in sentinel.md §7.
 *
 * Authority: sentinel.md v1.2.0 §7
 * Existing features preserved: Yes
 */

import 'server-only';

import {
  computeHealthScore,
  type HealthScoreComponents,
} from '@/types/sentinel';

import { getSnapshotsForRun } from '@/lib/sentinel/database';
import { getOrphanPages } from '@/lib/sentinel/snapshot';

// =============================================================================
// TYPES
// =============================================================================

export interface HealthScoreResult {
  score: number;
  components: HealthScoreComponents;
  coverage: {
    pagesTotal: number;
    pagesHealthy: number;
    metaDescCount: number;
    canonicalCount: number;
    schemaCount: number;
    activeRegressions: number;
    orphanCount: number;
    avgResponseMs: number;
  };
}

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Compute full health score for a run.
 *
 * @param runId              The run to score
 * @param activeRegressions  Count of unresolved, non-suppressed regressions
 */
export async function computeRunHealthScore(
  runId: string,
  activeRegressions: number,
): Promise<HealthScoreResult> {
  const snapshots = await getSnapshotsForRun(runId);
  const orphans = await getOrphanPages(runId, 3);

  const pagesTotal = snapshots.length;
  const pagesHealthy = snapshots.filter((s) => s.status_code === 200).length;

  // Metadata completeness: pages with title + meta_desc + canonical
  const metaDescCount = snapshots.filter((s) => Boolean(s.meta_desc)).length;
  const canonicalCount = snapshots.filter((s) => Boolean(s.canonical)).length;
  const pagesWithAllThree = snapshots.filter(
    (s) => Boolean(s.title) && Boolean(s.meta_desc) && Boolean(s.canonical),
  ).length;

  // Schema presence
  const schemaCount = snapshots.filter(
    (s) => (s.schema_types?.length ?? 0) > 0,
  ).length;

  // Average response time
  const responseTimes = snapshots
    .map((s) => s.response_ms)
    .filter((ms): ms is number => ms !== null && ms > 0);
  const avgResponseMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

  // Compute component scores (0–100 each)
  const availability = pagesTotal > 0 ? (pagesHealthy / pagesTotal) * 100 : 0;
  const metadata = pagesTotal > 0 ? (pagesWithAllThree / pagesTotal) * 100 : 0;
  const schema = pagesTotal > 0 ? (schemaCount / pagesTotal) * 100 : 0;
  const regressionBurden = Math.max(0, 100 - activeRegressions * 5);
  const pagesNotOrphaned = pagesTotal - orphans.length;
  const orphanRisk = pagesTotal > 0 ? (pagesNotOrphaned / pagesTotal) * 100 : 0;

  const components: HealthScoreComponents = {
    availability,
    metadata,
    schema,
    regressionBurden,
    orphanRisk,
  };

  const score = computeHealthScore(components);

  return {
    score,
    components,
    coverage: {
      pagesTotal,
      pagesHealthy,
      metaDescCount,
      canonicalCount,
      schemaCount,
      activeRegressions,
      orphanCount: orphans.length,
      avgResponseMs,
    },
  };
}
