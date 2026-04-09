/**
 * Sentinel Content Freshness Watchdog
 *
 * Compares the SSOT version string extracted from authority pages
 * against the current version in the codebase. Detects when ISR
 * cache is serving stale data.
 *
 * The crawler extracts SSOT version strings like "SSOT v1.1.0"
 * from page HTML. This module compares them to the canonical
 * version from platform-config.json.
 *
 * Authority: sentinel.md v1.2.0 §3.7
 * Existing features preserved: Yes
 */

import type { CrawlResult } from '@/types/sentinel';

// =============================================================================
// SSOT VERSION SOURCE
// =============================================================================

/**
 * Get the current SSOT version from the platform-config.json metadata.
 *
 * This reads the version at import time (static). In production, the
 * version is baked into the build. The crawler compares page-embedded
 * versions against this value.
 *
 * Note: We dynamically import to avoid hard-coupling to the data layer.
 * If the import fails (e.g. file moved), we return null and the freshness
 * check is skipped (degrades cleanly per §1.2).
 */
export async function getCurrentSsotVersion(): Promise<string | null> {
  try {
    // Dynamic import — resolves at runtime, not build time
    const config = await import('@/data/providers/platform-config.json', {
      with: { type: 'json' },
    });

    // platform-config.json has a top-level "version" field
    const version =
      (config as unknown as { default: { version?: string } }).default
        ?.version ?? null;

    return version;
  } catch {
    console.warn(
      '[Sentinel Freshness] Could not read SSOT version from platform-config.json',
    );
    return null;
  }
}

// =============================================================================
// FRESHNESS CHECK
// =============================================================================

export interface FreshnessDrift {
  url: string;
  pageVersion: string;
  currentVersion: string;
}

/**
 * Check all crawl results for SSOT version drift.
 *
 * Returns a list of pages where the embedded SSOT version does not
 * match the current canonical version. An empty list means all
 * authority pages are fresh.
 *
 * Pages without an SSOT version string (product pages, homepage)
 * are silently skipped — they don't embed version info.
 */
export async function checkFreshness(
  results: CrawlResult[],
): Promise<FreshnessDrift[]> {
  const currentVersion = await getCurrentSsotVersion();

  // If we can't determine the current version, skip the check entirely
  if (!currentVersion) {
    console.warn(
      '[Sentinel Freshness] No current SSOT version available — skipping freshness check',
    );
    return [];
  }

  const drifts: FreshnessDrift[] = [];

  for (const result of results) {
    // Skip failed fetches
    if (result.statusCode === 0) continue;

    // Skip pages without SSOT version (product pages don't have one)
    if (!result.ssotVersion) continue;

    // Compare versions (normalise: strip leading "v" if present)
    const pageVer = result.ssotVersion.replace(/^v/i, '').trim();
    const currentVer = currentVersion.replace(/^v/i, '').trim();

    if (pageVer !== currentVer) {
      drifts.push({
        url: result.url,
        pageVersion: pageVer,
        currentVersion: currentVer,
      });
    }
  }

  return drifts;
}
