// src/app/api/online-users/route.ts
// ============================================================================
// ONLINE USERS API — Aggregated counts by country
// ============================================================================
// GET /api/online-users
//
// Aggregates active heartbeats from Vercel KV into per-country counts.
// Only expired keys (>120s) are auto-pruned by Redis TTL.
//
// Returns: { total, countries: [{ countryCode, count }] }
// Cache: 30-second stale-while-revalidate (lightweight, not hammering KV).
//
// If KV is unavailable, returns { total: 0, countries: [] }
// — the client hides the component when total === 0.
//
// Authority: docs/authority/homepage.md §8.4, §8.5
// Existing features preserved: Yes (additive route only)
// ============================================================================

import { NextResponse } from 'next/server';

import { hasKvConfigured, aggregateOnlineUsers } from '@/lib/kv/heartbeat-store';
import type { OnlineUsersResponse } from '@/types/homepage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(): Promise<NextResponse<OnlineUsersResponse>> {
  try {
    // ── KV check ────────────────────────────────────────────────────────
    if (!hasKvConfigured()) {
      return NextResponse.json(
        { total: 0, countries: [] },
        { headers: cacheHeaders() },
      );
    }

    // ── Aggregate active heartbeats ─────────────────────────────────────
    const { total, countries } = await aggregateOnlineUsers();

    return NextResponse.json(
      { total, countries },
      { headers: cacheHeaders() },
    );
  } catch (error) {
    console.error('[online-users] Error:', error);

    // Graceful degradation: return zero (component hidden by threshold)
    return NextResponse.json(
      { total: 0, countries: [] },
      { headers: cacheHeaders() },
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Standard cache headers: 30-second SWR per spec §8.5. */
function cacheHeaders(): Record<string, string> {
  return { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' };
}
