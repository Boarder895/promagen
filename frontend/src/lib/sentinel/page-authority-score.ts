/**
 * Sentinel Page Authority Score (PAS) — Extra 12
 *
 * Per-page composite score (0–100) computed from all Sentinel signals.
 * Produces a ranked authority leaderboard showing which pages to invest
 * in and which are already strong.
 *
 * Components (all available from Phase 1 crawl data):
 *   - Metadata completeness: title + desc + canonical + schema (25%)
 *   - Inbound link strength: count vs class average (20%)
 *   - Content depth: word count vs class average (15%)
 *   - Regression history: clean weeks vs total weeks (20%)
 *   - Schema richness: number of JSON-LD types (10%)
 *   - Response performance: relative to class average (10%)
 *
 * Phase 2 adds (when available):
 *   - Crawler visit frequency bonus (+5 if visited this week)
 *   - Citation score bonus (+5 per citation point from Cockpit)
 *
 * Nobody else computes per-page AI-visibility authority from crawl data.
 *
 * Authority: sentinel.md v2.0.0 §15
 * Existing features preserved: Yes
 */

import 'server-only';

import { db } from '@/lib/db';
import type { PageClass, SentinelSnapshotRow } from '@/types/sentinel';
import { getSnapshotsForRun, getInboundLinkCounts } from '@/lib/sentinel/database';

// =============================================================================
// TYPES
// =============================================================================

export interface PageAuthorityResult {
  url: string;
  pageClass: PageClass;
  score: number;
  components: {
    metadata: number;
    inboundLinks: number;
    contentDepth: number;
    regressionHistory: number;
    schemaRichness: number;
    performance: number;
  };
  rank: number;
  recommendation: string;
}

export interface PASReport {
  available: boolean;
  totalPages: number;
  averageScore: number;
  pages: PageAuthorityResult[];
  topPages: PageAuthorityResult[];
  weakestPages: PageAuthorityResult[];
}

// =============================================================================
// WEIGHTS
// =============================================================================

const WEIGHTS = {
  metadata: 0.25,
  inboundLinks: 0.20,
  contentDepth: 0.15,
  regressionHistory: 0.20,
  schemaRichness: 0.10,
  performance: 0.10,
} as const;

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Compute Page Authority Scores for all pages in a run.
 */
export async function computePageAuthorityScores(
  runId: string,
): Promise<PASReport> {
  const snapshots = await getSnapshotsForRun(runId);
  const inboundCounts = await getInboundLinkCounts(runId);

  if (snapshots.length === 0) {
    return {
      available: false,
      totalPages: 0,
      averageScore: 0,
      pages: [],
      topPages: [],
      weakestPages: [],
    };
  }

  // Compute class averages for relative scoring
  const classStats = computeClassAverages(snapshots, inboundCounts);

  // Get regression history counts
  const regressionCounts = await getRegressionHistoryPerUrl();

  // Score each page
  const scored: PageAuthorityResult[] = [];

  for (const snap of snapshots) {
    const pageClass = snap.page_class as PageClass;
    const classAvg = classStats.get(pageClass);

    // Metadata completeness (0–100)
    let metadataScore = 0;
    if (snap.title) metadataScore += 25;
    if (snap.meta_desc) metadataScore += 25;
    if (snap.canonical) metadataScore += 25;
    if ((snap.schema_types?.length ?? 0) > 0) metadataScore += 25;

    // Inbound link strength vs class average (0–100)
    const inbound = inboundCounts.get(snap.url) ?? 0;
    const avgInbound = classAvg?.avgInboundLinks ?? 3;
    const inboundScore = Math.min(100, (inbound / Math.max(avgInbound, 1)) * 50);

    // Content depth vs class average (0–100)
    const wc = snap.word_count ?? 0;
    const avgWc = classAvg?.avgWordCount ?? 500;
    const contentScore = Math.min(100, (wc / Math.max(avgWc, 1)) * 50);

    // Regression history: ratio of clean weeks (0–100)
    const regHistory = regressionCounts.get(snap.url);
    const totalWeeks = regHistory?.totalWeeks ?? 1;
    const regWeeks = regHistory?.regressionWeeks ?? 0;
    const cleanRatio = Math.max(0, (totalWeeks - regWeeks) / totalWeeks);
    const regressionScore = cleanRatio * 100;

    // Schema richness (0–100)
    const schemaCount = snap.schema_types?.length ?? 0;
    const schemaScore = Math.min(100, schemaCount * 33); // 3 types = 100

    // Performance vs class average (0–100, inverted — lower ms = higher score)
    const ms = snap.response_ms ?? 500;
    const avgMs = classAvg?.avgResponseMs ?? 500;
    const perfScore = ms > 0 ? Math.min(100, (avgMs / ms) * 50) : 50;

    // Composite score
    const score = Math.round(
      metadataScore * WEIGHTS.metadata +
      inboundScore * WEIGHTS.inboundLinks +
      contentScore * WEIGHTS.contentDepth +
      regressionScore * WEIGHTS.regressionHistory +
      schemaScore * WEIGHTS.schemaRichness +
      perfScore * WEIGHTS.performance,
    );

    scored.push({
      url: snap.url,
      pageClass,
      score,
      components: {
        metadata: Math.round(metadataScore),
        inboundLinks: Math.round(inboundScore),
        contentDepth: Math.round(contentScore),
        regressionHistory: Math.round(regressionScore),
        schemaRichness: Math.round(schemaScore),
        performance: Math.round(perfScore),
      },
      rank: 0,
      recommendation: '',
    });
  }

  // Rank and generate recommendations
  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length; i++) {
    scored[i]!.rank = i + 1;
    scored[i]!.recommendation = generateRecommendation(scored[i]!);
  }

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length)
    : 0;

  return {
    available: true,
    totalPages: scored.length,
    averageScore: avgScore,
    pages: scored,
    topPages: scored.slice(0, 5),
    weakestPages: scored.slice(-5).reverse(),
  };
}

/**
 * Format PAS report for Monday email.
 */
export function formatPASReport(report: PASReport): string | null {
  if (!report.available || report.pages.length === 0) return null;

  const lines: string[] = [];
  lines.push(`📊 PAGE AUTHORITY SCORES (avg: ${report.averageScore}/100 across ${report.totalPages} pages)`);

  lines.push('  Top 5:');
  for (const p of report.topPages) {
    lines.push(`    #${p.rank} ${p.url} — PAS ${p.score} (${p.pageClass})`);
  }

  lines.push('  Weakest 5:');
  for (const p of report.weakestPages) {
    lines.push(`    #${p.rank} ${p.url} — PAS ${p.score}`);
    lines.push(`      → ${p.recommendation}`);
  }

  return lines.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

interface ClassAverage {
  avgInboundLinks: number;
  avgWordCount: number;
  avgResponseMs: number;
}

function computeClassAverages(
  snapshots: SentinelSnapshotRow[],
  inboundCounts: Map<string, number>,
): Map<PageClass, ClassAverage> {
  const byClass = new Map<PageClass, SentinelSnapshotRow[]>();

  for (const snap of snapshots) {
    const cls = snap.page_class as PageClass;
    const existing = byClass.get(cls) ?? [];
    existing.push(snap);
    byClass.set(cls, existing);
  }

  const result = new Map<PageClass, ClassAverage>();

  for (const [cls, snaps] of byClass) {
    const inbounds = snaps.map((s) => inboundCounts.get(s.url) ?? 0);
    const wordCounts = snaps.map((s) => s.word_count ?? 0).filter((w) => w > 0);
    const responseTimes = snaps.map((s) => s.response_ms ?? 0).filter((m) => m > 0);

    result.set(cls, {
      avgInboundLinks: inbounds.length > 0 ? inbounds.reduce((a, b) => a + b, 0) / inbounds.length : 0,
      avgWordCount: wordCounts.length > 0 ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length : 0,
      avgResponseMs: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    });
  }

  return result;
}

async function getRegressionHistoryPerUrl(): Promise<
  Map<string, { totalWeeks: number; regressionWeeks: number }>
> {
  const sql = db();
  const rows = await sql<{
    url: string;
    total_weeks: string;
    reg_weeks: string;
  }[]>`
    SELECT
      s.url,
      COUNT(DISTINCT s.crawl_date)::TEXT AS total_weeks,
      COUNT(DISTINCT r.crawl_date)::TEXT AS reg_weeks
    FROM sentinel_snapshots s
    LEFT JOIN sentinel_regressions r
      ON r.url = s.url AND r.resolved = FALSE AND r.suppressed = FALSE
    GROUP BY s.url
  `;

  const map = new Map<string, { totalWeeks: number; regressionWeeks: number }>();
  for (const row of rows) {
    map.set(row.url, {
      totalWeeks: parseInt(row.total_weeks, 10),
      regressionWeeks: parseInt(row.reg_weeks, 10),
    });
  }
  return map;
}

function generateRecommendation(page: PageAuthorityResult): string {
  const weakest = Object.entries(page.components)
    .sort(([, a], [, b]) => a - b)[0];

  if (!weakest) return 'Review page';

  const [component, score] = weakest;

  const recs: Record<string, string> = {
    metadata: score === 0 ? 'Add title, meta description, canonical, and JSON-LD schema'
      : `Add missing metadata (${100 - score}% incomplete)`,
    inboundLinks: 'Add internal links from related pages',
    contentDepth: 'Expand content — page is thinner than class average',
    regressionHistory: 'Fix outstanding regressions on this page',
    schemaRichness: 'Add JSON-LD schema types (FAQPage, BreadcrumbList)',
    performance: 'Investigate slow response time',
  };

  return recs[component] ?? 'Review page quality';
}
