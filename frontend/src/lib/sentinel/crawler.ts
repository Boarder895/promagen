/**
 * Sentinel Crawler
 *
 * Fetches Promagen's own public pages and extracts 13 data points
 * per sentinel.md §3.1. Read-only observer — never modifies pages.
 *
 * v2: Extraction logic moved to extraction.ts (hardened parsers).
 *     This file now owns: fetch, concurrency, retries, and link extraction.
 *     All other parsing is delegated to the extraction module.
 *
 * Crawl controls (sentinel.md §3.10):
 *   Concurrency: 5   |  Timeout: 10s  |  Retries: 1 (3s delay)
 *   User-Agent: PromagenSentinel/1.0  |  Max pages: 100
 *
 * Authority: sentinel.md v1.2.0 §3.1, §3.10
 * Existing features preserved: Yes
 */

import {
  SENTINEL_USER_AGENT,
  CRAWL_CONCURRENCY,
  CRAWL_TIMEOUT_MS,
  CRAWL_RETRY_DELAY_MS,
  CRAWL_MAX_RETRIES,
  CRAWL_MAX_PAGES,
  type CrawlResult,
} from '@/types/sentinel';

import {
  extractTitle,
  extractMetaDescription,
  extractH1,
  extractCanonical,
  extractWordCount,
  extractSchemaTypes,
  extractFaqCount,
  extractSsotVersion,
  extractLastVerified,
} from '@/lib/sentinel/extraction';

// =============================================================================
// SITEMAP FETCH
// =============================================================================

/**
 * Fetch the sitemap XML and extract all <loc> URLs.
 */
export async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const sitemapUrl = `${baseUrl}/sitemap.xml`;

  const response = await fetch(sitemapUrl, {
    headers: { 'User-Agent': SENTINEL_USER_AGENT },
    signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Sitemap fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();

  const urls: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/g;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1]?.trim();
    if (url) urls.push(url);
  }

  if (urls.length === 0) {
    throw new Error('Sitemap returned no URLs — possible parsing failure');
  }

  if (urls.length > CRAWL_MAX_PAGES) {
    console.warn(
      `[Sentinel Crawler] Sitemap has ${urls.length} URLs — capping at ${CRAWL_MAX_PAGES}`,
    );
    return urls.slice(0, CRAWL_MAX_PAGES);
  }

  return urls;
}

// =============================================================================
// SINGLE PAGE FETCH + EXTRACT
// =============================================================================

/**
 * Fetch a single page and extract all 13 data points.
 * Retries once on failure (3s delay).
 */
export async function crawlPage(url: string): Promise<CrawlResult> {
  let retried = false;

  for (let attempt = 0; attempt <= CRAWL_MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        retried = true;
        await sleep(CRAWL_RETRY_DELAY_MS);
      }

      const startMs = Date.now();

      const response = await fetch(url, {
        headers: { 'User-Agent': SENTINEL_USER_AGENT },
        signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
        redirect: 'follow',
      });

      const responseMs = Date.now() - startMs;
      const html = await response.text();

      // Delegate extraction to hardened parsers
      return {
        url,
        statusCode: response.status,
        title: extractTitle(html),
        metaDesc: extractMetaDescription(html),
        h1: extractH1(html),
        canonical: extractCanonical(html),
        wordCount: extractWordCount(html),
        schemaTypes: extractSchemaTypes(html),
        internalLinksOut: extractInternalLinkCount(html, url),
        internalLinkTargets: extractInternalLinkTargets(html, url),
        ssotVersion: extractSsotVersion(html),
        lastVerified: extractLastVerified(html),
        faqCount: extractFaqCount(html),
        responseMs,
        rawHtml: html,
        retried,
        error: null,
      };
    } catch (_error) {
      if (attempt >= CRAWL_MAX_RETRIES) {
        return {
          url,
          statusCode: 0,
          title: null,
          metaDesc: null,
          h1: null,
          canonical: null,
          wordCount: 0,
          schemaTypes: [],
          internalLinksOut: 0,
          internalLinkTargets: [],
          ssotVersion: null,
          lastVerified: null,
          faqCount: 0,
          responseMs: 0,
          rawHtml: '',
          retried,
          error: _error instanceof Error ? _error.message : 'Unknown fetch error',
        };
      }
    }
  }

  // TypeScript exhaustiveness
  throw new Error('Unreachable');
}

/**
 * Crawl multiple URLs with bounded concurrency.
 * Uses a pool pattern: N workers pull from a shared queue.
 */
export async function crawlAll(urls: string[]): Promise<CrawlResult[]> {
  const results: CrawlResult[] = new Array(urls.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < urls.length) {
      const idx = nextIndex++;
      const url = urls[idx]!;
      results[idx] = await crawlPage(url);
    }
  }

  const workers: Promise<void>[] = [];
  const workerCount = Math.min(CRAWL_CONCURRENCY, urls.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

// =============================================================================
// INTERNAL LINK EXTRACTION (crawler-specific — needs pageUrl context)
// =============================================================================

/**
 * Count internal <a href> links pointing to promagen.com.
 */
function extractInternalLinkCount(html: string, pageUrl: string): number {
  return extractInternalLinkTargets(html, pageUrl).length;
}

/**
 * Extract all internal link target paths.
 * Used both for counting and for link graph edge building.
 */
export function extractInternalLinkTargets(
  html: string,
  pageUrl: string,
): string[] {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = 'https://promagen.com';
  }

  const targets: string[] = [];
  const hrefRegex = /<a\s[^>]*href\s*=\s*["']([\s\S]*?)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1]?.trim();
    if (!rawHref) continue;

    if (rawHref.startsWith('#')) continue;
    if (rawHref.startsWith('javascript:')) continue;
    if (rawHref.startsWith('mailto:')) continue;
    if (rawHref.startsWith('tel:')) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, pageUrl);
    } catch {
      continue;
    }

    if (resolved.origin !== origin) continue;

    const normalisedPath = resolved.pathname + (resolved.search || '');
    targets.push(normalisedPath);
  }

  return targets;
}

// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
