/**
 * Serve Scoring Weights
 *
 * Public GET endpoint returning per-tier scoring weights computed
 * by the nightly aggregation cron (Phase 6). Used by the prompt
 * health scorer to replace hard-coded factor weights with learned ones.
 *
 * Returns cached data from learned_weights table (key: 'scoring-weights').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.3
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ScoringWeights } from '@/lib/learning/weight-recalibration';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<ScoringWeights>(
      LEARNING_CONSTANTS.SCORING_WEIGHTS_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No scoring weights yet — cron has not run',
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
    console.error('[Learning API] Error serving scoring weights:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch scoring weights',
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
