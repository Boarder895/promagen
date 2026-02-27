/**
 * Serve Magic Combos Data
 *
 * Public GET endpoint returning the higher-order combinations (trios/quads)
 * computed by the nightly aggregation cron (Phase 7.4 — Layer 13).
 * Used by the suggestion engine to boost terms that would complete
 * proven winning combinations.
 *
 * Returns cached data from learned_weights table (key: 'magic-combos').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-7.4-magic-combos-buildplan.md § 5
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { MagicCombosData } from '@/lib/learning/magic-combo-mining';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<MagicCombosData>(LEARNING_CONSTANTS.MAGIC_COMBOS_KEY);

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No magic combo data yet — cron has not run or Phase 7 is disabled',
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
    console.error('[Learning API] Error serving magic combos:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch magic combo data',
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
