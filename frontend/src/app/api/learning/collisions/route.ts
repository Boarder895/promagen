/**
 * Serve Collision Matrix Data
 *
 * Public GET endpoint returning the collision matrix computed
 * by the nightly aggregation cron (Phase 7.1 — Layer 10).
 * Used by the suggestion engine to demote term pairs that
 * compete for the same semantic role (solo-vs-together quality delta).
 *
 * Returns cached data from learned_weights table (key: 'collision-matrix').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { CollisionMatrixData } from '@/lib/learning/collision-matrix';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<CollisionMatrixData>(
      LEARNING_CONSTANTS.COLLISION_MATRIX_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No collision data yet — cron has not run or Phase 7 is disabled',
          updatedAt: null,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: result.data,
        updatedAt: result.updatedAt,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('[Learning API] Error serving collisions:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch collision data',
      },
      { status: 500 },
    );
  }
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
