/**
 * Serve Scene Candidates
 *
 * Public GET endpoint returning auto-generated scene candidates
 * computed by the nightly aggregation cron. Used by the admin
 * review queue and optionally the frontend for preview.
 *
 * Returns cached data from learned_weights table (key: 'scene-candidates').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';

import type { SceneCandidates } from '@/lib/learning/scene-candidates';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<SceneCandidates>('scene-candidates');

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No scene candidate data yet — cron has not run',
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
    console.error('[Learning API] Error serving scene candidates:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch scene candidate data',
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
