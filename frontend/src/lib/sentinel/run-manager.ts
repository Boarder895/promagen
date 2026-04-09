/**
 * Sentinel Run Manager
 *
 * Orchestrates the full weekly crawl lifecycle:
 *   started → crawl_complete → diff_complete → (reported by cron route)
 *
 * Handles:
 *   - Idempotency: skips if primary run already exists for this date
 *   - Reruns: permits a new run if previous run failed
 *   - Advisory lock: prevents concurrent cron execution
 *   - Failure mode: persists partial data, never throws away work
 *   - Regression detection with Extra A forensic snapshots
 *   - Suppression application
 *
 * Authority: sentinel.md v1.2.0 §3.2, §3.2.1, §3.12
 * Existing features preserved: Yes
 */

import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

import type {
  RunType,
  CrawlResult,
  SentinelCronResponse,
} from '@/types/sentinel';

import {
  ensureSentinelTables,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  findCompletedRun,
  findFailedRun,
  createRun,
  updateRunStatus,
} from '@/lib/sentinel/database';

import { fetchSitemapUrls, crawlAll } from '@/lib/sentinel/crawler';
import { writeSnapshots, writeLinkGraph } from '@/lib/sentinel/snapshot';
import { detectRegressions } from '@/lib/sentinel/regression';
import { applySuppressions } from '@/lib/sentinel/suppression';
import { checkFreshness } from '@/lib/sentinel/freshness';

const gzipAsync = promisify(gzip);

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

export async function executeRun(
  baseUrl: string,
  runType: RunType = 'weekly',
): Promise<SentinelCronResponse> {
  const startTime = Date.now();
  const today = toDateString(new Date());

  await ensureSentinelTables();

  // ── Step 1: Advisory lock ─────────────────────────────────────────────────
  const lockAcquired = await acquireAdvisoryLock();
  if (!lockAcquired) {
    return {
      ok: false,
      message: 'Another Sentinel instance is running — skipped',
      runId: null,
      pagesCrawled: 0,
      pagesTotal: 0,
      regressionsFound: 0,
      durationMs: Date.now() - startTime,
      ranAt: new Date().toISOString(),
      skipped: true,
      skipReason: 'lock_held',
    };
  }

  try {
    // ── Step 2: Idempotency ───────────────────────────────────────────────────
    const existingCompleted = await findCompletedRun(today, runType);
    if (existingCompleted) {
      return {
        ok: true,
        message: 'Primary run already exists for today — skipped',
        runId: existingCompleted.id,
        pagesCrawled: existingCompleted.pages_crawled,
        pagesTotal: existingCompleted.pages_total,
        regressionsFound: existingCompleted.regressions_found,
        durationMs: Date.now() - startTime,
        ranAt: new Date().toISOString(),
        skipped: true,
        skipReason: 'primary_run_exists',
      };
    }

    const existingFailed = await findFailedRun(today, runType);
    const isRerun = existingFailed !== null;

    // ── Step 3: Fetch sitemap ─────────────────────────────────────────────────
    let urls: string[];
    try {
      urls = await fetchSitemapUrls(baseUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sentinel] Sitemap fetch failed:', msg);
      const failedRunId = await createRun(today, runType, isRerun, 0);
      await updateRunStatus(failedRunId, 'failed', {
        failureReason: `Sitemap fetch failed: ${msg}`,
      });
      return {
        ok: false, message: `Sitemap fetch failed: ${msg}`, runId: failedRunId,
        pagesCrawled: 0, pagesTotal: 0, regressionsFound: 0,
        durationMs: Date.now() - startTime, ranAt: new Date().toISOString(),
      };
    }

    console.debug(`[Sentinel] Starting ${isRerun ? 'rerun' : 'run'}: ${urls.length} URLs`);

    // ── Step 4: Create run record ─────────────────────────────────────────────
    const runId = await createRun(today, runType, isRerun, urls.length);

    // ── Step 5: Crawl all pages ───────────────────────────────────────────────
    const crawlStart = Date.now();
    let results: CrawlResult[];

    try {
      results = await crawlAll(urls);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sentinel] Crawl failed:', msg);
      await updateRunStatus(runId, 'failed', {
        failureReason: `Crawl failed: ${msg}`, crawlDurationMs: Date.now() - crawlStart,
      });
      return {
        ok: false, message: `Crawl failed: ${msg}`, runId,
        pagesCrawled: 0, pagesTotal: urls.length, regressionsFound: 0,
        durationMs: Date.now() - startTime, ranAt: new Date().toISOString(),
      };
    }

    const crawlDurationMs = Date.now() - crawlStart;
    const successful = results.filter((r) => r.statusCode !== 0);
    const failed = results.filter((r) => r.statusCode === 0);
    const timedOut = results.filter((r) => r.error?.includes('timeout'));

    if (failed.length > 0) {
      console.warn(`[Sentinel] ${failed.length}/${results.length} pages failed`);
      for (const f of failed) {
        console.warn(`  ✗ ${f.url}: ${f.error}`);
      }
    }

    // Abort if >50% timed out (sentinel.md §3.12)
    if (timedOut.length >= results.length / 2) {
      await updateRunStatus(runId, 'failed', {
        pagesCrawled: successful.length, crawlDurationMs,
        failureReason: `Too many timeouts: ${timedOut.length}/${results.length}`,
      });
      return {
        ok: false, message: `Aborted: ${timedOut.length}/${results.length} timed out`, runId,
        pagesCrawled: successful.length, pagesTotal: urls.length, regressionsFound: 0,
        durationMs: Date.now() - startTime, ranAt: new Date().toISOString(),
      };
    }

    // ── Step 6: Write snapshots ───────────────────────────────────────────────
    let snapshotsWritten: number;
    try {
      snapshotsWritten = await writeSnapshots(runId, today, results);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sentinel] Snapshot write failed:', msg);
      await updateRunStatus(runId, 'failed', {
        pagesCrawled: successful.length, crawlDurationMs,
        failureReason: `Snapshot write failed: ${msg}`,
      });
      return {
        ok: false, message: `Snapshot write failed: ${msg}`, runId,
        pagesCrawled: successful.length, pagesTotal: urls.length, regressionsFound: 0,
        durationMs: Date.now() - startTime, ranAt: new Date().toISOString(),
      };
    }

    // ── Step 7: Link graph ────────────────────────────────────────────────────
    let edgeCount: number;
    try {
      edgeCount = await writeLinkGraph(runId, results);
      console.debug(`[Sentinel] Link graph: ${edgeCount} edges`);
    } catch (error) {
      console.error('[Sentinel] Link graph failed (non-fatal):',
        error instanceof Error ? error.message : error);
      edgeCount = 0;
    }

    await updateRunStatus(runId, 'crawl_complete', {
      pagesCrawled: snapshotsWritten, crawlDurationMs,
    });

    console.debug(
      `[Sentinel] Crawl complete: ${snapshotsWritten}/${urls.length} pages, ${edgeCount} edges, ${crawlDurationMs}ms`,
    );

    // ── Step 8: Freshness check (non-fatal) ───────────────────────────────────
    try {
      const drifts = await checkFreshness(results);
      if (drifts.length > 0) {
        console.warn(`[Sentinel] SSOT drift on ${drifts.length} pages`);
      }
    } catch (error) {
      console.error('[Sentinel] Freshness check failed (non-fatal):',
        error instanceof Error ? error.message : error);
    }

    // ── Step 9: Regression detection + suppression ────────────────────────────
    const diffStart = Date.now();
    let regressionsFound = 0;
    let suppressionsApplied = 0;

    try {
      // Build URL → rawHtml map for Extra A forensic capture
      const htmlMap = new Map<string, string>();
      for (const r of results) {
        if (r.statusCode !== 0 && r.rawHtml) {
          htmlMap.set(normaliseUrlToPath(r.url), r.rawHtml);
        }
      }

      const regResult = await detectRegressions(runId, today, runType, htmlMap);
      regressionsFound = regResult.totalDetected;

      const supResult = await applySuppressions(runId);
      suppressionsApplied = supResult.suppressionsApplied;

      await updateRunStatus(runId, 'diff_complete', {
        regressionsFound, suppressionsApplied,
        diffDurationMs: Date.now() - diffStart,
      });

      console.debug(
        `[Sentinel] Diff complete: ${regressionsFound} regressions, ${suppressionsApplied} suppressed`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sentinel] Regression detection failed:', msg);
      await updateRunStatus(runId, 'failed', {
        diffDurationMs: Date.now() - diffStart,
        failureReason: `Diff failed: ${msg}`,
      });
      return {
        ok: false, message: `Crawl OK but diff failed: ${msg}`, runId,
        pagesCrawled: snapshotsWritten, pagesTotal: urls.length, regressionsFound: 0,
        durationMs: Date.now() - startTime, ranAt: new Date().toISOString(),
      };
    }

    // Run stays at diff_complete — cron route advances to reported after email
    return {
      ok: true,
      message:
        `Complete: ${snapshotsWritten}/${urls.length} pages, ${edgeCount} edges, ` +
        `${regressionsFound} regressions (${suppressionsApplied} suppressed)`,
      runId,
      pagesCrawled: snapshotsWritten,
      pagesTotal: urls.length,
      regressionsFound,
      durationMs: Date.now() - startTime,
      ranAt: new Date().toISOString(),
    };
  } finally {
    await releaseAdvisoryLock();
  }
}

// =============================================================================
// EXTRA A: FORENSIC HTML COMPRESSION
// =============================================================================

export async function compressForensicHtml(html: string): Promise<Buffer> {
  return gzipAsync(Buffer.from(html, 'utf-8')) as Promise<Buffer>;
}

// =============================================================================
// UTILITIES
// =============================================================================

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normaliseUrlToPath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return path;
  } catch {
    return url;
  }
}
