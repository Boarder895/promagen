/**
 * GET /api/admin/scoring-health/tier-weights
 *
 * Admin-only endpoint returning per-tier scoring model data:
 * - All factor names across all tiers
 * - Per-tier weight profiles (Tier 1–4 + global)
 * - Max weight for heatmap normalisation
 * - Hottest / coldest cell callouts
 *
 * Data source: scoring-weights (learned_weights table)
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
import type {
  ScoringHealthApiResponse,
  TierWeightsData,
  TierProfile,
} from '@/lib/admin/scoring-health-types';
import { findHeatmapExtremes } from '@/lib/admin/scoring-health-types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Tier labels for display in heatmap columns */
const TIER_LABELS: Record<string, string> = {
  '1': 'Tier 1 (CLIP)',
  '2': 'Tier 2 (MJ)',
  '3': 'Tier 3 (NL)',
  '4': 'Tier 4 (Plain)',
  global: 'Global',
};

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

    const weightsRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    const now = new Date().toISOString();

    // ── No weights yet (cold start) ────────────────────────────────────
    if (!weightsRow?.data) {
      const empty: TierWeightsData = {
        factors: [],
        tiers: [],
        maxWeight: 0,
        hottest: null,
        coldest: null,
        generatedAt: now,
      };
      return NextResponse.json(
        { ok: true, data: empty, generatedAt: now } satisfies ScoringHealthApiResponse<TierWeightsData>,
      );
    }

    const weights = weightsRow.data;

    // ── Build tier profiles ─────────────────────────────────────────────
    const tierProfiles: TierProfile[] = [];
    const allFactors = new Set<string>();

    // Tiers 1–4
    for (const tierKey of ['1', '2', '3', '4']) {
      const profile = weights.tiers[tierKey];
      if (profile) {
        const tierWeights = profile.weights ?? {};
        for (const f of Object.keys(tierWeights)) allFactors.add(f);
        tierProfiles.push({
          tier: tierKey,
          label: TIER_LABELS[tierKey] ?? `Tier ${tierKey}`,
          weights: tierWeights,
          eventCount: profile.eventCount ?? 0,
        });
      }
    }

    // Global fallback
    if (weights.global) {
      const globalWeights = weights.global.weights ?? {};
      for (const f of Object.keys(globalWeights)) allFactors.add(f);
      tierProfiles.push({
        tier: 'global',
        label: TIER_LABELS.global ?? 'Global',
        weights: globalWeights,
        eventCount: weights.global.eventCount ?? 0,
      });
    }

    const factors = Array.from(allFactors).sort();

    // ── Compute max weight for heatmap normalisation ────────────────────
    let maxWeight = 0;
    for (const tier of tierProfiles) {
      for (const factor of factors) {
        const w = tier.weights[factor] ?? 0;
        if (w > maxWeight) maxWeight = w;
      }
    }

    // ── Find extremes ────────────────────────────────────────────────────
    const { hottest, coldest } = findHeatmapExtremes(tierProfiles, factors);

    const result: TierWeightsData = {
      factors,
      tiers: tierProfiles,
      maxWeight,
      hottest,
      coldest,
      generatedAt: now,
    };

    return NextResponse.json(
      { ok: true, data: result, generatedAt: now } satisfies ScoringHealthApiResponse<TierWeightsData>,
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
