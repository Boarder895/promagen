/**
 * GET /api/learning/ab-tests
 *
 * Admin endpoint: returns all A/B tests (history + running) with full
 * evaluation data for the admin dashboard.
 *
 * Optional query parameters:
 *   ?limit=<number>   — Max tests to return (default: 50)
 *   ?status=<string>  — Filter by status: 'running', 'promoted', 'rolled_back'
 *
 * Also returns the currently running test with live event counts
 * (for the dashboard to show real-time progress).
 *
 * @see docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 5 (7.6d)
 *
 * Version: 1.0.0
 * Existing features preserved: Yes.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  getAllABTests,
  getRunningABTest,
  countABTestEvents,
} from '@/lib/learning/database';
import {
  evaluateTest,
  computeRequiredSampleSize,
  estimateDaysRemaining,
} from '@/lib/learning/ab-testing';
import type { ABTest, ABTestResult } from '@/lib/learning/ab-testing';

// =============================================================================
// RESPONSE TYPE
// =============================================================================

interface ABTestSummary extends ABTest {
  /** Live event counts (only for running tests) */
  liveCounts?: {
    controlEvents: number;
    variantEvents: number;
    controlCopies: number;
    variantCopies: number;
  };
  /** Live evaluation result (only for running tests) */
  liveEvaluation?: ABTestResult;
  /** Estimated days remaining (only for running tests) */
  estimatedDaysRemaining?: number | null;
  /** Required sample size per group at 80% power for 5% lift detection */
  requiredSampleSize?: number | null;
}

interface ABTestsResponse {
  tests: ABTestSummary[];
  runningTestId: string | null;
  totalCount: number;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);
    const statusFilter = searchParams.get('status');

    // Fetch all tests
    let tests = await getAllABTests(Math.min(limit, 200));

    // Filter by status if requested
    if (statusFilter && ['running', 'promoted', 'rolled_back'].includes(statusFilter)) {
      tests = tests.filter((t) => t.status === statusFilter);
    }

    // Get the running test with live data
    const runningTest = await getRunningABTest();
    let enrichedTests: ABTestSummary[] = tests;

    if (runningTest) {
      const counts = await countABTestEvents(runningTest.id);
      const liveEvaluation = evaluateTest(runningTest, counts);

      // Compute traffic rate (events per day since test started)
      const ageMs = Date.now() - new Date(runningTest.startedAt).getTime();
      const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 0.1); // avoid div by 0
      const totalEvents = counts.controlEvents + counts.variantEvents;
      const dailyRate = totalEvents / ageDays;
      const baseRate = counts.controlEvents > 0
        ? counts.controlCopies / counts.controlEvents
        : 0.3; // fallback estimate

      const daysRemaining = estimateDaysRemaining(runningTest, dailyRate, baseRate, 0.05);
      const requiredSampleSize = computeRequiredSampleSize(baseRate, 0.05);

      enrichedTests = tests.map((t) => {
        if (t.id === runningTest.id) {
          return {
            ...t,
            liveCounts: {
              controlEvents: counts.controlEvents,
              variantEvents: counts.variantEvents,
              controlCopies: counts.controlCopies,
              variantCopies: counts.variantCopies,
            },
            liveEvaluation,
            estimatedDaysRemaining: daysRemaining,
            requiredSampleSize: isFinite(requiredSampleSize) ? requiredSampleSize : null,
          } as ABTestSummary;
        }
        return t as ABTestSummary;
      });
    }

    return NextResponse.json<ABTestsResponse>({
      tests: enrichedTests,
      runningTestId: runningTest?.id ?? null,
      totalCount: enrichedTests.length,
    });
  } catch (error) {
    console.error('[AB Tests Admin] Error:', error);

    return NextResponse.json<ABTestsResponse>(
      {
        tests: [],
        runningTestId: null,
        totalCount: 0,
      },
      { status: 500 },
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
