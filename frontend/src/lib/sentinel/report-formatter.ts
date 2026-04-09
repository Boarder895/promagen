/**
 * Sentinel Report Formatter
 *
 * Formats the Monday email report from crawl data.
 * Produces both plain text (email body) and structured data.
 *
 * Authority: sentinel.md v1.2.0 §3.9
 * Existing features preserved: Yes
 */

import 'server-only';

import type { PageClass, RegressionType, Severity } from '@/types/sentinel';
import { getInboundLinkCounts } from '@/lib/sentinel/database';
import { getOrphanPages } from '@/lib/sentinel/snapshot';
import { getSuppressionSummary } from '@/lib/sentinel/suppression';
import { computeRunHealthScore, type HealthScoreResult } from '@/lib/sentinel/health-score';

// =============================================================================
// TYPES
// =============================================================================

export interface ReportData {
  weekOf: string;
  runId: string;
  pagesTotal: number;
  pagesCrawled: number;
  crawlDurationMs: number;
  healthScore: HealthScoreResult;
  regressions: Array<{
    url: string;
    pageClass: PageClass;
    regressionType: RegressionType;
    severity: Severity;
    previousValue: string | null;
    currentValue: string | null;
    suppressed: boolean;
  }>;
  suppressions: Array<{
    url: string;
    regressionType: string;
    reason: string;
    expiresAt: string | null;
  }>;
  topLinked: Array<{ url: string; inboundCount: number }>;
  orphans: Array<{ url: string; pageClass: PageClass; inboundCount: number }>;
  improvements: Array<{ url: string; description: string }>;
}

// =============================================================================
// REPORT ASSEMBLY
// =============================================================================

/**
 * Assemble full report data from a completed run.
 */
export async function assembleReport(
  runId: string,
  crawlDate: string,
  pagesCrawled: number,
  pagesTotal: number,
  crawlDurationMs: number,
  regressions: ReportData['regressions'],
): Promise<ReportData> {
  // Count active (non-suppressed) regressions for health score
  const activeRegressions = regressions.filter((r) => !r.suppressed).length;

  const healthScore = await computeRunHealthScore(runId, activeRegressions);
  const suppressions = await getSuppressionSummary();
  const orphans = await getOrphanPages(runId, 3);

  // Top 5 most-linked pages
  const inboundCounts = await getInboundLinkCounts(runId);
  const topLinked = Array.from(inboundCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, inboundCount]) => ({ url, inboundCount }));

  // Detect improvements (regressions that auto-resolved this week)
  const improvements = await detectImprovements(runId);

  return {
    weekOf: crawlDate,
    runId,
    pagesTotal,
    pagesCrawled,
    crawlDurationMs,
    healthScore,
    regressions,
    suppressions,
    topLinked,
    orphans,
    improvements,
  };
}

// =============================================================================
// TEXT FORMATTER
// =============================================================================

/**
 * Format the report as plain text email body.
 * Follows the layout defined in sentinel.md §3.9.
 */
export function formatReportText(data: ReportData): string {
  const lines: string[] = [];

  const unsuppressedRegs = data.regressions.filter((r) => !r.suppressed);
  const suppressedCount = data.regressions.filter((r) => r.suppressed).length;

  lines.push(`PROMAGEN SENTINEL — Week of ${data.weekOf}`);
  lines.push(`Run #${data.runId} — ${data.pagesCrawled}/${data.pagesTotal} pages crawled in ${(data.crawlDurationMs / 1000).toFixed(1)}s`);
  lines.push('═'.repeat(50));
  lines.push('');

  // Health score
  const hs = data.healthScore;
  const scoreEmoji = hs.score >= 80 ? '🟢' : hs.score >= 60 ? '🟡' : '🔴';
  lines.push(`${scoreEmoji} HEALTH SCORE: ${hs.score}/100`);
  lines.push(`  Availability: ${hs.components.availability.toFixed(1)}% (weight 40%)`);
  lines.push(`  Metadata: ${hs.components.metadata.toFixed(1)}% (weight 20%)`);
  lines.push(`  Schema: ${hs.components.schema.toFixed(1)}% (weight 15%)`);
  lines.push(`  Regression burden: ${hs.components.regressionBurden.toFixed(1)}% (weight 15%)`);
  lines.push(`  Orphan risk: ${hs.components.orphanRisk.toFixed(1)}% (weight 10%)`);
  lines.push('');

  lines.push(`HEALTH: ${hs.coverage.pagesHealthy}/${hs.coverage.pagesTotal} pages responding (${((hs.coverage.pagesHealthy / hs.coverage.pagesTotal) * 100).toFixed(0)}%)`);
  lines.push(`REGRESSIONS THIS WEEK: ${unsuppressedRegs.length}${suppressedCount > 0 ? ` (${suppressedCount} suppressed)` : ''}`);
  lines.push('');

  // Regressions by severity
  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
    const icon = sev === 'CRITICAL' ? '🔴' : sev === 'HIGH' ? '🟠' : sev === 'MEDIUM' ? '🟡' : '🔵';
    const regs = unsuppressedRegs.filter((r) => r.severity === sev);
    lines.push(`${icon} ${sev}`);
    if (regs.length === 0) {
      lines.push('  (none)');
    } else {
      for (const r of regs) {
        const detail = r.previousValue && r.currentValue
          ? ` (was ${r.previousValue} → now ${r.currentValue})`
          : '';
        lines.push(`  ${r.url} — ${formatRegressionType(r.regressionType)}${detail}`);
      }
    }
    lines.push('');
  }

  // Improvements
  if (data.improvements.length > 0) {
    lines.push('✅ IMPROVEMENTS THIS WEEK');
    for (const imp of data.improvements) {
      lines.push(`  ${imp.url} — ${imp.description}`);
    }
    lines.push('');
  }

  // Coverage summary
  lines.push('📊 COVERAGE SUMMARY');
  lines.push(`  Meta descriptions: ${hs.coverage.metaDescCount}/${hs.coverage.pagesTotal} present`);
  lines.push(`  Canonical tags: ${hs.coverage.canonicalCount}/${hs.coverage.pagesTotal} present`);
  lines.push(`  JSON-LD schema: ${hs.coverage.schemaCount}/${hs.coverage.pagesTotal} pages have schema`);
  lines.push(`  Average response time: ${hs.coverage.avgResponseMs}ms`);
  lines.push('');

  // Link graph
  if (data.topLinked.length > 0) {
    lines.push('🔗 LINK GRAPH (top 5 most-linked)');
    for (const link of data.topLinked) {
      lines.push(`  ${link.url} ← ${link.inboundCount} internal links`);
    }
    lines.push('');
  }

  // Orphans
  if (data.orphans.length > 0) {
    lines.push('🔗 ORPHAN ALERT (pages with <3 inbound links)');
    for (const orphan of data.orphans.slice(0, 10)) {
      lines.push(`  ${orphan.url} ← ${orphan.inboundCount}`);
    }
    lines.push('');
  }

  // Suppressions
  if (data.suppressions.length > 0) {
    lines.push(`🔇 SUPPRESSED (${suppressedCount})`);
    for (const s of data.suppressions) {
      const expires = s.expiresAt ? `, expires ${s.expiresAt}` : '';
      lines.push(`  ${s.url} ${s.regressionType} (${s.reason}${expires})`);
    }
    lines.push('');
  }

  // Top 3 actions
  lines.push('⏭️ TOP 3 ACTIONS THIS WEEK');
  const actions = generateTopActions(data);
  for (let i = 0; i < Math.min(3, actions.length); i++) {
    lines.push(`  ${i + 1}. ${actions[i]}`);
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function formatRegressionType(type: RegressionType): string {
  const labels: Record<RegressionType, string> = {
    page_down: 'Page returning error',
    title_lost: 'Title tag lost',
    meta_desc_lost: 'Meta description lost',
    schema_lost: 'JSON-LD schema disappeared',
    h1_changed: 'H1 changed',
    content_shrink_20: 'Word count dropped >20%',
    content_shrink_30: 'Word count dropped >30%',
    canonical_lost: 'Canonical tag lost',
    links_dropped_30: 'Internal links dropped >30%',
    performance_spike_3x: 'Response time spiked >3x',
    ssot_drift: 'SSOT version drift',
  };
  return labels[type] ?? type;
}

function generateTopActions(data: ReportData): string[] {
  const actions: string[] = [];

  // Priority 1: CRITICAL/HIGH regressions
  const criticalHigh = data.regressions.filter(
    (r) => !r.suppressed && (r.severity === 'CRITICAL' || r.severity === 'HIGH'),
  );
  for (const r of criticalHigh.slice(0, 2)) {
    actions.push(`Fix: ${r.url} — ${formatRegressionType(r.regressionType)} (${r.severity})`);
  }

  // Priority 2: Coverage gaps
  const hs = data.healthScore.coverage;
  if (hs.metaDescCount < hs.pagesTotal) {
    actions.push(`Add meta descriptions (${hs.metaDescCount}/${hs.pagesTotal} present)`);
  }
  if (hs.canonicalCount < hs.pagesTotal) {
    actions.push(`Add canonical tags (${hs.canonicalCount}/${hs.pagesTotal} present)`);
  }

  // Priority 3: Orphans
  if (data.orphans.length > 0) {
    actions.push(`Add internal links to ${data.orphans.length} orphaned pages`);
  }

  return actions.slice(0, 5);
}

async function detectImprovements(
  _runId: string,
): Promise<Array<{ url: string; description: string }>> {
  // Check for recently resolved regressions (resolved this week)
  const { db } = await import('@/lib/db');
  const resolved = await db()<{
    url: string;
    regression_type: string;
  }[]>`
    SELECT url, regression_type FROM sentinel_regressions
    WHERE resolved = TRUE
      AND resolved_date = (SELECT MAX(crawl_date) FROM sentinel_snapshots WHERE run_id = ${_runId})
  `;

  return resolved.map((r) => ({
    url: r.url,
    description: `${formatRegressionType(r.regression_type as RegressionType)} resolved`,
  }));
}
