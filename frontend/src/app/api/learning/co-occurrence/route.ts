/**
 * Serve Co-occurrence Matrix
 *
 * Public GET endpoint returning the co-occurrence matrix computed
 * by the nightly aggregation cron. Used by vocabulary-loader.ts
 * to blend learned weights with curated cluster scores.
 *
 * Returns cached data from learned_weights table (key: 'co-occurrence').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 9.1
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';

import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<CoOccurrenceMatrix>('co-occurrence');

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No co-occurrence data yet — cron has not run',
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
    console.error('[Learning API] Error serving co-occurrence:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch co-occurrence data',
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
