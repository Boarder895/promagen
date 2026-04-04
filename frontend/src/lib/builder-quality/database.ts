// src/lib/builder-quality/database.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Database Operations
// ============================================================================
// Two tables: builder_quality_runs (parent) + builder_quality_results (child).
// All queries use parameterised statements (postgres tagged template).
// Uses the existing db() singleton from src/lib/db.ts.
//
// v1.3.0 (4 Apr 2026): Part 11 — showcase_entry_id, showcase_created_at, showcase_tier, scorer_version on results. Idempotency index.
// v1.2.0 (4 Apr 2026): Added resumedAt, SIGINT support fields.
// v1.1.0 (4 Apr 2026): Part 10 — Added parentRunId, lastProgressAt, unique index.
// v1.0.0 (3 Apr 2026): Initial implementation.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §6
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';

// Re-export for convenience
export { hasDatabaseConfigured };

// =============================================================================
// TABLE CREATION (AUTO-MIGRATION)
// =============================================================================

/**
 * Create builder_quality_runs table if not exists.
 * Parent table — one row per batch run.
 */
export async function ensureRunsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS builder_quality_runs (
      id              SERIAL PRIMARY KEY,
      run_id          TEXT NOT NULL UNIQUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ,

      -- Configuration
      mode            TEXT NOT NULL,
      scope           TEXT NOT NULL,
      scorer_mode     TEXT NOT NULL DEFAULT 'gpt_only',
      replicate_count SMALLINT NOT NULL DEFAULT 1,
      include_holdout BOOLEAN NOT NULL DEFAULT FALSE,

      -- Versioning (all mandatory)
      scorer_version  TEXT NOT NULL,
      scorer_prompt_hash TEXT NOT NULL,
      gpt_model       TEXT NOT NULL,
      claude_model    TEXT,
      call2_version   TEXT,

      -- Comparison
      baseline_run_id TEXT,

      -- Status
      status          TEXT NOT NULL DEFAULT 'pending',
      total_expected  SMALLINT,
      total_completed SMALLINT DEFAULT 0,
      error_detail    TEXT,

      -- Summary
      mean_gpt_score  NUMERIC(5,2),
      mean_claude_score NUMERIC(5,2),
      flagged_count   SMALLINT DEFAULT 0
    )
  `;

  // v1.2.0: Add parent_run_id for rerun child→parent linkage
  await db()`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS parent_run_id TEXT
  `;

  // v1.2.0: Add last_progress_at heartbeat for stale detection
  await db()`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ
  `;

  // v1.3.0: Add resumed_at timestamp for dashboard audit trail
  await db()`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ
  `;
}

/**
 * Create builder_quality_results table if not exists.
 * Child table — one row per platform × scene × replicate.
 */
export async function ensureResultsTable(): Promise<void> {
  await db()`
    CREATE TABLE IF NOT EXISTS builder_quality_results (
      id              SERIAL PRIMARY KEY,
      run_id          TEXT NOT NULL REFERENCES builder_quality_runs(run_id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- What was tested
      platform_id     TEXT NOT NULL,
      platform_name   TEXT NOT NULL,
      scene_id        TEXT NOT NULL,
      scene_name      TEXT NOT NULL,
      tier            SMALLINT NOT NULL,
      call3_mode      TEXT NOT NULL,
      builder_version TEXT NOT NULL,
      replicate_index SMALLINT NOT NULL DEFAULT 1,

      -- Snapshot provenance (builder mode only)
      snapshot_hash   TEXT,

      -- Prompts captured (full text)
      human_text      TEXT NOT NULL,
      assembled_prompt TEXT NOT NULL,
      raw_optimised_prompt TEXT NOT NULL,
      optimised_prompt TEXT NOT NULL,
      negative_prompt  TEXT,

      -- Hashes
      input_hash      TEXT NOT NULL,
      output_hash     TEXT NOT NULL,

      -- Length metrics
      assembled_char_count    SMALLINT NOT NULL,
      raw_optimised_char_count SMALLINT NOT NULL,
      optimised_char_count    SMALLINT NOT NULL,

      -- Post-processing effect
      post_processing_changed BOOLEAN NOT NULL DEFAULT FALSE,
      post_processing_delta   TEXT,

      -- GPT scores
      gpt_score       SMALLINT NOT NULL,
      gpt_axes        JSONB NOT NULL,
      gpt_directives  JSONB NOT NULL,
      gpt_summary     TEXT NOT NULL,

      -- Claude scores (nullable)
      claude_score    SMALLINT,
      claude_axes     JSONB,
      claude_directives JSONB,
      claude_summary  TEXT,

      -- Triangulated result
      median_score    SMALLINT,
      divergence      SMALLINT,
      flagged         BOOLEAN DEFAULT FALSE,

      -- Anchor audit
      anchor_audit    JSONB,
      anchors_expected SMALLINT,
      anchors_preserved SMALLINT,
      anchors_dropped SMALLINT,
      critical_anchors_dropped SMALLINT,

      -- Source and status
      source          TEXT NOT NULL DEFAULT 'batch',
      status          TEXT NOT NULL DEFAULT 'complete',
      error_detail    TEXT,
      is_holdout      BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  // Indexes for efficient dashboard queries
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_platform_created
    ON builder_quality_results (platform_id, created_at DESC)
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_run
    ON builder_quality_results (run_id)
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_flagged
    ON builder_quality_results (flagged) WHERE flagged = TRUE
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_scene
    ON builder_quality_results (scene_id, platform_id)
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_critical_drops
    ON builder_quality_results (critical_anchors_dropped)
    WHERE critical_anchors_dropped > 0
  `;
  await db()`
    CREATE INDEX IF NOT EXISTS idx_bqr_holdout
    ON builder_quality_results (is_holdout) WHERE is_holdout = TRUE
  `;

  // v1.2.0: Unique index enforcing logical uniqueness invariant at DB layer
  // Hard rule: exactly one row per (run_id, platform_id, scene_id, replicate_index)
  try {
    await db()`
      CREATE UNIQUE INDEX IF NOT EXISTS bqr_results_unique_logical
      ON builder_quality_results (run_id, platform_id, scene_id, replicate_index)
    `;
  } catch (e) {
    console.error('[builder-quality] Could not create unique index (possible duplicate rows):', e);
    console.error('Run: SELECT run_id, platform_id, scene_id, replicate_index, COUNT(*) FROM builder_quality_results GROUP BY run_id, platform_id, scene_id, replicate_index HAVING COUNT(*) > 1;');
  }

  // Part 11: User sampling columns
  await db()`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_entry_id TEXT`;
  await db()`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_created_at TIMESTAMPTZ`;
  await db()`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_tier TEXT`;
  await db()`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS scorer_version TEXT`;

  // Part 11: Idempotency — one showcase entry per scorer version for user samples
  try {
    await db()`
      CREATE UNIQUE INDEX IF NOT EXISTS bqr_results_unique_user_sample
      ON builder_quality_results (showcase_entry_id, scorer_version)
      WHERE source = 'user_sample' AND showcase_entry_id IS NOT NULL
    `;
  } catch (e) {
    console.error('[builder-quality] Could not create user-sample unique index:', e);
  }
}

/**
 * Ensure all builder quality tables and indexes exist.
 * Safe to call multiple times (CREATE IF NOT EXISTS).
 */
export async function ensureTablesExist(): Promise<void> {
  await ensureRunsTable();
  await ensureResultsTable();
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export interface BuilderQualityHealth {
  connected: boolean;
  tablesExist: boolean;
  runsCount: number;
  resultsCount: number;
}

/**
 * Check database health for builder quality system.
 * Returns safe defaults (false/0) on any error — never throws.
 */
export async function checkHealth(): Promise<BuilderQualityHealth> {
  try {
    await db()`SELECT 1`;

    const tableCheck = await db()<{
      runs_exists: boolean;
      results_exists: boolean;
    }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'builder_quality_runs'
      ) AS runs_exists,
      EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'builder_quality_results'
      ) AS results_exists
    `;

    const tablesExist =
      tableCheck[0]?.runs_exists === true &&
      tableCheck[0]?.results_exists === true;

    let runsCount = 0;
    let resultsCount = 0;

    if (tablesExist) {
      const rc = await db()<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM builder_quality_runs
      `;
      runsCount = rc[0]?.count ?? 0;

      const rsc = await db()<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM builder_quality_results
      `;
      resultsCount = rsc[0]?.count ?? 0;
    }

    return { connected: true, tablesExist, runsCount, resultsCount };
  } catch (error) {
    console.error('[builder-quality] Health check failed:', error);
    return { connected: false, tablesExist: false, runsCount: 0, resultsCount: 0 };
  }
}

// =============================================================================
// RUN QUERIES
// =============================================================================

/** Row shape returned from builder_quality_runs queries */
type RunRow = {
  run_id: string;
  created_at: Date | string;
  completed_at: Date | string | null;
  mode: string;
  scope: string;
  scorer_mode: string;
  replicate_count: number;
  include_holdout: boolean;
  scorer_version: string;
  scorer_prompt_hash: string;
  gpt_model: string;
  claude_model: string | null;
  call2_version: string | null;
  baseline_run_id: string | null;
  parent_run_id: string | null;
  last_progress_at: Date | string | null;
  resumed_at: Date | string | null;
  status: string;
  total_expected: number | null;
  total_completed: number | null;
  error_detail: string | null;
  mean_gpt_score: string | number | null;
  mean_claude_score: string | number | null;
  flagged_count: number | null;
};

/** App-level run type */
export interface BuilderQualityRun {
  runId: string;
  createdAt: Date;
  completedAt: Date | null;
  mode: string;
  scope: string;
  scorerMode: string;
  replicateCount: number;
  includeHoldout: boolean;
  scorerVersion: string;
  scorerPromptHash: string;
  gptModel: string;
  claudeModel: string | null;
  call2Version: string | null;
  baselineRunId: string | null;
  parentRunId: string | null;
  lastProgressAt: Date | null;
  resumedAt: Date | null;
  status: string;
  totalExpected: number | null;
  totalCompleted: number;
  errorDetail: string | null;
  meanGptScore: number | null;
  meanClaudeScore: number | null;
  flaggedCount: number;
}

function mapRunRow(row: RunRow): BuilderQualityRun {
  return {
    runId: row.run_id,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    mode: row.mode,
    scope: row.scope,
    scorerMode: row.scorer_mode,
    replicateCount: row.replicate_count,
    includeHoldout: row.include_holdout,
    scorerVersion: row.scorer_version,
    scorerPromptHash: row.scorer_prompt_hash,
    gptModel: row.gpt_model,
    claudeModel: row.claude_model,
    call2Version: row.call2_version,
    baselineRunId: row.baseline_run_id,
    parentRunId: row.parent_run_id ?? null,
    lastProgressAt: row.last_progress_at ? new Date(row.last_progress_at) : null,
    resumedAt: row.resumed_at ? new Date(row.resumed_at) : null,
    status: row.status,
    totalExpected: row.total_expected,
    totalCompleted: row.total_completed ?? 0,
    errorDetail: row.error_detail,
    meanGptScore: row.mean_gpt_score !== null ? parseFloat(String(row.mean_gpt_score)) : null,
    meanClaudeScore: row.mean_claude_score !== null ? parseFloat(String(row.mean_claude_score)) : null,
    flaggedCount: row.flagged_count ?? 0,
  };
}

/**
 * Get a run by its run_id.
 */
export async function getRun(runId: string): Promise<BuilderQualityRun | null> {
  try {
    const rows = await db()<RunRow[]>`
      SELECT * FROM builder_quality_runs WHERE run_id = ${runId}
    `;
    const row = rows[0];
    return row ? mapRunRow(row) : null;
  } catch (error) {
    console.error('[builder-quality] Error fetching run:', error);
    return null;
  }
}

/**
 * Get recent runs, newest first.
 */
export async function getRecentRuns(limit = 20): Promise<BuilderQualityRun[]> {
  try {
    const rows = await db()<RunRow[]>`
      SELECT * FROM builder_quality_runs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(mapRunRow);
  } catch (error) {
    console.error('[builder-quality] Error fetching recent runs:', error);
    return [];
  }
}

/**
 * Insert a new run. Returns the run_id on success.
 */
export async function insertRun(run: {
  runId: string;
  mode: string;
  scope: string;
  scorerMode: string;
  replicateCount: number;
  includeHoldout: boolean;
  scorerVersion: string;
  scorerPromptHash: string;
  gptModel: string;
  claudeModel?: string | null;
  call2Version?: string | null;
  baselineRunId?: string | null;
  parentRunId?: string | null;
  totalExpected: number;
}): Promise<string> {
  await db()`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, claude_model, call2_version, baseline_run_id,
      parent_run_id, status, total_expected, total_completed,
      last_progress_at
    ) VALUES (
      ${run.runId}, ${run.mode}, ${run.scope}, ${run.scorerMode},
      ${run.replicateCount}, ${run.includeHoldout}, ${run.scorerVersion},
      ${run.scorerPromptHash}, ${run.gptModel}, ${run.claudeModel ?? null},
      ${run.call2Version ?? null}, ${run.baselineRunId ?? null},
      ${run.parentRunId ?? null}, 'running', ${run.totalExpected}, 0,
      NOW()
    )
  `;
  return run.runId;
}

/**
 * Update run status and summary fields.
 */
export async function updateRunStatus(
  runId: string,
  update: {
    status: string;
    totalCompleted?: number;
    errorDetail?: string | null;
    meanGptScore?: number | null;
    meanClaudeScore?: number | null;
    flaggedCount?: number;
  },
): Promise<void> {
  const completedAt = update.status === 'complete' || update.status === 'partial'
    ? db()`NOW()`
    : null;

  await db()`
    UPDATE builder_quality_runs
    SET
      status = ${update.status},
      total_completed = COALESCE(${update.totalCompleted ?? null}, total_completed),
      error_detail = COALESCE(${update.errorDetail ?? null}, error_detail),
      mean_gpt_score = COALESCE(${update.meanGptScore ?? null}, mean_gpt_score),
      mean_claude_score = COALESCE(${update.meanClaudeScore ?? null}, mean_claude_score),
      flagged_count = COALESCE(${update.flaggedCount ?? null}, flagged_count),
      completed_at = COALESCE(${completedAt}, completed_at)
    WHERE run_id = ${runId}
  `;
}

/**
 * Increment total_completed by 1 for a given run.
 * Also updates last_progress_at heartbeat (v1.2.0).
 */
export async function incrementRunCompleted(runId: string): Promise<void> {
  await db()`
    UPDATE builder_quality_runs
    SET total_completed = COALESCE(total_completed, 0) + 1,
        last_progress_at = NOW()
    WHERE run_id = ${runId}
  `;
}

// =============================================================================
// RESULT QUERIES
// =============================================================================

/**
 * Insert a single result row. Used by the batch runner after each
 * platform × scene × replicate completes.
 */
export async function insertResult(result: {
  runId: string;
  platformId: string;
  platformName: string;
  sceneId: string;
  sceneName: string;
  tier: number;
  call3Mode: string;
  builderVersion: string;
  replicateIndex: number;
  snapshotHash?: string | null;
  humanText: string;
  assembledPrompt: string;
  rawOptimisedPrompt: string;
  optimisedPrompt: string;
  negativePrompt?: string | null;
  inputHash: string;
  outputHash: string;
  assembledCharCount: number;
  rawOptimisedCharCount: number;
  optimisedCharCount: number;
  postProcessingChanged: boolean;
  postProcessingDelta?: string | null;
  gptScore: number;
  gptAxes: Record<string, unknown>;
  gptDirectives: string[];
  gptSummary: string;
  claudeScore?: number | null;
  claudeAxes?: Record<string, unknown> | null;
  claudeDirectives?: string[] | null;
  claudeSummary?: string | null;
  medianScore?: number | null;
  divergence?: number | null;
  flagged?: boolean;
  anchorAudit?: Record<string, unknown>[] | null;
  anchorsExpected?: number;
  anchorsPreserved?: number;
  anchorsDropped?: number;
  criticalAnchorsDropped?: number;
  source?: string;
  status?: string;
  errorDetail?: string | null;
  isHoldout?: boolean;
  showcaseEntryId?: string | null;
  showcaseCreatedAt?: Date | string | null;
  showcaseTier?: string | null;
  scorerVersion?: string | null;
}): Promise<void> {
  await db()`
    INSERT INTO builder_quality_results (
      run_id, platform_id, platform_name, scene_id, scene_name,
      tier, call3_mode, builder_version, replicate_index, snapshot_hash,
      human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
      negative_prompt, input_hash, output_hash,
      assembled_char_count, raw_optimised_char_count, optimised_char_count,
      post_processing_changed, post_processing_delta,
      gpt_score, gpt_axes, gpt_directives, gpt_summary,
      claude_score, claude_axes, claude_directives, claude_summary,
      median_score, divergence, flagged,
      anchor_audit, anchors_expected, anchors_preserved,
      anchors_dropped, critical_anchors_dropped,
      source, status, error_detail, is_holdout,
      showcase_entry_id, showcase_created_at, showcase_tier, scorer_version
    ) VALUES (
      ${result.runId}, ${result.platformId}, ${result.platformName},
      ${result.sceneId}, ${result.sceneName}, ${result.tier},
      ${result.call3Mode}, ${result.builderVersion}, ${result.replicateIndex},
      ${result.snapshotHash ?? null},
      ${result.humanText}, ${result.assembledPrompt},
      ${result.rawOptimisedPrompt}, ${result.optimisedPrompt},
      ${result.negativePrompt ?? null},
      ${result.inputHash}, ${result.outputHash},
      ${result.assembledCharCount}, ${result.rawOptimisedCharCount},
      ${result.optimisedCharCount},
      ${result.postProcessingChanged}, ${result.postProcessingDelta ?? null},
      ${result.gptScore}, ${JSON.stringify(result.gptAxes)},
      ${JSON.stringify(result.gptDirectives)}, ${result.gptSummary},
      ${result.claudeScore ?? null},
      ${result.claudeAxes ? JSON.stringify(result.claudeAxes) : null},
      ${result.claudeDirectives ? JSON.stringify(result.claudeDirectives) : null},
      ${result.claudeSummary ?? null},
      ${result.medianScore ?? null}, ${result.divergence ?? null},
      ${result.flagged ?? false},
      ${result.anchorAudit ? JSON.stringify(result.anchorAudit) : null},
      ${result.anchorsExpected ?? 0}, ${result.anchorsPreserved ?? 0},
      ${result.anchorsDropped ?? 0}, ${result.criticalAnchorsDropped ?? 0},
      ${result.source ?? 'batch'}, ${result.status ?? 'complete'},
      ${result.errorDetail ?? null}, ${result.isHoldout ?? false},
      ${result.showcaseEntryId ?? null},
      ${result.showcaseCreatedAt ? new Date(String(result.showcaseCreatedAt)) : null},
      ${result.showcaseTier ?? null},
      ${result.scorerVersion ?? null}
    )
  `;
}

/**
 * Get results for a specific run, optionally filtered by platform.
 */
export async function getResultsForRun(
  runId: string,
  platformId?: string,
): Promise<Record<string, unknown>[]> {
  try {
    if (platformId) {
      return await db()`
        SELECT * FROM builder_quality_results
        WHERE run_id = ${runId} AND platform_id = ${platformId}
        ORDER BY scene_id, replicate_index
      `;
    }
    return await db()`
      SELECT * FROM builder_quality_results
      WHERE run_id = ${runId}
      ORDER BY platform_id, scene_id, replicate_index
    `;
  } catch (error) {
    console.error('[builder-quality] Error fetching results:', error);
    return [];
  }
}

/**
 * Get latest results for a platform across all runs.
 * Useful for trend dashboard.
 */
export async function getLatestResultsForPlatform(
  platformId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  try {
    return await db()`
      SELECT * FROM builder_quality_results
      WHERE platform_id = ${platformId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } catch (error) {
    console.error('[builder-quality] Error fetching platform results:', error);
    return [];
  }
}

/**
 * Check if a specific scene+platform+replicate already exists in a run.
 * Used by --resume to skip completed work.
 */
export async function resultExists(
  runId: string,
  platformId: string,
  sceneId: string,
  replicateIndex: number,
): Promise<boolean> {
  try {
    const rows = await db()<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM builder_quality_results
        WHERE run_id = ${runId}
          AND platform_id = ${platformId}
          AND scene_id = ${sceneId}
          AND replicate_index = ${replicateIndex}
          AND status = 'complete'
      ) AS exists
    `;
    return rows[0]?.exists === true;
  } catch (error) {
    console.error('[builder-quality] Error checking result existence:', error);
    return false;
  }
}

/**
 * Get error results for a run (used by --rerun).
 */
export async function getErrorResults(
  runId: string,
): Promise<{ platformId: string; sceneId: string; replicateIndex: number }[]> {
  try {
    const rows = await db()<{
      platform_id: string;
      scene_id: string;
      replicate_index: number;
    }[]>`
      SELECT platform_id, scene_id, replicate_index
      FROM builder_quality_results
      WHERE run_id = ${runId} AND status = 'error'
      ORDER BY platform_id, scene_id, replicate_index
    `;
    return rows.map((r) => ({
      platformId: r.platform_id,
      sceneId: r.scene_id,
      replicateIndex: r.replicate_index,
    }));
  } catch (error) {
    console.error('[builder-quality] Error fetching error results:', error);
    return [];
  }
}
