/**
 * Index Rating Cron Job
 * 
 * Daily rating calculation for Promagen's competitive ranking system.
 * 
 * Schedule: 00:05 UTC daily (configured in vercel.json)
 * 
 * SECURITY:
 * - Cron secret validation (PROMAGEN_CRON_SECRET)
 * - Advisory lock to prevent concurrent runs
 * - Parameterized queries throughout
 * - Graceful error handling
 * - Returns 404 for invalid auth (hides endpoint existence)
 * 
 * @see docs/authority/index-rating.md
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import providers from '@/data/providers/providers.json';
import marketPowerData from '@/data/providers/market-power.json';

import {
  hasDatabaseConfigured,
  ensureTablesExist,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  getAllProviderRatings,
  getAllProviderEvents,
  upsertProviderRating,
  seedProviderRating,
  logCronRun,
} from '@/lib/index-rating/database';

import {
  calculateMPI,
  calculateTotalEloChange,
  applyDailyRegression,
  applyRatingFloor,
  calculateSeedRating,
  calculateChangePercent,
} from '@/lib/index-rating/calculations';

import type {
  ProviderContext,
  MarketPowerData,
  IndexRatingCronResponse,
} from '@/lib/index-rating';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CRON_SECRET = process.env.PROMAGEN_CRON_SECRET;

// Cast market power data to typed version
const typedMarketPowerData = marketPowerData as MarketPowerData;

// =============================================================================
// HELPERS
// =============================================================================

/** Character set for ID generation */
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a simple random ID without external deps
 */
function generateRequestId(): string {
  const length = 12;
  let result = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      // Non-null assertion safe: array length matches loop bounds
      const byte = array[i]!;
      result += ID_CHARS.charAt(byte % ID_CHARS.length);
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
    }
  }
  return result;
}

// =============================================================================
// SECURITY: AUTH VALIDATION
// =============================================================================

/**
 * Validate cron request authentication.
 * 
 * Accepts auth via:
 * - Header: x-promagen-cron
 * - Header: x-cron-secret
 * - Query param: secret
 * 
 * Returns 404 (not 401/403) to hide endpoint existence from attackers.
 */
function validateCronAuth(request: NextRequest): boolean {
  if (!CRON_SECRET || CRON_SECRET.length < 16) {
    console.error('[Index Rating Cron] PROMAGEN_CRON_SECRET not configured or too short');
    return false;
  }

  // Check headers (constant-time comparison would be ideal but not critical for cron)
  const headerSecret = 
    request.headers.get('x-promagen-cron') ?? 
    request.headers.get('x-cron-secret');
  
  if (headerSecret === CRON_SECRET) {
    return true;
  }

  // Check query param
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  
  if (querySecret === CRON_SECRET) {
    return true;
  }

  return false;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Log request (no sensitive data)
  console.debug('[Index Rating Cron] Request received', { requestId });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECURITY: Validate auth
  // ─────────────────────────────────────────────────────────────────────────────
  if (!validateCronAuth(request)) {
    console.warn('[Index Rating Cron] Unauthorized request', { requestId });
    // Return 404 to hide endpoint existence
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Check database configuration
  // ─────────────────────────────────────────────────────────────────────────────
  if (!hasDatabaseConfigured()) {
    const response: IndexRatingCronResponse = {
      ok: false,
      message: 'Database not configured',
      providersUpdated: 0,
      providersSeeded: 0,
      durationMs: Date.now() - startTime,
      requestId,
      ranAt: new Date().toISOString(),
      dryRun: false,
    };
    return NextResponse.json(response, { status: 500 });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Parse query params
  // ─────────────────────────────────────────────────────────────────────────────
  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // ─────────────────────────────────────────────────────────────────────────────
  // Acquire advisory lock (prevent concurrent runs)
  // ─────────────────────────────────────────────────────────────────────────────
  let lockAcquired = false;
  
  try {
    lockAcquired = await acquireAdvisoryLock();
    
    if (!lockAcquired) {
      console.warn('[Index Rating Cron] Could not acquire lock - another instance running', { requestId });
      const response: IndexRatingCronResponse = {
        ok: false,
        message: 'Another cron instance is running',
        providersUpdated: 0,
        providersSeeded: 0,
        durationMs: Date.now() - startTime,
        requestId,
        ranAt: new Date().toISOString(),
        dryRun,
      };
      return NextResponse.json(response, { status: 409 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Ensure tables exist
    // ─────────────────────────────────────────────────────────────────────────────
    await ensureTablesExist();

    // ─────────────────────────────────────────────────────────────────────────────
    // Load data sources
    // ─────────────────────────────────────────────────────────────────────────────
    
    // Provider list from JSON (SSOT) - it's an array, not an object with providers property
    const providersList = providers as unknown as ProviderContext[];
    console.debug('[Index Rating Cron] Loaded providers', { 
      requestId, 
      count: providersList.length 
    });

    // Market Power data
    const marketPower = typedMarketPowerData.providers || {};
    console.debug('[Index Rating Cron] Loaded market power data', { 
      requestId, 
      count: Object.keys(marketPower).length 
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Get current ratings and events
    // ─────────────────────────────────────────────────────────────────────────────
    const currentRatings = await getAllProviderRatings();
    const ratingsMap = new Map(currentRatings.map(r => [r.providerId, r]));
    
    const allEvents = await getAllProviderEvents(180); // 180 days lookback

    console.debug('[Index Rating Cron] Loaded current state', {
      requestId,
      existingRatings: currentRatings.length,
      providersWithEvents: allEvents.size,
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Process each provider
    // ─────────────────────────────────────────────────────────────────────────────
    const updates: Array<{
      providerId: string;
      newRating: number;
      previousRating: number;
      change: number;
      changePercent: number;
    }> = [];

    let providersSeeded = 0;

    for (const provider of providersList) {
      const providerId = provider.id.toLowerCase().trim();
      const existingRating = ratingsMap.get(providerId);
      const providerMarketPower = marketPower[providerId];
      const providerEvents = allEvents.get(providerId) || [];

      let newRating: number;
      let previousRating: number;

      if (!existingRating) {
        // ─────────────────────────────────────────────────────────────────────────
        // AUTO-SEED: New provider detected
        // ─────────────────────────────────────────────────────────────────────────
        const isIncumbent = providerMarketPower 
          ? calculateMPI(providerMarketPower) > 5.0 
          : false;
        
        newRating = calculateSeedRating(provider, isIncumbent);
        previousRating = newRating;
        
        if (!dryRun) {
          await seedProviderRating(providerId, newRating);
        }
        
        providersSeeded++;
        console.debug('[Index Rating Cron] Seeded new provider', {
          requestId,
          providerId,
          seededRating: newRating,
        });
      } else {
        // ─────────────────────────────────────────────────────────────────────────
        // EXISTING PROVIDER: Calculate new rating
        // ─────────────────────────────────────────────────────────────────────────
        previousRating = existingRating.currentRating;

        // Calculate Elo change from events
        const eloChange = calculateTotalEloChange(
          providerEvents,
          provider,
          providerMarketPower
        );

        // Apply Elo change
        let workingRating = previousRating + eloChange;

        // Apply daily regression toward baseline
        workingRating = applyDailyRegression(workingRating);

        // Apply floor
        newRating = applyRatingFloor(workingRating);
      }

      // Calculate change metrics
      const change = newRating - previousRating;
      const changePercent = calculateChangePercent(newRating, previousRating);

      updates.push({
        providerId,
        newRating,
        previousRating,
        change,
        changePercent,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Calculate ranks
    // ─────────────────────────────────────────────────────────────────────────────
    updates.sort((a, b) => b.newRating - a.newRating);
    
    const rankedUpdates = updates.map((update, index) => ({
      ...update,
      currentRank: index + 1,
      previousRank: ratingsMap.get(update.providerId)?.currentRank ?? null,
    }));

    // ─────────────────────────────────────────────────────────────────────────────
    // Detect rank changes (climbers only)
    // ─────────────────────────────────────────────────────────────────────────────
    const now = new Date();
    const finalUpdates = rankedUpdates.map(update => {
      const existing = ratingsMap.get(update.providerId);
      let rankChangedAt = existing?.rankChangedAt ?? null;

      // Check if rank improved (lower number = better)
      if (update.previousRank !== null && update.currentRank < update.previousRank) {
        rankChangedAt = now;
        console.debug('[Index Rating Cron] Rank climbed', {
          requestId,
          providerId: update.providerId,
          from: update.previousRank,
          to: update.currentRank,
        });
      }

      return { ...update, rankChangedAt };
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // Persist updates (upsert for idempotency)
    // ─────────────────────────────────────────────────────────────────────────────
    let providersUpdated = 0;

    if (!dryRun) {
      for (const update of finalUpdates) {
        await upsertProviderRating(
          update.providerId,
          update.newRating,
          update.previousRating,
          update.change,
          update.changePercent,
          update.currentRank,
          update.previousRank,
          update.rankChangedAt
        );
        providersUpdated++;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Log completion
    // ─────────────────────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const message = dryRun 
      ? `Dry run complete: ${finalUpdates.length} providers processed`
      : `Updated ${providersUpdated} providers, seeded ${providersSeeded}`;

    if (!dryRun) {
      await logCronRun(requestId, true, message, providersUpdated, durationMs);
    }

    console.debug('[Index Rating Cron] Complete', {
      requestId,
      providersUpdated,
      providersSeeded,
      durationMs,
      dryRun,
    });

    const response: IndexRatingCronResponse = {
      ok: true,
      message,
      providersUpdated,
      providersSeeded,
      durationMs,
      requestId,
      ranAt: new Date().toISOString(),
      dryRun,
    };

    return NextResponse.json(response);

  } catch (error) {
    // ─────────────────────────────────────────────────────────────────────────────
    // Error handling
    // ─────────────────────────────────────────────────────────────────────────────
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Index Rating Cron] Error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Log failed run (best effort)
    try {
      await logCronRun(requestId, false, errorMessage, 0, durationMs);
    } catch {
      // Ignore logging errors
    }

    const response: IndexRatingCronResponse = {
      ok: false,
      message: `Cron failed: ${errorMessage}`,
      providersUpdated: 0,
      providersSeeded: 0,
      durationMs,
      requestId,
      ranAt: new Date().toISOString(),
      dryRun: false,
    };

    return NextResponse.json(response, { status: 500 });

  } finally {
    // ─────────────────────────────────────────────────────────────────────────────
    // Always release lock
    // ─────────────────────────────────────────────────────────────────────────────
    if (lockAcquired) {
      await releaseAdvisoryLock();
      console.debug('[Index Rating Cron] Released advisory lock', { requestId });
    }
  }
}

// =============================================================================
// RUNTIME CONFIG
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max for Vercel
