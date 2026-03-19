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
// - feedback_events      — Direct user feedback (👍👌👎) linked to prompt events
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.4, § 11, § 7.10
//
// Version: 2.4.0 — Phase 7.10h Dashboard query helpers
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import 'server-only';

import { db } from '@/lib/db';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

import type { ABTest, ABTestEventCounts, ABTestResult } from '@/lib/learning/ab-testing';
import type { FeedbackRating } from '@/types/feedback';

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

  // ── A/B testing columns (Phase 7.6c) ─────────────────────────────
  // Three nullable columns — old events without these fields still work fine.
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS ab_hash TEXT`;
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS test_id TEXT`;
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS variant TEXT`;

  // Partial index: only events that belong to an A/B test (test_id IS NOT NULL)
  await sql`
    CREATE INDEX IF NOT EXISTS idx_prompt_events_ab_test
    ON prompt_events (test_id, variant) WHERE test_id IS NOT NULL
  `;

  // ── Feedback columns (Phase 7.10a) ─────────────────────────────────
  // Denormalized feedback data on prompt_events for efficient JOIN-free
  // queries in the 17 existing cron layers. Full event detail lives in
  // the dedicated feedback_events table.
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS feedback_rating TEXT`;
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS feedback_credibility REAL`;

  // ── Conversion telemetry (Part 8) ──────────────────────────────────
  // JSONB column storing budget-aware conversion outcome summary.
  // Nullable — old events and events without conversions have null.
  await sql`ALTER TABLE prompt_events ADD COLUMN IF NOT EXISTS conversion_meta JSONB`;
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
 * Create ab_tests table if not exists.
 * Stores A/B test definitions and results (Phase 7.6c).
 *
 * Design constraint: At most ONE test can have status = 'running' at a time.
 * Enforced in application logic (check before insert), not as a DB constraint,
 * to allow concurrent reads.
 */
export async function ensureABTestsTable(): Promise<void> {
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS ab_tests (
      id                TEXT        NOT NULL PRIMARY KEY,
      name              TEXT        NOT NULL,
      status            TEXT        NOT NULL DEFAULT 'running',
      control_weights   JSONB       NOT NULL,
      variant_weights   JSONB       NOT NULL,
      split_pct         SMALLINT    NOT NULL DEFAULT 50,
      min_events        SMALLINT    NOT NULL DEFAULT 200,
      max_duration_days SMALLINT    NOT NULL DEFAULT 14,
      started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at          TIMESTAMPTZ,
      peek_count        SMALLINT    NOT NULL DEFAULT 0,
      result_summary    JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Quick lookup for the currently running test
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ab_tests_running
    ON ab_tests (status) WHERE status = 'running'
  `;
}

/**
 * Create feedback_events table if not exists.
 * Stores direct user feedback (👍👌👎) linked to prompt events.
 *
 * Phase 7.10a — one row per feedback event. Idempotent per prompt_event_id
 * (enforced at API level via ON CONFLICT, not DB constraint, to allow
 * the dual-write to prompt_events without transaction overhead).
 *
 * GDPR posture: No user IDs, no IPs. user_tier and account_age_days are
 * aggregated demographic signals, not PII.
 */
export async function ensureFeedbackEventsTable(): Promise<void> {
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS feedback_events (
      id                  TEXT        NOT NULL PRIMARY KEY,
      prompt_event_id     TEXT        NOT NULL,
      rating              TEXT        NOT NULL,
      credibility_score   REAL        NOT NULL,
      credibility_factors JSONB       NOT NULL DEFAULT '{}',
      response_time_ms    BIGINT      NOT NULL DEFAULT 0,
      user_tier           TEXT,
      account_age_days    SMALLINT,
      platform            TEXT        NOT NULL,
      tier                SMALLINT    NOT NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Join back to prompt_events for cron aggregation
  await sql`
    CREATE INDEX IF NOT EXISTS idx_feedback_events_prompt
    ON feedback_events (prompt_event_id)
  `;

  // Time-based queries for cron windowed aggregation
  await sql`
    CREATE INDEX IF NOT EXISTS idx_feedback_events_created
    ON feedback_events (created_at)
  `;

  // Platform + tier for per-platform satisfaction scores
  await sql`
    CREATE INDEX IF NOT EXISTS idx_feedback_events_platform
    ON feedback_events (platform, tier, created_at)
  `;

  // Unique constraint: one feedback per prompt event (idempotency)
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_events_unique_prompt
    ON feedback_events (prompt_event_id)
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
  await ensureABTestsTable();
  await ensureFeedbackEventsTable();
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
  /** Stable anonymous browser UUID for A/B assignment (Phase 7.6) */
  ab_hash?: string | null;
  /** Active A/B test ID at time of event (Phase 7.6) */
  test_id?: string | null;
  /** Assigned variant: 'A' (control) or 'B' (variant) (Phase 7.6) */
  variant?: string | null;
  /** Direct user feedback rating: 'positive' | 'neutral' | 'negative' (Phase 7.10) */
  feedback_rating?: string | null;
  /** Credibility-weighted trust score for this feedback (0.40–1.80) (Phase 7.10) */
  feedback_credibility?: number | null;
  /** Budget-aware conversion outcome summary (Part 8) */
  conversion_meta?: {
    fidelityConverted: number;
    fidelityDeferred: number;
    negativesConverted: number;
    negativesDeferred: number;
    budgetCeiling: number;
    budgetRemaining: number;
    parametricCount: number;
  } | null;
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
        scene_used, outcome, user_tier, account_age_days,
        feedback_rating, feedback_credibility, conversion_meta, created_at
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
        scene_used, outcome, user_tier, account_age_days,
        feedback_rating, feedback_credibility, conversion_meta, created_at
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
    ab_tests: boolean;
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
      ab_tests: boolean;
    }[]>`
      SELECT
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prompt_events') AS prompt_events,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'learned_weights') AS learned_weights,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'learning_cron_runs') AS learning_cron_runs,
        EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ab_tests') AS ab_tests
    `;

    const tables = tableCheck[0] ?? {
      prompt_events: false,
      learned_weights: false,
      learning_cron_runs: false,
      ab_tests: false,
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
      tables: { prompt_events: false, learned_weights: false, learning_cron_runs: false, ab_tests: false },
      eventCount: 0,
      qualifyingCount: 0,
      lastCronRun: null,
    };
  }
}

// ============================================================================
// A/B TEST CRUD (Phase 7.6c)
// ============================================================================

/** Row shape returned by ab_tests queries (snake_case from Postgres). */
interface ABTestRow {
  id: string;
  name: string;
  status: string;
  control_weights: Record<string, number>;
  variant_weights: Record<string, number>;
  split_pct: number;
  min_events: number;
  max_duration_days: number;
  started_at: string;
  ended_at: string | null;
  peek_count: number;
  result_summary: ABTestResult | null;
}

/** Convert a Postgres snake_case row to our camelCase ABTest interface. */
function rowToABTest(row: ABTestRow): ABTest {
  return {
    id: row.id,
    name: row.name,
    status: row.status as ABTest['status'],
    controlWeights: row.control_weights,
    variantWeights: row.variant_weights,
    splitPct: Number(row.split_pct),
    minEvents: Number(row.min_events),
    maxDurationDays: Number(row.max_duration_days),
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    peekCount: Number(row.peek_count),
    resultSummary: row.result_summary,
  };
}

/**
 * Insert a new A/B test.
 * Checks that no other test is currently running (at-most-one invariant).
 * Throws if a running test already exists.
 */
export async function insertABTest(test: ABTest): Promise<void> {
  const sql = db();

  // Enforce at-most-one running test
  const running = await sql<ABTestRow[]>`
    SELECT id FROM ab_tests WHERE status = 'running' LIMIT 1
  `;
  if (running.length > 0) {
    throw new Error(
      `Cannot create A/B test: test "${running[0]!.id}" is already running`,
    );
  }

  await sql`
    INSERT INTO ab_tests (
      id, name, status, control_weights, variant_weights,
      split_pct, min_events, max_duration_days, started_at,
      ended_at, peek_count, result_summary
    ) VALUES (
      ${test.id},
      ${test.name},
      ${test.status},
      ${JSON.stringify(test.controlWeights)},
      ${JSON.stringify(test.variantWeights)},
      ${test.splitPct},
      ${test.minEvents},
      ${test.maxDurationDays},
      ${test.startedAt},
      ${test.endedAt},
      ${test.peekCount},
      ${test.resultSummary ? JSON.stringify(test.resultSummary) : null}
    )
  `;
}

/**
 * Get the currently running A/B test (at most one).
 * Returns null if no test is running.
 */
export async function getRunningABTest(): Promise<ABTest | null> {
  try {
    const rows = await db()<ABTestRow[]>`
      SELECT * FROM ab_tests WHERE status = 'running' LIMIT 1
    `;
    if (rows.length === 0) return null;
    return rowToABTest(rows[0]!);
  } catch (error) {
    console.error('[Learning] Error fetching running A/B test:', error);
    return null;
  }
}

/**
 * Get all A/B tests (for admin), ordered by created_at desc.
 *
 * @param limit — Max rows to return (default: 50)
 */
export async function getAllABTests(limit: number = 50): Promise<ABTest[]> {
  try {
    const rows = await db()<ABTestRow[]>`
      SELECT * FROM ab_tests ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map(rowToABTest);
  } catch (error) {
    console.error('[Learning] Error fetching all A/B tests:', error);
    return [];
  }
}

/**
 * Update test status, endedAt, and resultSummary when a test concludes.
 * Also increments peek_count for observability.
 */
export async function updateABTestResult(
  testId: string,
  status: 'promoted' | 'rolled_back',
  resultSummary: ABTestResult,
): Promise<void> {
  await db()`
    UPDATE ab_tests
    SET status = ${status},
        ended_at = NOW(),
        result_summary = ${JSON.stringify(resultSummary)}
    WHERE id = ${testId}
  `;
}

/**
 * Increment the peek_count for a running test (called after each evaluation).
 */
export async function incrementPeekCount(testId: string): Promise<void> {
  await db()`
    UPDATE ab_tests
    SET peek_count = peek_count + 1
    WHERE id = ${testId}
  `;
}

/**
 * Count events per variant for a running test.
 * Aggregates from prompt_events where test_id matches.
 *
 * Uses FILTER clause for efficient single-pass aggregation.
 */
export async function countABTestEvents(
  testId: string,
): Promise<ABTestEventCounts> {
  try {
    const rows = await db()<{
      control_events: string;
      variant_events: string;
      control_copies: string;
      variant_copies: string;
      control_saves: string;
      variant_saves: string;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE variant = 'A')::text AS control_events,
        COUNT(*) FILTER (WHERE variant = 'B')::text AS variant_events,
        COUNT(*) FILTER (WHERE variant = 'A' AND (outcome->>'copied')::boolean = true)::text AS control_copies,
        COUNT(*) FILTER (WHERE variant = 'B' AND (outcome->>'copied')::boolean = true)::text AS variant_copies,
        COUNT(*) FILTER (WHERE variant = 'A' AND (outcome->>'saved')::boolean = true)::text AS control_saves,
        COUNT(*) FILTER (WHERE variant = 'B' AND (outcome->>'saved')::boolean = true)::text AS variant_saves
      FROM prompt_events
      WHERE test_id = ${testId}
    `;

    const row = rows[0];
    if (!row) {
      return {
        controlEvents: 0, variantEvents: 0,
        controlCopies: 0, variantCopies: 0,
        controlSaves: 0, variantSaves: 0,
      };
    }

    return {
      controlEvents: parseInt(row.control_events, 10),
      variantEvents: parseInt(row.variant_events, 10),
      controlCopies: parseInt(row.control_copies, 10),
      variantCopies: parseInt(row.variant_copies, 10),
      controlSaves: parseInt(row.control_saves, 10),
      variantSaves: parseInt(row.variant_saves, 10),
    };
  } catch (error) {
    console.error('[Learning] Error counting A/B test events:', error);
    return {
      controlEvents: 0, variantEvents: 0,
      controlCopies: 0, variantCopies: 0,
      controlSaves: 0, variantSaves: 0,
    };
  }
}

// ============================================================================
// FEEDBACK EVENT QUERIES (Phase 7.10)
// ============================================================================

/** Row shape returned by feedback_events queries */
export interface FeedbackEventRow {
  id: string;
  prompt_event_id: string;
  rating: string;
  credibility_score: number;
  credibility_factors: Record<string, number>;
  response_time_ms: number;
  user_tier: string | null;
  account_age_days: number | null;
  platform: string;
  tier: number;
  created_at: Date | string;
}

/**
 * Insert a feedback event and update the parent prompt_events row.
 *
 * Dual-write pattern:
 * 1. INSERT into feedback_events (full detail for admin + cron)
 * 2. UPDATE prompt_events set feedback_rating + feedback_credibility (denormalized for JOIN-free cron queries)
 *
 * Idempotent: ON CONFLICT (prompt_event_id) DO NOTHING — one feedback per prompt event.
 *
 * @returns true if inserted, false if already exists (idempotent)
 */
export async function insertFeedbackEvent(event: {
  id: string;
  promptEventId: string;
  rating: FeedbackRating;
  credibilityScore: number;
  credibilityFactors: Record<string, number>;
  responseTimeMs: number;
  userTier: string | null;
  accountAgeDays: number | null;
  platform: string;
  tier: number;
}): Promise<boolean> {
  try {
    const sql = db();

    // 1. Insert into feedback_events (idempotent via unique index)
    const result = await sql`
      INSERT INTO feedback_events (
        id, prompt_event_id, rating, credibility_score,
        credibility_factors, response_time_ms, user_tier,
        account_age_days, platform, tier
      ) VALUES (
        ${event.id},
        ${event.promptEventId},
        ${event.rating},
        ${event.credibilityScore},
        ${JSON.stringify(event.credibilityFactors)},
        ${event.responseTimeMs},
        ${event.userTier},
        ${event.accountAgeDays},
        ${event.platform},
        ${event.tier}
      )
      ON CONFLICT (prompt_event_id) DO NOTHING
    `;

    // If nothing was inserted (duplicate), skip the denormalized update
    if (result.count === 0) {
      return false;
    }

    // 2. Denormalize feedback onto prompt_events for JOIN-free cron queries
    await sql`
      UPDATE prompt_events
      SET feedback_rating = ${event.rating},
          feedback_credibility = ${event.credibilityScore}
      WHERE id = ${event.promptEventId}
    `;

    return true;
  } catch (error) {
    console.error('[Learning] Error inserting feedback event:', error);
    return false;
  }
}

/**
 * Fetch recent feedback events for a time window (used by Layer 18 cron).
 *
 * @param afterDate — Only events created after this date
 * @param limit — Max rows to return
 */
export async function fetchRecentFeedbackEvents(
  afterDate: Date,
  limit: number = 10_000,
): Promise<FeedbackEventRow[]> {
  try {
    const rows = await db()<FeedbackEventRow[]>`
      SELECT *
      FROM feedback_events
      WHERE created_at > ${afterDate}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows;
  } catch (error) {
    console.error('[Learning] Error fetching recent feedback events:', error);
    return [];
  }
}

/**
 * Count feedback events by rating for a given platform + time window.
 * Used by the admin dashboard Feedback Pulse widget.
 */
export async function countFeedbackByRating(
  afterDate: Date,
  platform?: string,
): Promise<{ positive: number; neutral: number; negative: number; total: number }> {
  try {
    const sql = db();

    const rows = platform
      ? await sql<{ rating: string; count: string }[]>`
          SELECT rating, COUNT(*)::text AS count
          FROM feedback_events
          WHERE created_at > ${afterDate}
            AND platform = ${platform}
          GROUP BY rating
        `
      : await sql<{ rating: string; count: string }[]>`
          SELECT rating, COUNT(*)::text AS count
          FROM feedback_events
          WHERE created_at > ${afterDate}
          GROUP BY rating
        `;

    let positive = 0, neutral = 0, negative = 0;
    for (const row of rows) {
      const c = parseInt(row.count, 10);
      if (row.rating === 'positive') positive = c;
      else if (row.rating === 'neutral') neutral = c;
      else if (row.rating === 'negative') negative = c;
    }

    return { positive, neutral, negative, total: positive + neutral + negative };
  } catch (error) {
    console.error('[Learning] Error counting feedback by rating:', error);
    return { positive: 0, neutral: 0, negative: 0, total: 0 };
  }
}

// ============================================================================
// Phase 7.10h — Dashboard query helpers
// ============================================================================

/**
 * Daily feedback counts for the last N days.
 * Used by Feedback Pulse Dashboard sparkline.
 */
export async function fetchDailyFeedbackCounts(
  days: number = 14,
): Promise<{ date: string; positive: number; neutral: number; negative: number }[]> {
  try {
    const sql = db();
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);

    const rows = await sql<{ day: string; rating: string; count: string }[]>`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
        rating,
        COUNT(*)::text AS count
      FROM feedback_events
      WHERE created_at > ${afterDate}
      GROUP BY day, rating
      ORDER BY day ASC
    `;

    const dayMap = new Map<string, { date: string; positive: number; neutral: number; negative: number }>();
    for (const row of rows) {
      if (!dayMap.has(row.day)) {
        dayMap.set(row.day, { date: row.day, positive: 0, neutral: 0, negative: 0 });
      }
      const entry = dayMap.get(row.day)!;
      const c = parseInt(row.count, 10);
      if (row.rating === 'positive') entry.positive = c;
      else if (row.rating === 'neutral') entry.neutral = c;
      else if (row.rating === 'negative') entry.negative = c;
    }
    return Array.from(dayMap.values());
  } catch (error) {
    console.error('[Learning] Error fetching daily feedback counts:', error);
    return [];
  }
}

/**
 * Credibility-weighted satisfaction per platform.
 * Formula: Σ(ratingValue × credibility) / Σ(credibility) × 100
 * Where positive=1, neutral=0.5, negative=0
 */
export async function fetchPlatformSatisfaction(
  afterDate: Date,
): Promise<{ platform: string; score: number; eventCount: number }[]> {
  try {
    const sql = db();
    const rows = await sql<{
      platform: string;
      rating: string;
      credibility_score: number;
    }[]>`
      SELECT platform, rating, credibility_score
      FROM feedback_events
      WHERE created_at > ${afterDate}
      ORDER BY platform
    `;

    const platformMap = new Map<string, { weightedSum: number; totalWeight: number; count: number }>();
    for (const row of rows) {
      if (!platformMap.has(row.platform)) {
        platformMap.set(row.platform, { weightedSum: 0, totalWeight: 0, count: 0 });
      }
      const entry = platformMap.get(row.platform)!;
      const ratingValue = row.rating === 'positive' ? 1 : row.rating === 'neutral' ? 0.5 : 0;
      const cred = row.credibility_score ?? 1;
      entry.weightedSum += ratingValue * cred;
      entry.totalWeight += cred;
      entry.count++;
    }

    const results: { platform: string; score: number; eventCount: number }[] = [];
    for (const [platform, data] of platformMap) {
      const score = data.totalWeight > 0
        ? Math.round((data.weightedSum / data.totalWeight) * 100)
        : 0;
      results.push({ platform, score, eventCount: data.count });
    }
    return results.sort((a, b) => b.eventCount - a.eventCount);
  } catch (error) {
    console.error('[Learning] Error fetching platform satisfaction:', error);
    return [];
  }
}

// ============================================================================
// Part 8 Improvement 1: Conversion Success Rate Dashboard Query
// ============================================================================

/** Aggregated conversion stats per platform */
export interface ConversionDashboardRow {
  platform: string;
  tier: number;
  eventCount: number;
  avgFidelityConverted: number;
  avgFidelityDeferred: number;
  avgNegativesConverted: number;
  avgNegativesDeferred: number;
  avgBudgetCeiling: number;
  avgBudgetRemaining: number;
  avgParametricCount: number;
  /** Conversion success rate: converted / (converted + deferred), 0–1 */
  successRate: number;
}

/**
 * Fetch aggregated conversion stats grouped by platform + tier.
 * Powers the admin dashboard showing which platforms have the tightest
 * conversion budgets and where deferrals are most common.
 *
 * @param windowDays — How far back to look (default: 90 days)
 * @returns Sorted by eventCount descending (busiest platforms first)
 */
export async function fetchConversionDashboard(
  windowDays: number = 90,
): Promise<ConversionDashboardRow[]> {
  try {
    const result = await db()<Array<{
      platform: string;
      tier: number;
      event_count: string;
      avg_fidelity_converted: string;
      avg_fidelity_deferred: string;
      avg_negatives_converted: string;
      avg_negatives_deferred: string;
      avg_budget_ceiling: string;
      avg_budget_remaining: string;
      avg_parametric_count: string;
    }>>`
      SELECT
        platform,
        tier,
        COUNT(*)::text AS event_count,
        ROUND(AVG((conversion_meta->>'fidelityConverted')::numeric), 2)::text AS avg_fidelity_converted,
        ROUND(AVG((conversion_meta->>'fidelityDeferred')::numeric), 2)::text AS avg_fidelity_deferred,
        ROUND(AVG((conversion_meta->>'negativesConverted')::numeric), 2)::text AS avg_negatives_converted,
        ROUND(AVG((conversion_meta->>'negativesDeferred')::numeric), 2)::text AS avg_negatives_deferred,
        ROUND(AVG((conversion_meta->>'budgetCeiling')::numeric), 1)::text AS avg_budget_ceiling,
        ROUND(AVG((conversion_meta->>'budgetRemaining')::numeric), 1)::text AS avg_budget_remaining,
        ROUND(AVG((conversion_meta->>'parametricCount')::numeric), 2)::text AS avg_parametric_count
      FROM prompt_events
      WHERE conversion_meta IS NOT NULL
        AND created_at >= NOW() - (${windowDays} || ' days')::interval
      GROUP BY platform, tier
      ORDER BY COUNT(*) DESC
    `;

    return result.map((row) => {
      const fc = parseFloat(row.avg_fidelity_converted) || 0;
      const fd = parseFloat(row.avg_fidelity_deferred) || 0;
      const nc = parseFloat(row.avg_negatives_converted) || 0;
      const nd = parseFloat(row.avg_negatives_deferred) || 0;
      const totalConverted = fc + nc;
      const totalDeferred = fd + nd;
      const total = totalConverted + totalDeferred;

      return {
        platform: row.platform,
        tier: row.tier,
        eventCount: parseInt(row.event_count, 10),
        avgFidelityConverted: fc,
        avgFidelityDeferred: fd,
        avgNegativesConverted: nc,
        avgNegativesDeferred: nd,
        avgBudgetCeiling: parseFloat(row.avg_budget_ceiling) || 0,
        avgBudgetRemaining: parseFloat(row.avg_budget_remaining) || 0,
        avgParametricCount: parseFloat(row.avg_parametric_count) || 0,
        successRate: total > 0 ? Math.round((totalConverted / total) * 100) / 100 : 1,
      };
    });
  } catch (error) {
    console.error('[Learning] Error fetching conversion dashboard:', error);
    return [];
  }
}

// ============================================================================
// Part 8 Improvement 2: Conversion-Outcome Correlation
// ============================================================================

/** Correlation between conversion success and feedback quality */
export interface ConversionOutcomeCorrelation {
  platform: string;
  /** Events where all conversions were included (no deferrals) */
  fullConversionCount: number;
  /** Average feedback score (0–1) for full-conversion events */
  fullConversionFeedbackScore: number;
  /** Events where some conversions were deferred */
  partialConversionCount: number;
  /** Average feedback score (0–1) for partial-conversion events */
  partialConversionFeedbackScore: number;
  /** Delta: full - partial (positive = full conversions produce better feedback) */
  delta: number;
}

/**
 * Correlate conversion success rates with user feedback.
 * Events where all conversions were included vs events with deferrals.
 * Requires both conversion_meta AND feedback_rating to be present.
 *
 * @param windowDays — How far back to look (default: 90 days)
 * @returns Per-platform correlation data sorted by event count
 */
export async function fetchConversionOutcomeCorrelation(
  windowDays: number = 90,
): Promise<ConversionOutcomeCorrelation[]> {
  try {
    const rows = await db()<PromptEventRow[]>`
      SELECT
        id, session_id, attempt_number, selections, category_count,
        char_length, score, score_factors, platform, tier,
        scene_used, outcome, user_tier, account_age_days,
        feedback_rating, feedback_credibility, conversion_meta, created_at
      FROM prompt_events
      WHERE conversion_meta IS NOT NULL
        AND feedback_rating IS NOT NULL
        AND created_at >= NOW() - (${windowDays} || ' days')::interval
    `;

    // Group by platform
    const platformGroups = new Map<string, {
      full: { feedbackSum: number; count: number };
      partial: { feedbackSum: number; count: number };
    }>();

    for (const row of rows) {
      const cm = row.conversion_meta;
      if (!cm) continue;

      const totalDeferred = (cm.fidelityDeferred ?? 0) + (cm.negativesDeferred ?? 0);
      const isFullConversion = totalDeferred === 0;

      // Convert feedback rating to numeric score
      const feedbackScore =
        row.feedback_rating === 'positive' ? 1.0 :
        row.feedback_rating === 'neutral' ? 0.5 : 0.0;

      // Weight by credibility
      const weight = row.feedback_credibility ?? 1.0;

      if (!platformGroups.has(row.platform)) {
        platformGroups.set(row.platform, {
          full: { feedbackSum: 0, count: 0 },
          partial: { feedbackSum: 0, count: 0 },
        });
      }

      const group = platformGroups.get(row.platform)!;
      const bucket = isFullConversion ? group.full : group.partial;
      bucket.feedbackSum += feedbackScore * weight;
      bucket.count++;
    }

    const results: ConversionOutcomeCorrelation[] = [];

    for (const [platform, group] of platformGroups) {
      const fullScore = group.full.count > 0
        ? Math.round((group.full.feedbackSum / group.full.count) * 100) / 100
        : 0;
      const partialScore = group.partial.count > 0
        ? Math.round((group.partial.feedbackSum / group.partial.count) * 100) / 100
        : 0;

      results.push({
        platform,
        fullConversionCount: group.full.count,
        fullConversionFeedbackScore: fullScore,
        partialConversionCount: group.partial.count,
        partialConversionFeedbackScore: partialScore,
        delta: Math.round((fullScore - partialScore) * 100) / 100,
      });
    }

    return results.sort((a, b) =>
      (b.fullConversionCount + b.partialConversionCount) -
      (a.fullConversionCount + a.partialConversionCount),
    );
  } catch (error) {
    console.error('[Learning] Error fetching conversion-outcome correlation:', error);
    return [];
  }
}
