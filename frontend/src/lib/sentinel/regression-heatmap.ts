/**
 * Sentinel Regression Heatmap
 *
 * After 8+ weeks of data, generates a heatmap showing which
 * page classes × regression types fire most often. Surfaces
 * systemic patterns like "comparison pages lose schemas after
 * every deploy" → fix the template, not individual pages.
 *
 * The heatmap is a 2D matrix:
 *   Rows = regression types (10)
 *   Columns = page classes (8)
 *   Cells = frequency count over the analysis window
 *
 * Authority: sentinel.md v1.2.0 (Extra addition)
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import {
  REGRESSION_TYPES,
  PAGE_CLASSES,
  type RegressionType,
  type PageClass,
} from '@/types/sentinel';

// =============================================================================
// TYPES
// =============================================================================

export interface HeatmapCell {
  regressionType: RegressionType;
  pageClass: PageClass;
  count: number;
  /** Normalised intensity 0–1 (0 = never fires, 1 = fires every week) */
  intensity: number;
}

export interface RegressionHeatmap {
  windowWeeks: number;
  totalRegressions: number;
  cells: HeatmapCell[];
  /** Top 5 hotspots (highest frequency cells) */
  hotspots: HeatmapCell[];
  /** Systemic patterns: same cell firing 3+ times in the window */
  systemicPatterns: Array<{
    regressionType: RegressionType;
    pageClass: PageClass;
    count: number;
    suggestion: string;
  }>;
}

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Generate the regression heatmap from historical data.
 *
 * @param windowWeeks  How many weeks to look back (default: 8)
 */
export async function generateHeatmap(
  windowWeeks: number = 8,
): Promise<RegressionHeatmap> {
  const sql = db();

  // Count regressions by type × class over the window
  const rows = await sql<{
    regression_type: string;
    page_class: string;
    cnt: string;
  }[]>`
    SELECT regression_type, page_class, COUNT(*)::TEXT AS cnt
    FROM sentinel_regressions
    WHERE crawl_date >= (CURRENT_DATE - ${windowWeeks * 7})
      AND suppressed = FALSE
    GROUP BY regression_type, page_class
  `;

  // Build counts map
  const counts = new Map<string, number>();
  let maxCount = 0;

  for (const row of rows) {
    const key = `${row.regression_type}:${row.page_class}`;
    const count = parseInt(row.cnt, 10);
    counts.set(key, count);
    if (count > maxCount) maxCount = count;
  }

  // Build full matrix (all combinations)
  const cells: HeatmapCell[] = [];
  let totalRegressions = 0;

  for (const regType of REGRESSION_TYPES) {
    for (const pageClass of PAGE_CLASSES) {
      const key = `${regType}:${pageClass}`;
      const count = counts.get(key) ?? 0;
      totalRegressions += count;

      cells.push({
        regressionType: regType,
        pageClass,
        count,
        intensity: maxCount > 0 ? count / maxCount : 0,
      });
    }
  }

  // Top 5 hotspots
  const hotspots = [...cells]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Systemic patterns: same cell firing 3+ times
  const systemicPatterns = cells
    .filter((c) => c.count >= 3)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      regressionType: c.regressionType,
      pageClass: c.pageClass,
      count: c.count,
      suggestion: generateSuggestion(c.regressionType, c.pageClass, c.count),
    }));

  return {
    windowWeeks,
    totalRegressions,
    cells,
    hotspots,
    systemicPatterns,
  };
}

/**
 * Format heatmap for the Monday report.
 * Only included when systemic patterns are detected.
 */
export function formatHeatmapReport(heatmap: RegressionHeatmap): string | null {
  if (heatmap.systemicPatterns.length === 0) return null;

  const lines: string[] = [];
  lines.push(`🔥 SYSTEMIC PATTERNS (last ${heatmap.windowWeeks} weeks, ${heatmap.totalRegressions} total regressions)`);

  for (const pattern of heatmap.systemicPatterns) {
    lines.push(
      `  ${formatRegressionLabel(pattern.regressionType)} on ${pattern.pageClass} pages: ` +
        `${pattern.count} occurrences`,
    );
    lines.push(`    → ${pattern.suggestion}`);
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function generateSuggestion(regType: RegressionType, pageClass: PageClass, count: number): string {
  const frequency = count >= 6 ? 'recurring' : 'repeated';

  const suggestions: Partial<Record<RegressionType, string>> = {
    schema_lost: `Check the ${pageClass} page template — JSON-LD may be conditionally rendered and ${frequency}ly failing`,
    meta_desc_lost: `The ${pageClass} layout may be stripping meta descriptions during ISR — check generateMetadata()`,
    title_lost: `Title generation for ${pageClass} pages has a ${frequency} failure — review the title template`,
    content_shrink_20: `${pageClass} pages are ${frequency}ly losing content — check if ISR is serving partial renders`,
    content_shrink_30: `Significant content loss on ${pageClass} pages ${count} times — likely a template or data pipeline issue`,
    canonical_lost: `Canonical tags on ${pageClass} pages keep disappearing — check the layout component`,
    h1_changed: `H1 instability on ${pageClass} pages — likely dynamic content in the H1 that changes between builds`,
    links_dropped_30: `Internal links on ${pageClass} pages are ${frequency}ly dropping — check navigation components`,
    performance_spike_3x: `${pageClass} pages have ${frequency} performance spikes — check for heavy data fetching`,
    ssot_drift: `${pageClass} pages are falling behind the SSOT version — ISR revalidation may be stale`,
    page_down: `${pageClass} pages have gone down ${count} times — investigate deploy stability`,
  };

  return suggestions[regType] ?? `Investigate ${frequency} ${regType} on ${pageClass} pages`;
}

function formatRegressionLabel(type: RegressionType): string {
  const labels: Record<RegressionType, string> = {
    page_down: 'Page down',
    title_lost: 'Title lost',
    meta_desc_lost: 'Meta desc lost',
    schema_lost: 'Schema lost',
    h1_changed: 'H1 changed',
    content_shrink_20: 'Content shrink >20%',
    content_shrink_30: 'Content shrink >30%',
    canonical_lost: 'Canonical lost',
    links_dropped_30: 'Links dropped >30%',
    performance_spike_3x: 'Performance spike',
    ssot_drift: 'SSOT drift',
  };
  return labels[type] ?? type;
}
