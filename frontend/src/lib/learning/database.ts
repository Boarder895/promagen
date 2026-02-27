// src/lib/learning/database.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Database Operations
// ============================================================================
//
// Secure database operations for the learning pipeline.
// All queries use parameterized statements (postgres tagged templates).
// Follows the index-rating/database.ts pattern.
//
// Tables managed:
// - prompt_events        — Raw telemetry from high-quality prompts
// - learned_weights      — JSON weight files produced by nightly cron
// - learning_cron_runs   — Observability log for cron executions
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.4, § 11
//
// Version: 2.1.0 — Phase 7.1a confidence columns + anti-pattern query
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import 'server-only';

import { db } from '@/lib/db';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ============================================================================
// TABLE CREATION (AUTO-MIGRATION)
// ============================================================================

/**
 * Create prompt_events table if not exists.
 * Called by the telemetry endpoint and the cron job on startup.
 */
export async function ensurePromptEventsTable(): Promise<void> {
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS prompt_events (
      id              TEXT        NOT NULL PRIMARY KEY,
      session_id      TEXT        NOT NULL,
      attempt_number  SMALLINT    NOT NULL DEFAULT 1,
      selections      JSONB       NOT NULL,
      category_count  SMALLINT    NOT NULL,
      char_length     SMALLINT    NOT NULL,
      score           SMALLINT    NOT NULL,
      score_factors   JSONB       NOT NULL,
      platform        TEXT        NOT NULL,
      tier            SMALLINT    NOT NULL,
      scene_used      TEXT,
      outcome         JSONB       NOT NULL DEFAULT '{}',
      user_tier       TEXT,
      account_age_days SMALLINT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Index for nightly aggregation: filter by score + tier, sort by time
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_events_aggregation
    ON prompt_events (tier, score, created_at)
  `;

  // Index for sequence pattern analysis (group by session, order by attempt)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_events_session
    ON prompt_events (session_id, attempt_number)
  `;

  // Index for platform-specific learning
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_events_platform
    ON prompt_events (platform, created_at)
  `;
}

/**
 * Create learned_weights table if not exists.
 * Stores the JSON outputs from the nightly aggregation cron.
 * Keys: 'co-occurrence', 'sequences', 'scene-candidates'
 */
export async function ensureLearnedWeightsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS learned_weights (
      key         TEXT        NOT NULL PRIMARY KEY,
      data        JSONB       NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

/**
 * Create learning_cron_runs table if not exists.
 * Observability log — one row per cron execution.
 */
export async function ensureLearningCronRunsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS learning_cron_runs (
      id                 TEXT        NOT NULL PRIMARY KEY,
      ran_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ok                 BOOLEAN     NOT NULL,
      message            TEXT,
      events_processed   BIGINT      NOT NULL DEFAULT 0,
      pairs_generated    BIGINT      NOT NULL DEFAULT 0,
      candidates_found   BIGINT      NOT NULL DEFAULT 0,
      duration_ms        BIGINT      NOT NULL DEFAULT 0
    )
  `;
}

/**
 * Ensure all required tables exist.
 * Idempotent — safe to call on every cold start.
 */
export async function ensureAllTables(): Promise<void> {
  await ensurePromptEventsTable();
  await ensureLearnedWeightsTable();
  await ensureLearningCronRunsTable();
}

// ============================================================================
// ADVISORY LOCK
// ============================================================================

/**
 * Acquire advisory lock for aggregation cron.
 * Prevents concurrent executions.
 *
 * @returns true if lock acquired, false if already held
 */
export async function acquireAggregationLock(): Promise<boolean> {
  try {
    const result = await db()`
      SELECT pg_try_advisory_lock(${LEARNING_CONSTANTS.AGGREGATION_ADVISORY_LOCK_ID}) AS acquired
    `;
    return result[0]?.acquired === true;
  } catch (error) {
    console.error('[Learning] Failed to acquire advisory lock:', error);
    return false;
  }
}

/**
 * Release advisory lock.
 */
export async function releaseAggregationLock(): Promise<void> {
  try {
    await db()`
      SELECT pg_advisory_unlock(${LEARNING_CONSTANTS.AGGREGATION_ADVISORY_LOCK_ID})
    `;
  } catch (error) {
    console.error('[Learning] Failed to release advisory lock:', error);
  }
}

// ============================================================================
// PROMPT EVENT QUERIES
// ============================================================================

/** Row shape returned by prompt_events queries */
export interface PromptEventRow {
  id: string;
  session_id: string;
  attempt_number: number;
  selections: Record<string, string[]>;
  category_count: number;
  char_length: number;
  score: number;
  score_factors: Record<string, number>;
  platform: string;
  tier: number;
  scene_used: string | null;
  outcome: Record<string, boolean>;
  /** User subscription tier ('free' | 'paid'), null/undefined for old events */
  user_tier?: string | null;
  /** Days since account creation at event time, null/undefined for old events */
  account_age_days?: number | null;
  created_at: Date | string;
}

/**
 * Count total qualifying prompt events.
 * "Qualifying" means score >= threshold and category_count >= minimum.
 */
export async function countQualifyingEvents(): Promise<number> {
  try {
    const result = await db()<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM prompt_events
      WHERE score >= ${LEARNING_CONSTANTS.SCORE_THRESHOLD}
        AND category_count >= ${LEARNING_CONSTANTS.MIN_CATEGORIES}
    `;
    return parseInt(result[0]?.count ?? '0', 10);
  } catch (error) {
    console.error('[Learning] Error counting qualifying events:', error);
    return 0;
  }
}

/**
 * Fetch qualifying events within a time window for aggregation.
 * Returns events ordered by created_at DESC (newest first).
 *
 * @param windowDays — How far back to look (default: 180 = 6 months)
 * @param limit — Max rows to fetch (default: AGGREGATION_BATCH_SIZE)
 * @param offset — Pagination offset (default: 0)
 */
export async function fetchQualifyingEvents(
  windowDays: number = 180,
  limit: number = LEARNING_CONSTANTS.AGGREGATION_BATCH_SIZE,
  offset: number = 0,
): Promise<PromptEventRow[]> {
  try {
    const result = await db()<PromptEventRow[]>`
      SELECT
        id, session_id, attempt_number, selections, category_count,
        char_length, score, score_factors, platform, tier,
        scene_used, outcome, user_tier, account_age_days, created_at
      FROM prompt_events
      WHERE score >= ${LEARNING_CONSTANTS.SCORE_THRESHOLD}
        AND category_count >= ${LEARNING_CONSTANTS.MIN_CATEGORIES}
        AND created_at >= NOW() - (${windowDays} || ' days')::interval
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    return result;
  } catch (error) {
    console.error('[Learning] Error fetching qualifying events:', error);
    return [];
  }
}

/**
 * Fetch ALL events (including low-scoring ones) for anti-pattern analysis.
 *
 * Unlike fetchQualifyingEvents, this has NO score floor — anti-pattern
 * detection needs the bad prompts to learn what kills quality.
 * Still respects time window and a minimum category count to filter junk.
 *
 * @param windowDays — How far back to look (default: 180 = 6 months)
 * @param limit — Max rows to fetch (default: AGGREGATION_BATCH_SIZE)
 * @param offset — Pagination offset (default: 0)
 */
export async function fetchAllEventsForAntiPatterns(
  windowDays: number = 180,
  limit: number = LEARNING_CONSTANTS.AGGREGATION_BATCH_SIZE,
  offset: number = 0,
): Promise<PromptEventRow[]> {
  try {
    const result = await db()<PromptEventRow[]>`
      SELECT
        id, session_id, attempt_number, selections, category_count,
        char_length, score, score_factors, platform, tier,
        scene_used, outcome, user_tier, account_age_days, created_at
      FROM prompt_events
      WHERE category_count >= ${LEARNING_CONSTANTS.ANTI_PATTERN_MIN_CATEGORIES}
        AND created_at >= NOW() - (${windowDays} || ' days')::interval
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    return result;
  } catch (error) {
    console.error('[Learning] Error fetching events for anti-pattern analysis:', error);
    return [];
  }
}

// ============================================================================
// LEARNED WEIGHTS STORAGE
// ============================================================================

/**
 * Upsert a learned weights JSON blob.
 *
 * @param key — One of: 'co-occurrence', 'sequences', 'scene-candidates'
 * @param data — The JSON payload to store
 */
export async function upsertLearnedWeights(
  key: string,
  data: unknown,
): Promise<void> {
  await db()`
    INSERT INTO learned_weights (key, data, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (key)
    DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  `;
}

/**
 * Fetch a learned weights JSON blob by key.
 *
 * @param key — One of: 'co-occurrence', 'sequences', 'scene-candidates'
 * @returns The parsed JSON data, or null if not found
 */
export async function getLearnedWeights<T = unknown>(
  key: string,
): Promise<{ data: T; updatedAt: string } | null> {
  try {
    const result = await db()<{ data: T; updated_at: string }[]>`
      SELECT data, updated_at
      FROM learned_weights
      WHERE key = ${key}
    `;
    const row = result[0];
    if (!row) return null;
    return { data: row.data, updatedAt: String(row.updated_at) };
  } catch (error) {
    console.error(`[Learning] Error fetching weights for key="${key}":`, error);
    return null;
  }
}

// ============================================================================
// CRON RUN LOGGING
// ============================================================================

/**
 * Log a cron execution for observability.
 */
export async function logCronRun(
  requestId: string,
  ok: boolean,
  message: string,
  eventsProcessed: number,
  pairsGenerated: number,
  candidatesFound: number,
  durationMs: number,
): Promise<void> {
  try {
    await db()`
      INSERT INTO learning_cron_runs (
        id, ran_at, ok, message,
        events_processed, pairs_generated, candidates_found, duration_ms
      ) VALUES (
        ${requestId}, NOW(), ${ok}, ${message},
        ${eventsProcessed}, ${pairsGenerated}, ${candidatesFound}, ${durationMs}
      )
    `;
  } catch (error) {
    console.error('[Learning] Error logging cron run:', error);
  }
}

/**
 * Get the last cron run for observability.
 */
export async function getLastCronRun(): Promise<{
  id: string;
  ranAt: string;
  ok: boolean;
  message: string | null;
  eventsProcessed: number;
  pairsGenerated: number;
  candidatesFound: number;
  durationMs: number;
} | null> {
  try {
    const result = await db()<{
      id: string;
      ran_at: string;
      ok: boolean;
      message: string | null;
      events_processed: string;
      pairs_generated: string;
      candidates_found: string;
      duration_ms: string;
    }[]>`
      SELECT *
      FROM learning_cron_runs
      ORDER BY ran_at DESC
      LIMIT 1
    `;
    const row = result[0];
    if (!row) return null;
    return {
      id: row.id,
      ranAt: String(row.ran_at),
      ok: row.ok,
      message: row.message,
      eventsProcessed: parseInt(row.events_processed, 10),
      pairsGenerated: parseInt(row.pairs_generated, 10),
      candidatesFound: parseInt(row.candidates_found, 10),
      durationMs: parseInt(row.duration_ms, 10),
    };
  } catch (error) {
    console.error('[Learning] Error fetching last cron run:', error);
    return null;
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check database health for the learning pipeline.
 * Used by the admin migration endpoint.
 */
export async function checkLearningHealth(): Promise<{
  connected: boolean;
  tables: {
    prompt_events: boolean;
    learned_weights: boolean;
    learning_cron_runs: boolean;
  };
  eventCount: number;
  qualifyingCount: number;
  lastCronRun: Awaited<ReturnType<typeof getLastCronRun>>;
}> {
  try {
    await db()`SELECT 1`;

    const tableCheck = await db()<{
      prompt_events: boolean;
      learned_weights: boolean;
      learning_cron_runs: boolean;
    }[]>`
      SELECT
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prompt_events') AS prompt_events,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'learned_weights') AS learned_weights,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'learning_cron_runs') AS learning_cron_runs
    `;

    const tables = tableCheck[0] ?? {
      prompt_events: false,
      learned_weights: false,
      learning_cron_runs: false,
    };

    let eventCount = 0;
    let qualifyingCount = 0;
    if (tables.prompt_events) {
      const total = await db()<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM prompt_events
      `;
      eventCount = parseInt(total[0]?.count ?? '0', 10);
      qualifyingCount = await countQualifyingEvents();
    }

    const lastCronRun = tables.learning_cron_runs ? await getLastCronRun() : null;

    return {
      connected: true,
      tables,
      eventCount,
      qualifyingCount,
      lastCronRun,
    };
  } catch (error) {
    console.error('[Learning] Health check failed:', error);
    return {
      connected: false,
      tables: { prompt_events: false, learned_weights: false, learning_cron_runs: false },
      eventCount: 0,
      qualifyingCount: 0,
      lastCronRun: null,
    };
  }
}
