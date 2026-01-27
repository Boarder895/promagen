/**
 * Index Rating Database Operations
 * 
 * Secure database operations for the Index Rating system.
 * All queries use parameterized statements to prevent SQL injection.
 * 
 * Uses the existing db() pattern from src/lib/db.ts
 * 
 * @see docs/authority/index-rating.md
 */

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';
import {
  INDEX_RATING_STALE_HOURS,
  INDEX_RATING_ADVISORY_LOCK_ID,
  type ProviderRating,
  type ProviderRatingRow,
  type IndexRatingCronRun,
  type IndexRatingCronRunRow,
  type RatingEvent,
  type IndexRatingEventType,
} from '@/types/index-rating';

// Re-export for convenience
export { hasDatabaseConfigured };

// =============================================================================
// TABLE CREATION (AUTO-MIGRATION)
// =============================================================================

/**
 * Create provider_ratings table if not exists.
 * Called by cron job on startup.
 */
export async function ensureProviderRatingsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS provider_ratings (
      provider_id      TEXT        NOT NULL PRIMARY KEY,
      current_rating   NUMERIC     NOT NULL DEFAULT 1500,
      previous_rating  NUMERIC     NOT NULL DEFAULT 1500,
      change           NUMERIC     NOT NULL DEFAULT 0,
      change_percent   NUMERIC     NOT NULL DEFAULT 0,
      current_rank     INTEGER,
      previous_rank    INTEGER,
      rank_changed_at  TIMESTAMPTZ,
      calculated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  
  // Create index for efficient ranking queries
  await db()`
    CREATE INDEX IF NOT EXISTS idx_provider_ratings_rank
    ON provider_ratings (current_rank)
  `;
}

/**
 * Create index_rating_cron_runs table if not exists.
 * Called by cron job on startup.
 */
export async function ensureIndexRatingCronRunsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS index_rating_cron_runs (
      id                 TEXT        NOT NULL PRIMARY KEY,
      ran_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ok                 BOOLEAN     NOT NULL,
      message            TEXT,
      providers_updated  BIGINT      NOT NULL DEFAULT 0,
      duration_ms        BIGINT      NOT NULL DEFAULT 0
    )
  `;
}

/**
 * Ensure all required tables exist
 */
export async function ensureTablesExist(): Promise<void> {
  await ensureProviderRatingsTable();
  await ensureIndexRatingCronRunsTable();
}

// =============================================================================
// ADVISORY LOCK
// =============================================================================

/**
 * Acquire advisory lock for cron job.
 * Prevents concurrent executions.
 * 
 * @returns true if lock acquired, false if already held
 */
export async function acquireAdvisoryLock(): Promise<boolean> {
  try {
    const result = await db()`
      SELECT pg_try_advisory_lock(${INDEX_RATING_ADVISORY_LOCK_ID}) AS acquired
    `;
    return result[0]?.acquired === true;
  } catch (error) {
    console.error('[Index Rating] Failed to acquire advisory lock:', error);
    return false;
  }
}

/**
 * Release advisory lock.
 */
export async function releaseAdvisoryLock(): Promise<void> {
  try {
    await db()`
      SELECT pg_advisory_unlock(${INDEX_RATING_ADVISORY_LOCK_ID})
    `;
  } catch (error) {
    console.error('[Index Rating] Failed to release advisory lock:', error);
  }
}

// =============================================================================
// RATING QUERIES
// =============================================================================

/**
 * Get rating for a single provider
 */
export async function getProviderRating(providerId: string): Promise<ProviderRating | null> {
  try {
    const result = await db()<ProviderRatingRow[]>`
      SELECT
        provider_id,
        current_rating,
        previous_rating,
        change,
        change_percent,
        current_rank,
        previous_rank,
        rank_changed_at,
        calculated_at
      FROM provider_ratings
      WHERE provider_id = ${providerId.toLowerCase().trim()}
    `;
    
    const row = result[0];
    if (!row) {
      return null;
    }
    
    return mapProviderRatingRow(row);
  } catch (error) {
    console.error('[Index Rating] Error fetching provider rating:', error);
    return null;
  }
}

/**
 * Get ratings for multiple providers (batch query)
 */
export async function getProviderRatings(
  providerIds: string[]
): Promise<Map<string, ProviderRating>> {
  if (providerIds.length === 0) {
    return new Map();
  }

  try {
    // Normalize IDs
    const normalizedIds = providerIds.map(id => id.toLowerCase().trim());
    
    const result = await db()<ProviderRatingRow[]>`
      SELECT
        provider_id,
        current_rating,
        previous_rating,
        change,
        change_percent,
        current_rank,
        previous_rank,
        rank_changed_at,
        calculated_at
      FROM provider_ratings
      WHERE provider_id = ANY(${normalizedIds})
    `;
    
    const map = new Map<string, ProviderRating>();
    for (const row of result) {
      const rating = mapProviderRatingRow(row);
      map.set(rating.providerId, rating);
    }
    
    return map;
  } catch (error) {
    console.error('[Index Rating] Error fetching provider ratings:', error);
    return new Map();
  }
}

/**
 * Get all provider ratings ordered by rank
 */
export async function getAllProviderRatings(): Promise<ProviderRating[]> {
  try {
    const result = await db()<ProviderRatingRow[]>`
      SELECT
        provider_id,
        current_rating,
        previous_rating,
        change,
        change_percent,
        current_rank,
        previous_rank,
        rank_changed_at,
        calculated_at
      FROM provider_ratings
      ORDER BY current_rating DESC
    `;
    
    return result.map(mapProviderRatingRow);
  } catch (error) {
    console.error('[Index Rating] Error fetching all provider ratings:', error);
    return [];
  }
}

// =============================================================================
// RATING UPSERT
// =============================================================================

/**
 * Upsert a provider rating (idempotent)
 */
export async function upsertProviderRating(
  providerId: string,
  currentRating: number,
  previousRating: number,
  change: number,
  changePercent: number,
  currentRank: number | null,
  previousRank: number | null,
  rankChangedAt: Date | null
): Promise<void> {
  const normalizedId = providerId.toLowerCase().trim();
  
  await db()`
    INSERT INTO provider_ratings (
      provider_id,
      current_rating,
      previous_rating,
      change,
      change_percent,
      current_rank,
      previous_rank,
      rank_changed_at,
      calculated_at
    ) VALUES (
      ${normalizedId},
      ${currentRating},
      ${previousRating},
      ${change},
      ${changePercent},
      ${currentRank},
      ${previousRank},
      ${rankChangedAt},
      NOW()
    )
    ON CONFLICT (provider_id)
    DO UPDATE SET
      current_rating = EXCLUDED.current_rating,
      previous_rating = EXCLUDED.previous_rating,
      change = EXCLUDED.change,
      change_percent = EXCLUDED.change_percent,
      current_rank = EXCLUDED.current_rank,
      previous_rank = EXCLUDED.previous_rank,
      rank_changed_at = EXCLUDED.rank_changed_at,
      calculated_at = EXCLUDED.calculated_at
  `;
}

/**
 * Seed a new provider with initial rating
 */
export async function seedProviderRating(
  providerId: string,
  seededRating: number
): Promise<void> {
  const normalizedId = providerId.toLowerCase().trim();
  
  await db()`
    INSERT INTO provider_ratings (
      provider_id,
      current_rating,
      previous_rating,
      change,
      change_percent,
      current_rank,
      previous_rank,
      rank_changed_at,
      calculated_at
    ) VALUES (
      ${normalizedId},
      ${seededRating},
      ${seededRating},
      0,
      0,
      NULL,
      NULL,
      NULL,
      NOW()
    )
    ON CONFLICT (provider_id) DO NOTHING
  `;
}

// =============================================================================
// EVENT QUERIES
// =============================================================================

/** Event row from database */
type EventRow = {
  event_type: string;
  created_at: Date | string;
};

/**
 * Get events for a provider within a time window.
 * Used for Elo calculation.
 * 
 * @param providerId - Provider ID
 * @param windowDays - Number of days to look back (default 180)
 * @returns List of rating events
 */
export async function getProviderEvents(
  providerId: string,
  windowDays: number = 180
): Promise<RatingEvent[]> {
  try {
    const normalizedId = providerId.toLowerCase().trim();
    
    const result = await db()<EventRow[]>`
      SELECT
        event_type,
        created_at
      FROM provider_activity_events
      WHERE provider_id = ${normalizedId}
        AND created_at >= NOW() - (${windowDays} || ' days')::interval
        AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
      ORDER BY created_at DESC
    `;
    
    return result.map((row) => ({
      eventType: row.event_type as IndexRatingEventType,
      createdAt: new Date(row.created_at),
      providerId: normalizedId,
    }));
  } catch (error) {
    console.error('[Index Rating] Error fetching provider events:', error);
    return [];
  }
}

/** Aggregated event row from database */
type AggEventRow = {
  provider_id: string;
  event_type: string;
  created_at: Date | string;
};

/**
 * Get all events across all providers within a time window.
 * Used for batch Elo calculation in cron job.
 */
export async function getAllProviderEvents(
  windowDays: number = 180
): Promise<Map<string, RatingEvent[]>> {
  try {
    const result = await db()<AggEventRow[]>`
      SELECT
        lower(trim(provider_id)) AS provider_id,
        event_type,
        created_at
      FROM provider_activity_events
      WHERE created_at >= NOW() - (${windowDays} || ' days')::interval
        AND event_type IN ('vote', 'open', 'click', 'prompt_builder_open', 'prompt_submit', 'social_click')
        AND provider_id IS NOT NULL
        AND trim(provider_id) <> ''
      ORDER BY provider_id, created_at DESC
    `;
    
    const map = new Map<string, RatingEvent[]>();
    
    for (const row of result) {
      const providerId = row.provider_id;
      if (!map.has(providerId)) {
        map.set(providerId, []);
      }
      map.get(providerId)!.push({
        eventType: row.event_type as IndexRatingEventType,
        createdAt: new Date(row.created_at),
        providerId,
      });
    }
    
    return map;
  } catch (error) {
    console.error('[Index Rating] Error fetching all provider events:', error);
    return new Map();
  }
}

// =============================================================================
// CRON RUN LOGGING
// =============================================================================

/**
 * Log a cron run
 */
export async function logCronRun(
  requestId: string,
  ok: boolean,
  message: string,
  providersUpdated: number,
  durationMs: number
): Promise<void> {
  try {
    await db()`
      INSERT INTO index_rating_cron_runs (
        id,
        ran_at,
        ok,
        message,
        providers_updated,
        duration_ms
      ) VALUES (
        ${requestId},
        NOW(),
        ${ok},
        ${message},
        ${providersUpdated},
        ${durationMs}
      )
    `;
  } catch (error) {
    console.error('[Index Rating] Error logging cron run:', error);
  }
}

/**
 * Get the last cron run info
 */
export async function getLastCronRun(): Promise<IndexRatingCronRun | null> {
  try {
    const result = await db()<IndexRatingCronRunRow[]>`
      SELECT
        id,
        ran_at,
        ok,
        message,
        providers_updated,
        duration_ms
      FROM index_rating_cron_runs
      ORDER BY ran_at DESC
      LIMIT 1
    `;
    
    const row = result[0];
    if (!row) {
      return null;
    }
    
    return mapCronRunRow(row);
  } catch (error) {
    console.error('[Index Rating] Error fetching last cron run:', error);
    return null;
  }
}

// =============================================================================
// STALENESS CHECK
// =============================================================================

/**
 * Check if rating data is stale
 */
export function isStale(calculatedAt: Date | null | undefined): boolean {
  if (!calculatedAt) {
    return true;
  }
  
  const now = new Date();
  const hoursSinceCalculation = 
    (now.getTime() - calculatedAt.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceCalculation > INDEX_RATING_STALE_HOURS;
}

// =============================================================================
// ROW MAPPERS
// =============================================================================

/**
 * Map database row to ProviderRating type
 */
function mapProviderRatingRow(row: ProviderRatingRow): ProviderRating {
  return {
    providerId: row.provider_id,
    currentRating: parseFloat(String(row.current_rating)),
    previousRating: parseFloat(String(row.previous_rating)),
    change: parseFloat(String(row.change)),
    changePercent: parseFloat(String(row.change_percent)),
    currentRank: row.current_rank,
    previousRank: row.previous_rank,
    rankChangedAt: row.rank_changed_at ? new Date(row.rank_changed_at) : null,
    calculatedAt: new Date(row.calculated_at),
  };
}

/**
 * Map database row to IndexRatingCronRun type
 */
function mapCronRunRow(row: IndexRatingCronRunRow): IndexRatingCronRun {
  return {
    id: row.id,
    ranAt: new Date(row.ran_at),
    ok: row.ok,
    message: row.message,
    providersUpdated: parseInt(String(row.providers_updated), 10),
    durationMs: parseInt(String(row.duration_ms), 10),
  };
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Check database health for Index Rating system
 */
export async function checkIndexRatingHealth(): Promise<{
  connected: boolean;
  tablesExist: boolean;
  ratingsCount: number;
  lastCronRun: IndexRatingCronRun | null;
}> {
  try {
    // Check connection
    await db()`SELECT 1`;
    
    // Check tables
    const tableCheck = await db()<{ ratings_exists: boolean; cron_runs_exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'provider_ratings'
      ) AS ratings_exists,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'index_rating_cron_runs'
      ) AS cron_runs_exists
    `;
    
    const tablesExist = 
      tableCheck[0]?.ratings_exists === true &&
      tableCheck[0]?.cron_runs_exists === true;
    
    // Get ratings count
    let ratingsCount = 0;
    if (tablesExist) {
      const countResult = await db()<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM provider_ratings`;
      ratingsCount = countResult[0]?.count || 0;
    }
    
    // Get last cron run
    const lastCronRun = tablesExist ? await getLastCronRun() : null;
    
    return {
      connected: true,
      tablesExist,
      ratingsCount,
      lastCronRun,
    };
  } catch (error) {
    console.error('[Index Rating] Health check failed:', error);
    return {
      connected: false,
      tablesExist: false,
      ratingsCount: 0,
      lastCronRun: null,
    };
  }
}
