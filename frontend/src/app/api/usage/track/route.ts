/**
 * @file src/app/api/usage/track/route.ts
 * @description API endpoint for tracking prompt builder usage
 *
 * POST /api/usage/track - Increment usage counter (on "Copy prompt" click)
 * GET /api/usage/track - Get current usage status
 *
 * Authority: docs/authority/paid_tier.md §3.3
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  incrementDailyUsage,
  getUsageStatus,
  getTodayInTimezone,
  FREE_DAILY_LIMIT,
} from '@/lib/usage';

// ============================================================================
// GET - Get current usage status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // Get timezone from query params or header
    const timezone = request.nextUrl.searchParams.get('timezone') ?? 
                     request.headers.get('x-timezone') ?? 
                     'UTC';
    
    // Get tier from Clerk metadata (would need to fetch user)
    // For now, assume free tier - the client hook will have the real tier
    const isPaidUser = false;
    
    const date = getTodayInTimezone(timezone);
    const status = await getUsageStatus(userId, date, isPaidUser);
    
    return NextResponse.json({
      success: true,
      usage: status,
    });
  } catch (error) {
    console.error('[usage/track] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Increment usage counter
// ============================================================================

interface TrackRequestBody {
  timezone?: string;
  providerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // Parse request body
    let body: TrackRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }
    
    const timezone = body.timezone ?? 
                     request.headers.get('x-timezone') ?? 
                     'UTC';
    
    const date = getTodayInTimezone(timezone);
    
    // Get current usage to check limit
    // Note: In production, we'd also check user tier here
    const currentStatus = await getUsageStatus(userId, date, false);
    
    // Check if at limit (for free users)
    if (currentStatus.isAtLimit) {
      return NextResponse.json(
        {
          error: 'Daily limit reached',
          code: 'LIMIT_REACHED',
          usage: currentStatus,
        },
        { status: 429 }
      );
    }
    
    // Increment usage
    const updated = await incrementDailyUsage(userId, date, timezone);
    
    // Calculate new status
    const newStatus = {
      count: updated.promptCount,
      limit: FREE_DAILY_LIMIT,
      remaining: Math.max(0, FREE_DAILY_LIMIT - updated.promptCount),
      isAtLimit: updated.promptCount >= FREE_DAILY_LIMIT,
      resetTime: currentStatus.resetTime,
    };
    
    return NextResponse.json({
      success: true,
      usage: newStatus,
      providerId: body.providerId,
    });
  } catch (error) {
    console.error('[usage/track] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
