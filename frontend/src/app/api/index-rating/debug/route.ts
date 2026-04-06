/**
 * Index Rating Debug/Health Endpoint
 * 
 * Protected endpoint for checking Index Rating system health.
 * Requires PROMAGEN_CRON_SECRET for access.
 * 
 * Returns:
 * - Database connection status
 * - Table existence
 * - Ratings count
 * - Last cron run info
 * - Sample ratings
 * 
 * @see docs/authority/index-rating.md
 */

import { timingSafeEqual } from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hasDatabaseConfigured } from '@/lib/db';
import {
  checkIndexRatingHealth,
  getAllProviderRatings,
} from '@/lib/index-rating/database';

// =============================================================================
// AUTH
// =============================================================================

const CRON_SECRET = process.env.PROMAGEN_CRON_SECRET;

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) {
    timingSafeEqual(aa, aa); // dummy comparison to maintain constant time
    return false;
  }
  return timingSafeEqual(aa, bb);
}

/**
 * Validate admin/debug authentication.
 *
 * Accepted auth inputs:
 * - Authorization: Bearer <PROMAGEN_CRON_SECRET>  (Vercel Cron default)
 * - x-promagen-cron header
 * - x-cron-secret header
 * - x-promagen-cron-secret header
 * - ?secret= query param  (manual testing only)
 */
function validateAuth(request: NextRequest): boolean {
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    return false;
  }

  const url = new URL(request.url);
  const authorization = request.headers.get('authorization') ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice('bearer '.length).trim()
    : '';

  const provided = (
    bearerSecret ||
    request.headers.get('x-promagen-cron') ||
    request.headers.get('x-cron-secret') ||
    request.headers.get('x-promagen-cron-secret') ||
    url.searchParams.get('secret') ||
    ''
  ).trim();

  if (!provided) {
    return false;
  }

  return constantTimeEquals(provided, CRON_SECRET);
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate auth
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  try {
    // Check if database is configured
    const dbConfigured = hasDatabaseConfigured();
    
    if (!dbConfigured) {
      return NextResponse.json({
        status: 'degraded',
        dbConfigured: false,
        message: 'Database not configured',
      });
    }

    // Get health info
    const health = await checkIndexRatingHealth();

    // Get sample ratings (top 5)
    let sampleRatings: Array<{
      providerId: string;
      currentRating: number;
      rank: number | null;
    }> = [];

    if (health.tablesExist) {
      const allRatings = await getAllProviderRatings();
      sampleRatings = allRatings.slice(0, 5).map(r => ({
        providerId: r.providerId,
        currentRating: r.currentRating,
        rank: r.currentRank,
      }));
    }

    return NextResponse.json({
      status: health.connected && health.tablesExist ? 'healthy' : 'degraded',
      dbConfigured: true,
      dbConnected: health.connected,
      tablesExist: health.tablesExist,
      ratingsCount: health.ratingsCount,
      lastCronRun: health.lastCronRun ? {
        id: health.lastCronRun.id,
        ranAt: health.lastCronRun.ranAt.toISOString(),
        ok: health.lastCronRun.ok,
        message: health.lastCronRun.message,
        providersUpdated: health.lastCronRun.providersUpdated,
        durationMs: health.lastCronRun.durationMs,
      } : null,
      sampleRatings,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Index Rating Debug] Error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// =============================================================================
// RUNTIME
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
