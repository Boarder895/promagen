/**
 * GET /api/admin/builder-quality/runs
 *
 * Admin-only endpoint returning recent builder quality runs.
 *
 * Auth: Requires admin role via Clerk.
 * Cache: No caching (admin data, always fresh).
 *
 * Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.4
 * Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
 *
 * Version: 1.0.0
 * Created: 4 April 2026
 *
 * Existing features preserved: Yes (new file).
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getRecentRuns } from '@/lib/builder-quality/database';

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

export async function GET(): Promise<NextResponse> {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, data: null, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const runs = await getRecentRuns(20);

    return NextResponse.json({
      ok: true,
      data: runs,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.debug('[builder-quality] Error fetching runs:', error);
    return NextResponse.json(
      { ok: false, data: null, message: 'Internal error' },
      { status: 500 },
    );
  }
}
