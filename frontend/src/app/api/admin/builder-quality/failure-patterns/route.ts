/**
 * GET /api/admin/builder-quality/failure-patterns?platformId=bing
 *
 * Returns aggregated failure patterns for a platform: anchor drops,
 * recurring directives, scene weakness, post-processing reliance,
 * and patch test history.
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §11
 * Build plan: part-12-build-plan v1.1.0
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasDatabaseConfigured, db } from '@/lib/db';

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
    return NextResponse.json({ ok: false, data: null, message: 'Unauthorized' }, { status: 401 });
  }

  const platformId = request.nextUrl.searchParams.get('platformId');
  if (!platformId) {
    return NextResponse.json({ ok: false, data: null, message: 'platformId required' }, { status: 400 });
  }

  try {
    if (!hasDatabaseConfigured()) {
      return NextResponse.json({ ok: true, data: { anchorDrops: [], recurringDirectives: [], sceneWeakness: [], patchTests: [], postProcessingReliance: 0 } });
    }

    const sql = db();

    // ── Anchor drops ──────────────────────────────────────────────
    const anchorRows = await sql`
      SELECT anchor_audit, scene_id
      FROM builder_quality_results
      WHERE platform_id = ${platformId}
        AND source = 'batch'
        AND status = 'complete'
        AND is_holdout = false
        AND anchor_audit IS NOT NULL
    `;

    const anchorMap = new Map<string, { severity: string; dropped: number; total: number; scenes: Set<string> }>();
    for (const row of anchorRows) {
      const r = row as Record<string, unknown>;
      const audit = r.anchor_audit as { anchor: string; severity: string; status: string }[];
      if (!Array.isArray(audit)) continue;
      for (const entry of audit) {
        const key = `${entry.anchor}|${entry.severity}`;
        const existing = anchorMap.get(key) || { severity: entry.severity, dropped: 0, total: 0, scenes: new Set<string>() };
        existing.total++;
        if (entry.status === 'dropped') {
          existing.dropped++;
          existing.scenes.add(r.scene_id as string);
        }
        anchorMap.set(key, existing);
      }
    }

    const anchorDrops = Array.from(anchorMap.entries())
      .map(([key, data]) => ({
        anchor: key.split('|')[0],
        severity: data.severity,
        dropRate: data.total > 0 ? Math.round((data.dropped / data.total) * 100) : 0,
        dropCount: data.dropped,
        totalRuns: data.total,
        scenes: [...data.scenes],
      }))
      .sort((a, b) => b.dropRate - a.dropRate)
      .slice(0, 20);

    // ── Recurring directives ──────────────────────────────────────
    const directiveRows = await sql`
      SELECT gpt_directives
      FROM builder_quality_results
      WHERE platform_id = ${platformId}
        AND source = 'batch'
        AND status = 'complete'
        AND is_holdout = false
    `;

    const directiveCounts = new Map<string, number>();
    let totalResults = 0;
    for (const row of directiveRows) {
      totalResults++;
      const directives = (row as Record<string, unknown>).gpt_directives as string[];
      if (!Array.isArray(directives)) continue;
      for (const d of directives) {
        const canon = d.trim().toLowerCase().replace(/^(restore|preserve|ensure|maintain)\s+/i, '').replace(/[.!;:]+$/, '');
        if (canon.length < 5) continue;
        directiveCounts.set(canon, (directiveCounts.get(canon) || 0) + 1);
      }
    }

    const recurringDirectives = Array.from(directiveCounts.entries())
      .map(([canonical, count]) => ({
        canonical,
        occurrenceCount: count,
        occurrenceRate: totalResults > 0 ? Math.round((count / totalResults) * 100) : 0,
      }))
      .filter((d) => d.occurrenceRate >= 20)
      .sort((a, b) => b.occurrenceRate - a.occurrenceRate)
      .slice(0, 10);

    // ── Scene weakness ────────────────────────────────────────────
    const sceneRows = await sql`
      SELECT scene_id,
        AVG(gpt_score)::numeric(5,2) AS mean_score,
        MIN(gpt_score) AS min_score,
        MAX(gpt_score) AS max_score,
        COUNT(*)::int AS result_count
      FROM builder_quality_results
      WHERE platform_id = ${platformId}
        AND source = 'batch'
        AND status = 'complete'
        AND is_holdout = false
      GROUP BY scene_id
      ORDER BY mean_score ASC
    `;

    const sceneWeakness = sceneRows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        sceneId: row.scene_id as string,
        meanScore: parseFloat(String(row.mean_score)),
        minScore: row.min_score as number,
        maxScore: row.max_score as number,
        resultCount: row.result_count as number,
      };
    });

    // ── Post-processing reliance ──────────────────────────────────
    const ppRows = await sql`
      SELECT
        COUNT(*) FILTER (WHERE post_processing_changed = true)::int AS changed,
        COUNT(*)::int AS total
      FROM builder_quality_results
      WHERE platform_id = ${platformId}
        AND source = 'batch'
        AND status = 'complete'
    `;
    const ppRow = ppRows[0] as Record<string, unknown>;
    const postProcessingReliance = (ppRow.total as number) > 0
      ? Math.round(((ppRow.changed as number) / (ppRow.total as number)) * 100)
      : 0;

    // ── Patch test history ────────────────────────────────────────
    const patchTestRows = await sql`
      SELECT run_id, created_at, completed_at, status, mean_gpt_score,
             total_expected, total_completed, error_detail
      FROM builder_quality_runs
      WHERE mode = 'patch_test'
        AND scope = ${'patch:' + platformId}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const patchTests = patchTestRows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        runId: row.run_id as string,
        createdAt: row.created_at as string,
        status: row.status as string,
        meanScore: row.mean_gpt_score ? parseFloat(String(row.mean_gpt_score)) : null,
      };
    });

    return NextResponse.json({
      ok: true,
      data: { anchorDrops, recurringDirectives, sceneWeakness, postProcessingReliance, patchTests },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('[builder-quality] Error fetching failure patterns:', error);
    return NextResponse.json({ ok: false, data: null, message: 'Internal error' }, { status: 500 });
  }
}
