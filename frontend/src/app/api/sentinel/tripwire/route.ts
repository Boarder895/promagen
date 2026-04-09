/**
 * Sentinel Tripwire Cron Route
 *
 * Schedule: 0 6 * * 2-7 (Tuesday–Sunday 06:00 UTC)
 * Lightweight status-only check — no full extraction.
 *
 * Rules (sentinel.md §3.8):
 *   - Only checks authority pages (hub, profile, guide, comparison, use_case, methodology)
 *   - Product pages excluded
 *   - Only fires for non-200 responses
 *   - Maximum 1 alert per URL per day (no email storms)
 *   - Does NOT write to sentinel_snapshots (tripwire runs are separate)
 *
 * Authority: sentinel.md v1.2.0 §3.8
 * Existing features preserved: Yes
 */

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { hasDatabaseConfigured, ensureSentinelTables, createRun, updateRunStatus } from '@/lib/sentinel/database';
import { fetchSitemapUrls } from '@/lib/sentinel/crawler';
import { classifyPage, isAuthorityPage } from '@/lib/sentinel/page-classifier';
import { sendTripwireAlert } from '@/lib/sentinel/email';
import { SENTINEL_USER_AGENT, CRAWL_TIMEOUT_MS } from '@/types/sentinel';

// =============================================================================
// AUTH (identical to cron route)
// =============================================================================

function validateCronAuth(request: NextRequest): boolean {
  const secret = env.cron.secret;
  if (!secret || secret.length < 16) return false;

  const url = new URL(request.url);
  const authorization = request.headers.get('authorization') ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : '';

  const provided = (
    bearerSecret ||
    request.headers.get('x-promagen-cron') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('x-promagen-cron-secret') ||
    url.searchParams.get('secret') ||
    ''
  ).trim();

  if (!provided) return false;

  const aa = Buffer.from(provided, 'utf8');
  const bb = Buffer.from(secret, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // Kill switch
  const sentinelEnabled = process.env.SENTINEL_ENABLED?.trim().toLowerCase();
  if (sentinelEnabled === 'false' || sentinelEnabled === '0') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'SENTINEL_ENABLED=false' });
  }

  if (!hasDatabaseConfigured()) {
    return NextResponse.json({ ok: false, message: 'Database not configured' }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const baseUrl = env.siteUrl;

  try {
    await ensureSentinelTables();

    // Create tripwire run record
    let urls: string[];
    try {
      urls = await fetchSitemapUrls(baseUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ ok: false, message: `Sitemap failed: ${msg}` }, { status: 500 });
    }

    // Filter to authority pages only
    const authorityUrls = urls.filter((url) => {
      const pageClass = classifyPage(url);
      return isAuthorityPage(pageClass);
    });

    const runId = await createRun(today, 'tripwire', false, authorityUrls.length);

    // Status-only check — just fetch HEAD or GET and check status code
    const downPages: Array<{ url: string; status: number; pageClass: string }> = [];

    // Sequential checks (tripwire is lightweight, no need for concurrency)
    for (const url of authorityUrls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': SENTINEL_USER_AGENT },
          signal: AbortSignal.timeout(CRAWL_TIMEOUT_MS),
          redirect: 'follow',
        });

        if (response.status >= 400) {
          downPages.push({
            url,
            status: response.status,
            pageClass: classifyPage(url),
          });
        }
      } catch (_error) {
        // Fetch failure = treat as down
        downPages.push({
          url,
          status: 0,
          pageClass: classifyPage(url),
        });
      }
    }

    // Update run
    await updateRunStatus(runId, 'reported', {
      pagesCrawled: authorityUrls.length,
      regressionsFound: downPages.length,
      reportSent: downPages.length > 0,
    });

    // Send alert if any authority pages are down
    if (downPages.length > 0) {
      const alertLines = [
        `PROMAGEN SENTINEL TRIPWIRE ALERT — ${today}`,
        '',
        `${downPages.length} authority page(s) returning non-200:`,
        '',
      ];

      for (const page of downPages) {
        const statusText = page.status === 0 ? 'UNREACHABLE' : `HTTP ${page.status}`;
        alertLines.push(`  🔴 ${page.url} — ${statusText} (${page.pageClass})`);
      }

      alertLines.push('');
      alertLines.push('Action: Check for deploy breakage or infrastructure issues.');

      const alertText = alertLines.join('\n');

      const emailResult = await sendTripwireAlert(
        `🔴 Sentinel Tripwire: ${downPages.length} page(s) down`,
        alertText,
      );

      console.warn(
        `[Sentinel Tripwire] ${downPages.length} pages down, alert ${emailResult.sent ? 'sent' : 'failed'}`,
      );
    } else {
      console.debug(`[Sentinel Tripwire] All ${authorityUrls.length} authority pages healthy`);
    }

    return NextResponse.json({
      ok: true,
      pagesChecked: authorityUrls.length,
      pagesDown: downPages.length,
      downPages: downPages.map((p) => ({ url: p.url, status: p.status })),
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sentinel Tripwire] Failed:', msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
