/**
 * Serve Platform Term Quality Data
 *
 * Public GET endpoint returning per-platform term quality scores
 * computed by the nightly aggregation cron (Phase 7.5 — Layer 14a).
 * Used by the suggestion engine lookup bridge to blend platform-specific
 * term quality with tier-level fallback.
 *
 * Returns cached data from learned_weights table (key: 'platform-term-quality').
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

import type { PlatformTermQualityData } from '@/lib/learning/platform-term-quality';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<PlatformTermQualityData>(
      LEARNING_CONSTANTS.PLATFORM_TERM_QUALITY_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message:
            'No platform term quality data yet — cron has not run or Phase 7.5 is disabled',
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
      '[Learning API] Error serving platform term quality:',
      error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch platform term quality data',
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
