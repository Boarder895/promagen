/**
 * POST /api/admin/scoring-health/weight-edit
 *
 * Admin-only endpoint to edit a single scoring weight in a specific tier.
 * After editing, auto-normalises all weights in that tier to sum to 1.0.
 * Returns both previous and updated weights for undo capability.
 *
 * Request body: { tier, factor, newWeight, normalise }
 * Response: { tier, updatedWeights, previousWeights, editedAt }
 *
 * Auth: Requires admin role via Clerk.
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 *
 * Existing features preserved: Yes (new file).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { ensureAllTables, getLearnedWeights, upsertLearnedWeights } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import type {
  ScoringHealthApiResponse,
  WeightEditRequest,
  WeightEditResponse,
} from '@/lib/admin/scoring-health-types';
import { validateWeight, normaliseWeights } from '@/lib/admin/scoring-profiles';

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
// VALID TIERS
// =============================================================================

const VALID_TIERS = new Set(['1', '2', '3', '4', 'global']);

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth gate ─────────────────────────────────────────────────────
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as WeightEditRequest;

    // ── Validate request ──────────────────────────────────────────────
    if (!body.tier || !VALID_TIERS.has(body.tier)) {
      return NextResponse.json(
        { ok: false, data: null, message: `Invalid tier: "${body.tier}". Must be 1, 2, 3, 4, or global.`, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    if (!body.factor || typeof body.factor !== 'string') {
      return NextResponse.json(
        { ok: false, data: null, message: 'Missing or invalid factor name.', generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    const weightError = validateWeight(body.newWeight);
    if (weightError) {
      return NextResponse.json(
        { ok: false, data: null, message: weightError, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    await ensureAllTables();

    // ── Fetch current scoring weights ──────────────────────────────────
    const weightsRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    if (!weightsRow?.data) {
      return NextResponse.json(
        { ok: false, data: null, message: 'No scoring weights found. Run the cron job first.', generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const scoringWeights = weightsRow.data;

    // ── Get the tier's current weights ─────────────────────────────────
    const tierData = body.tier === 'global'
      ? scoringWeights.global
      : scoringWeights.tiers[body.tier];

    if (!tierData) {
      return NextResponse.json(
        { ok: false, data: null, message: `Tier "${body.tier}" not found in scoring weights.`, generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const previousWeights = { ...tierData.weights };

    // ── Check factor exists ────────────────────────────────────────────
    if (!(body.factor in tierData.weights)) {
      return NextResponse.json(
        { ok: false, data: null, message: `Factor "${body.factor}" not found in tier "${body.tier}".`, generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    // ── Apply edit ─────────────────────────────────────────────────────
    tierData.weights[body.factor] = body.newWeight;

    // ── Normalise if requested ─────────────────────────────────────────
    if (body.normalise) {
      tierData.weights = normaliseWeights(tierData.weights);
    }

    // ── Write back to database ─────────────────────────────────────────
    scoringWeights.generatedAt = new Date().toISOString();
    await upsertLearnedWeights(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY, scoringWeights);

    const now = new Date().toISOString();
    const result: WeightEditResponse = {
      tier: body.tier,
      updatedWeights: { ...tierData.weights },
      previousWeights,
      editedAt: now,
    };

    return NextResponse.json(
      { ok: true, data: result, generatedAt: now } satisfies ScoringHealthApiResponse<WeightEditResponse>,
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
