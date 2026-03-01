/**
 * GET/POST /api/admin/scoring-health/profiles
 *
 * GET  — List all saved scoring configuration profiles.
 * POST — Save current live scoring weights as a new named profile.
 *
 * Profiles are stored in learned_weights table:
 * - Index: key "scoring-profiles-index" (list of all profile metadata)
 * - Each profile: key "scoring-profile:{id}" (full weights snapshot)
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

import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';
import type { ProfileIndex, ScoringProfile, ProfileIndexEntry } from '@/lib/admin/scoring-profiles';
import {
  PROFILE_KEY_PREFIX,
  PROFILE_INDEX_KEY,
  MAX_PROFILES,
  generateProfileId,
  validateProfileName,
  extractProfileWeights,
} from '@/lib/admin/scoring-profiles';

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
// HELPERS
// =============================================================================

async function getProfileIndex(): Promise<ProfileIndex> {
  const row = await getLearnedWeights<ProfileIndex>(PROFILE_INDEX_KEY);
  return row?.data ?? { profiles: [], activeProfileId: null, updatedAt: new Date().toISOString() };
}

// =============================================================================
// GET — List all profiles
// =============================================================================

export async function GET(): Promise<NextResponse> {
  const userId = await getAdminUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized', generatedAt: new Date().toISOString() },
      { status: 401 },
    );
  }

  try {
    await ensureAllTables();
    const index = await getProfileIndex();
    const now = new Date().toISOString();

    return NextResponse.json(
      { ok: true, data: index, generatedAt: now } satisfies ScoringHealthApiResponse<ProfileIndex>,
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
// POST — Save new profile from current live weights
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
    const body = (await req.json()) as { name: string; description?: string };

    // ── Validate name ──────────────────────────────────────────────────
    const nameError = validateProfileName(body.name ?? '');
    if (nameError) {
      return NextResponse.json(
        { ok: false, data: null, message: nameError, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    await ensureAllTables();

    // ── Check profile limit ────────────────────────────────────────────
    const index = await getProfileIndex();
    if (index.profiles.length >= MAX_PROFILES) {
      return NextResponse.json(
        { ok: false, data: null, message: `Maximum ${MAX_PROFILES} profiles reached. Delete some before saving new ones.`, generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    // ── Check duplicate name ───────────────────────────────────────────
    const trimmedName = body.name.trim();
    if (index.profiles.some((p) => p.name === trimmedName)) {
      return NextResponse.json(
        { ok: false, data: null, message: `A profile named "${trimmedName}" already exists.`, generatedAt: new Date().toISOString() },
        { status: 409 },
      );
    }

    // ── Fetch current live weights ─────────────────────────────────────
    const weightsRow = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    if (!weightsRow?.data) {
      return NextResponse.json(
        { ok: false, data: null, message: 'No scoring weights found. Run the cron job first.', generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const profileId = generateProfileId();

    // ── Create the profile ─────────────────────────────────────────────
    const profile: ScoringProfile = {
      id: profileId,
      name: trimmedName,
      description: (body.description ?? '').trim(),
      createdBy: userId,
      createdAt: now,
      isActive: false,
      weights: extractProfileWeights(weightsRow.data),
    };

    // ── Store the full profile ─────────────────────────────────────────
    await upsertLearnedWeights(`${PROFILE_KEY_PREFIX}${profileId}`, profile);

    // ── Update the index ───────────────────────────────────────────────
    const entry: ProfileIndexEntry = {
      id: profileId,
      name: profile.name,
      description: profile.description,
      createdBy: profile.createdBy,
      createdAt: profile.createdAt,
      isActive: false,
    };
    index.profiles.unshift(entry); // Newest first
    index.updatedAt = now;
    await upsertLearnedWeights(PROFILE_INDEX_KEY, index);

    return NextResponse.json(
      { ok: true, data: profile, generatedAt: now } satisfies ScoringHealthApiResponse<ScoringProfile>,
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
