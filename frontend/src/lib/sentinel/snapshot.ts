/**
 * Sentinel Snapshot Writer
 *
 * Converts raw CrawlResult[] into sentinel_snapshots rows and
 * sentinel_link_graph edges. Computes inbound link counts after
 * the full crawl is written.
 *
 * v2 FIX: getOrphanPages now cross-references ALL crawled URLs
 * from snapshots, not just URLs that appear in the link graph.
 * Pages with zero inbound links (true orphans) are now detected.
 *
 * Authority: sentinel.md v1.2.0 §3.3, §3.6
 * Existing features preserved: Yes
 */

import type { CrawlResult, PageClass, SentinelLinkEdge } from '@/types/sentinel';
import { classifyPage } from '@/lib/sentinel/page-classifier';
import {
  insertSnapshots,
  insertLinkEdges,
  getInboundLinkCounts,
  updateSnapshotInboundLinks,
  getAllSnapshotUrls,
} from '@/lib/sentinel/database';

// =============================================================================
// SNAPSHOT WRITING
// =============================================================================

/**
 * Write all crawl results as snapshot rows for a run.
 * @returns Number of snapshots successfully written.
 */
export async function writeSnapshots(
  runId: string,
  crawlDate: string,
  results: CrawlResult[],
): Promise<number> {
  const valid = results.filter((r) => r.statusCode !== 0);

  const snapshotRows = valid.map((r) => ({
    url: normaliseUrlToPath(r.url),
    pageClass: classifyPage(r.url),
    statusCode: r.statusCode,
    title: r.title,
    metaDesc: r.metaDesc,
    h1: r.h1,
    canonical: r.canonical,
    wordCount: r.wordCount,
    schemaTypes: r.schemaTypes,
    internalLinksOut: r.internalLinksOut,
    ssotVersion: r.ssotVersion,
    lastVerified: r.lastVerified,
    faqCount: r.faqCount,
    responseMs: r.responseMs,
  }));

  await insertSnapshots(runId, crawlDate, snapshotRows);
  return snapshotRows.length;
}

// =============================================================================
// LINK GRAPH BUILDING
// =============================================================================

/**
 * Build and write the link graph from crawl results.
 * Then compute inbound counts and update snapshots.
 * @returns Number of link edges written.
 */
export async function writeLinkGraph(
  runId: string,
  results: CrawlResult[],
): Promise<number> {
  const edges: SentinelLinkEdge[] = [];

  for (const result of results) {
    if (result.statusCode === 0) continue;

    const sourcePath = normaliseUrlToPath(result.url);
    const sourceClass = classifyPage(result.url);

    for (const targetPath of result.internalLinkTargets) {
      const normTarget = normaliseRawPath(targetPath);
      const targetClass = classifyPage(normTarget);

      if (normTarget === sourcePath) continue;

      edges.push({
        source_url: sourcePath,
        target_url: normTarget,
        source_class: sourceClass,
        target_class: targetClass,
      });
    }
  }

  const deduped = deduplicateEdges(edges);
  await insertLinkEdges(runId, deduped);

  const inboundCounts = await getInboundLinkCounts(runId);
  await updateSnapshotInboundLinks(runId, inboundCounts);

  return deduped.length;
}

// =============================================================================
// ORPHAN DETECTION (v2 FIX)
// =============================================================================

/**
 * Get pages with fewer than `threshold` inbound internal links.
 *
 * v2 FIX: Cross-references ALL crawled URLs from sentinel_snapshots,
 * not just URLs that appear as targets in the link graph.
 * Pages with ZERO inbound links (the most critical orphans)
 * now appear in the results.
 */
export async function getOrphanPages(
  runId: string,
  threshold: number = 3,
): Promise<Array<{ url: string; pageClass: PageClass; inboundCount: number }>> {
  // Get ALL URLs we crawled in this run
  const allUrls = await getAllSnapshotUrls(runId);

  // Get inbound counts from link graph (only URLs that have ≥1 inbound link)
  const inboundCounts = await getInboundLinkCounts(runId);

  const orphans: Array<{ url: string; pageClass: PageClass; inboundCount: number }> = [];

  // Check every crawled URL — not just those in the link graph
  for (const url of allUrls) {
    const count = inboundCounts.get(url) ?? 0;
    if (count < threshold) {
      orphans.push({
        url,
        pageClass: classifyPage(url),
        inboundCount: count,
      });
    }
  }

  return orphans.sort((a, b) => a.inboundCount - b.inboundCount);
}

// =============================================================================
// URL NORMALISATION
// =============================================================================

function normaliseUrlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  } catch {
    return url;
  }
}

function normaliseRawPath(raw: string): string {
  const qIdx = raw.indexOf('?');
  let path = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

function deduplicateEdges(edges: SentinelLinkEdge[]): SentinelLinkEdge[] {
  const seen = new Set<string>();
  const result: SentinelLinkEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.source_url}\u2192${edge.target_url}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(edge);
    }
  }
  return result;
}
