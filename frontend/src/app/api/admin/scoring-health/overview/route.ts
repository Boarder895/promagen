/**
 * GET /api/admin/scoring-health/overview
 *
 * Admin-only endpoint returning the Scorer Health Overview data:
 * - Score-outcome correlation (current + trend + sparkline history)
 * - Total qualifying events + weekly delta
 * - A/B test counts by status
 * - Last cron run details
 * - Pipeline uptime (30 days)
 * - Quick-pulse traffic-light indicators
 *
 * Data sources:
 * - scorer-health-report (learned_weights)
 * - scoring-weights (learned_weights)
 * - prompt_events table (counts)
 * - ab_tests table (status counts)
 * - learning_cron_runs table (last run + uptime)
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 *
 * Existing features preserved: Yes (new file, no existing code changed).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  ensureAllTables,
  getLearnedWeights,
  countQualifyingEvents,
  getAllABTests,
  getLastCronRun,
} from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ScorerHealthReport } from '@/lib/learning/scorer-health';
import type {
  ScorerHealthOverviewData,
  ScoringHealthApiResponse,
  PulseIndicator,
  PulseStatus,
  SparklinePoint,
} from '@/lib/admin/scoring-health-types';

// =============================================================================
// ADMIN AUTH CHECK
// =============================================================================

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);

async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.userId) return false;
    return ADMIN_USER_IDS.includes(session.userId);
  } catch {
    return false;
  }
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  // ── Auth gate ─────────────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
      { status: 401 },
    );
  }

  try {
    await ensureAllTables();

    // ── Parallel data fetches ──────────────────────────────────────
    const [healthReport, totalEvents, abTests, lastCron] = await Promise.all([
      getLearnedWeights<ScorerHealthReport>(LEARNING_CONSTANTS.SCORER_HEALTH_KEY),
      countQualifyingEvents(),
      getAllABTests(100),
      getLastCronRun(),
    ]);

    const now = new Date().toISOString();

    // ── If no health report exists yet ─────────────────────────────
    if (!healthReport?.data) {
      const response: ScoringHealthApiResponse<ScorerHealthOverviewData> = {
        ok: true,
        data: null,
        message: 'No scoring data yet — cron has not run.',
        generatedAt: now,
      };
      return NextResponse.json(response, { headers: noCacheHeaders() });
    }

    const report = healthReport.data;

    // ── Compute weekly delta ──────────────────────────────────────
    // Use history to estimate: sum of last 7 entries' eventCounts
    // vs the entry 7 positions back
    const weeklyDelta = computeWeeklyDelta(report.history, totalEvents);

    // ── A/B test status counts ────────────────────────────────────
    const abCounts = { running: 0, pending: 0, concluded: 0 };
    for (const test of abTests) {
      if (test.status === 'running') abCounts.running++;
      else if (test.status === 'promoted' || test.status === 'rolled_back') abCounts.concluded++;
    }

    // ── Last cron run ─────────────────────────────────────────────
    const cronData = {
      timestamp: lastCron?.ranAt ?? null,
      durationSeconds: lastCron ? lastCron.durationMs / 1_000 : null,
      success: lastCron?.ok ?? false,
    };

    // ── Pipeline uptime (30 days) ─────────────────────────────────
    const pipelineUptime = computePipelineUptime(report.history);

    // ── Sparkline history ─────────────────────────────────────────
    const correlationHistory: SparklinePoint[] = report.history.map((entry) => ({
      label: entry.date,
      value: entry.correlation,
    }));

    // ── Quick Pulse ───────────────────────────────────────────────
    const pulse = computePulse(report, lastCron ? {
      ranAt: lastCron.ranAt,
      ok: lastCron.ok,
      durationSeconds: lastCron.durationMs / 1_000,
    } : null);

    // ── Assemble response ─────────────────────────────────────────
    const data: ScorerHealthOverviewData = {
      correlation: report.overallCorrelation,
      tierCorrelations: report.tierCorrelations,
      correlationTrend: report.correlationTrend,
      correlationHistory,
      totalPrompts: totalEvents,
      weeklyDelta,
      abTests: abCounts,
      lastCron: cronData,
      pipelineUptime,
      pulse,
      generatedAt: now,
    };

    const response: ScoringHealthApiResponse<ScorerHealthOverviewData> = {
      ok: true,
      data,
      generatedAt: now,
    };

    return NextResponse.json(response, { headers: noCacheHeaders() });
  } catch (error) {
    console.error('[Admin API] Scoring health overview error:', error);
    return NextResponse.json(
      {
        ok: false,
        data: null,
        message: error instanceof Error ? error.message : 'Internal server error',
        generatedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function noCacheHeaders() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
  };
}

/**
 * Estimate weekly delta from history.
 * Compare current total against totalEvents from ~7 entries ago.
 */
function computeWeeklyDelta(
  history: { date: string; eventCount: number }[],
  currentTotal: number,
): number {
  if (history.length < 2) return 0;

  // Try to find an entry from ~7 days ago
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1_000;
  let bestEntry: { date: string; eventCount: number } | null = null;

  for (const entry of history) {
    const entryAge = now - new Date(entry.date).getTime();
    if (entryAge >= sevenDaysMs) {
      bestEntry = entry;
    }
  }

  if (bestEntry) {
    return currentTotal - bestEntry.eventCount;
  }

  // Fallback: compare first and last history entries
  const first = history[0];
  const last = history[history.length - 1];
  if (first && last) {
    return last.eventCount - first.eventCount;
  }

  return 0;
}

/**
 * Compute pipeline uptime from cron history.
 * Uptime = (successful runs / total runs) × 100.
 * If no history, return 0.
 */
function computePipelineUptime(history: { date: string; correlation: number }[]): number {
  if (history.length === 0) return 0;

  // Each history entry represents a successful cron run
  // (only successful runs generate health reports)
  // Estimate expected runs: 1 per day for the history period
  const firstDate = new Date(history[0]!.date);
  const lastDate = new Date(history[history.length - 1]!.date);
  const daySpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (24 * 60 * 60 * 1_000));
  const expectedRuns = Math.ceil(daySpan);
  const actualRuns = history.length;

  return Math.min(100, (actualRuns / expectedRuns) * 100);
}

/**
 * Compute Quick Pulse indicators from health data.
 */
function computePulse(
  report: ScorerHealthReport,
  lastCron: { ranAt: string; ok: boolean; durationSeconds: number | null } | null,
): PulseIndicator[] {
  const pulse: PulseIndicator[] = [];

  // ── Correlation health ──────────────────────────────────────────
  let correlationStatus: PulseStatus = 'healthy';
  if (report.overallCorrelation < 0.2) {
    correlationStatus = 'critical';
  } else if (report.overallCorrelation < 0.4 || report.correlationTrend < -0.05) {
    correlationStatus = 'warning';
  }
  pulse.push({
    label: 'Correlation',
    status: correlationStatus,
    detail: `r = ${report.overallCorrelation.toFixed(3)} (trend: ${report.correlationTrend > 0 ? '+' : ''}${report.correlationTrend.toFixed(3)})`,
  });

  // ── Data freshness ──────────────────────────────────────────────
  let freshnessStatus: PulseStatus = 'unknown';
  if (lastCron?.ranAt) {
    const ageHours = (Date.now() - new Date(lastCron.ranAt).getTime()) / 3_600_000;
    if (ageHours < 26) freshnessStatus = 'healthy';      // Less than ~1 day
    else if (ageHours < 72) freshnessStatus = 'warning';  // 1–3 days
    else freshnessStatus = 'critical';                     // 3+ days
  }
  pulse.push({
    label: 'Freshness',
    status: freshnessStatus,
    detail: lastCron?.ranAt ? `Last run: ${lastCron.ranAt}` : 'No cron run recorded',
  });

  // ── Anti-patterns health ────────────────────────────────────────
  const antiPatternAlerts = report.alerts.filter(
    (a) => a.level === 'critical' || a.level === 'warning',
  );
  const antiPatternStatus: PulseStatus =
    antiPatternAlerts.some((a) => a.level === 'critical') ? 'critical' :
    antiPatternAlerts.length > 0 ? 'warning' : 'healthy';
  pulse.push({
    label: 'Alerts',
    status: antiPatternStatus,
    detail: `${report.alerts.length} alert(s): ${antiPatternAlerts.length} requiring attention`,
  });

  // ── Weight stability ────────────────────────────────────────────
  let weightStatus: PulseStatus = 'healthy';
  if (report.weightDrift > 0.5) weightStatus = 'critical';
  else if (report.weightDrift > 0.2) weightStatus = 'warning';
  pulse.push({
    label: 'Weight Stability',
    status: weightStatus,
    detail: `Drift: ${report.weightDrift.toFixed(3)} (0 = stable, 1 = complete overhaul)`,
  });

  return pulse;
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
