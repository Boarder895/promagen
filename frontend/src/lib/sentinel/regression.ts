/**
 * Sentinel Regression Engine
 *
 * Compares this week's snapshots to last week's, detects regressions
 * using class-aware severity thresholds, respects minimum history
 * requirements, and captures forensic HTML snapshots (Extra A).
 *
 * Authority: sentinel.md v1.2.0 §3.4
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import {
  REGRESSION_THRESHOLD_MATRIX,
  REGRESSION_MIN_HISTORY,
  type RunType,
  type PageClass,
  type RegressionType,
  type Severity,
  type SentinelSnapshotRow,
} from '@/types/sentinel';

import { getPreviousSnapshots, getSnapshotHistory } from '@/lib/sentinel/database';
import { compressForensicHtml } from '@/lib/sentinel/run-manager';

// =============================================================================
// TYPES
// =============================================================================

export interface RegressionDetectionResult {
  totalDetected: number;
  bySeverity: Record<string, number>;
}

interface PendingRegression {
  url: string;
  pageClass: PageClass;
  regressionType: RegressionType;
  severity: Severity;
  previousValue: string | null;
  currentValue: string | null;
}

// =============================================================================
// MAIN DETECTION
// =============================================================================

/**
 * Detect regressions by comparing current run snapshots to previous run.
 *
 * @param runId       Current run ID
 * @param crawlDate   Current crawl date (YYYY-MM-DD)
 * @param runType     Run type (weekly/manual)
 * @param htmlMap     Map of URL path → raw HTML (for Extra A forensic capture)
 */
export async function detectRegressions(
  runId: string,
  crawlDate: string,
  runType: RunType,
  htmlMap: Map<string, string>,
): Promise<RegressionDetectionResult> {
  const sql = db();

  // Get current run's snapshots
  const currentRows = await sql<SentinelSnapshotRow[]>`
    SELECT * FROM sentinel_snapshots WHERE run_id = ${runId} ORDER BY url
  `;

  // Get previous run's snapshots
  const previousRows = await getPreviousSnapshots(crawlDate, runType);

  // No previous data = first run, nothing to compare
  if (previousRows.length === 0) {
    console.debug('[Sentinel Regression] First run — no previous data to compare');
    return { totalDetected: 0, bySeverity: {} };
  }

  // Build lookup maps
  const prevMap = new Map<string, SentinelSnapshotRow>();
  for (const row of previousRows) {
    prevMap.set(row.url, row);
  }

  // Detect regressions
  const pending: PendingRegression[] = [];

  for (const current of currentRows) {
    const prev = prevMap.get(current.url);
    if (!prev) continue; // New page — no comparison possible

    const pageClass = current.page_class as PageClass;

    // Run all regression checks
    const checks = detectForUrl(current, prev, pageClass);
    pending.push(...checks);
  }

  // Filter by minimum history requirements
  const filtered: PendingRegression[] = [];
  for (const reg of pending) {
    const minWeeks = REGRESSION_MIN_HISTORY[reg.regressionType];
    if (minWeeks && minWeeks > 1) {
      const history = await getSnapshotHistory(reg.url, minWeeks);
      if (history.length < minWeeks) {
        console.debug(
          `[Sentinel Regression] Skipping ${reg.regressionType} on ${reg.url} — ` +
            `only ${history.length}/${minWeeks} weeks of history`,
        );
        continue;
      }
    }
    filtered.push(reg);
  }

  // Write regressions to DB with forensic HTML for CRITICAL/HIGH
  const bySeverity: Record<string, number> = {};

  for (const reg of filtered) {
    // Extra A: compress forensic HTML for CRITICAL/HIGH regressions
    let forensicGz: Buffer | null = null;
    if (
      (reg.severity === 'CRITICAL' || reg.severity === 'HIGH') &&
      htmlMap.has(reg.url)
    ) {
      const rawHtml = htmlMap.get(reg.url)!;
      forensicGz = await compressForensicHtml(rawHtml);
    }

    await sql`
      INSERT INTO sentinel_regressions (
        run_id, crawl_date, url, page_class, regression_type,
        severity, previous_value, current_value, forensic_html_gz
      ) VALUES (
        ${runId}, ${crawlDate}, ${reg.url}, ${reg.pageClass}, ${reg.regressionType},
        ${reg.severity}, ${reg.previousValue}, ${reg.currentValue}, ${forensicGz}
      )
    `;

    bySeverity[reg.severity] = (bySeverity[reg.severity] ?? 0) + 1;
  }

  // Auto-resolve regressions that are no longer present
  await autoResolveRegressions(runId, crawlDate, currentRows);

  return {
    totalDetected: filtered.length,
    bySeverity,
  };
}

// =============================================================================
// PER-URL REGRESSION CHECKS
// =============================================================================

function detectForUrl(
  current: SentinelSnapshotRow,
  prev: SentinelSnapshotRow,
  pageClass: PageClass,
): PendingRegression[] {
  const results: PendingRegression[] = [];

  function add(type: RegressionType, prevVal: string | null, curVal: string | null): void {
    const severity = REGRESSION_THRESHOLD_MATRIX[type][pageClass];
    if (severity === 'IGNORED') return;
    results.push({
      url: current.url,
      pageClass,
      regressionType: type,
      severity,
      previousValue: prevVal,
      currentValue: curVal,
    });
  }

  // Page down: status changed from 200 to 4xx/5xx
  if (prev.status_code === 200 && current.status_code >= 400) {
    add('page_down', String(prev.status_code), String(current.status_code));
  }

  // Title lost
  if (prev.title && !current.title) {
    add('title_lost', prev.title, current.title);
  }

  // Meta description lost
  if (prev.meta_desc && !current.meta_desc) {
    add('meta_desc_lost', prev.meta_desc, current.meta_desc);
  }

  // Schema lost: any type that was present is now gone
  const prevSchemas = new Set(prev.schema_types ?? []);
  const curSchemas = new Set(current.schema_types ?? []);
  for (const schema of prevSchemas) {
    if (!curSchemas.has(schema)) {
      add('schema_lost', schema, null);
      break; // One regression per URL for schema loss
    }
  }

  // H1 changed (profile/guide/hub pages only — homepage/product IGNORED by matrix)
  if (prev.h1 && current.h1 && prev.h1 !== current.h1) {
    add('h1_changed', prev.h1, current.h1);
  }

  // Content shrink >20% and >30%
  const prevWc = prev.word_count ?? 0;
  const curWc = current.word_count ?? 0;
  if (prevWc > 0 && curWc > 0) {
    const dropPct = ((prevWc - curWc) / prevWc) * 100;
    if (dropPct > 30) {
      add('content_shrink_30', String(prevWc), String(curWc));
    } else if (dropPct > 20) {
      add('content_shrink_20', String(prevWc), String(curWc));
    }
  }

  // Canonical lost
  if (prev.canonical && !current.canonical) {
    add('canonical_lost', prev.canonical, current.canonical);
  }

  // Links dropped >30%
  const prevLinks = prev.internal_links_out ?? 0;
  const curLinks = current.internal_links_out ?? 0;
  if (prevLinks > 0 && curLinks > 0) {
    const dropPct = ((prevLinks - curLinks) / prevLinks) * 100;
    if (dropPct > 30) {
      add('links_dropped_30', String(prevLinks), String(curLinks));
    }
  }

  // Performance spike >3x (compared to previous week, not 4-week avg — simplified)
  const prevMs = prev.response_ms ?? 0;
  const curMs = current.response_ms ?? 0;
  if (prevMs > 0 && curMs > prevMs * 3) {
    add('performance_spike_3x', String(prevMs), String(curMs));
  }

  // SSOT drift
  if (prev.ssot_version && current.ssot_version && prev.ssot_version !== current.ssot_version) {
    add('ssot_drift', prev.ssot_version, current.ssot_version);
  }

  return results;
}

// =============================================================================
// AUTO-RESOLVE
// =============================================================================

/**
 * Mark regressions as resolved if the issue no longer exists.
 * E.g. if meta_desc was lost last week but is now present, resolve it.
 */
async function autoResolveRegressions(
  _runId: string,
  crawlDate: string,
  currentSnapshots: SentinelSnapshotRow[],
): Promise<void> {
  const sql = db();

  const currentMap = new Map<string, SentinelSnapshotRow>();
  for (const s of currentSnapshots) {
    currentMap.set(s.url, s);
  }

  // Get all unresolved regressions
  const unresolved = await sql<{
    id: string;
    url: string;
    regression_type: string;
  }[]>`
    SELECT id, url, regression_type FROM sentinel_regressions
    WHERE resolved = FALSE AND suppressed = FALSE
  `;

  for (const reg of unresolved) {
    const current = currentMap.get(reg.url);
    if (!current) continue;

    const shouldResolve = checkResolved(reg.regression_type as RegressionType, current);

    if (shouldResolve) {
      await sql`
        UPDATE sentinel_regressions
        SET resolved = TRUE, resolved_date = ${crawlDate}
        WHERE id = ${reg.id}
      `;
    }
  }
}

/** Check if a regression type is resolved based on current snapshot. */
function checkResolved(type: RegressionType, current: SentinelSnapshotRow): boolean {
  switch (type) {
    case 'page_down':
      return current.status_code === 200;
    case 'title_lost':
      return Boolean(current.title);
    case 'meta_desc_lost':
      return Boolean(current.meta_desc);
    case 'canonical_lost':
      return Boolean(current.canonical);
    case 'schema_lost':
      return (current.schema_types?.length ?? 0) > 0;
    default:
      // content_shrink, h1_changed, links_dropped, performance_spike, ssot_drift
      // These need manual verification or a specific fix — don't auto-resolve
      return false;
  }
}
