/**
 * Serve Compression Intelligence Profiles
 *
 * Public GET endpoint returning learned compression profiles including
 * per-tier optimal length analysis, expendable term lists, and
 * platform-aware length profiles.
 *
 * Reads from learned_weights table using COMPRESSION_PROFILES_KEY.
 * Cache: 5 minutes (s-maxage=300) — data only changes during nightly cron.
 *
 * @see docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { CompressionProfilesData } from '@/lib/learning/compression-intelligence';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<CompressionProfilesData>(
      LEARNING_CONSTANTS.COMPRESSION_PROFILES_KEY,
    );

    // No data yet — cron has not run or Phase 7.9 is not active
    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No compression profiles yet — cron has not run or Phase 7.9 is disabled',
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
    console.error('[Learning API] Error serving compression-profiles:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch compression intelligence data',
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
