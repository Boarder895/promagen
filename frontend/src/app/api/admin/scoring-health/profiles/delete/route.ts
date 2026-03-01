/**
 * POST /api/admin/scoring-health/profiles/delete
 *
 * Delete a saved scoring profile by ID.
 * Removes from both the profile index and the data store.
 * Cannot delete the currently active profile.
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

import type { ScoringHealthApiResponse } from '@/lib/admin/scoring-health-types';
import type { ProfileIndex } from '@/lib/admin/scoring-profiles';
import { PROFILE_KEY_PREFIX, PROFILE_INDEX_KEY } from '@/lib/admin/scoring-profiles';

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
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

    // ── Fetch index ────────────────────────────────────────────────────
    const indexRow = await getLearnedWeights<ProfileIndex>(PROFILE_INDEX_KEY);
    if (!indexRow?.data) {
      return NextResponse.json(
        { ok: false, data: null, message: 'No profiles found.', generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    const index = indexRow.data;

    // ── Find the profile ───────────────────────────────────────────────
    const profileEntry = index.profiles.find((p) => p.id === body.profileId);
    if (!profileEntry) {
      return NextResponse.json(
        { ok: false, data: null, message: `Profile "${body.profileId}" not found.`, generatedAt: new Date().toISOString() },
        { status: 404 },
      );
    }

    // ── Cannot delete active profile ───────────────────────────────────
    if (index.activeProfileId === body.profileId) {
      return NextResponse.json(
        { ok: false, data: null, message: 'Cannot delete the currently active profile. Activate a different profile first.', generatedAt: new Date().toISOString() },
        { status: 400 },
      );
    }

    // ── Remove from index ──────────────────────────────────────────────
    index.profiles = index.profiles.filter((p) => p.id !== body.profileId);
    index.updatedAt = new Date().toISOString();
    await upsertLearnedWeights(PROFILE_INDEX_KEY, index);

    // ── Remove the profile data ────────────────────────────────────────
    // We overwrite with a tombstone (empty object) since we can't DELETE from
    // learned_weights without adding a new DB function. The index no longer
    // references it, so it's effectively deleted.
    await upsertLearnedWeights(`${PROFILE_KEY_PREFIX}${body.profileId}`, { deleted: true, deletedAt: new Date().toISOString() });

    const now = new Date().toISOString();
    return NextResponse.json({
      ok: true,
      data: { profileId: body.profileId, deletedAt: now },
      generatedAt: now,
    } satisfies ScoringHealthApiResponse<{ profileId: string; deletedAt: string }>);
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
