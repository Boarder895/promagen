/**
 * Sentinel Monday Cron Route
 *
 * Schedule: 0 6 * * 1 (Monday 06:00 UTC)
 * Configured in vercel.json alongside existing crons.
 *
 * Flow:
 *   1. Validate cron auth (same pattern as index-rating cron)
 *   2. Check kill switch (SENTINEL_ENABLED)
 *   3. Execute run (crawl → snapshots → link graph → regressions → suppressions)
 *   4. Assemble and send Monday report via Resend
 *   5. Mark run as reported
 *
 * Authority: sentinel.md v1.2.0 §3.13
 * Existing features preserved: Yes
 */

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { hasDatabaseConfigured, updateRunStatus } from '@/lib/sentinel/database';
import { executeRun } from '@/lib/sentinel/run-manager';
import { assembleReport, formatReportText } from '@/lib/sentinel/report-formatter';
import { sendReportEmail } from '@/lib/sentinel/email';
import type { SentinelCronResponse, RegressionType, Severity, PageClass } from '@/types/sentinel';

// =============================================================================
// CONFIG
// =============================================================================

const BASE_URL = env.siteUrl;

// =============================================================================
// AUTH (same pattern as index-rating cron)
// =============================================================================

function validateCronAuth(request: NextRequest): boolean {
  const secret = env.cron.secret;
  if (!secret || secret.length < 16) {
    console.error('[Sentinel Cron] PROMAGEN_CRON_SECRET not configured or too short');
    return false;
  }

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

  // ── Auth ────────────────────────────────────────────────────────────────────
  if (!validateCronAuth(request)) {
    console.warn('[Sentinel Cron] Unauthorized request');
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // ── Kill switch ─────────────────────────────────────────────────────────────
  const sentinelEnabled = process.env.SENTINEL_ENABLED?.trim().toLowerCase();
  if (sentinelEnabled === 'false' || sentinelEnabled === '0') {
    return NextResponse.json({ ok: true, skipped: true, reason: 'SENTINEL_ENABLED=false' });
  }

  // ── Database check ──────────────────────────────────────────────────────────
  if (!hasDatabaseConfigured()) {
    return NextResponse.json(
      { ok: false, message: 'Database not configured' },
      { status: 500 },
    );
  }

  // ── Execute run (crawl + diff) ──────────────────────────────────────────────
  let runResult: SentinelCronResponse;
  try {
    runResult = await executeRun(BASE_URL, 'weekly');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sentinel Cron] Run failed:', msg);
    return NextResponse.json(
      { ok: false, message: `Run failed: ${msg}`, durationMs: Date.now() - startTime },
      { status: 500 },
    );
  }

  // If skipped (idempotency or lock), return early
  if (runResult.skipped) {
    return NextResponse.json(runResult);
  }

  // If run failed, return the failure (data is persisted)
  if (!runResult.ok || !runResult.runId) {
    return NextResponse.json(runResult, { status: 500 });
  }

  // ── Assemble report ─────────────────────────────────────────────────────────
  let reportText: string;
  try {
    // Get regressions for this run from DB
    const { db } = await import('@/lib/db');
    const regressions = await db()<{
      url: string;
      page_class: string;
      regression_type: string;
      severity: string;
      previous_value: string | null;
      current_value: string | null;
      suppressed: boolean;
    }[]>`
      SELECT url, page_class, regression_type, severity,
             previous_value, current_value, suppressed
      FROM sentinel_regressions WHERE run_id = ${runResult.runId}
      ORDER BY CASE severity
        WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END, url
    `;

    const reportData = await assembleReport(
      runResult.runId,
      new Date().toISOString().slice(0, 10),
      runResult.pagesCrawled,
      runResult.pagesTotal,
      runResult.durationMs,
      regressions.map((r) => ({
        url: r.url,
        pageClass: r.page_class as PageClass,
        regressionType: r.regression_type as RegressionType,
        severity: r.severity as Severity,
        previousValue: r.previous_value,
        currentValue: r.current_value,
        suppressed: r.suppressed,
      })),
    );

    reportText = formatReportText(reportData);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sentinel Cron] Report assembly failed:', msg);
    // Data is persisted — mark as failed at report stage
    await updateRunStatus(runResult.runId, 'failed', {
      failureReason: `Report assembly failed: ${msg}`,
    });
    return NextResponse.json(
      { ...runResult, message: `Run complete but report failed: ${msg}` },
      { status: 500 },
    );
  }

  // ── Send email ──────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const subject = `Promagen Sentinel — Week of ${today}`;

  const emailResult = await sendReportEmail(subject, reportText);

  if (emailResult.sent) {
    await updateRunStatus(runResult.runId, 'reported', { reportSent: true });
    console.debug(`[Sentinel Cron] Report sent: ${emailResult.messageId}`);
  } else {
    // Email failed — data is safe, run stays at diff_complete
    console.error(`[Sentinel Cron] Email failed: ${emailResult.error}`);
    await updateRunStatus(runResult.runId, 'failed', {
      reportSent: false,
      failureReason: `Email send failed: ${emailResult.error}`,
    });
  }

  return NextResponse.json({
    ...runResult,
    reportSent: emailResult.sent,
    emailMessageId: emailResult.messageId,
    durationMs: Date.now() - startTime,
  });
}

// =============================================================================
// RUNTIME CONFIG
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
