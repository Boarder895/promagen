/**
 * GET /api/learning/ab-assignment?abHash=<hash>
 *
 * Returns the current A/B test assignment for a given browser hash.
 *
 * If a test is running:
 *   { testId, variant: 'A'|'B', weights: {...}, testName, splitPct }
 *
 * If no test running:
 *   { testId: null, variant: null, weights: null, testName: null, splitPct: null }
 *
 * The client uses this to know which scoring weights to apply.
 * Reads from the cached `ab-active-test` key in learned_weights for fast reads
 * (no complex DB query needed — the cron writes this cache entry).
 *
 * @see docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 5 (7.6d)
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getLearnedWeights } from '@/lib/learning/database';
import { assignVariant } from '@/lib/learning/ab-assignment';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import type { ABTest } from '@/lib/learning/ab-testing';

// =============================================================================
// RESPONSE TYPE
// =============================================================================

interface ABAssignmentResponse {
  testId: string | null;
  testName: string | null;
  variant: 'A' | 'B' | null;
  weights: Record<string, number> | null;
  splitPct: number | null;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const abHash = searchParams.get('abHash');

    // No hash → no assignment (graceful degradation)
    if (!abHash) {
      return NextResponse.json<ABAssignmentResponse>({
        testId: null,
        testName: null,
        variant: null,
        weights: null,
        splitPct: null,
      });
    }

    // Read cached active test (written by Layer 15 in the cron)
    const cached = await getLearnedWeights<ABTest>(LEARNING_CONSTANTS.AB_ACTIVE_TEST_KEY);

    if (!cached?.data || cached.data.status !== 'running') {
      return NextResponse.json<ABAssignmentResponse>({
        testId: null,
        testName: null,
        variant: null,
        weights: null,
        splitPct: null,
      });
    }

    const test = cached.data;

    // Deterministic assignment: same (abHash, testId) → same variant
    const variant = assignVariant(abHash, test.id, test.splitPct);

    // Variant A (control) gets null weights (use default SCORE_WEIGHTS)
    // Variant B gets the variant weights as a partial overlay
    const weights = variant === 'B' ? test.variantWeights : null;

    return NextResponse.json<ABAssignmentResponse>({
      testId: test.id,
      testName: test.name,
      variant,
      weights,
      splitPct: test.splitPct,
    });
  } catch (error) {
    console.error('[AB Assignment] Error:', error);

    // Graceful degradation: no test info → user gets default weights
    return NextResponse.json<ABAssignmentResponse>({
      testId: null,
      testName: null,
      variant: null,
      weights: null,
      splitPct: null,
    });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
