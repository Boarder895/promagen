/**
 * GET /api/admin/builder-quality/run-results?runId=xxx
 *
 * Admin-only endpoint returning results for a specific run, aggregated by
 * platform via aggregation.ts. If runId is omitted, uses the latest complete
 * run.
 *
 * Query params:
 *   runId  (optional) — specific run to load. If invalid/not found, falls
 *          back to latest complete run with a warning.
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.1
 * Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getRecentRuns,
  getRun,
  getResultsForRun,
} from '@/lib/builder-quality/database';
import {
  aggregateByPlatform,
  type ResultRow,
} from '@/lib/builder-quality/aggregation';

// =============================================================================
// ADMIN AUTH CHECK
// =============================================================================

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean);

async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.userId) return false;
    return ADMIN_USER_IDS.includes(session.userId);
  } catch {
    return false;
  }
}

// =============================================================================
// MAP DB ROW → ResultRow (aggregation input)
// =============================================================================

function toResultRow(row: Record<string, unknown>): ResultRow {
  return {
    platform_id: String(row.platform_id ?? ''),
    platform_name: String(row.platform_name ?? ''),
    scene_id: String(row.scene_id ?? ''),
    scene_name: String(row.scene_name ?? ''),
    tier: Number(row.tier ?? 3),
    replicate_index: Number(row.replicate_index ?? 1),
    gpt_score: Number(row.gpt_score ?? 0),
    anchors_expected: Number(row.anchors_expected ?? 0),
    anchors_preserved: Number(row.anchors_preserved ?? 0),
    anchors_dropped: Number(row.anchors_dropped ?? 0),
    critical_anchors_dropped: Number(row.critical_anchors_dropped ?? 0),
    anchor_audit: row.anchor_audit as ResultRow['anchor_audit'] ?? null,
    status: String(row.status ?? 'complete'),
    is_holdout: Boolean(row.is_holdout),
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    let requestedRunId = searchParams.get('runId');
    let warning: string | null = null;

    // ── Resolve run ──────────────────────────────────────────────────
    let resolvedRunId: string | null = null;

    if (requestedRunId) {
      const run = await getRun(requestedRunId);
      if (run) {
        resolvedRunId = run.runId;
      } else {
        // Invalid runId — fall back to latest with warning
        warning = `Run not found: ${requestedRunId}. Showing latest run instead.`;
        requestedRunId = null;
      }
    }

    if (!resolvedRunId) {
      // Find latest complete run
      const runs = await getRecentRuns(10);
      const latestComplete = runs.find((r) => r.status === 'complete');
      if (latestComplete) {
        resolvedRunId = latestComplete.runId;
      }
    }

    if (!resolvedRunId) {
      return NextResponse.json({
        ok: true,
        data: {
          runId: null,
          platforms: [],
          warning: warning ?? 'No complete runs found.',
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Fetch and aggregate ──────────────────────────────────────────
    const rawResults = await getResultsForRun(resolvedRunId);
    const resultRows = rawResults.map(toResultRow);
    const run = await getRun(resolvedRunId);

    // Filter out holdout results for the overview (holdout has its own view)
    const coreResults = resultRows.filter((r) => !r.is_holdout);
    const platforms = aggregateByPlatform(coreResults);

    return NextResponse.json({
      ok: true,
      data: {
        runId: resolvedRunId,
        run: run
          ? {
              runId: run.runId,
              createdAt: run.createdAt.toISOString(),
              status: run.status,
              mode: run.mode,
              scope: run.scope,
              scorerMode: run.scorerMode,
              replicateCount: run.replicateCount,
              totalExpected: run.totalExpected,
              totalCompleted: run.totalCompleted,
              meanGptScore: run.meanGptScore,
              flaggedCount: run.flaggedCount,
              baselineRunId: run.baselineRunId,
            }
          : null,
        platforms,
        warning,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('[builder-quality] Error fetching run results:', error);
    return NextResponse.json(
      { ok: false, data: null, message: 'Internal error' },
      { status: 500 },
    );
  }
}
