// src/app/api/prompts/like/status/route.ts
// ============================================================================
// LIKE STATUS API — GET liked status for multiple prompt IDs
// ============================================================================
// GET /api/prompts/like/status?promptIds=id1,id2,id3
//
// Returns which prompts the current session has liked + their like counts.
// Used on page load to pre-fill heart states.
//
// Authority: docs/authority/homepage.md §7.8
// Existing features preserved: Yes (additive route)
// ============================================================================

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { hasDatabaseConfigured } from '@/lib/db';
import { ensureLikeTables, getLikedStatus } from '@/lib/likes/database';
import { getSessionId } from '@/lib/likes/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// GET — Batch status check
// ============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const promptIdsParam = searchParams.get('promptIds');

    if (!promptIdsParam) {
      return NextResponse.json(
        { success: false, error: 'promptIds query parameter is required' },
        { status: 400 },
      );
    }

    const promptIds = promptIdsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, 20); // Cap at 20 IDs per request

    if (promptIds.length === 0) {
      return NextResponse.json({ success: true, statuses: {} });
    }

    // ── Database check ─────────────────────────────────────────────────
    if (!hasDatabaseConfigured()) {
      // Safe mode: return all as not-liked with zero counts
      const statuses: Record<string, { liked: boolean; count: number }> = {};
      for (const id of promptIds) {
        statuses[id] = { liked: false, count: 0 };
      }
      return NextResponse.json({ success: true, statuses, _safeMode: true });
    }

    // ── Session ────────────────────────────────────────────────────────
    const sessionId = getSessionId(req);
    if (!sessionId) {
      // No session = nothing liked
      const statuses: Record<string, { liked: boolean; count: number }> = {};
      for (const id of promptIds) {
        statuses[id] = { liked: false, count: 0 };
      }
      return NextResponse.json({ success: true, statuses });
    }

    // ── Ensure tables exist ────────────────────────────────────────────
    await ensureLikeTables();

    // ── Batch query ────────────────────────────────────────────────────
    const statusMap = await getLikedStatus(sessionId, promptIds);

    const statuses: Record<string, { liked: boolean; count: number }> = {};
    for (const id of promptIds) {
      const s = statusMap.get(id);
      statuses[id] = s ?? { liked: false, count: 0 };
    }

    return NextResponse.json(
      { success: true, statuses },
      {
        headers: {
          // Short cache — likes change frequently
          'Cache-Control': 'private, max-age=10',
        },
      },
    );
  } catch (error) {
    console.error('[Like Status API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
