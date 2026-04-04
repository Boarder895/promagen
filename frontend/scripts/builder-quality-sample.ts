#!/usr/bin/env npx tsx
// scripts/builder-quality-sample.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — User Sampling Script
// ============================================================================
// Samples real user prompts from Community Pulse, scores them via the
// scoring route, and stores results with source='user_sample'.
//
// Usage (from frontend/, dev server must be running):
//   npx tsx scripts/builder-quality-sample.ts
//   npx tsx scripts/builder-quality-sample.ts --platform midjourney
//   npx tsx scripts/builder-quality-sample.ts --days 7
//   npx tsx scripts/builder-quality-sample.ts --dry-run
//
// Requirements:
//   - Dev server running on localhost:3000
//   - DATABASE_URL or POSTGRES_URL in .env.local
//   - BUILDER_QUALITY_KEY in .env.local
//   - Community Pulse entries with source='user' in prompt_showcase_entries
//
// Part 11 v1.0.0 (4 Apr 2026): Initial implementation.
//   ChatGPT review: 97/100, signed off.
//
// IMPORTANT FRAMING: Part 11 v1 measures historical output quality from
// real usage, not current builder regression against real phrasing. It
// answers "how good were the prompts we actually delivered?" — not "how
// good would the current builder do on this input today?"
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §10
// Build plan: part-11-build-plan v1.1.0
// ============================================================================

import { readFileSync } from 'node:fs';
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
const SCORE_ENDPOINT = `${BASE_URL}/api/score-prompt`;
const BUILDER_QUALITY_KEY = process.env.BUILDER_QUALITY_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const GPT_MODEL = 'gpt-5.4-mini';
const SCORER_VERSION = '2.0.0';

// ============================================================================
// TYPES
// ============================================================================

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
  call3Mode?: string;
}

interface ShowcaseEntry {
  id: string;
  platformId: string;
  promptText: string;
  description: string;
  tier: string;
  showcaseScore: number;
  createdAt: Date;
}

interface CliArgs {
  platform: string | null;
  days: number;
  maxPerPlatform: number;
  dryRun: boolean;
  baseline: string | null;
}

// ============================================================================
// SIGINT STATE
// ============================================================================

let sigintRunId: string | null = null;
let sigintSql: postgres.Sql | null = null;
let sigintLastLabel = '';
let sigintHandled = false;

function registerSigintHandler(): void {
  process.on('SIGINT', async () => {
    if (sigintHandled) process.exit(130);
    sigintHandled = true;
    console.log('');
    log('');
    log('⚠ INTERRUPTED (Ctrl+C)');
    if (sigintLastLabel) log(`Last processing: ${sigintLastLabel}`);
    if (sigintRunId && sigintSql) {
      try {
        await sigintSql`
          UPDATE builder_quality_runs
          SET status = 'partial',
              error_detail = COALESCE(error_detail, '') || ' [interrupted by SIGINT]'
          WHERE run_id = ${sigintRunId} AND status = 'running'
        `;
        log(`Run ${sigintRunId} marked as 'partial'`);
      } catch (e) { logError(`Could not update run status: ${e}`); }
      try { await sigintSql.end(); } catch { /* best effort */ }
    }
    log('Resume with: npx tsx scripts/builder-quality-sample.ts');
    process.exit(130);
  });
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

function generateRunId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `bqr-sample-${ts}-${rand}`;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

// ============================================================================
// JUNK FILTERING
// ============================================================================

/** Returns true if the prompt text is junk and should be skipped */
function isJunk(promptText: string): boolean {
  const trimmed = promptText.trim();

  // Too short
  if (trimmed.length < 20) return true;

  // Single token (no spaces)
  if (!trimmed.includes(' ')) return true;

  // Mostly non-alphanumeric (>50%)
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (alphaNum.length < trimmed.length * 0.5) return true;

  // Contains raw URLs
  if (/https?:\/\//i.test(trimmed)) return true;

  // Known placeholder strings
  const placeholders = ['test', 'asdf', 'hello world', 'testing', 'aaa', 'xxx', 'lorem ipsum'];
  if (placeholders.includes(trimmed.toLowerCase())) return true;

  return false;
}

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    platform: null,
    days: 7,
    maxPerPlatform: 1,
    dryRun: false,
    baseline: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--platform':
        result.platform = args[++i] || null;
        break;
      case '--days':
        result.days = parseInt(args[++i] || '7', 10) || 7;
        break;
      case '--max-per-platform':
        result.maxPerPlatform = parseInt(args[++i] || '1', 10) || 1;
        break;
      case '--dry-run':
        result.dryRun = true;
        break;
      case '--baseline':
        result.baseline = args[++i] || null;
        break;
    }
  }

  return result;
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadPlatformConfig(): Record<string, PlatformConfig> {
  const configPath = resolve('src/data/providers/platform-config.json');
  const raw = JSON.parse(readFileSync(configPath, 'utf8'));
  return raw.platforms as Record<string, PlatformConfig>;
}

// ============================================================================
// DATABASE
// ============================================================================

function createDb() {
  if (!DATABASE_URL) {
    logError('DATABASE_URL not configured. Set it in .env.local');
    process.exit(1);
  }
  return postgres(DATABASE_URL, { max: 3, idle_timeout: 20, ssl: 'require', onnotice: () => {} });
}

// ============================================================================
// SCORING
// ============================================================================

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

async function scorePrompt(
  optimisedPrompt: string,
  humanText: string,
  platformId: string,
  platformConfig: PlatformConfig,
): Promise<{
  score: number;
  axes: Record<string, number | null>;
  directives: string[];
  summary: string;
}> {
  const body = {
    optimisedPrompt: truncate(optimisedPrompt, 2000),
    humanText: truncate(humanText, 1000),
    assembledPrompt: truncate(optimisedPrompt, 2000), // Option A: use optimised as stand-in (original not available)
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
    // No expectedAnchors — user prompts have no predefined anchor set
  };

  const res = await fetchWithRetry(SCORE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Builder-Quality-Key': BUILDER_QUALITY_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Score failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  return await res.json();
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (!BUILDER_QUALITY_KEY) {
    logError('BUILDER_QUALITY_KEY not set in .env.local');
    process.exit(1);
  }

  log('═══ BUILDER QUALITY USER SAMPLING v1.0.0 ═══');
  log(`Look-back: ${args.days} days`);
  log(`Max per platform: ${args.maxPerPlatform}`);
  if (args.platform) log(`Platform filter: ${args.platform}`);
  if (args.dryRun) log('DRY RUN — no scoring, no storage');
  log('');

  // ── Load platform config ────────────────────────────────────────
  const platformConfig = loadPlatformConfig();
  const activePlatforms = new Set(
    Object.entries(platformConfig)
      .filter(([, v]) => !v._removed)
      .map(([k]) => k),
  );

  // ── Database setup ──────────────────────────────────────────────
  const sql = createDb();
  sigintSql = sql;
  registerSigintHandler();

  // ── Ensure Part 11 columns exist ────────────────────────────────
  // The batch runner's ensureTables() creates these, but the sampling
  // script may run before the batch runner has been executed post-deploy.
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_entry_id TEXT`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_created_at TIMESTAMPTZ`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS showcase_tier TEXT`;
  await sql`ALTER TABLE builder_quality_results ADD COLUMN IF NOT EXISTS scorer_version TEXT`;
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bqr_results_unique_user_sample
      ON builder_quality_results (showcase_entry_id, scorer_version)
      WHERE source = 'user_sample' AND showcase_entry_id IS NOT NULL
    `;
  } catch { /* index may already exist */ }

  // ── Query eligible entries ──────────────────────────────────────
  // "Most recent unsampled" — entries already scored are excluded
  const daysInterval = `${args.days} days`;
  const platformFilter = args.platform ? sql`AND e.platform_id = ${args.platform}` : sql``;

  const eligibleRows = await sql`
    SELECT e.id, e.platform_id, e.prompt_text, e.description,
           e.tier, COALESCE(e.score, 0) AS score, e.created_at
    FROM prompt_showcase_entries e
    WHERE e.source = 'user'
      AND e.created_at > NOW() - ${daysInterval}::interval
      AND e.platform_id IS NOT NULL
      AND LENGTH(e.prompt_text) >= 20
      AND NOT EXISTS (
        SELECT 1 FROM builder_quality_results bqr
        WHERE bqr.showcase_entry_id = e.id
          AND bqr.source = 'user_sample'
          AND bqr.status = 'complete'
      )
      ${platformFilter}
    ORDER BY e.platform_id, e.created_at DESC
  `;

  // ── Group by platform, apply junk filter + max-per-platform ─────
  const byPlatform = new Map<string, ShowcaseEntry[]>();

  for (const row of eligibleRows) {
    const r = row as Record<string, unknown>;
    const platformId = r.platform_id as string;

    // Skip inactive/removed platforms
    if (!activePlatforms.has(platformId)) continue;

    const promptText = r.prompt_text as string;
    if (isJunk(promptText)) continue;

    const arr = byPlatform.get(platformId) || [];
    if (arr.length >= args.maxPerPlatform) continue; // Already have enough for this platform

    arr.push({
      id: r.id as string,
      platformId,
      promptText,
      description: (r.description as string) || '',
      tier: (r.tier as string) || 'tier3',
      showcaseScore: r.score as number,
      createdAt: new Date(r.created_at as string),
    });
    byPlatform.set(platformId, arr);
  }

  const totalSamples = Array.from(byPlatform.values()).reduce((sum, arr) => sum + arr.length, 0);

  log(`Platforms with eligible entries: ${byPlatform.size} of ${activePlatforms.size}`);
  log(`Sampling: ${totalSamples} total`);
  log('');

  if (totalSamples === 0) {
    log('No eligible user entries found. Nothing to sample.');
    await sql.end();
    return;
  }

  // ── Dry run: show selections and exit ───────────────────────────
  if (args.dryRun) {
    log('── DRY RUN — Selected entries ──');
    for (const [platformId, entries] of byPlatform) {
      for (const entry of entries) {
        log(`  ${platformId}: ${entry.id} (${entry.createdAt.toISOString()}) "${truncate(entry.description || entry.promptText, 60)}"`);
      }
    }
    log('');
    log('No scoring performed. Remove --dry-run to execute.');
    await sql.end();
    return;
  }

  // ── Create run record ───────────────────────────────────────────
  const runId = generateRunId();
  const scorerPromptHash = md5(SCORER_VERSION + '-diagnostic-v2');

  await sql`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, status, total_expected, total_completed,
      last_progress_at
    ) VALUES (
      ${runId}, 'user_sample',
      ${args.platform ? 'sample:' + args.platform : 'sample'},
      'gpt_only', 1, ${false},
      ${SCORER_VERSION}, ${scorerPromptHash}, ${GPT_MODEL},
      'running', ${totalSamples}, 0, NOW()
    )
  `;

  sigintRunId = runId;
  log(`Run created: ${runId}`);
  log('');

  // ── Score each entry ────────────────────────────────────────────
  let succeeded = 0;
  let failed = 0;
  const skippedJunk = 0;
  const scores: number[] = [];

  for (const [platformId, entries] of byPlatform) {
    const pConfig = platformConfig[platformId];
    if (!pConfig) {
      logError(`Platform "${platformId}" not in config — skipping`);
      failed += entries.length;
      continue;
    }

    const tier = pConfig.tier ?? 3;
    log(`── ${platformId} (T${tier}) ──`);

    for (const entry of entries) {
      sigintLastLabel = `${platformId} / ${entry.id}`;

      try {
        const scoreResult = await scorePrompt(
          entry.promptText,
          entry.description,
          platformId,
          pConfig,
        );

        // ── Store result ──────────────────────────────────────
        // Remove any prior error row for this entry (retry scenario)
        await sql`
          DELETE FROM builder_quality_results
          WHERE showcase_entry_id = ${entry.id}
            AND source = 'user_sample'
            AND status = 'error'
        `;
        await sql`
          INSERT INTO builder_quality_results (
            run_id, platform_id, platform_name, scene_id, scene_name,
            tier, call3_mode, builder_version, replicate_index,
            snapshot_hash, showcase_entry_id, showcase_created_at, showcase_tier,
            human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
            negative_prompt, input_hash, output_hash,
            assembled_char_count, raw_optimised_char_count, optimised_char_count,
            post_processing_changed,
            gpt_score, gpt_axes, gpt_directives, gpt_summary,
            scorer_version,
            median_score,
            anchor_audit, anchors_expected, anchors_preserved,
            anchors_dropped, critical_anchors_dropped,
            source, status, is_holdout
          ) VALUES (
            ${runId}, ${platformId}, ${platformId},
            ${'user-sample-' + entry.id}, ${truncate(entry.description || 'user prompt', 100)},
            ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, 'n/a', 1,
            ${null}, ${entry.id}, ${entry.createdAt}, ${entry.tier},
            ${entry.description}, '', ${entry.promptText}, ${entry.promptText},
            ${null}, ${md5(entry.promptText)}, ${md5(entry.promptText)},
            0, ${entry.promptText.length}, ${entry.promptText.length},
            ${false},
            ${scoreResult.score}, ${JSON.stringify(scoreResult.axes)},
            ${JSON.stringify(scoreResult.directives)}, ${scoreResult.summary},
            ${SCORER_VERSION},
            ${scoreResult.score},
            ${null}, 0, 0, 0, 0,
            'user_sample', 'complete', ${false}
          )
        `;

        succeeded++;
        scores.push(scoreResult.score);

        // Heartbeat
        await sql`
          UPDATE builder_quality_runs
          SET total_completed = ${succeeded}, last_progress_at = NOW()
          WHERE run_id = ${runId}
        `;

        log(`  Entry: ${entry.id} (${entry.createdAt.toISOString().slice(0, 10)}, T${tier})`);
        log(`  "${truncate(entry.description || entry.promptText, 50)}"`);
        log(`  Score: ${scoreResult.score}`);

      } catch (e) {
        failed++;
        logError(`  ${entry.id}: ${e}`);

        // Store error result
        try {
          // Remove any prior error row for this entry (retry scenario)
          await sql`
            DELETE FROM builder_quality_results
            WHERE showcase_entry_id = ${entry.id}
              AND source = 'user_sample'
              AND status = 'error'
          `;
          await sql`
            INSERT INTO builder_quality_results (
              run_id, platform_id, platform_name, scene_id, scene_name,
              tier, call3_mode, builder_version, replicate_index,
              showcase_entry_id, showcase_created_at, showcase_tier,
              human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
              input_hash, output_hash,
              assembled_char_count, raw_optimised_char_count, optimised_char_count,
              post_processing_changed,
              gpt_score, gpt_axes, gpt_directives, gpt_summary,
              scorer_version,
              anchors_expected, anchors_preserved, anchors_dropped, critical_anchors_dropped,
              source, status, error_detail, is_holdout
            ) VALUES (
              ${runId}, ${platformId}, ${platformId},
              ${'user-sample-' + entry.id}, ${truncate(entry.description || 'user prompt', 100)},
              ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, 'n/a', 1,
              ${entry.id}, ${entry.createdAt}, ${entry.tier},
              ${entry.description}, '', '', '',
              ${md5(entry.promptText)}, '',
              0, 0, 0, ${false},
              0, '{}', '[]', '',
              ${SCORER_VERSION},
              0, 0, 0, 0,
              'user_sample', 'error', ${String(e).slice(0, 500)}, ${false}
            )
          `;
        } catch { /* best effort */ }

        // Still update heartbeat
        await sql`
          UPDATE builder_quality_runs
          SET last_progress_at = NOW()
          WHERE run_id = ${runId}
        `.catch(() => {});
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ── Finalise run ────────────────────────────────────────────────
  const finalStatus = failed === 0 && succeeded > 0 ? 'complete' : 'partial';
  const overallMean = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : null;

  await sql`
    UPDATE builder_quality_runs
    SET
      status = ${finalStatus},
      completed_at = NOW(),
      total_completed = ${succeeded},
      mean_gpt_score = ${overallMean},
      error_detail = ${failed > 0 ? `${failed} errors` : null}
    WHERE run_id = ${runId}
  `;

  // ── Summary ─────────────────────────────────────────────────────
  log('');
  log('═══ SAMPLING COMPLETE ═══');
  log(`Run ID: ${runId}`);
  log(`Status: ${finalStatus}`);
  log(`Attempted: ${succeeded + failed}`);
  log(`Succeeded: ${succeeded}`);
  log(`Failed: ${failed}`);
  log(`Skipped (junk): ${skippedJunk}`);
  if (overallMean !== null) {
    log(`Mean score (succeeded): ${overallMean}`);
    log(`Score range: ${Math.min(...scores)}–${Math.max(...scores)}`);
  }

  // Platforms below 70
  const platformScores = new Map<string, number[]>();
  for (const [platformId] of byPlatform) {
    const pScores: number[] = [];
    // We'd need to track per-platform scores in the loop above for full accuracy,
    // but for the summary we re-query
    const rows = await sql`
      SELECT gpt_score FROM builder_quality_results
      WHERE run_id = ${runId} AND platform_id = ${platformId} AND status = 'complete'
    `;
    for (const r of rows) {
      pScores.push((r as Record<string, unknown>).gpt_score as number);
    }
    if (pScores.length > 0) platformScores.set(platformId, pScores);
  }

  const below70: string[] = [];
  for (const [pid, pScores] of platformScores) {
    const mean = pScores.reduce((a, b) => a + b, 0) / pScores.length;
    if (mean < 70) below70.push(pid);
  }
  if (below70.length > 0) {
    log(`Platforms below 70: ${below70.length} (${below70.join(', ')})`);
  }

  log('');
  log('Next steps:');
  log(`  1. Check Neon: SELECT * FROM builder_quality_results WHERE run_id = '${runId}' ORDER BY gpt_score ASC LIMIT 10`);
  log(`  2. Dashboard: /admin/builder-quality — check User (7d) column`);

  await sql.end();
}

main().catch(async (e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
