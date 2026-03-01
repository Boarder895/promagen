// src/app/api/admin/scoring-health/simulate-weights/route.ts
// ============================================================================
// GET  /api/admin/scoring-health/simulate-weights?tier=global|1|2|3|4
// POST /api/admin/scoring-health/simulate-weights
// ============================================================================
//
// GET:  Returns 20 recent qualifying events + current weights for the
//       specified tier. The client uses this to power the sandbox preview.
//
// POST: Promotes a full weight vector to production for a specific tier.
//       Validates, normalises, writes to learned_weights, logs the change.
//
// Auth: Requires admin role via Clerk + ADMIN_USER_IDS.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 11
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new route).
// ============================================================================

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import {
  ensureAllTables,
  getLearnedWeights,
  upsertLearnedWeights,
  fetchQualifyingEvents,
} from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ScoringWeights, TierWeightProfile } from '@/lib/learning/weight-recalibration';
import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';
import { normaliseWeights as serverNormalise } from '@/lib/admin/scoring-profiles';

// ============================================================================
// AUTH
// ============================================================================

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

// ============================================================================
// VALID TIERS
// ============================================================================

const VALID_TIERS = new Set(['1', '2', '3', '4', 'global']);

// ============================================================================
// GET — Sample events + current weights for sandbox
// ============================================================================

export interface SandboxSampleResponse {
  events: {
    id: string;
    promptPreview: string;
    scoreFactors: Record<string, number>;
    originalScore: number;
    platform: string;
    tier: number;
  }[];
  currentWeights: Record<string, number>;
  tier: string;
  generatedAt: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ScoringHealthApiResponse<SandboxSampleResponse>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    const tier = request.nextUrl.searchParams.get('tier') ?? 'global';
    if (!VALID_TIERS.has(tier)) {
      return NextResponse.json(
        { ok: false, data: null, message: `Invalid tier: "${tier}"`, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    await ensureAllTables();

    // ── Fetch current weights ────────────────────────────────────────
    const weightsRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    const scoringWeights = weightsRow?.data ?? null;

    let currentWeights: Record<string, number>;
    if (scoringWeights) {
      const profile: TierWeightProfile | undefined = tier === 'global'
        ? scoringWeights.global
        : scoringWeights.tiers[tier];
      currentWeights = profile?.weights ?? {
        categoryCount: 0.20, coherence: 0.20, promptLength: 0.15,
        tierFormat: 0.15, negative: 0.10, fidelity: 0.10, density: 0.10,
      };
    } else {
      // Cold start defaults
      currentWeights = {
        categoryCount: 0.20, coherence: 0.20, promptLength: 0.15,
        tierFormat: 0.15, negative: 0.10, fidelity: 0.10, density: 0.10,
      };
    }

    // ── Fetch 20 recent qualifying events ────────────────────────────
    const rawEvents = await fetchQualifyingEvents(30, 20, 0);

    // Filter by tier if not global
    const filtered = tier === 'global'
      ? rawEvents
      : rawEvents.filter((e) => String(e.tier) === tier);

    // Transform for client
    const events = filtered.slice(0, 20).map((e) => {
      // Build a prompt preview from selections
      const selections = e.selections ?? {};
      const terms = Object.values(selections).flat().slice(0, 5);
      const preview = terms.length > 0
        ? terms.join(', ').slice(0, 60) + (terms.join(', ').length > 60 ? '…' : '')
        : `[${e.platform}] Event ${e.id.slice(0, 8)}`;

      return {
        id: e.id,
        promptPreview: preview,
        scoreFactors: typeof e.score_factors === 'string'
          ? JSON.parse(e.score_factors) as Record<string, number>
          : e.score_factors ?? {},
        originalScore: e.score,
        platform: e.platform,
        tier: e.tier,
      };
    });

    const now = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      data: { events, currentWeights, tier, generatedAt: now },
      generatedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, data: null, message: err instanceof Error ? err.message : 'Internal error', generatedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Promote a full weight vector
// ============================================================================

export interface PromoteWeightsRequest {
  tier: string;
  weights: Record<string, number>;
}

export interface PromoteWeightsResponse {
  tier: string;
  previousWeights: Record<string, number>;
  promotedWeights: Record<string, number>;
  promotedAt: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ScoringHealthApiResponse<PromoteWeightsResponse>>> {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
        { status: 401 },
      );
    }

    const body = (await request.json()) as PromoteWeightsRequest;

    // ── Validate ──────────────────────────────────────────────────────
    if (!body.tier || !VALID_TIERS.has(body.tier)) {
      return NextResponse.json(
        { ok: false, data: null, message: `Invalid tier: "${body.tier}"`, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    if (!body.weights || typeof body.weights !== 'object' || Object.keys(body.weights).length === 0) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Missing or empty weights object', generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    // Validate all values are finite numbers >= 0
    for (const [factor, value] of Object.entries(body.weights)) {
      if (!isFinite(value) || value < 0) {
        return NextResponse.json(
          { ok: false, data: null, message: `Invalid weight for "${factor}": ${value}`, generatedAt: new Date().toISOString() },
          { status: 400 },
        );
      }
    }

    await ensureAllTables();

    // ── Fetch current weights ────────────────────────────────────────
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

    // ── Get tier profile ─────────────────────────────────────────────
    const profile: TierWeightProfile | undefined = body.tier === 'global'
      ? scoringWeights.global
      : scoringWeights.tiers[body.tier];

    if (!profile) {
      return NextResponse.json(
        { ok: false, data: null, message: `Tier "${body.tier}" not found`, generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const previousWeights = { ...profile.weights };

    // ── Normalise and apply ──────────────────────────────────────────
    const normalised = serverNormalise(body.weights);
    profile.weights = normalised;

    // ── Write back ───────────────────────────────────────────────────
    scoringWeights.generatedAt = new Date().toISOString();
    await upsertLearnedWeights(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY, scoringWeights);

    const now = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      data: {
        tier: body.tier,
        previousWeights,
        promotedWeights: normalised,
        promotedAt: now,
      },
      generatedAt: now,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, data: null, message: err instanceof Error ? err.message : 'Internal error', generatedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
