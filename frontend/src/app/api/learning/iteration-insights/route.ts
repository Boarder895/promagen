/**
 * Serve Iteration Insights Data
 *
 * Public GET endpoint returning the iteration tracking data computed
 * by the nightly aggregation cron (Phase 7.2 — Layer 11).
 * Used by the suggestion engine to demote weak terms (frequently
 * replaced terms) and by the confidence multiplier to identify
 * final attempts.
 *
 * Returns cached data from learned_weights table (key: 'iteration-insights').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { IterationInsightsData } from '@/lib/learning/iteration-tracking';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<IterationInsightsData>(
      LEARNING_CONSTANTS.ITERATION_INSIGHTS_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No iteration insights yet — cron has not run or Phase 7 is disabled',
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
    console.error('[Learning API] Error serving iteration insights:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch iteration insights data',
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
