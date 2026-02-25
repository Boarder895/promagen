/**
 * Serve Sequence Patterns
 *
 * Public GET endpoint returning the sequence patterns computed
 * by the nightly aggregation cron. Used by the frontend to
 * highlight the "next likely dropdown" based on real user behaviour.
 *
 * Returns cached data from learned_weights table (key: 'sequences').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9.2
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';

import type { SequencePatterns } from '@/lib/learning/sequence-patterns';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<SequencePatterns>('sequences');

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No sequence data yet — cron has not run',
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
    console.error('[Learning API] Error serving sequences:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch sequence data',
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
