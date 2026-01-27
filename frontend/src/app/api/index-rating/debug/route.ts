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

function validateAuth(request: NextRequest): boolean {
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    return false;
  }

  const headerSecret = 
    request.headers.get('x-promagen-cron') ?? 
    request.headers.get('x-cron-secret');
  
  if (headerSecret === CRON_SECRET) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  
  return querySecret === CRON_SECRET;
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
