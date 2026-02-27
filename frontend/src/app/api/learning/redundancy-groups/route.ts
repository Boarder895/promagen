/**
 * Serve Redundancy Groups Data
 *
 * Public GET endpoint returning the semantic redundancy groups computed
 * by the nightly aggregation cron (Phase 7.3 — Layer 12).
 * Used by the suggestion engine to gently demote terms that are
 * functionally interchangeable with already-selected terms.
 *
 * Returns cached data from learned_weights table (key: 'redundancy-groups').
 * Cache: 5 minutes (s-maxage=300) — data only changes at 3 AM UTC.
 *
 * @see docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';

import { getLearnedWeights, ensureAllTables } from '@/lib/learning/database';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection';

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    await ensureAllTables();

    const result = await getLearnedWeights<RedundancyGroupsData>(
      LEARNING_CONSTANTS.REDUNDANCY_GROUPS_KEY,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: true,
          data: null,
          message: 'No redundancy group data yet — cron has not run or Phase 7 is disabled',
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
    console.error('[Learning API] Error serving redundancy groups:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch redundancy group data',
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
