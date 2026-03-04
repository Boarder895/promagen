// src/app/api/homepage/community-pulse/route.ts
// ============================================================================
// COMMUNITY PULSE — API Route
// ============================================================================
// GET /api/homepage/community-pulse
//
// Returns the 20 most recent pulse entries from prompt_showcase_entries,
// plus the single "most liked today" entry (highest like_count in last 24h).
//
// Data sources:
// - Weather-seeded entries: auto-logged by prompt-of-the-moment on each rotation
// - User-generated entries: logged by scoring pipeline when score ≥ 80 (future)
//
// Cache: 30-second stale-while-revalidate (live feed, but not hammering)
//
// Authority: docs/authority/homepage.md §6.4
// Existing features preserved: Yes (additive route only)
// ============================================================================

import { NextResponse } from 'next/server';

import { hasDatabaseConfigured, db } from '@/lib/db';
import { ensureLikeTables } from '@/lib/likes/database';
import type { CommunityPulseEntry, CommunityPulseResponse } from '@/types/homepage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<CommunityPulseResponse>> {
  try {
    // ── Database check ───────────────────────────────────────────────────
    if (!hasDatabaseConfigured()) {
      // Safe mode: return empty feed (UI renders "no activity yet")
      return NextResponse.json(
        { entries: [], mostLikedToday: null },
        { headers: cacheHeaders() },
      );
    }

    // Ensure tables exist (lazy creation, same pattern as like API)
    await ensureLikeTables();

    const sql = db();

    // ── Fetch 20 most recent entries ─────────────────────────────────────
    const recentRows = await sql`
      SELECT
        id,
        COALESCE(score, 0) AS score,
        COALESCE(description, '') AS description,
        COALESCE(tier, 'tier3') AS tier,
        COALESCE(platform_id, '') AS platform_id,
        COALESCE(city, '') AS city,
        COALESCE(source, 'weather') AS source,
        COALESCE(like_count, 0) AS like_count,
        created_at
      FROM prompt_showcase_entries
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const entries: CommunityPulseEntry[] = recentRows.map((row) =>
      rowToEntry(row),
    );

    // ── Fetch most liked today (last 24 hours) ───────────────────────────
    const mostLikedRows = await sql`
      SELECT
        id,
        COALESCE(score, 0) AS score,
        COALESCE(description, '') AS description,
        COALESCE(tier, 'tier3') AS tier,
        COALESCE(platform_id, '') AS platform_id,
        COALESCE(city, '') AS city,
        COALESCE(source, 'weather') AS source,
        COALESCE(like_count, 0) AS like_count,
        created_at
      FROM prompt_showcase_entries
      WHERE created_at > NOW() - INTERVAL '24 hours'
        AND like_count > 0
      ORDER BY like_count DESC, created_at DESC
      LIMIT 1
    `;

    const mostLikedToday: CommunityPulseEntry | null =
      mostLikedRows.length > 0 ? rowToEntry(mostLikedRows[0]!) : null;

    // ── Response ─────────────────────────────────────────────────────────
    return NextResponse.json(
      { entries, mostLikedToday },
      { headers: cacheHeaders() },
    );
  } catch (error) {
    console.error('[community-pulse] Error:', error);

    // Graceful degradation: empty feed, not a 500
    return NextResponse.json(
      { entries: [], mostLikedToday: null },
      { headers: cacheHeaders() },
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Map a database row to a CommunityPulseEntry. */
function rowToEntry(row: Record<string, unknown>): CommunityPulseEntry {
  const platformId = (row.platform_id as string) || '';
  const city = (row.city as string) || '';
  const source = (row.source as string) || 'weather';

  // Derive platform display name from source + platformId
  // Weather-seeded entries have no platformId — show city name as context
  let platform = 'Unknown';
  if (source === 'weather' && city) {
    platform = city;
  } else if (platformId) {
    // Use the platformId as display (provider name lookup would need an import
    // that creates a circular dependency — keep this lightweight)
    platform = platformId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return {
    id: row.id as string,
    score: Number(row.score) || 0,
    platform,
    platformId,
    description: (row.description as string) || '',
    tier: validTier(row.tier as string),
    likeCount: Number(row.like_count) || 0,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at ?? new Date().toISOString()),
  };
}

/** Validate tier string (defensive against bad DB data). */
function validTier(t: string): 'tier1' | 'tier2' | 'tier3' | 'tier4' {
  if (t === 'tier1' || t === 'tier2' || t === 'tier3' || t === 'tier4') return t;
  return 'tier3'; // Default to natural language tier
}

/** Standard cache headers: 30-second SWR per spec §14.4. */
function cacheHeaders(): Record<string, string> {
  return { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' };
}
