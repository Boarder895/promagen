#!/usr/bin/env npx tsx
// scripts/builder-quality-run.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Batch Runner
// ============================================================================
// Runs Call 3 → Score for each platform × scene, stores results in Postgres,
// and reports a summary. The core regression testing tool.
//
// Usage (from frontend/, dev server must be running):
//   # Single platform diagnostic
//   npx tsx scripts/builder-quality-run.ts --platform lexica --mode builder
//
//   # Full batch (all 40 platforms)
//   npx tsx scripts/builder-quality-run.ts --all --mode builder
//
//   # Include holdouts
//   npx tsx scripts/builder-quality-run.ts --all --mode builder --holdout
//
//   # Rerun failed results from a prior run (creates child run)
//   npx tsx scripts/builder-quality-run.ts --rerun bqr-<id>
//
//   # Resume a crashed/partial run in-place
//   npx tsx scripts/builder-quality-run.ts --resume bqr-<id> --force
//
// Requirements:
//   - Dev server running on localhost:3000
//   - DATABASE_URL or POSTGRES_URL in .env.local
//   - BUILDER_QUALITY_KEY in .env.local
//   - Frozen snapshots generated (run generate-snapshots.ts first)
//
// v1.3.0 (4 Apr 2026): SIGINT handler + resumed_at column.
//   - Ctrl+C sets run to 'partial' with interruption log before exiting
//   - resumed_at timestamp set when --resume prepares run for resumption
// v1.2.0 (4 Apr 2026): Part 10 — Rerun/resume mechanics.
//   - --rerun <run_id>: re-run only error results, creates child run
//   - --resume <run_id>: continue crashed run in-place, update-in-place model
//   - --force: required for resuming stale runs (no progress for 10+ min)
//   - Heartbeat (last_progress_at) on every result for stale detection
//   - Tightened final status: complete = zero errors, partial = any errors
//   - DB unique index on (run_id, platform_id, scene_id, replicate_index)
//   - parent_run_id column for rerun child→parent linkage
//   ChatGPT review: 97/100, signed off.
// v1.0.0 (3 Apr 2026): Initial implementation.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §7
// Build plan: part-10-build-plan v1.2.0
// ============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';

// Load .env.local
config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

// ============================================================================
// CONFIG
// ============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CALL3_ENDPOINT = `${BASE_URL}/api/optimise-prompt`;
const SCORE_ENDPOINT = `${BASE_URL}/api/score-prompt`;
const BUILDER_QUALITY_KEY = process.env.BUILDER_QUALITY_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const GPT_MODEL = 'gpt-5.4-mini';
const SCORER_VERSION = '2.0.0';

/** Stale detection: no progress for 10 minutes = stale */
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

// ============================================================================
// SIGINT HANDLER STATE
// ============================================================================
// Module-level state so the SIGINT handler can access the active run.
// Set by main/handleRerun/handleResume before the pipeline starts.

let sigintRunId: string | null = null;
let sigintSql: postgres.Sql | null = null;
let sigintLastLabel = '';
let sigintHandled = false;

/**
 * Register the SIGINT (Ctrl+C) handler.
 * Sets run status to 'partial', logs the interruption, closes DB, and exits.
 * Only fires once — second Ctrl+C force-kills as normal.
 */
function registerSigintHandler(): void {
  process.on('SIGINT', async () => {
    if (sigintHandled) {
      // Second Ctrl+C — force exit
      process.exit(130);
    }
    sigintHandled = true;

    console.log(''); // newline after ^C
    log('');
    log('⚠ INTERRUPTED (Ctrl+C)');

    if (sigintLastLabel) {
      log(`Last processing: ${sigintLastLabel}`);
    }

    if (sigintRunId && sigintSql) {
      try {
        await sigintSql`
          UPDATE builder_quality_runs
          SET status = 'partial',
              error_detail = COALESCE(error_detail, '') || ' [interrupted by SIGINT]'
          WHERE run_id = ${sigintRunId} AND status = 'running'
        `;
        log(`Run ${sigintRunId} marked as 'partial'`);
      } catch (e) {
        logError(`Could not update run status: ${e}`);
      }

      try {
        await sigintSql.end();
      } catch { /* best effort */ }
    }

    log('Resume with: npx tsx scripts/builder-quality-run.ts --resume <run_id> --force');
    process.exit(130);
  });
}

// ============================================================================
// TYPES
// ============================================================================

interface TestScene {
  id: string;
  name: string;
  humanText: string;
  expectedAnchors: { term: string; severity: 'critical' | 'important' | 'optional' }[];
  stressTarget: string;
  categoriesExpected: string[];
  holdout: boolean;
}

interface FrozenSnapshot {
  sceneId: string;
  tier: number;
  call2Version: string;
  assembledPrompt: string;
  snapshotHash: string;
  createdAt: string;
}

interface PlatformConfig {
  tier?: number;
  _removed?: boolean;
  promptStyle?: string;
  sweetSpot?: number;
  tokenLimit?: number;
  maxChars?: number | null;
  idealMin?: number;
  idealMax?: number;
  negativeSupport?: string;
  supportsWeighting?: boolean;
  weightingSyntax?: string;
  qualityPrefix?: string[];
  categoryOrder?: string[];
  groupKnowledge?: string;
  call3Mode?: string;
}

interface CliArgs {
  platform: string | null;
  all: boolean;
  mode: 'builder' | 'pipeline';
  scorer: 'gpt_only';
  replicates: number;
  holdout: boolean;
  baseline: string | null;
  rerun: string | null;
  resume: string | null;
  force: boolean;
}

/** Settings loaded from an original run for rerun/resume inheritance */
interface OriginalRunSettings {
  mode: 'builder' | 'pipeline';
  scope: string;
  scorerMode: string;
  replicateCount: number;
  includeHoldout: boolean;
  status: string;
  totalExpected: number;
  lastProgressAt: Date | null;
  createdAt: Date;
}

/** A combination key: platform+scene+replicate */
type ComboKey = string;

function comboKey(platformId: string, sceneId: string, replicateIndex: number): ComboKey {
  return `${platformId}:${sceneId}:${replicateIndex}`;
}

// ============================================================================
// HELPERS
// ============================================================================

function md5(content: string): string {
  return createHash('md5').update(content, 'utf8').digest('hex');
}

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ✗ ${msg}`);
}

function logSuccess(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ✓ ${msg}`);
}

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bqr-${ts}-${rand}`;
}

/** Truncate string to max chars for API route field limits */
function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

/** Format milliseconds as human-readable duration */
function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Route field limits (must match route schemas)
const LIMITS = {
  humanText: 1000,
  assembledPrompt: 2000,
  optimisedPrompt: 2000,
  negativePrompt: 500,
  originalSentence: 1000,
} as const;

/**
 * Fetch with 429 retry. Waits the Retry-After period (or 30s default)
 * and retries up to maxRetries times.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  let res = await fetch(url, init);

  for (let attempt = 0; attempt < maxRetries && res.status === 429; attempt++) {
    const retryAfter = res.headers.get('Retry-After');
    const waitSec = retryAfter ? Math.min(parseInt(retryAfter, 10) || 30, 60) : 30;
    log(`    ↻ Rate limited — waiting ${waitSec}s (retry ${attempt + 1}/${maxRetries})`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    res = await fetch(url, init);
  }

  return res;
}

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    platform: null,
    all: false,
    mode: 'builder',
    scorer: 'gpt_only',
    replicates: 1,
    holdout: false,
    baseline: null,
    rerun: null,
    resume: null,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--platform':
        result.platform = args[++i] || null;
        break;
      case '--all':
        result.all = true;
        break;
      case '--mode':
        result.mode = (args[++i] as 'builder' | 'pipeline') || 'builder';
        break;
      case '--scorer':
        result.scorer = 'gpt_only'; // Only mode available in v1
        i++;
        break;
      case '--replicates':
        result.replicates = parseInt(args[++i] || '1', 10) || 1;
        break;
      case '--holdout':
        result.holdout = true;
        break;
      case '--baseline':
        result.baseline = args[++i] || null;
        break;
      case '--rerun':
        result.rerun = args[++i] || null;
        break;
      case '--resume':
        result.resume = args[++i] || null;
        break;
      case '--force':
        result.force = true;
        break;
    }
  }

  // ── Mutual exclusion validation ──────────────────────────────────
  if (result.rerun && result.resume) {
    console.error('ERROR: Cannot use --rerun and --resume together.');
    process.exit(1);
  }

  const isRecovery = result.rerun || result.resume;

  if (isRecovery && (result.all || result.platform)) {
    console.error('ERROR: Scope is inherited from original run. Remove --all/--platform.');
    process.exit(1);
  }

  // Check for settings flags that shouldn't be used with recovery
  const rawArgs = process.argv.slice(2);
  const settingsFlags = ['--mode', '--scorer', '--replicates', '--holdout'];
  if (isRecovery) {
    for (const flag of settingsFlags) {
      if (rawArgs.includes(flag)) {
        console.error(`ERROR: Settings inherited from original run. Remove ${flag}.`);
        process.exit(1);
      }
    }
  }

  // Normal mode: require --platform or --all
  if (!isRecovery && !result.platform && !result.all) {
    console.error('Usage: npx tsx scripts/builder-quality-run.ts --platform <id> | --all | --rerun <run_id> | --resume <run_id> [--force]');
    process.exit(1);
  }

  return result;
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadScenes(includeHoldout: boolean): TestScene[] {
  const corePath = resolve('src/data/scoring/test-scenes.json');
  const core = JSON.parse(readFileSync(corePath, 'utf8')) as TestScene[];

  if (!includeHoldout) return core;

  const holdoutPath = resolve('src/data/scoring/holdout-scenes.json');
  if (!existsSync(holdoutPath)) return core;

  const holdout = JSON.parse(readFileSync(holdoutPath, 'utf8')) as TestScene[];
  return [...core, ...holdout];
}

function loadSnapshots(includeHoldout: boolean): Map<string, FrozenSnapshot> {
  const corePath = resolve('src/data/scoring/frozen-snapshots.json');
  if (!existsSync(corePath)) {
    logError('frozen-snapshots.json not found. Run generate-snapshots.ts first.');
    process.exit(1);
  }

  const core = JSON.parse(readFileSync(corePath, 'utf8')) as FrozenSnapshot[];
  const map = new Map<string, FrozenSnapshot>();

  for (const s of core) {
    map.set(`${s.sceneId}:${s.tier}`, s);
  }

  if (includeHoldout) {
    const holdoutPath = resolve('src/data/scoring/holdout-snapshots.json');
    if (existsSync(holdoutPath)) {
      const holdout = JSON.parse(readFileSync(holdoutPath, 'utf8')) as FrozenSnapshot[];
      for (const s of holdout) {
        map.set(`${s.sceneId}:${s.tier}`, s);
      }
    }
  }

  return map;
}

function loadPlatformConfig(): Record<string, PlatformConfig> {
  const configPath = resolve('src/data/providers/platform-config.json');
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return raw.platforms as Record<string, PlatformConfig>;
}

function getActivePlatforms(
  config: Record<string, PlatformConfig>,
  platformFilter: string | null,
): string[] {
  if (platformFilter) {
    if (!config[platformFilter]) {
      logError(`Platform "${platformFilter}" not found in platform-config.json`);
      process.exit(1);
    }
    return [platformFilter];
  }
  return Object.entries(config)
    .filter(([, v]) => !v._removed)
    .map(([k]) => k);
}

function getBuilderFilePath(platformId: string, config: Record<string, PlatformConfig>): string {
  const tier = config[platformId]?.tier ?? 3;
  // Determine likely builder file based on tier and platform conventions
  // This is a best-effort lookup — actual group resolution is in the route
  const basePath = resolve('src/lib/optimise-prompts');
  const candidates = [
    `${basePath}/group-nl-${platformId}.ts`,
    `${basePath}/group-sd-clip-parenthetical.ts`,
    `${basePath}/group-mj.ts`,
    `${basePath}/group-dalle-api.ts`,
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // Fallback: use a generic identifier based on tier
  return `tier-${tier}-builder`;
}

function getBuilderVersion(platformId: string, config: Record<string, PlatformConfig>): string {
  const filePath = getBuilderFilePath(platformId, config);
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      return md5(content);
    }
  } catch { /* fallback below */ }
  return md5(`${platformId}-unknown-builder`);
}

// ============================================================================
// API CALLS
// ============================================================================

async function callOptimise(
  assembledPrompt: string,
  originalSentence: string,
  platformId: string,
  platformConfig: PlatformConfig,
): Promise<{ optimised: string; negative?: string; changes: string[] }> {
  const providerContext = {
    name: platformId,
    tier: platformConfig.tier ?? 3,
    promptStyle: platformConfig.promptStyle ?? 'natural',
    sweetSpot: platformConfig.sweetSpot ?? 200,
    tokenLimit: platformConfig.tokenLimit ?? 500,
    maxChars: platformConfig.maxChars ?? null,
    idealMin: platformConfig.idealMin ?? 50,
    idealMax: platformConfig.idealMax ?? 200,
    negativeSupport: platformConfig.negativeSupport ?? 'none',
    supportsWeighting: platformConfig.supportsWeighting ?? false,
    weightingSyntax: platformConfig.weightingSyntax,
    qualityPrefix: platformConfig.qualityPrefix,
    categoryOrder: platformConfig.categoryOrder,
    groupKnowledge: platformConfig.groupKnowledge,
    call3Mode: platformConfig.call3Mode,
  };

  const res = await fetchWithRetry(CALL3_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Builder-Quality-Key': BUILDER_QUALITY_KEY,
    },
    body: JSON.stringify({
      promptText: truncate(assembledPrompt, 5000),
      originalSentence: truncate(originalSentence, LIMITS.originalSentence),
      providerId: platformId,
      providerContext,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Call 3 failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const result = data.result || data;
  return {
    optimised: result.optimised || result.optimized || '',
    negative: result.negative,
    changes: result.changes || [],
  };
}

async function callScore(
  optimisedPrompt: string,
  humanText: string,
  assembledPrompt: string,
  negativePrompt: string | undefined,
  platformId: string,
  platformConfig: PlatformConfig,
  expectedAnchors: TestScene['expectedAnchors'],
): Promise<{
  score: number;
  axes: Record<string, number | null>;
  directives: string[];
  summary: string;
  anchorAudit?: { anchor: string; severity: string; status: string; note?: string }[];
}> {
  const baseBody = {
    optimisedPrompt: truncate(optimisedPrompt, LIMITS.optimisedPrompt),
    humanText: truncate(humanText, LIMITS.humanText),
    assembledPrompt: truncate(assembledPrompt, LIMITS.assembledPrompt),
    negativePrompt: negativePrompt ? truncate(negativePrompt, LIMITS.negativePrompt) : undefined,
    platformId,
    platformName: platformId,
    tier: platformConfig.tier ?? 3,
    promptStyle: platformConfig.promptStyle ?? 'natural',
    maxChars: platformConfig.maxChars ?? 500,
    idealMin: platformConfig.idealMin ?? 50,
    idealMax: platformConfig.idealMax ?? 200,
    negativeSupport: platformConfig.negativeSupport ?? 'none',
    call3Changes: [],
    call3Mode: platformConfig.call3Mode ?? 'gpt_rewrite',
    categoryRichness: {},
  };

  // First attempt: with expectedAnchors
  const headers = {
    'Content-Type': 'application/json',
    'X-Builder-Quality-Key': BUILDER_QUALITY_KEY,
  };

  const res = await fetchWithRetry(SCORE_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...baseBody, expectedAnchors }),
  });

  if (res.ok) return await res.json();

  // Retry on 502 without expectedAnchors (reduces GPT output size)
  if (res.status === 502 && expectedAnchors.length > 0) {
    log('    ↻ Retrying score without anchor audit (502 fallback)');
    const retryRes = await fetchWithRetry(SCORE_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(baseBody),
    });

    if (retryRes.ok) return await retryRes.json();

    const errText = await retryRes.text().catch(() => 'unknown');
    throw new Error(`Score failed on retry (${retryRes.status}): ${errText.slice(0, 200)}`);
  }

  const errText = await res.text().catch(() => 'unknown');
  throw new Error(`Score failed (${res.status}): ${errText.slice(0, 200)}`);
}

// ============================================================================
// DATABASE (direct connection — scripts can't use server-only modules)
// ============================================================================

function createDb() {
  if (!DATABASE_URL) {
    logError('DATABASE_URL not configured. Set it in .env.local');
    process.exit(1);
  }
  return postgres(DATABASE_URL, { max: 3, idle_timeout: 20, ssl: 'require', onnotice: () => {} });
}

async function ensureTables(sql: postgres.Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS builder_quality_runs (
      id              SERIAL PRIMARY KEY,
      run_id          TEXT NOT NULL UNIQUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at    TIMESTAMPTZ,
      mode            TEXT NOT NULL,
      scope           TEXT NOT NULL,
      scorer_mode     TEXT NOT NULL DEFAULT 'gpt_only',
      replicate_count SMALLINT NOT NULL DEFAULT 1,
      include_holdout BOOLEAN NOT NULL DEFAULT FALSE,
      scorer_version  TEXT NOT NULL,
      scorer_prompt_hash TEXT NOT NULL,
      gpt_model       TEXT NOT NULL,
      claude_model    TEXT,
      call2_version   TEXT,
      baseline_run_id TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      total_expected  SMALLINT,
      total_completed SMALLINT DEFAULT 0,
      error_detail    TEXT,
      mean_gpt_score  NUMERIC(5,2),
      mean_claude_score NUMERIC(5,2),
      flagged_count   SMALLINT DEFAULT 0
    )
  `;

  // v1.2.0: Add parent_run_id for rerun child→parent linkage
  await sql`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS parent_run_id TEXT
  `;

  // v1.2.0: Add last_progress_at heartbeat for stale detection
  await sql`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ
  `;

  // v1.3.0: Add resumed_at timestamp for dashboard audit trail
  await sql`
    ALTER TABLE builder_quality_runs
    ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS builder_quality_results (
      id              SERIAL PRIMARY KEY,
      run_id          TEXT NOT NULL REFERENCES builder_quality_runs(run_id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      platform_id     TEXT NOT NULL,
      platform_name   TEXT NOT NULL,
      scene_id        TEXT NOT NULL,
      scene_name      TEXT NOT NULL,
      tier            SMALLINT NOT NULL,
      call3_mode      TEXT NOT NULL,
      builder_version TEXT NOT NULL,
      replicate_index SMALLINT NOT NULL DEFAULT 1,
      snapshot_hash   TEXT,
      human_text      TEXT NOT NULL,
      assembled_prompt TEXT NOT NULL,
      raw_optimised_prompt TEXT NOT NULL,
      optimised_prompt TEXT NOT NULL,
      negative_prompt  TEXT,
      input_hash      TEXT NOT NULL,
      output_hash     TEXT NOT NULL,
      assembled_char_count    SMALLINT NOT NULL,
      raw_optimised_char_count SMALLINT NOT NULL,
      optimised_char_count    SMALLINT NOT NULL,
      post_processing_changed BOOLEAN NOT NULL DEFAULT FALSE,
      post_processing_delta   TEXT,
      gpt_score       SMALLINT NOT NULL,
      gpt_axes        JSONB NOT NULL,
      gpt_directives  JSONB NOT NULL,
      gpt_summary     TEXT NOT NULL,
      claude_score    SMALLINT,
      claude_axes     JSONB,
      claude_directives JSONB,
      claude_summary  TEXT,
      median_score    SMALLINT,
      divergence      SMALLINT,
      flagged         BOOLEAN DEFAULT FALSE,
      anchor_audit    JSONB,
      anchors_expected SMALLINT,
      anchors_preserved SMALLINT,
      anchors_dropped SMALLINT,
      critical_anchors_dropped SMALLINT,
      source          TEXT NOT NULL DEFAULT 'batch',
      status          TEXT NOT NULL DEFAULT 'complete',
      error_detail    TEXT,
      is_holdout      BOOLEAN NOT NULL DEFAULT FALSE
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_platform_created ON builder_quality_results (platform_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_run ON builder_quality_results (run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_flagged ON builder_quality_results (flagged) WHERE flagged = TRUE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_scene ON builder_quality_results (scene_id, platform_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_critical_drops ON builder_quality_results (critical_anchors_dropped) WHERE critical_anchors_dropped > 0`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bqr_holdout ON builder_quality_results (is_holdout) WHERE is_holdout = TRUE`;

  // v1.2.0: Unique index enforcing logical uniqueness invariant at DB layer
  // Hard rule: exactly one row per (run_id, platform_id, scene_id, replicate_index)
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bqr_results_unique_logical
      ON builder_quality_results (run_id, platform_id, scene_id, replicate_index)
    `;
  } catch (e) {
    // If index creation fails due to existing duplicate rows, log warning and continue.
    // Operator must clean up duplicates manually before the index can be created.
    logError(`Could not create unique index (possible duplicate rows): ${e}`);
    log('Run this query to find duplicates:');
    log('  SELECT run_id, platform_id, scene_id, replicate_index, COUNT(*)');
    log('  FROM builder_quality_results');
    log('  GROUP BY run_id, platform_id, scene_id, replicate_index');
    log('  HAVING COUNT(*) > 1;');
  }

  // Part 11: User sampling columns on results table
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_entry_id TEXT`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_created_at TIMESTAMPTZ`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_tier TEXT`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS scorer_version TEXT`;

  // Part 11: Idempotency index — one showcase entry per scorer version for user samples
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bqr_results_unique_user_sample
      ON builder_quality_results (showcase_entry_id, scorer_version)
      WHERE source = 'user_sample' AND showcase_entry_id IS NOT NULL
    `;
  } catch (e) {
    logError(`Could not create user-sample unique index: ${e}`);
  }
}

// ============================================================================
// RERUN / RESUME HELPERS
// ============================================================================

/**
 * Load settings from an original run for rerun/resume inheritance.
 */
async function loadOriginalRunSettings(
  sql: postgres.Sql,
  runId: string,
): Promise<OriginalRunSettings | null> {
  const rows = await sql`
    SELECT mode, scope, scorer_mode, replicate_count, include_holdout,
           status, total_expected, last_progress_at, created_at
    FROM builder_quality_runs WHERE run_id = ${runId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    mode: r.mode as 'builder' | 'pipeline',
    scope: r.scope as string,
    scorerMode: r.scorer_mode as string,
    replicateCount: r.replicate_count as number,
    includeHoldout: r.include_holdout as boolean,
    status: r.status as string,
    totalExpected: (r.total_expected as number) ?? 0,
    lastProgressAt: r.last_progress_at ? new Date(r.last_progress_at as string) : null,
    createdAt: new Date(r.created_at as string),
  };
}

/**
 * Update heartbeat + total_completed on the run record.
 * Piggybacks on the existing counter update — one extra column, zero additional queries.
 */
async function updateHeartbeat(sql: postgres.Sql, runId: string, totalCompleted: number): Promise<void> {
  await sql`
    UPDATE builder_quality_runs
    SET total_completed = ${totalCompleted}, last_progress_at = NOW()
    WHERE run_id = ${runId}
  `;
}

/**
 * Recalculate total_completed from actual row states.
 * Authoritative: counts rows, not incremental counter.
 */
async function recalculateTotalCompleted(sql: postgres.Sql, runId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM builder_quality_results
    WHERE run_id = ${runId} AND status = 'complete'
  `;
  return (rows[0] as Record<string, unknown>).count as number;
}

/**
 * Count error rows for a run.
 */
async function countErrors(sql: postgres.Sql, runId: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS count
    FROM builder_quality_results
    WHERE run_id = ${runId} AND status = 'error'
  `;
  return (rows[0] as Record<string, unknown>).count as number;
}

/**
 * Determine final run status.
 * complete = zero error rows. partial = any errors.
 */
function determineFinalStatus(errorCount: number): 'complete' | 'partial' {
  return errorCount === 0 ? 'complete' : 'partial';
}

// ============================================================================
// PIPELINE CORE — shared by normal, rerun, and resume
// ============================================================================

interface PipelineContext {
  sql: postgres.Sql;
  runId: string;
  platformConfig: Record<string, PlatformConfig>;
  snapshots: Map<string, FrozenSnapshot>;
  scenes: TestScene[];
  mode: 'builder' | 'pipeline';
  /** Error row IDs for UPDATE-in-place (resume only). Null = always INSERT. */
  errorRowIds: Map<ComboKey, number> | null;
}

interface PipelineResult {
  completed: number;
  errors: number;
  scores: number[];
  updatedErrorCount: number;
  insertedNewCount: number;
}

/**
 * Run the pipeline for a set of platform+scene+replicate combinations.
 * Used by normal runs, reruns, and resumes.
 */
async function runPipeline(
  ctx: PipelineContext,
  combinations: { platformId: string; sceneId: string; replicateIndex: number }[],
  startingCompleted: number,
): Promise<PipelineResult> {
  let completed = startingCompleted;
  let errors = 0;
  let updatedErrorCount = 0;
  let insertedNewCount = 0;
  const scores: number[] = [];

  // Group combinations by platform for console output
  const byPlatform = new Map<string, { sceneId: string; replicateIndex: number }[]>();
  for (const c of combinations) {
    const arr = byPlatform.get(c.platformId) || [];
    arr.push({ sceneId: c.sceneId, replicateIndex: c.replicateIndex });
    byPlatform.set(c.platformId, arr);
  }

  for (const [platformId, combos] of byPlatform) {
    const pConfig = ctx.platformConfig[platformId];
    if (!pConfig) {
      logError(`Platform "${platformId}" not in config — skipping`);
      errors += combos.length;
      continue;
    }

    const tier = pConfig.tier ?? 3;
    const builderVersion = getBuilderVersion(platformId, ctx.platformConfig);

    log(`── ${platformId} (T${tier}) ──`);

    for (const { sceneId, replicateIndex } of combos) {
      const scene = ctx.scenes.find((s) => s.id === sceneId);
      if (!scene) {
        logError(`  Scene "${sceneId}" not found — skipping`);
        errors++;
        continue;
      }

      const snapshotKey = `${scene.id}:${tier}`;
      const snapshot = ctx.snapshots.get(snapshotKey);

      if (!snapshot && ctx.mode === 'builder') {
        logError(`  ${scene.id} rep${replicateIndex}: no snapshot for T${tier} — skipping`);
        errors++;
        continue;
      }

      const assembledPrompt = snapshot?.assembledPrompt ?? scene.humanText;
      const label = `  ${scene.id}${combos.length > 1 || replicateIndex > 1 ? ` rep${replicateIndex}` : ''}`;
      const key = comboKey(platformId, sceneId, replicateIndex);
      const existingErrorRowId = ctx.errorRowIds?.get(key) ?? null;

      // Track for SIGINT handler
      sigintLastLabel = `${platformId} / ${scene.id} / rep${replicateIndex}`;

      try {
        // ── Call 3: Optimise ──────────────────────────────────
        const c3Result = await callOptimise(
          assembledPrompt,
          scene.humanText,
          platformId,
          pConfig,
        );

        if (!c3Result.optimised || c3Result.optimised.trim().length === 0) {
          throw new Error('Empty optimised prompt from Call 3');
        }

        // ── Score ─────────────────────────────────────────────
        const scoreResult = await callScore(
          c3Result.optimised,
          scene.humanText,
          assembledPrompt,
          c3Result.negative,
          platformId,
          pConfig,
          scene.expectedAnchors,
        );

        // ── Anchor audit summary ──────────────────────────────
        const audit = scoreResult.anchorAudit || [];
        const preserved = audit.filter(
          (a: { status: string }) => a.status === 'exact' || a.status === 'approximate',
        ).length;
        const dropped = audit.filter(
          (a: { status: string }) => a.status === 'dropped',
        ).length;
        const critDropped = audit.filter(
          (a: { status: string; severity: string }) =>
            a.status === 'dropped' && a.severity === 'critical',
        ).length;

        // ── Store result (INSERT or UPDATE) ────────────────────
        if (existingErrorRowId !== null) {
          // Resume: UPDATE existing error row in place
          await ctx.sql`
            UPDATE builder_quality_results
            SET
              created_at = NOW(),
              call3_mode = ${pConfig.call3Mode ?? 'gpt_rewrite'},
              builder_version = ${builderVersion},
              snapshot_hash = ${snapshot?.snapshotHash ?? null},
              raw_optimised_prompt = ${c3Result.optimised},
              optimised_prompt = ${c3Result.optimised},
              negative_prompt = ${c3Result.negative ?? null},
              output_hash = ${md5(c3Result.optimised)},
              raw_optimised_char_count = ${c3Result.optimised.length},
              optimised_char_count = ${c3Result.optimised.length},
              post_processing_changed = ${false},
              gpt_score = ${scoreResult.score},
              gpt_axes = ${JSON.stringify(scoreResult.axes)},
              gpt_directives = ${JSON.stringify(scoreResult.directives)},
              gpt_summary = ${scoreResult.summary},
              median_score = ${scoreResult.score},
              anchor_audit = ${JSON.stringify(audit)},
              anchors_expected = ${scene.expectedAnchors.length},
              anchors_preserved = ${preserved},
              anchors_dropped = ${dropped},
              critical_anchors_dropped = ${critDropped},
              status = 'complete',
              error_detail = ${null}
            WHERE id = ${existingErrorRowId}
          `;
          updatedErrorCount++;
        } else {
          // Normal INSERT
          await ctx.sql`
            INSERT INTO builder_quality_results (
              run_id, platform_id, platform_name, scene_id, scene_name,
              tier, call3_mode, builder_version, replicate_index, snapshot_hash,
              human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
              negative_prompt, input_hash, output_hash,
              assembled_char_count, raw_optimised_char_count, optimised_char_count,
              post_processing_changed, gpt_score, gpt_axes, gpt_directives, gpt_summary,
              median_score, anchor_audit, anchors_expected, anchors_preserved,
              anchors_dropped, critical_anchors_dropped,
              source, status, is_holdout
            ) VALUES (
              ${ctx.runId}, ${platformId}, ${platformId}, ${scene.id}, ${scene.name},
              ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, ${builderVersion},
              ${replicateIndex}, ${snapshot?.snapshotHash ?? null},
              ${scene.humanText}, ${assembledPrompt},
              ${c3Result.optimised}, ${c3Result.optimised},
              ${c3Result.negative ?? null},
              ${md5(assembledPrompt)}, ${md5(c3Result.optimised)},
              ${assembledPrompt.length}, ${c3Result.optimised.length},
              ${c3Result.optimised.length},
              ${false}, ${scoreResult.score},
              ${JSON.stringify(scoreResult.axes)},
              ${JSON.stringify(scoreResult.directives)},
              ${scoreResult.summary},
              ${scoreResult.score},
              ${JSON.stringify(audit)},
              ${scene.expectedAnchors.length}, ${preserved}, ${dropped}, ${critDropped},
              'batch', 'complete', ${scene.holdout}
            )
          `;
          insertedNewCount++;
        }

        // ── Update heartbeat + counter ────────────────────────
        completed++;
        scores.push(scoreResult.score);
        await updateHeartbeat(ctx.sql, ctx.runId, completed);

        const anchSummary = audit.length > 0
          ? ` anchors: ${preserved}/${scene.expectedAnchors.length}${critDropped > 0 ? ` (${critDropped} critical dropped!)` : ''}`
          : '';
        const updateTag = existingErrorRowId !== null ? ' [updated]' : '';
        log(`${label}: score=${scoreResult.score}${anchSummary}${updateTag}`);

      } catch (e) {
        errors++;
        logError(`${label}: ${e}`);

        // Store error result (or update existing error row with new error)
        try {
          if (existingErrorRowId !== null) {
            await ctx.sql`
              UPDATE builder_quality_results
              SET error_detail = ${String(e).slice(0, 500)}, created_at = NOW()
              WHERE id = ${existingErrorRowId}
            `;
          } else {
            await ctx.sql`
              INSERT INTO builder_quality_results (
                run_id, platform_id, platform_name, scene_id, scene_name,
                tier, call3_mode, builder_version, replicate_index,
                human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
                input_hash, output_hash,
                assembled_char_count, raw_optimised_char_count, optimised_char_count,
                post_processing_changed,
                gpt_score, gpt_axes, gpt_directives, gpt_summary,
                anchors_expected, anchors_preserved, anchors_dropped,
                critical_anchors_dropped,
                source, status, error_detail, is_holdout
              ) VALUES (
                ${ctx.runId}, ${platformId}, ${platformId}, ${scene.id}, ${scene.name},
                ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, ${builderVersion}, ${replicateIndex},
                ${scene.humanText}, ${assembledPrompt}, '', '',
                ${md5(assembledPrompt)}, '',
                ${assembledPrompt.length}, 0, 0,
                ${false},
                0, '{}', '[]', '',
                0, 0, 0, 0,
                'batch', 'error', ${String(e).slice(0, 500)}, ${scene.holdout}
              )
            `;
          }
        } catch { /* best effort */ }

        // Still update heartbeat on errors
        await updateHeartbeat(ctx.sql, ctx.runId, completed).catch(() => {});
      }

      // Brief pause between API calls
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return { completed, errors, scores, updatedErrorCount, insertedNewCount };
}

// ============================================================================
// AGGREGATION + SUMMARY (shared)
// ============================================================================

async function loadAndPrintSummary(
  sql: postgres.Sql,
  runId: string,
  args: { baseline: string | null; mode: string; holdout: boolean; scorer: string; replicates: number },
): Promise<void> {
  // ── Load results for aggregation ─────────────────────────────────
  const allResults = await sql`
    SELECT platform_id, platform_name, scene_id, scene_name, tier,
           replicate_index, gpt_score, anchors_expected, anchors_preserved,
           anchors_dropped, critical_anchors_dropped, anchor_audit,
           status, is_holdout
    FROM builder_quality_results
    WHERE run_id = ${runId} AND status = 'complete'
    ORDER BY platform_id, scene_id, replicate_index
  `;

  // ── Three-layer aggregation ──────────────────────────────────────
  const {
    aggregateByPlatform,
    aggregateByScene,
    aggregateByPlatformScene,
    compareToBaseline,
    checkCompatibility,
    getComparisonConfidence,
  } = await import('../src/lib/builder-quality/aggregation.js');

  const resultRows = allResults.map((r: Record<string, unknown>) => ({
    platform_id: r.platform_id as string,
    platform_name: r.platform_name as string,
    scene_id: r.scene_id as string,
    scene_name: r.scene_name as string,
    tier: r.tier as number,
    replicate_index: r.replicate_index as number,
    gpt_score: r.gpt_score as number,
    anchors_expected: r.anchors_expected as number,
    anchors_preserved: r.anchors_preserved as number,
    anchors_dropped: r.anchors_dropped as number,
    critical_anchors_dropped: r.critical_anchors_dropped as number,
    anchor_audit: r.anchor_audit as unknown[] | null,
    status: r.status as string,
    is_holdout: r.is_holdout as boolean,
  }));

  const platformAgg = aggregateByPlatform(resultRows);
  const sceneAgg = aggregateByScene(resultRows);
  const _platformSceneAgg = aggregateByPlatformScene(resultRows);

  // ── Baseline comparison ──────────────────────────────────────────
  if (args.baseline) {
    log('');
    log(`── Baseline Comparison: ${args.baseline} ──`);

    const baselineRunRows = await sql`
      SELECT mode, include_holdout, scorer_mode, replicate_count
      FROM builder_quality_runs WHERE run_id = ${args.baseline}
    `;

    if (baselineRunRows.length === 0) {
      logError(`Baseline run ${args.baseline} not found in database`);
    } else {
      const baselineRun = baselineRunRows[0] as Record<string, unknown>;
      const compat = checkCompatibility(
        { mode: args.mode, includeHoldout: args.holdout, scorerMode: args.scorer, replicateCount: args.replicates },
        {
          mode: baselineRun.mode as string,
          includeHoldout: baselineRun.include_holdout as boolean,
          scorerMode: baselineRun.scorer_mode as string,
          replicateCount: baselineRun.replicate_count as number,
        },
      );

      for (const w of compat.warnings) {
        log(`  ⚠ ${w}`);
      }

      if (compat.blocked) {
        logError(`  BLOCKED: ${compat.codes.filter((c: string) => c.endsWith('_BLOCKED')).join(', ')}`);
        log('  Comparison skipped — runs are not comparable.');
      } else {
        const confidence = getComparisonConfidence(args.replicates, baselineRun.replicate_count as number);
        log(`  Comparison confidence: ${confidence}`);

        const baselineResults = await sql`
          SELECT platform_id, platform_name, scene_id, scene_name, tier,
                 replicate_index, gpt_score, anchors_expected, anchors_preserved,
                 anchors_dropped, critical_anchors_dropped, anchor_audit,
                 status, is_holdout
          FROM builder_quality_results
          WHERE run_id = ${args.baseline} AND status = 'complete'
        `;

        const baselineRows = baselineResults.map((r: Record<string, unknown>) => ({
          platform_id: r.platform_id as string,
          platform_name: r.platform_name as string,
          scene_id: r.scene_id as string,
          scene_name: r.scene_name as string,
          tier: r.tier as number,
          replicate_index: r.replicate_index as number,
          gpt_score: r.gpt_score as number,
          anchors_expected: r.anchors_expected as number,
          anchors_preserved: r.anchors_preserved as number,
          anchors_dropped: r.anchors_dropped as number,
          critical_anchors_dropped: r.critical_anchors_dropped as number,
          anchor_audit: r.anchor_audit as unknown[] | null,
          status: r.status as string,
          is_holdout: r.is_holdout as boolean,
        }));

        const comparison = compareToBaseline(resultRows, baselineRows, confidence);

        log('');
        const classIcons: Record<string, string> = {
          regression: '⚠ REGRESSION',
          improvement: '✓ IMPROVEMENT',
          neutral: '— neutral',
          neutral_unstable: '~ neutral_unstable',
        };

        const regressions = comparison.platforms.filter((p: { classification: string }) => p.classification === 'regression');
        const improvements = comparison.platforms.filter((p: { classification: string }) => p.classification === 'improvement');
        const unstable = comparison.platforms.filter((p: { classification: string }) => p.classification === 'neutral_unstable');

        for (const p of comparison.platforms) {
          const icon = classIcons[p.classification] ?? '—';
          const delta = p.delta >= 0 ? `+${p.delta}` : `${p.delta}`;
          log(`  ${p.platformId.padEnd(22)} ${delta.padStart(6)}  crit_new=${p.criticalNewlyDropped}  ${icon}`);
        }

        if (comparison.worstSceneRegressions.length > 0) {
          log('');
          log('── Worst Scene Regressions ──');
          for (const sr of comparison.worstSceneRegressions) {
            log(`  ${sr.sceneId}: ${sr.baselineMean} → ${sr.currentMean} (${sr.delta})  critical newly dropped: ${sr.criticalNewlyDropped}`);
          }
        }

        log('');
        log('── Decision ──');
        log(`  Regressions flagged: ${regressions.length}${regressions.length > 0 ? ` (${regressions.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
        log(`  Improvements confirmed: ${improvements.length}${improvements.length > 0 ? ` (${improvements.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
        log(`  Unstable builders: ${unstable.length}${unstable.length > 0 ? ` (${unstable.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
      }
    }
  }

  // ── Platform summary ──────────────────────────────────────────────
  if (platformAgg.length > 0) {
    log('');
    log('── Platform Summary (sorted by mean, lowest first) ──');
    for (const p of platformAgg) {
      const unstableTag = p.unstableSceneCount > 0 ? `  [${p.unstableSceneCount} unstable]` : '';
      log(`  ${p.platformName.padEnd(22)} T${p.tier}  mean=${p.meanScore}  stddev=${p.stddevScore}  preserved=${p.preservationPct}%  crit=${p.criticalDropped}${unstableTag}`);
    }
  }

  // ── Scene summary ─────────────────────────────────────────────────
  if (sceneAgg.length > 0) {
    log('');
    log('── Scene Summary (weakest first) ──');
    for (const s of sceneAgg) {
      log(`  ${s.sceneId.padEnd(38)} mean=${s.meanScore}  stddev=${s.stddevScore}  preserved=${s.preservationPct}%`);
    }
  }
}

// ============================================================================
// HANDLE RERUN
// ============================================================================

async function handleRerun(args: CliArgs, sql: postgres.Sql): Promise<void> {
  const originalRunId = args.rerun!;

  // ── Validate original run ───────────────────────────────────────
  const original = await loadOriginalRunSettings(sql, originalRunId);
  if (!original) {
    logError(`Run "${originalRunId}" not found in database.`);
    process.exit(1);
  }
  if (original.status === 'running') {
    logError(`Run "${originalRunId}" has status 'running'. Use --resume instead.`);
    process.exit(1);
  }
  if (original.status === 'complete') {
    log(`Run "${originalRunId}" is complete (zero errors) — nothing to rerun.`);
    await sql.end();
    process.exit(0);
  }

  // ── Query error results ─────────────────────────────────────────
  const errorRows = await sql`
    SELECT DISTINCT platform_id, scene_id, replicate_index
    FROM builder_quality_results
    WHERE run_id = ${originalRunId} AND status = 'error'
  `;

  if (errorRows.length === 0) {
    log(`No errors to rerun from "${originalRunId}".`);
    await sql.end();
    process.exit(0);
  }

  const errorCombos = errorRows.map((r: Record<string, unknown>) => ({
    platformId: r.platform_id as string,
    sceneId: r.scene_id as string,
    replicateIndex: r.replicate_index as number,
  }));

  const uniquePlatforms = new Set(errorCombos.map((c) => c.platformId));

  // ── Print header ────────────────────────────────────────────────
  log('═══ BUILDER QUALITY BATCH RUNNER v1.3.0 ═══');
  log(`Mode: RERUN (parent: ${originalRunId})`);
  log(`Original run: ${original.createdAt.toISOString()}, scope=${original.scope}, scorer=${original.scorerMode}, replicates=${original.replicateCount}`);
  log(`Errors found: ${errorCombos.length} of ${original.totalExpected}`);
  log(`Re-running: ${errorCombos.length} combinations across ${uniquePlatforms.size} platforms`);
  log('');

  // ── Load data ───────────────────────────────────────────────────
  const scenes = loadScenes(original.includeHoldout);
  const snapshots = loadSnapshots(original.includeHoldout);
  const platformConfig = loadPlatformConfig();

  // ── Create child run ────────────────────────────────────────────
  const runId = generateRunId();
  const scorerPromptHash = md5(SCORER_VERSION + '-diagnostic-v2');

  await sql`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, status, total_expected, total_completed,
      parent_run_id, baseline_run_id, last_progress_at
    ) VALUES (
      ${runId}, ${original.mode}, ${'rerun:' + originalRunId},
      ${original.scorerMode}, ${original.replicateCount}, ${original.includeHoldout},
      ${SCORER_VERSION}, ${scorerPromptHash}, ${GPT_MODEL},
      'running', ${errorCombos.length}, 0,
      ${originalRunId}, ${args.baseline ?? null}, NOW()
    )
  `;
  log(`Rerun created: ${runId} (child of ${originalRunId})`);
  sigintRunId = runId;
  log('');

  // ── Run pipeline ────────────────────────────────────────────────
  const result = await runPipeline(
    { sql, runId, platformConfig, snapshots, scenes, mode: original.mode, errorRowIds: null },
    errorCombos,
    0,
  );

  // ── Finalise ────────────────────────────────────────────────────
  const finalCompleted = await recalculateTotalCompleted(sql, runId);
  const finalErrors = await countErrors(sql, runId);
  const finalStatus = determineFinalStatus(finalErrors);
  const overallMean = result.scores.length > 0
    ? Math.round((result.scores.reduce((a, b) => a + b, 0) / result.scores.length) * 100) / 100
    : null;

  await sql`
    UPDATE builder_quality_runs
    SET
      status = ${finalStatus},
      completed_at = NOW(),
      total_completed = ${finalCompleted},
      mean_gpt_score = ${overallMean},
      error_detail = ${finalErrors > 0 ? `${finalErrors} errors` : null}
    WHERE run_id = ${runId}
  `;

  // ── Summary ─────────────────────────────────────────────────────
  log('');
  log('═══ RERUN COMPLETE ═══');
  log(`Parent run: ${originalRunId}`);
  log(`Rerun ID: ${runId}`);
  log(`Status: ${finalStatus}`);
  log(`Re-ran: ${errorCombos.length} error results`);
  log(`Succeeded: ${result.completed}`);
  log(`Still failing: ${finalErrors}`);
  if (overallMean !== null) {
    log(`Mean GPT score: ${overallMean}`);
  }

  // Print aggregation + baseline if requested
  await loadAndPrintSummary(sql, runId, {
    baseline: args.baseline,
    mode: original.mode,
    holdout: original.includeHoldout,
    scorer: original.scorerMode,
    replicates: original.replicateCount,
  });

  log('');
  log('Next steps:');
  log(`  1. Check Neon: SELECT * FROM builder_quality_results WHERE run_id = '${runId}' ORDER BY gpt_score ASC LIMIT 10`);

  await sql.end();
}

// ============================================================================
// HANDLE RESUME
// ============================================================================

async function handleResume(args: CliArgs, sql: postgres.Sql): Promise<void> {
  const originalRunId = args.resume!;

  // ── Validate original run ───────────────────────────────────────
  const original = await loadOriginalRunSettings(sql, originalRunId);
  if (!original) {
    logError(`Run "${originalRunId}" not found in database.`);
    process.exit(1);
  }
  if (original.status === 'complete') {
    log(`Run "${originalRunId}" is already complete — nothing to resume.`);
    await sql.end();
    process.exit(0);
  }

  // ── Stale detection via heartbeat ───────────────────────────────
  if (original.status === 'running') {
    const lastProgress = original.lastProgressAt ?? original.createdAt;
    const ageMs = Date.now() - lastProgress.getTime();

    if (ageMs > STALE_THRESHOLD_MS) {
      // Stale — require --force
      if (!args.force) {
        logError(`Run "${originalRunId}" has status 'running' but last progress was ${formatDuration(ageMs)} ago.`);
        log('This may indicate the process crashed, or another terminal is still active but stalled.');
        log('');
        log('To proceed anyway, add --force:');
        log(`  npx tsx scripts/builder-quality-run.ts --resume ${originalRunId} --force`);
        await sql.end();
        process.exit(1);
      }
      log(`WARNING: Resuming stale run ${originalRunId} (last progress ${formatDuration(ageMs)} ago). --force acknowledged.`);
    } else {
      // Recently active — likely still running
      if (!args.force) {
        logError(`Run "${originalRunId}" appears to be actively running (last progress ${formatDuration(ageMs)} ago).`);
        log('Wait for it to finish, or if the process has crashed, wait 10 minutes then retry,');
        log('or use --force to override.');
        await sql.end();
        process.exit(1);
      }
      log(`WARNING: Overriding active run ${originalRunId} (last progress ${formatDuration(ageMs)} ago). --force acknowledged.`);
    }
  }

  // ── Query all existing results ──────────────────────────────────
  const existingRows = await sql`
    SELECT id, platform_id, scene_id, replicate_index, status
    FROM builder_quality_results
    WHERE run_id = ${originalRunId}
  `;

  const completedSet = new Set<ComboKey>();
  const errorMap = new Map<ComboKey, number>();

  for (const r of existingRows) {
    const row = r as Record<string, unknown>;
    const key = comboKey(
      row.platform_id as string,
      row.scene_id as string,
      row.replicate_index as number,
    );
    if (row.status === 'complete') {
      completedSet.add(key);
    } else if (row.status === 'error') {
      errorMap.set(key, row.id as number);
    }
  }

  // ── Reconstruct scope ───────────────────────────────────────────
  const scenes = loadScenes(original.includeHoldout);
  const snapshots = loadSnapshots(original.includeHoldout);
  const platformConfig = loadPlatformConfig();

  let platforms: string[];
  if (original.scope === 'all') {
    platforms = getActivePlatforms(platformConfig, null);
  } else if (original.scope.startsWith('rerun:')) {
    // Resuming a rerun — scope is the error combos from the parent
    // Just use whatever platforms appear in existing results + errors
    const allPlatformIds = new Set<string>();
    for (const r of existingRows) {
      allPlatformIds.add((r as Record<string, unknown>).platform_id as string);
    }
    platforms = [...allPlatformIds];
  } else {
    platforms = [original.scope];
  }

  // Build full expected combinations
  const allCombinations: { platformId: string; sceneId: string; replicateIndex: number }[] = [];
  for (const platformId of platforms) {
    const tier = platformConfig[platformId]?.tier ?? 3;
    for (const scene of scenes) {
      // Check if this scene's snapshot exists for this tier (builder mode only)
      if (original.mode === 'builder') {
        const snapshotKey = `${scene.id}:${tier}`;
        if (!snapshots.has(snapshotKey)) continue;
      }
      for (let rep = 1; rep <= original.replicateCount; rep++) {
        allCombinations.push({ platformId, sceneId: scene.id, replicateIndex: rep });
      }
    }
  }

  // Filter to remaining = not completed
  const remaining = allCombinations.filter(
    (c) => !completedSet.has(comboKey(c.platformId, c.sceneId, c.replicateIndex)),
  );

  const errorRetries = remaining.filter(
    (c) => errorMap.has(comboKey(c.platformId, c.sceneId, c.replicateIndex)),
  ).length;
  const neverAttempted = remaining.length - errorRetries;

  if (remaining.length === 0) {
    log(`Run "${originalRunId}" already has all combinations complete — nothing to resume.`);
    // Ensure status is correct
    await sql`
      UPDATE builder_quality_runs
      SET status = 'complete', completed_at = NOW()
      WHERE run_id = ${originalRunId}
    `;
    await sql.end();
    process.exit(0);
  }

  // ── Print header ────────────────────────────────────────────────
  log('═══ BUILDER QUALITY BATCH RUNNER v1.3.0 ═══');
  log(`Mode: RESUME (run: ${originalRunId})`);
  log(`Original run: ${original.createdAt.toISOString()}, scope=${original.scope}, scorer=${original.scorerMode}, replicates=${original.replicateCount}`);
  log(`Already completed: ${completedSet.size} of ${original.totalExpected}`);
  log(`Previously errored (will retry): ${errorRetries}`);
  log(`Never attempted: ${neverAttempted}`);
  log(`Remaining: ${remaining.length} combinations`);
  log('');

  // ── Prepare run for resumption ──────────────────────────────────
  await sql`
    UPDATE builder_quality_runs
    SET status = 'running', completed_at = ${null}, last_progress_at = NOW(),
        resumed_at = NOW()
    WHERE run_id = ${originalRunId}
  `;
  sigintRunId = originalRunId;

  // ── Run pipeline ────────────────────────────────────────────────
  const result = await runPipeline(
    { sql, runId: originalRunId, platformConfig, snapshots, scenes, mode: original.mode, errorRowIds: errorMap },
    remaining,
    completedSet.size,
  );

  // ── Finalise (recalculate from actual row states) ───────────────
  const finalCompleted = await recalculateTotalCompleted(sql, originalRunId);
  const finalErrors = await countErrors(sql, originalRunId);
  const finalStatus = determineFinalStatus(finalErrors);

  // Calculate mean from all complete results
  const allScores = await sql`
    SELECT gpt_score FROM builder_quality_results
    WHERE run_id = ${originalRunId} AND status = 'complete'
  `;
  const allScoreValues = allScores.map((r: Record<string, unknown>) => r.gpt_score as number);
  const overallMean = allScoreValues.length > 0
    ? Math.round((allScoreValues.reduce((a: number, b: number) => a + b, 0) / allScoreValues.length) * 100) / 100
    : null;

  await sql`
    UPDATE builder_quality_runs
    SET
      status = ${finalStatus},
      completed_at = NOW(),
      total_completed = ${finalCompleted},
      mean_gpt_score = ${overallMean},
      error_detail = ${finalErrors > 0 ? `${finalErrors} errors` : null}
    WHERE run_id = ${originalRunId}
  `;

  // ── Summary ─────────────────────────────────────────────────────
  log('');
  log('═══ RESUME COMPLETE ═══');
  log(`Run ID: ${originalRunId}`);
  log(`Status: ${finalStatus}`);
  log(`Total: ${finalCompleted + finalErrors} (${completedSet.size} prior + ${remaining.length} resumed)`);
  if (result.updatedErrorCount > 0) {
    log(`Previously errored → now complete: ${result.updatedErrorCount}`);
  }
  log(`New results: ${result.insertedNewCount}`);
  log(`Still failing: ${finalErrors}`);
  if (overallMean !== null) {
    log(`Mean GPT score: ${overallMean}`);
  }

  // Print aggregation + baseline if requested
  await loadAndPrintSummary(sql, originalRunId, {
    baseline: args.baseline,
    mode: original.mode,
    holdout: original.includeHoldout,
    scorer: original.scorerMode,
    replicates: original.replicateCount,
  });

  log('');
  log('Next steps:');
  log(`  1. Check Neon: SELECT * FROM builder_quality_results WHERE run_id = '${originalRunId}' ORDER BY gpt_score ASC LIMIT 10`);
  if (finalErrors > 0) {
    log(`  2. Rerun remaining errors: npx tsx scripts/builder-quality-run.ts --rerun ${originalRunId}`);
  }

  await sql.end();
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // ── Preflight checks ─────────────────────────────────────────────
  if (!BUILDER_QUALITY_KEY) {
    logError('BUILDER_QUALITY_KEY not set in .env.local');
    process.exit(1);
  }

  // ── Database setup ───────────────────────────────────────────────
  const sql = createDb();
  try {
    await ensureTables(sql);
    logSuccess('Database tables verified');
  } catch (e) {
    logError(`Database setup failed: ${e}`);
    await sql.end();
    process.exit(1);
  }

  // ── Register SIGINT handler ──────────────────────────────────────
  sigintSql = sql;
  registerSigintHandler();

  // ── Route to rerun/resume if applicable ──────────────────────────
  if (args.rerun) {
    await handleRerun(args, sql);
    return;
  }
  if (args.resume) {
    await handleResume(args, sql);
    return;
  }

  // ── Normal run ───────────────────────────────────────────────────
  log('═══ BUILDER QUALITY BATCH RUNNER v1.3.0 ═══');
  log(`Mode: ${args.mode}`);
  log(`Scope: ${args.all ? 'all platforms' : args.platform}`);
  log(`Scorer: ${args.scorer}`);
  log(`Replicates: ${args.replicates}`);
  log(`Holdout: ${args.holdout}`);
  log('');

  // ── Load data ────────────────────────────────────────────────────
  const scenes = loadScenes(args.holdout);
  const snapshots = loadSnapshots(args.holdout);
  const platformConfig = loadPlatformConfig();
  const platforms = getActivePlatforms(platformConfig, args.platform);

  log(`Scenes: ${scenes.length}`);
  log(`Snapshots: ${snapshots.size}`);
  log(`Platforms: ${platforms.length}`);

  const totalExpected = platforms.length * scenes.length * args.replicates;
  log(`Total expected results: ${totalExpected}`);
  log('');

  // ── Create run record ────────────────────────────────────────────
  const runId = generateRunId();
  const scorerPromptHash = md5(SCORER_VERSION + '-diagnostic-v2');

  await sql`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, status, total_expected, total_completed,
      baseline_run_id, last_progress_at
    ) VALUES (
      ${runId}, ${args.mode}, ${args.all ? 'all' : args.platform!},
      ${args.scorer}, ${args.replicates}, ${args.holdout},
      ${SCORER_VERSION}, ${scorerPromptHash}, ${GPT_MODEL},
      'running', ${totalExpected}, 0,
      ${args.baseline ?? null}, NOW()
    )
  `;
  log(`Run created: ${runId}`);
  sigintRunId = runId;
  log('');

  // ── Build combinations list ──────────────────────────────────────
  const combinations: { platformId: string; sceneId: string; replicateIndex: number }[] = [];
  for (const platformId of platforms) {
    for (const scene of scenes) {
      for (let rep = 1; rep <= args.replicates; rep++) {
        combinations.push({ platformId, sceneId: scene.id, replicateIndex: rep });
      }
    }
  }

  // ── Run pipeline ─────────────────────────────────────────────────
  const result = await runPipeline(
    { sql, runId, platformConfig, snapshots, scenes, mode: args.mode, errorRowIds: null },
    combinations,
    0,
  );

  // ── Finalise run (v1.2.0: recalculate from DB, tightened status) ─
  const finalCompleted = await recalculateTotalCompleted(sql, runId);
  const finalErrors = await countErrors(sql, runId);
  const finalStatus = determineFinalStatus(finalErrors);
  const overallMean = result.scores.length > 0
    ? Math.round((result.scores.reduce((a, b) => a + b, 0) / result.scores.length) * 100) / 100
    : null;

  await sql`
    UPDATE builder_quality_runs
    SET
      status = ${finalStatus},
      completed_at = NOW(),
      total_completed = ${finalCompleted},
      mean_gpt_score = ${overallMean},
      error_detail = ${finalErrors > 0 ? `${finalErrors} errors` : null}
    WHERE run_id = ${runId}
  `;

  // ── Summary header ───────────────────────────────────────────────
  log('');
  log('═══ BATCH RUN COMPLETE ═══');
  log(`Run ID: ${runId}`);
  log(`Status: ${finalStatus}`);
  log(`Completed: ${finalCompleted}/${totalExpected}`);
  log(`Errors: ${finalErrors}`);
  if (overallMean !== null) {
    log(`Mean GPT score: ${overallMean}`);
    log(`Score range: ${Math.min(...result.scores)}–${Math.max(...result.scores)}`);
  }

  // Print aggregation + baseline
  await loadAndPrintSummary(sql, runId, {
    baseline: args.baseline,
    mode: args.mode,
    holdout: args.holdout,
    scorer: args.scorer,
    replicates: args.replicates,
  });

  log('');
  log('Next steps:');
  log(`  1. Check Neon: SELECT * FROM builder_quality_results WHERE run_id = '${runId}' ORDER BY gpt_score ASC LIMIT 10`);
  if (!args.baseline) {
    log(`  2. Run with baseline: npx tsx scripts/builder-quality-run.ts --all --mode builder --baseline ${runId}`);
  }
  if (finalErrors > 0) {
    log(`  3. Resume or rerun errors: npx tsx scripts/builder-quality-run.ts --resume ${runId} --force`);
  }

  await sql.end();
}

main().catch(async (e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
