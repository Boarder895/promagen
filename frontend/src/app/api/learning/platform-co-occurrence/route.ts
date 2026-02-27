/**
 * Serve Platform Co-occurrence Data
 *
 * Public GET endpoint returning per-platform co-occurrence matrices
 * computed by the nightly aggregation cron (Phase 7.5 — Layer 14b).
 * Used by the suggestion engine lookup bridge to blend platform-specific
 * pair weights with tier-level fallback.
 *
 * Returns cached data from learned_weights table (key: 'platform-co-occurrence').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-7.5-per-platform-learning-buildplan.md § 5
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { PlatformCoOccurrenceData } from '@/lib/learning/platform-co-occurrence';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<PlatformCoOccurrenceData>(
      LEARNING_CONSTANTS.PLATFORM_CO_OCCURRENCE_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message:
            'No platform co-occurrence data yet — cron has not run or Phase 7.5 is disabled',
          updatedAt: null,
        },
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=60, stale-while-revalidate=120',
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
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error(
      '[Learning API] Error serving platform co-occurrence:',
      error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch platform co-occurrence data',
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
