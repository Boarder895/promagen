/**
 * GET /api/admin/scoring-health/weight-history
 *
 * Admin-only endpoint returning weight drift data:
 * - Per-factor drift (baseline → current, sorted by magnitude)
 * - Overall weight drift metric from health report
 * - Biggest mover / biggest decline callouts
 * - Weight-drift sparkline from health report history
 *
 * Data sources:
 * - scoring-weights (learned_weights) — current per-factor weights
 * - scorer-health-report (learned_weights) — drift metric + history
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 5
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 *
 * Existing features preserved: Yes (new file, no existing code changed).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import type { ScorerHealthReport } from '@/lib/learning/scorer-health';
import type {
  ScoringHealthApiResponse,
  WeightDriftData,
  SparklinePoint,
} from '@/lib/admin/scoring-health-types';
import { computeFactorDrift, findDriftExtremes } from '@/lib/admin/scoring-health-types';

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

    // ── Fetch scoring weights ─────────────────────────────────────────
    const weightsRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    // ── Fetch health report (for drift metric + history) ──────────────
    const healthRow = await getLearnedWeights<ScorerHealthReport>(
      LEARNING_CONSTANTS.SCORER_HEALTH_KEY,
    );

    const now = new Date().toISOString();

    // ── No weights yet (cold start) ────────────────────────────────────
    if (!weightsRow?.data) {
      const empty: WeightDriftData = {
        factors: [],
        overallDrift: 0,
        biggestMover: null,
        biggestDecline: null,
        snapshotCount: 0,
        generatedAt: now,
      };
      return NextResponse.json(
        { ok: true, data: empty, generatedAt: now } satisfies ScoringHealthApiResponse<WeightDriftData>,
      );
    }

    const weights = weightsRow.data;
    const healthReport = healthRow?.data ?? null;

    // ── Extract global factor weights ──────────────────────────────────
    const globalWeights = weights.global?.weights ?? {};

    // ── Build weight-drift sparkline from health report history ────────
    const driftHistory: SparklinePoint[] = (healthReport?.history ?? []).map((h) => ({
      label: h.date,
      value: h.weightDrift,
    }));

    // ── Compute per-factor drift (baseline → current) ──────────────────
    const factorDrifts = computeFactorDrift(globalWeights, driftHistory);
    const { biggestMover, biggestDecline } = findDriftExtremes(factorDrifts);

    const result: WeightDriftData = {
      factors: factorDrifts,
      overallDrift: healthReport?.weightDrift ?? 0,
      biggestMover,
      biggestDecline,
      snapshotCount: driftHistory.length,
      generatedAt: now,
    };

    return NextResponse.json(
      { ok: true, data: result, generatedAt: now } satisfies ScoringHealthApiResponse<WeightDriftData>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { ok: false, data: null, message, generatedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
