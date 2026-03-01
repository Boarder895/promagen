/**
 * Serve All Temporal Intelligence Data (Combined Endpoint)
 *
 * Public GET endpoint returning BOTH temporal boosts (seasonal + weekly)
 * AND trending terms in a single response. Halves the HTTP requests the
 * client makes on page load compared to calling /temporal-boosts and
 * /trending-terms separately.
 *
 * Reads both keys from learned_weights table in parallel via Promise.all.
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 7.8
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { TemporalBoostsData, TrendingTermsData } from '@/lib/learning/temporal-intelligence';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    // Fetch both keys in parallel — single round-trip to the database
    const [boostsResult, trendingResult] = await Promise.all([
      getLearnedWeights<TemporalBoostsData>(LEARNING_CONSTANTS.TEMPORAL_BOOSTS_KEY),
      getLearnedWeights<TrendingTermsData>(LEARNING_CONSTANTS.TRENDING_TERMS_KEY),
    ]);

    // If neither has data yet, return a lightweight "no data" response
    if (!boostsResult && !trendingResult) {
      return NextResponse.json(
        {
          ok: true,
          boosts: null,
          trending: null,
          message: 'No temporal data yet — cron has not run or Phase 7.8 is disabled',
          boostsUpdatedAt: null,
          trendingUpdatedAt: null,
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
        boosts: boostsResult?.data ?? null,
        trending: trendingResult?.data ?? null,
        boostsUpdatedAt: boostsResult?.updatedAt ?? null,
        trendingUpdatedAt: trendingResult?.updatedAt ?? null,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('[Learning API] Error serving temporal-all:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch temporal intelligence data',
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
