/**
 * @file src/app/api/cron/rankings/route.ts
 * @description Cron job for recalculating provider rankings
 * 
 * Schedule: Every hour at minute 0 (configured in vercel.json)
 * 
 * This job:
 * 1. Fetches all provider vote statistics from KV
 * 2. Applies time decay to older votes
 * 3. Calculates Bayesian scores
 * 4. Blends community scores with seed scores
 * 5. Generates new rankings
 * 6. Stores results in KV cache
 * 
 * Security:
 * - Requires CRON_SECRET header
 * - Rate limited (cannot run more than once per minute)
 * - Timeout protection
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  // Security
  validateCronAuth,
  
  // Storage
  getAllProviderStats,
  storeCachedRankings,
  getLastCalculationTime,
  cleanupExpiredData,
  
  // Bayesian
  calculateRankings,
  
  // Types
  type RankingsUpdateResult,
} from '@/lib/voting';

// Provider catalog
import providersData from '@/data/providers/providers.json';

// All provider IDs
const ALL_PROVIDER_IDS = (providersData as Array<{ id: string }>).map((p) => p.id);

// Minimum interval between calculations (ms)
const MIN_CALCULATION_INTERVAL_MS = 60 * 1000; // 1 minute

// ============================================================================
// GET /api/cron/rankings
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ========================================================================
    // 1. AUTHENTICATION
    // ========================================================================
    
    const isAuthorized = validateCronAuth(request);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // ========================================================================
    // 2. CHECK CALCULATION INTERVAL
    // ========================================================================
    
    const lastCalcTime = await getLastCalculationTime();
    
    if (lastCalcTime) {
      const timeSinceLastCalc = Date.now() - new Date(lastCalcTime).getTime();
      
      if (timeSinceLastCalc < MIN_CALCULATION_INTERVAL_MS) {
        return NextResponse.json({
          success: true,
          message: 'Calculation skipped - too recent',
          lastCalculated: lastCalcTime,
          nextAllowedAt: new Date(
            new Date(lastCalcTime).getTime() + MIN_CALCULATION_INTERVAL_MS
          ).toISOString(),
        });
      }
    }
    
    // ========================================================================
    // 3. FETCH ALL PROVIDER STATISTICS
    // ========================================================================
    
    const allStats = await getAllProviderStats(ALL_PROVIDER_IDS);
    
    // ========================================================================
    // 4. CALCULATE NEW RANKINGS
    // ========================================================================
    
    const rankings = calculateRankings(ALL_PROVIDER_IDS, allStats);
    
    // ========================================================================
    // 5. STORE RANKINGS IN CACHE
    // ========================================================================
    
    await storeCachedRankings(rankings);
    
    // ========================================================================
    // 6. CLEANUP EXPIRED DATA (optional, runs periodically)
    // ========================================================================
    
    // Run cleanup every ~6 hours (roughly every 6th run)
    const hour = new Date().getHours();
    let cleanupResult = { votesDeleted: 0, usersCleanedUp: 0 };
    
    if (hour % 6 === 0) {
      cleanupResult = await cleanupExpiredData();
    }
    
    // ========================================================================
    // 7. RETURN RESULT
    // ========================================================================
    
    const duration = Date.now() - startTime;
    
    const result: RankingsUpdateResult = {
      success: true,
      providersUpdated: rankings.length,
      newRankings: rankings,
      calculatedAt: new Date().toISOString(),
      duration,
    };
    
    // Log summary
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Cron Rankings] Completed:', {
        providersUpdated: rankings.length,
        duration: `${duration}ms`,
        cleanup: cleanupResult,
      });
    }
    
    return NextResponse.json({
      ...result,
      cleanup: cleanupResult,
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error
    if (process.env.NODE_ENV === 'development') {
       
      console.error('[Cron Rankings] Error:', error);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Rankings calculation failed',
        duration,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/cron/rankings
// Manual trigger for testing
// ============================================================================

export async function POST(request: NextRequest) {
  // Allow POST as alias for GET (useful for manual testing)
  return GET(request);
}
