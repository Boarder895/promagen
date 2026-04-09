/**
 * Sentinel Link Graph Analysis
 *
 * Higher-level link graph metrics beyond raw edge counts:
 *   - Hub strength: average inbound count of profile pages linked from /platforms
 *   - Orphan risk by page class
 *   - Week-over-week link delta
 *
 * Authority: sentinel.md v1.2.0 §3.6
 * Existing features preserved: Yes
 */

import 'server-only';

import type { PageClass } from '@/types/sentinel';
import { getInboundLinkCounts, getAllSnapshotUrls } from '@/lib/sentinel/database';
import { classifyPage } from '@/lib/sentinel/page-classifier';

// =============================================================================
// TYPES
// =============================================================================

export interface LinkGraphMetrics {
  totalEdges: number;
  hubStrength: number;
  orphansByClass: Record<PageClass, number>;
  topLinked: Array<{ url: string; pageClass: PageClass; inboundCount: number }>;
  bottomLinked: Array<{ url: string; pageClass: PageClass; inboundCount: number }>;
}

// =============================================================================
// COMPUTATION
// =============================================================================

/**
 * Compute link graph metrics for a run.
 *
 * Hub strength = average inbound link count of all profile pages.
 * This measures how well /platforms distributes link equity to profiles.
 */
export async function computeLinkGraphMetrics(
  runId: string,
): Promise<LinkGraphMetrics> {
  const inboundCounts = await getInboundLinkCounts(runId);
  const allUrls = await getAllSnapshotUrls(runId);

  // Build full url → count map (including zero-inbound pages)
  const fullCounts: Array<{ url: string; pageClass: PageClass; inboundCount: number }> = [];

  for (const url of allUrls) {
    fullCounts.push({
      url,
      pageClass: classifyPage(url),
      inboundCount: inboundCounts.get(url) ?? 0,
    });
  }

  // Hub strength: average inbound count of profile pages
  const profiles = fullCounts.filter((p) => p.pageClass === 'profile');
  const hubStrength =
    profiles.length > 0
      ? profiles.reduce((sum, p) => sum + p.inboundCount, 0) / profiles.length
      : 0;

  // Orphans by class
  const orphansByClass: Record<PageClass, number> = {
    homepage: 0, hub: 0, profile: 0, guide: 0,
    comparison: 0, use_case: 0, methodology: 0, product: 0,
  };
  for (const p of fullCounts) {
    if (p.inboundCount < 3) {
      orphansByClass[p.pageClass]++;
    }
  }

  // Sorted for top/bottom
  const sorted = [...fullCounts].sort((a, b) => b.inboundCount - a.inboundCount);

  return {
    totalEdges: Array.from(inboundCounts.values()).reduce((a, b) => a + b, 0),
    hubStrength: Math.round(hubStrength * 10) / 10,
    orphansByClass,
    topLinked: sorted.slice(0, 5),
    bottomLinked: sorted.slice(-5).reverse(),
  };
}

/**
 * Format link graph metrics for the Monday report.
 */
export function formatLinkGraphReport(metrics: LinkGraphMetrics): string {
  const lines: string[] = [];
  lines.push(`🔗 LINK GRAPH (${metrics.totalEdges} total edges, hub strength: ${metrics.hubStrength})`);
  lines.push('  Top 5 most-linked:');
  for (const p of metrics.topLinked) {
    lines.push(`    ${p.url} ← ${p.inboundCount} (${p.pageClass})`);
  }

  // Orphan breakdown if any exist
  const totalOrphans = Object.values(metrics.orphansByClass).reduce((a, b) => a + b, 0);
  if (totalOrphans > 0) {
    lines.push(`  Orphans (<3 inbound): ${totalOrphans} total`);
    for (const [cls, count] of Object.entries(metrics.orphansByClass)) {
      if (count > 0) {
        lines.push(`    ${cls}: ${count}`);
      }
    }
  }

  return lines.join('\n');
}
