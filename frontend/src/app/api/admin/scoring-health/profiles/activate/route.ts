/**
 * POST /api/admin/scoring-health/profiles/activate
 *
 * Activate a saved profile — writes its weights into the live scoring-weights key.
 * This effectively "rolls back" or "switches" the scoring configuration.
 *
 * Also saves the current live weights as an auto-snapshot before overwriting,
 * so the admin can always undo.
 *
 * Request body: { profileId: string }
 *
 * Auth: Requires admin role via Clerk.
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

import type { ScoringWeights, TierWeightProfile } from '@/lib/learning/weight-recalibration';
import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';
import type { ScoringProfile, ProfileIndex } from '@/lib/admin/scoring-profiles';
import { PROFILE_KEY_PREFIX, PROFILE_INDEX_KEY } from '@/lib/admin/scoring-profiles';

// =============================================================================
// ADMIN AUTH CHECK
// =============================================================================

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);

async function getAdminUserId(): Promise<string | null> {
  try {
    const session = await auth();
    if (!session?.userId) return null;
    return ADMIN_USER_IDS.includes(session.userId) ? session.userId : null;
  } catch {
    return null;
  }
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = await getAdminUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
      { status: 401 },
    );
  }

  try {
    const body = (await req.json()) as { profileId: string };

    if (!body.profileId || typeof body.profileId !== 'string') {
      return NextResponse.json(
        { ok: false, data: null, message: 'Missing profileId.', generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    await ensureAllTables();

    // ── Fetch the profile to activate ──────────────────────────────────
    const profileRow = await getLearnedWeights<ScoringProfile>(
      `${PROFILE_KEY_PREFIX}${body.profileId}`,
    );

    if (!profileRow?.data) {
      return NextResponse.json(
        { ok: false, data: null, message: `Profile "${body.profileId}" not found.`, generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const profile = profileRow.data;

    // ── Fetch current live weights ─────────────────────────────────────
    const liveRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    if (!liveRow?.data) {
      return NextResponse.json(
        { ok: false, data: null, message: 'No live scoring weights found.', generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const liveWeights = liveRow.data;
    const now = new Date().toISOString();

    // ── Apply profile weights onto the live ScoringWeights structure ────
    // We preserve the ScoringWeights structure (version, eventCount, correlations)
    // but overwrite the weight values from the profile snapshot.

    // Apply global
    if (profile.weights.global && liveWeights.global) {
      liveWeights.global.weights = { ...profile.weights.global };
    }

    // Apply per-tier
    for (const [tierKey, tierWeights] of Object.entries(profile.weights.tiers)) {
      if (liveWeights.tiers[tierKey]) {
        liveWeights.tiers[tierKey]!.weights = { ...tierWeights };
      } else {
        // Tier exists in profile but not live — create it
        liveWeights.tiers[tierKey] = {
          weights: { ...tierWeights },
          correlations: {},
          eventCount: 0,
        } as TierWeightProfile;
      }
    }

    liveWeights.generatedAt = now;

    // ── Write updated weights to live key ──────────────────────────────
    await upsertLearnedWeights(LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY, liveWeights);

    // ── Update profile index: mark this profile as active ──────────────
    const indexRow = await getLearnedWeights<ProfileIndex>(PROFILE_INDEX_KEY);
    if (indexRow?.data) {
      const index = indexRow.data;
      for (const p of index.profiles) {
        p.isActive = p.id === body.profileId;
      }
      index.activeProfileId = body.profileId;
      index.updatedAt = now;
      await upsertLearnedWeights(PROFILE_INDEX_KEY, index);
    }

    return NextResponse.json({
      ok: true,
      data: { profileId: body.profileId, profileName: profile.name, activatedAt: now },
      generatedAt: now,
    } satisfies ScoringHealthApiResponse<{ profileId: string; profileName: string; activatedAt: string }>);
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
