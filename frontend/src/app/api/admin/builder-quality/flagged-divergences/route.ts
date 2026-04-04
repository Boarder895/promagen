/**
 * GET /api/admin/builder-quality/flagged-divergences?runId=xxx
 *
 * Admin-only endpoint returning flagged divergence results (GPT vs Claude
 * gap >= 9 points) for a specific run. Also returns metadata about whether
 * dual-model runs exist at all.
 *
 * Query params:
 *   runId (optional) — specific run to check. If omitted, uses latest run.
 *
 * Auth: Requires admin role via Clerk.
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.3
 * Build plan: part-9-build-plan v1.1.0, Sub-Delivery 9b
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getRecentRuns, getResultsForRun, getRun } from '@/lib/builder-quality/database';

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
    const requestedRunId = searchParams.get('runId');

    // ── Check if any dual-model runs exist ───────────────────────────
    const recentRuns = await getRecentRuns(20);
    const hasDualRuns = recentRuns.some(
      (r) => r.scorerMode === 'dual_on_flagged' || r.scorerMode === 'dual_full',
    );

    if (!hasDualRuns) {
      return NextResponse.json({
        ok: true,
        data: {
          hasDualRuns: false,
          flaggedResults: [],
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Resolve run ──────────────────────────────────────────────────
    let resolvedRunId: string | null = null;

    if (requestedRunId) {
      const run = await getRun(requestedRunId);
      if (run) resolvedRunId = run.runId;
    }

    if (!resolvedRunId) {
      // Find latest dual-model run
      const latestDual = recentRuns.find(
        (r) =>
          r.status === 'complete' &&
          (r.scorerMode === 'dual_on_flagged' || r.scorerMode === 'dual_full'),
      );
      if (latestDual) resolvedRunId = latestDual.runId;
    }

    if (!resolvedRunId) {
      return NextResponse.json({
        ok: true,
        data: {
          hasDualRuns: true,
          flaggedResults: [],
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Fetch flagged results ────────────────────────────────────────
    const rawResults = await getResultsForRun(resolvedRunId);

    const flaggedResults = rawResults
      .filter((r) => r.flagged === true && r.status === 'complete')
      .map((r) => ({
        platformId: String(r.platform_id ?? ''),
        platformName: String(r.platform_name ?? ''),
        sceneId: String(r.scene_id ?? ''),
        sceneName: String(r.scene_name ?? ''),
        gptScore: Number(r.gpt_score ?? 0),
        claudeScore: r.claude_score != null ? Number(r.claude_score) : null,
        divergence: r.divergence != null ? Number(r.divergence) : null,
        runId: String(r.run_id ?? ''),
        createdAt: r.created_at ? String(r.created_at) : null,
      }))
      .filter((r) => r.claudeScore !== null && r.divergence !== null)
      .sort((a, b) => (b.divergence ?? 0) - (a.divergence ?? 0));

    return NextResponse.json({
      ok: true,
      data: {
        hasDualRuns: true,
        runId: resolvedRunId,
        flaggedResults,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('[builder-quality] Error fetching flagged divergences:', error);
    return NextResponse.json(
      { ok: false, data: null, message: 'Internal error' },
      { status: 500 },
    );
  }
}
