// src/app/api/homepage/community-pulse/route.ts
// ============================================================================
// COMMUNITY PULSE — API Route
// ============================================================================
// GET /api/homepage/community-pulse
// POST /api/homepage/community-pulse — Log user-created prompt (fire-and-forget)
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

import type { NextRequest} from 'next/server';
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
        COALESCE(country_code, '') AS country_code,
        COALESCE(venue, '') AS venue,
        COALESCE(source, 'weather') AS source,
        COALESCE(like_count, 0) AS like_count,
        COALESCE(prompt_text, '') AS prompt_text,
        prompts_json,
        weather_json,
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
        COALESCE(country_code, '') AS country_code,
        COALESCE(venue, '') AS venue,
        COALESCE(source, 'weather') AS source,
        COALESCE(like_count, 0) AS like_count,
        COALESCE(prompt_text, '') AS prompt_text,
        prompts_json,
        weather_json,
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
    platform = platformId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Parse prompts_json as WeatherCategoryMap (new format has 'selections' key)
  // Old entries with {tier1:..., tier2:...} are treated as null (no categoryMap)
  let categoryMap: import('@/types/prompt-builder').WeatherCategoryMap | null = null;
  try {
    const raw = row.prompts_json;
    if (typeof raw === 'string' && raw.length > 0) {
      const parsed = JSON.parse(raw);
      // Detect new format: has 'selections' key (WeatherCategoryMap)
      if (parsed && typeof parsed === 'object' && 'selections' in parsed) {
        categoryMap = parsed as import('@/types/prompt-builder').WeatherCategoryMap;
      }
      // Old format (tier1/tier2/tier3/tier4) → categoryMap stays null
    }
  } catch {
    // Invalid JSON — safe to ignore
  }

  // Parse weather_json safely
  let weather: import('@/types/homepage').PulseWeatherData | null = null;
  try {
    const rawW = row.weather_json;
    if (typeof rawW === 'string' && rawW.length > 0) {
      const parsed = JSON.parse(rawW);
      if (parsed && typeof parsed === 'object' && 'description' in parsed) {
        weather = parsed as import('@/types/homepage').PulseWeatherData;
      }
    }
  } catch {
    // Invalid JSON — safe to ignore
  }

  // Conditions: from weather description, falling back to categoryMap meta
  const conditions = weather?.description ?? '';

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
    countryCode: (row.country_code as string) || '',
    source,
    venue: (row.venue as string) || '',
    conditions,
    categoryMap,
    weather,
    promptText: (row.prompt_text as string) || '',
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

// ============================================================================
// POST — Log a user-created prompt to the Community Pulse feed
// ============================================================================
// Called fire-and-forget by prompt-builder after copy/save.
// Validates input, inserts with source='user', returns the new entry ID.
// ============================================================================

interface PostBody {
  platformId: string;
  platformName: string;
  tier: string;
  promptText: string;
  description: string;
  score: number;
  countryCode: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!hasDatabaseConfigured()) {
      return NextResponse.json({ ok: false, reason: 'no-db' }, { status: 200 });
    }

    const body = (await request.json()) as Partial<PostBody>;

    // Validate required fields
    if (!body.platformId || !body.promptText || !body.description) {
      return NextResponse.json({ ok: false, reason: 'missing-fields' }, { status: 400 });
    }

    // Sanitise
    const platformId = String(body.platformId).slice(0, 100);
    const tier = validTier(String(body.tier || 'tier3'));
    const promptText = String(body.promptText).slice(0, 2000);
    const description = String(body.description).slice(0, 60);
    const score = Math.min(100, Math.max(0, Number(body.score) || 0));
    const countryCode = String(body.countryCode || '').slice(0, 2).toUpperCase();

    await ensureLikeTables();
    const sql = db();

    const result = await sql`
      INSERT INTO prompt_showcase_entries
        (city, country_code, venue, mood, tier, platform_id, prompt_text, description, score, source)
      VALUES
        ('', ${countryCode}, '', '', ${tier}, ${platformId}, ${promptText}, ${description}, ${score}, 'user')
      RETURNING id
    `;

    const id = result[0]?.id ?? null;
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error('[community-pulse POST] Error:', error);
    return NextResponse.json({ ok: false, reason: 'internal' }, { status: 500 });
  }
}
