/**
 * Sentinel Citation Velocity Index (Extra B)
 *
 * After 4+ weeks of manual citation scores in the Cockpit,
 * computes the rate of change of citation scores over a rolling
 * 4-week window per query per platform.
 *
 * A query that went 0→0→1→2 has positive velocity (+0.67/week).
 * A query that went 3→3→2→1 has negative velocity (−0.67/week).
 *
 * The CVI appears in the Monday report and feeds into the Claude
 * Analyst (Phase 3) for pattern detection.
 *
 * Data source: Citation Cockpit export (JSON from window.storage).
 * The Cockpit is single-device and manual — CVI consumes exported
 * snapshots, it does not read browser storage directly.
 *
 * Authority: sentinel.md v1.2.0 (Extra B addition)
 * Existing features preserved: Yes
 */

// =============================================================================
// TYPES
// =============================================================================

/** A single week's citation scores for one query across all platforms */
export interface CitationWeekEntry {
  week: string;           // ISO date string (Monday of the week)
  queryIndex: number;     // 0–11 matching Cockpit query order
  query: string;          // The search query text
  scores: Record<string, number | null>;  // platform → score (0–3 or null)
}

/** Velocity result for one query on one platform */
export interface CitationVelocity {
  queryIndex: number;
  query: string;
  platform: string;
  velocityPerWeek: number;  // positive = gaining, negative = losing
  currentScore: number | null;
  weeksOfData: number;
  trend: 'accelerating' | 'decelerating' | 'stable' | 'insufficient';
}

/** Summary across all queries */
export interface CitationVelocitySummary {
  velocities: CitationVelocity[];
  topAccelerating: CitationVelocity[];
  topDecelerating: CitationVelocity[];
  overallDirection: 'improving' | 'declining' | 'stable' | 'insufficient';
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum weeks needed to compute meaningful velocity */
const MIN_WEEKS_FOR_VELOCITY = 4;

/** Threshold for "significant" velocity */
const VELOCITY_THRESHOLD = 0.25;

const PLATFORMS = ['ChatGPT', 'Perplexity', 'Claude', 'Grok'] as const;

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Compute citation velocity from a series of weekly citation entries.
 *
 * Uses linear regression slope over the rolling window to compute
 * the rate of change per week.
 *
 * @param entries  Weekly citation entries sorted by week ascending.
 *                 These come from the Cockpit export.
 * @param windowWeeks  Rolling window size (default: 4)
 */
export function computeCitationVelocity(
  entries: CitationWeekEntry[],
  windowWeeks: number = MIN_WEEKS_FOR_VELOCITY,
): CitationVelocitySummary {
  // Group entries by query
  const byQuery = new Map<number, CitationWeekEntry[]>();
  for (const entry of entries) {
    const existing = byQuery.get(entry.queryIndex) ?? [];
    existing.push(entry);
    byQuery.set(entry.queryIndex, existing);
  }

  const velocities: CitationVelocity[] = [];

  for (const [queryIndex, queryEntries] of byQuery) {
    // Sort by week ascending
    const sorted = queryEntries.sort((a, b) => a.week.localeCompare(b.week));

    // Take the most recent `windowWeeks` entries
    const window = sorted.slice(-windowWeeks);

    for (const platform of PLATFORMS) {
      const scores = window
        .map((e) => e.scores[platform])
        .filter((s): s is number => s !== null && s !== undefined);

      if (scores.length < MIN_WEEKS_FOR_VELOCITY) {
        velocities.push({
          queryIndex,
          query: sorted[0]?.query ?? `Query ${queryIndex}`,
          platform,
          velocityPerWeek: 0,
          currentScore: scores[scores.length - 1] ?? null,
          weeksOfData: scores.length,
          trend: 'insufficient',
        });
        continue;
      }

      // Linear regression: slope = velocity per week
      const slope = linearRegressionSlope(scores);
      const currentScore = scores[scores.length - 1] ?? null;

      let trend: CitationVelocity['trend'];
      if (slope > VELOCITY_THRESHOLD) {
        trend = 'accelerating';
      } else if (slope < -VELOCITY_THRESHOLD) {
        trend = 'decelerating';
      } else {
        trend = 'stable';
      }

      velocities.push({
        queryIndex,
        query: sorted[0]?.query ?? `Query ${queryIndex}`,
        platform,
        velocityPerWeek: Math.round(slope * 100) / 100,
        currentScore,
        weeksOfData: scores.length,
        trend,
      });
    }
  }

  // Top accelerating and decelerating
  const withData = velocities.filter((v) => v.trend !== 'insufficient');
  const topAccelerating = withData
    .filter((v) => v.trend === 'accelerating')
    .sort((a, b) => b.velocityPerWeek - a.velocityPerWeek)
    .slice(0, 3);
  const topDecelerating = withData
    .filter((v) => v.trend === 'decelerating')
    .sort((a, b) => a.velocityPerWeek - b.velocityPerWeek)
    .slice(0, 3);

  // Overall direction
  const avgVelocity =
    withData.length > 0
      ? withData.reduce((sum, v) => sum + v.velocityPerWeek, 0) / withData.length
      : 0;

  let overallDirection: CitationVelocitySummary['overallDirection'];
  if (withData.length === 0) {
    overallDirection = 'insufficient';
  } else if (avgVelocity > VELOCITY_THRESHOLD) {
    overallDirection = 'improving';
  } else if (avgVelocity < -VELOCITY_THRESHOLD) {
    overallDirection = 'declining';
  } else {
    overallDirection = 'stable';
  }

  return {
    velocities,
    topAccelerating,
    topDecelerating,
    overallDirection,
  };
}

/**
 * Format CVI data for inclusion in the Monday report.
 */
export function formatCitationVelocityReport(summary: CitationVelocitySummary): string {
  if (summary.overallDirection === 'insufficient') {
    return '📈 CITATION VELOCITY: Insufficient data (need 4+ weeks of Cockpit scores)';
  }

  const lines: string[] = [];
  const directionEmoji =
    summary.overallDirection === 'improving' ? '📈' :
    summary.overallDirection === 'declining' ? '📉' : '➡️';

  lines.push(`${directionEmoji} CITATION VELOCITY INDEX (overall: ${summary.overallDirection})`);

  if (summary.topAccelerating.length > 0) {
    lines.push('  Accelerating:');
    for (const v of summary.topAccelerating) {
      lines.push(`    "${v.query}" on ${v.platform}: +${v.velocityPerWeek}/week (score: ${v.currentScore})`);
    }
  }

  if (summary.topDecelerating.length > 0) {
    lines.push('  Decelerating:');
    for (const v of summary.topDecelerating) {
      lines.push(`    "${v.query}" on ${v.platform}: ${v.velocityPerWeek}/week (score: ${v.currentScore})`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// MATH
// =============================================================================

/**
 * Compute the slope of a simple linear regression on evenly-spaced data.
 * x values are implicitly 0, 1, 2, ... (week indices).
 */
function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}
