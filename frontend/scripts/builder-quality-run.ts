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
// Requirements:
//   - Dev server running on localhost:3000
//   - DATABASE_URL or POSTGRES_URL in .env.local
//   - BUILDER_QUALITY_KEY in .env.local
//   - Frozen snapshots generated (run generate-snapshots.ts first)
//
// v1.0.0 (3 Apr 2026): Initial implementation.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §7
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
    }
  }

  if (!result.platform && !result.all) {
    console.error('Usage: npx tsx scripts/builder-quality-run.ts --platform <id> | --all [--mode builder] [--holdout]');
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

  log('═══ BUILDER QUALITY BATCH RUNNER v1.0.0 ═══');
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

  // ── Create run record ────────────────────────────────────────────
  const runId = generateRunId();
  const scorerPromptHash = md5(SCORER_VERSION + '-diagnostic-v2');

  await sql`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, status, total_expected, total_completed
    ) VALUES (
      ${runId}, ${args.mode}, ${args.all ? 'all' : args.platform!},
      ${args.scorer}, ${args.replicates}, ${args.holdout},
      ${SCORER_VERSION}, ${scorerPromptHash}, ${GPT_MODEL},
      'running', ${totalExpected}, 0
    )
  `;
  log(`Run created: ${runId}`);
  log('');

  // ── Run pipeline ─────────────────────────────────────────────────
  let completed = 0;
  let errors = 0;
  const scores: number[] = [];

  for (const platformId of platforms) {
    const pConfig = platformConfig[platformId]!;
    const tier = pConfig.tier ?? 3;
    const builderVersion = getBuilderVersion(platformId, platformConfig);

    log(`── ${platformId} (T${tier}) ──`);

    for (const scene of scenes) {
      for (let rep = 1; rep <= args.replicates; rep++) {
        const snapshotKey = `${scene.id}:${tier}`;
        const snapshot = snapshots.get(snapshotKey);

        if (!snapshot && args.mode === 'builder') {
          logError(`  ${scene.id} rep${rep}: no snapshot for T${tier} — skipping`);
          errors++;
          continue;
        }

        const assembledPrompt = snapshot?.assembledPrompt ?? scene.humanText;
        const label = `  ${scene.id}${args.replicates > 1 ? ` rep${rep}` : ''}`;

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

          // ── Store result ──────────────────────────────────────
          await sql`
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
              ${runId}, ${platformId}, ${platformId}, ${scene.id}, ${scene.name},
              ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, ${builderVersion},
              ${rep}, ${snapshot?.snapshotHash ?? null},
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

          // ── Update run counter ────────────────────────────────
          completed++;
          scores.push(scoreResult.score);
          await sql`
            UPDATE builder_quality_runs
            SET total_completed = ${completed}
            WHERE run_id = ${runId}
          `;

          const anchSummary = audit.length > 0
            ? ` anchors: ${preserved}/${scene.expectedAnchors.length}${critDropped > 0 ? ` (${critDropped} critical dropped!)` : ''}`
            : '';
          log(`${label}: score=${scoreResult.score}${anchSummary}`);

        } catch (e) {
          errors++;
          logError(`${label}: ${e}`);

          // Store error result
          try {
            await sql`
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
                ${runId}, ${platformId}, ${platformId}, ${scene.id}, ${scene.name},
                ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, ${builderVersion}, ${rep},
                ${scene.humanText}, ${assembledPrompt}, '', '',
                ${md5(assembledPrompt)}, '',
                ${assembledPrompt.length}, 0, 0,
                ${false},
                0, '{}', '[]', '',
                0, 0, 0, 0,
                'batch', 'error', ${String(e).slice(0, 500)}, ${scene.holdout}
              )
            `;
          } catch { /* best effort */ }
        }

        // Brief pause between API calls
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  // ── Finalise run ─────────────────────────────────────────────────
  const overallMean = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null;

  const runStatus = errors > totalExpected * 0.5 ? 'partial' : 'complete';

  await sql`
    UPDATE builder_quality_runs
    SET
      status = ${runStatus},
      completed_at = NOW(),
      total_completed = ${completed},
      mean_gpt_score = ${overallMean},
      error_detail = ${errors > 0 ? `${errors} errors` : null}
    WHERE run_id = ${runId}
  `;

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
  // Import aggregation dynamically (relative path — scripts can't use @/ aliases)
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

  // ── Summary header ───────────────────────────────────────────────
  log('');
  log('═══ BATCH RUN COMPLETE ═══');
  log(`Run ID: ${runId}`);
  log(`Status: ${runStatus}`);
  log(`Completed: ${completed}/${totalExpected}`);
  log(`Errors: ${errors}`);
  if (overallMean !== null) {
    log(`Mean GPT score: ${overallMean}`);
    log(`Score range: ${Math.min(...scores)}–${Math.max(...scores)}`);
  }

  // ── Baseline comparison ──────────────────────────────────────────
  if (args.baseline) {
    log('');
    log(`── Baseline Comparison: ${args.baseline} ──`);

    // Load baseline run metadata
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

      // Show warnings
      for (const w of compat.warnings) {
        log(`  ⚠ ${w}`);
      }

      if (compat.blocked) {
        logError(`  BLOCKED: ${compat.codes.filter((c: string) => c.endsWith('_BLOCKED')).join(', ')}`);
        log('  Comparison skipped — runs are not comparable.');
      } else {
        const confidence = getComparisonConfidence(args.replicates, baselineRun.replicate_count as number);
        log(`  Comparison confidence: ${confidence}`);

        // Load baseline results
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

        // Platform deltas
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

        // Worst scene regressions
        if (comparison.worstSceneRegressions.length > 0) {
          log('');
          log('── Worst Scene Regressions ──');
          for (const sr of comparison.worstSceneRegressions) {
            log(`  ${sr.sceneId}: ${sr.baselineMean} → ${sr.currentMean} (${sr.delta})  critical newly dropped: ${sr.criticalNewlyDropped}`);
          }
        }

        // Decision summary
        log('');
        log('── Decision ──');
        log(`  Regressions flagged: ${regressions.length}${regressions.length > 0 ? ` (${regressions.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
        log(`  Improvements confirmed: ${improvements.length}${improvements.length > 0 ? ` (${improvements.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
        log(`  Unstable builders: ${unstable.length}${unstable.length > 0 ? ` (${unstable.map((r: { platformId: string }) => r.platformId).join(', ')})` : ''}`);
      }
    }
  }

  // ── Platform summary (always shown) ──────────────────────────────
  if (platformAgg.length > 0) {
    log('');
    log('── Platform Summary (sorted by mean, lowest first) ──');
    for (const p of platformAgg) {
      const unstableTag = p.unstableSceneCount > 0 ? `  [${p.unstableSceneCount} unstable]` : '';
      log(`  ${p.platformName.padEnd(22)} T${p.tier}  mean=${p.meanScore}  stddev=${p.stddevScore}  preserved=${p.preservationPct}%  crit=${p.criticalDropped}${unstableTag}`);
    }
  }

  // ── Scene summary (always shown) ─────────────────────────────────
  if (sceneAgg.length > 0) {
    log('');
    log('── Scene Summary (weakest first) ──');
    for (const s of sceneAgg) {
      log(`  ${s.sceneId.padEnd(38)} mean=${s.meanScore}  stddev=${s.stddevScore}  preserved=${s.preservationPct}%`);
    }
  }

  log('');
  log('Next steps:');
  log(`  1. Check Neon: SELECT * FROM builder_quality_results WHERE run_id = '${runId}' ORDER BY gpt_score ASC LIMIT 10`);
  if (!args.baseline) {
    log(`  2. Run with baseline: npx tsx scripts/builder-quality-run.ts --all --mode builder --baseline ${runId}`);
  }

  await sql.end();
}

main().catch(async (e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
