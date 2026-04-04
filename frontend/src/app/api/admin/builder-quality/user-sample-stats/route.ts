/**
 * GET /api/admin/builder-quality/user-sample-stats
 *
 * Returns per-platform 7-day rolling average from user_sample results.
 * Used by the Platform Overview table for the "User (7d)" column.
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §10
 * Build plan: part-11-build-plan v1.1.0
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

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
// TYPES
// =============================================================================

interface PlatformSampleStat {
  platformId: string;
  meanScore: number;
  sampleCount: number;
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    if (!hasDatabaseConfigured()) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const sql = db();

    const rows = await sql`
      SELECT
        platform_id,
        AVG(gpt_score)::numeric(5,2) AS mean_score,
        COUNT(*)::int AS sample_count
      FROM builder_quality_results
      WHERE source = 'user_sample'
        AND created_at > NOW() - INTERVAL '7 days'
        AND status = 'complete'
      GROUP BY platform_id
      ORDER BY mean_score ASC
    `;

    const stats: PlatformSampleStat[] = rows.map((r) => ({
      platformId: (r as Record<string, unknown>).platform_id as string,
      meanScore: parseFloat(String((r as Record<string, unknown>).mean_score)),
      sampleCount: (r as Record<string, unknown>).sample_count as number,
    }));

    return NextResponse.json({
      ok: true,
      data: stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('[builder-quality] Error fetching user sample stats:', error);
    return NextResponse.json(
      { ok: false, data: null, message: 'Internal error' },
      { status: 500 },
    );
  }
}
