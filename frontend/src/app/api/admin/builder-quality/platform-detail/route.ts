/**
 * GET /api/admin/builder-quality/platform-detail?platformId=xxx&runId=xxx
 *
 * Admin-only endpoint returning all results for a specific platform in a
 * specific run. Returns scene-level aggregation, full anchor audit JSONB,
 * post-processing data, and baseline comparison if available.
 *
 * Query params:
 *   platformId (required) — platform to view
 *   runId      (required) — run to view
 *
 * Auth: Requires admin role via Clerk.
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.2
 * Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun, getResultsForRun } from "@/lib/builder-quality/database";
import {
  aggregateByPlatformScene,
  compareToBaseline,
  getComparisonConfidence,
  type ResultRow,
} from "@/lib/builder-quality/aggregation";

// =============================================================================
// ADMIN AUTH CHECK
// =============================================================================

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? "")
  .split(",")
  .filter(Boolean);

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
    platform_id: String(row.platform_id ?? ""),
    platform_name: String(row.platform_name ?? ""),
    scene_id: String(row.scene_id ?? ""),
    scene_name: String(row.scene_name ?? ""),
    tier: Number(row.tier ?? 3),
    replicate_index: Number(row.replicate_index ?? 1),
    gpt_score: Number(row.gpt_score ?? 0),
    anchors_expected: Number(row.anchors_expected ?? 0),
    anchors_preserved: Number(row.anchors_preserved ?? 0),
    anchors_dropped: Number(row.anchors_dropped ?? 0),
    critical_anchors_dropped: Number(row.critical_anchors_dropped ?? 0),
    anchor_audit: (row.anchor_audit as ResultRow["anchor_audit"]) ?? null,
    status: String(row.status ?? "complete"),
    is_holdout: Boolean(row.is_holdout),
  };
}

/** Extended result shape with fields the detail view needs beyond ResultRow */
interface DetailResult {
  sceneId: string;
  sceneName: string;
  replicateIndex: number;
  gptScore: number;
  gptSummary: string;
  gptDirectives: string[];
  anchorAudit: AnchorAuditEntry[] | null;
  anchorsExpected: number;
  anchorsPreserved: number;
  anchorsDropped: number;
  criticalAnchorsDropped: number;
  rawOptimisedPrompt: string;
  optimisedPrompt: string;
  postProcessingChanged: boolean;
  postProcessingDelta: string | null;
  call3Mode: string;
  status: string;
  isHoldout: boolean;
}

interface AnchorAuditEntry {
  anchor: string;
  severity: "critical" | "important" | "optional";
  status: "exact" | "approximate" | "dropped";
  note?: string;
}

function toDetailResult(row: Record<string, unknown>): DetailResult {
  // Parse anchor_audit from JSONB
  let anchorAudit: AnchorAuditEntry[] | null = null;
  if (row.anchor_audit && Array.isArray(row.anchor_audit)) {
    anchorAudit = row.anchor_audit as AnchorAuditEntry[];
  } else if (typeof row.anchor_audit === "string") {
    try {
      anchorAudit = JSON.parse(row.anchor_audit);
    } catch {
      anchorAudit = null;
    }
  }

  // Parse gpt_directives
  let gptDirectives: string[] = [];
  if (Array.isArray(row.gpt_directives)) {
    gptDirectives = row.gpt_directives as string[];
  } else if (typeof row.gpt_directives === "string") {
    try {
      gptDirectives = JSON.parse(row.gpt_directives);
    } catch {
      gptDirectives = [];
    }
  }

  return {
    sceneId: String(row.scene_id ?? ""),
    sceneName: String(row.scene_name ?? ""),
    replicateIndex: Number(row.replicate_index ?? 1),
    gptScore: Number(row.gpt_score ?? 0),
    gptSummary: String(row.gpt_summary ?? ""),
    gptDirectives,
    anchorAudit,
    anchorsExpected: Number(row.anchors_expected ?? 0),
    anchorsPreserved: Number(row.anchors_preserved ?? 0),
    anchorsDropped: Number(row.anchors_dropped ?? 0),
    criticalAnchorsDropped: Number(row.critical_anchors_dropped ?? 0),
    rawOptimisedPrompt: String(row.raw_optimised_prompt ?? ""),
    optimisedPrompt: String(row.optimised_prompt ?? ""),
    postProcessingChanged: Boolean(row.post_processing_changed),
    postProcessingDelta: row.post_processing_delta
      ? String(row.post_processing_delta)
      : null,
    call3Mode: String(row.call3_mode ?? ""),
    status: String(row.status ?? "complete"),
    isHoldout: Boolean(row.is_holdout),
  };
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const platformId = searchParams.get("platformId");
    const runId = searchParams.get("runId");

    if (!platformId) {
      return NextResponse.json(
        { ok: false, data: null, message: "Missing platformId" },
        { status: 400 },
      );
    }

    if (!runId) {
      return NextResponse.json(
        { ok: false, data: null, message: "Missing runId" },
        { status: 400 },
      );
    }

    // ── Validate run exists ──────────────────────────────────────────
    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({
        ok: true,
        data: { notFound: "run", runId },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Fetch results for this platform in this run ──────────────────
    const rawResults = await getResultsForRun(runId, platformId);

    if (rawResults.length === 0) {
      return NextResponse.json({
        ok: true,
        data: { notFound: "platform", platformId, runId },
        generatedAt: new Date().toISOString(),
      });
    }

    // ── Build aggregation and detail results ─────────────────────────
    const resultRows = rawResults.map(toResultRow);
    const detailResults = rawResults.map(toDetailResult);

    // Separate core and holdout
    const coreResultRows = resultRows.filter((r) => !r.is_holdout);
    const holdoutResultRows = resultRows.filter((r) => r.is_holdout);
    const coreDetails = detailResults.filter((r) => !r.isHoldout);
    const holdoutDetails = detailResults.filter((r) => r.isHoldout);

    // Scene-level aggregation (core only)
    const sceneAggregates = aggregateByPlatformScene(coreResultRows);

    // Holdout scene aggregation (separate)
    const holdoutSceneAggregates =
      holdoutResultRows.length > 0
        ? aggregateByPlatformScene(holdoutResultRows)
        : [];

    // Post-processing stats
    const completeCoreDetails = coreDetails.filter(
      (r) => r.status === "complete",
    );
    const postProcessingCount = completeCoreDetails.filter(
      (r) => r.postProcessingChanged,
    ).length;
    const postProcessingPct =
      completeCoreDetails.length > 0
        ? Math.round((postProcessingCount / completeCoreDetails.length) * 100)
        : 0;

    // Platform-level summary from first result
    const firstResult = rawResults[0];
    const platformSummary = {
      platformId,
      platformName: String(firstResult?.platform_name ?? platformId),
      tier: Number(firstResult?.tier ?? 3),
      call3Mode: String(firstResult?.call3_mode ?? "unknown"),
    };

    // ── Baseline comparison (if linked) ──────────────────────────────
    let comparison = null;
    if (run.baselineRunId) {
      const baselineRawResults = await getResultsForRun(
        run.baselineRunId,
        platformId,
      );
      if (baselineRawResults.length > 0) {
        const baselineResultRows = baselineRawResults.map(toResultRow);
        const baselineCoreRows = baselineResultRows.filter(
          (r) => !r.is_holdout,
        );

        // Derive baseline replicate count from data
        const baselineScenes = new Set(baselineCoreRows.map((r) => r.scene_id));
        const baselineReplicates =
          baselineScenes.size > 0
            ? Math.round(baselineCoreRows.length / baselineScenes.size)
            : 1;

        const confidence = getComparisonConfidence(
          run.replicateCount,
          baselineReplicates,
        );

        const fullComparison = compareToBaseline(
          coreResultRows,
          baselineCoreRows,
          confidence,
        );
        // Filter to just this platform
        const platformComparison = fullComparison.platforms.find(
          (p) => p.platformId === platformId,
        );

        if (platformComparison) {
          comparison = {
            ...platformComparison,
            baselineRunId: run.baselineRunId,
          };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        platform: platformSummary,
        run: {
          runId: run.runId,
          createdAt: run.createdAt.toISOString(),
          status: run.status,
          mode: run.mode,
          replicateCount: run.replicateCount,
          baselineRunId: run.baselineRunId,
        },
        sceneAggregates,
        holdoutSceneAggregates,
        coreDetails,
        holdoutDetails,
        postProcessing: {
          totalScenes: completeCoreDetails.length,
          changedCount: postProcessingCount,
          percentage: postProcessingPct,
        },
        comparison,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug("[builder-quality] Error fetching platform detail:", error);
    return NextResponse.json(
      { ok: false, data: null, message: "Internal error" },
      { status: 500 },
    );
  }
}
