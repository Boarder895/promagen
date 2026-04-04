#!/usr/bin/env npx tsx
// scripts/builder-quality-test-patch.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Route-Faithful Patch Testing
// ============================================================================
// Tests a patched builder system prompt through the actual /api/optimise-prompt
// route (via systemPromptOverride body field), preserving the full compliance
// gate, post-processing, and routing pipeline. Compares core + holdout scene
// results against a baseline run. Applies overfitting guard.
//
// Usage (from frontend/, dev server must be running):
//   npx tsx scripts/builder-quality-test-patch.ts --platform bing --patched-file group-nl-bing.ts.patched
//
// Part 12 v1.0.0 (4 Apr 2026). ChatGPT review: 96/100, signed off.
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §11
// Build plan: part-12-build-plan v1.1.0
// ============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

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

interface CliArgs {
  platform: string;
  patchedFile: string;
  baseline: string | null;
  replicates: number;
}

interface TestScene {
  id: string;
  name: string;
  humanText: string;
  expectedAnchors: { term: string; severity: string }[];
  holdout: boolean;
}

interface FrozenSnapshot {
  sceneId: string;
  tier: number;
  assembledPrompt: string;
  snapshotHash: string;
}

interface PlatformConfig {
  tier?: number;
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

interface SceneDelta {
  sceneId: string;
  baselineMean: number;
  patchMean: number;
  delta: number;
  isHoldout: boolean;
}

type Verdict = 'SAFE' | 'CAUTION' | 'REJECT';

// ============================================================================
// SIGINT STATE
// ============================================================================

let sigintRunId: string | null = null;
let sigintSql: postgres.Sql | null = null;
let sigintHandled = false;

function registerSigintHandler(): void {
  process.on('SIGINT', async () => {
    if (sigintHandled) process.exit(130);
    sigintHandled = true;
    console.log('');
    log('⚠ INTERRUPTED (Ctrl+C)');
    if (sigintRunId && sigintSql) {
      try {
        await sigintSql`
          UPDATE builder_quality_runs
          SET status = 'partial', error_detail = COALESCE(error_detail, '') || ' [interrupted by SIGINT]'
          WHERE run_id = ${sigintRunId} AND status = 'running'
        `;
        log(`Run ${sigintRunId} marked as 'partial'`);
      } catch { /* best effort */ }
      try { await sigintSql.end(); } catch { /* best effort */ }
    }
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
  return `bqr-patch-${ts}-${rand}`;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

// ============================================================================
// CLI ARGS
// ============================================================================

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { platform: '', patchedFile: '', baseline: null, replicates: 3 };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--platform': result.platform = args[++i] || ''; break;
      case '--patched-file': result.patchedFile = args[++i] || ''; break;
      case '--baseline': result.baseline = args[++i] || null; break;
      case '--replicates': result.replicates = parseInt(args[++i] || '3', 10) || 3; break;
    }
  }

  if (!result.platform || !result.patchedFile) {
    console.error('Usage: npx tsx scripts/builder-quality-test-patch.ts --platform <id> --patched-file <path>');
    process.exit(1);
  }

  return result;
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadScenes(): TestScene[] {
  const corePath = resolve('src/data/scoring/test-scenes.json');
  const core = JSON.parse(readFileSync(corePath, 'utf8')) as TestScene[];
  const holdoutPath = resolve('src/data/scoring/holdout-scenes.json');
  if (existsSync(holdoutPath)) {
    const holdout = JSON.parse(readFileSync(holdoutPath, 'utf8')) as TestScene[];
    return [...core, ...holdout];
  }
  return core;
}

function loadSnapshots(): Map<string, FrozenSnapshot> {
  const map = new Map<string, FrozenSnapshot>();
  for (const file of ['frozen-snapshots.json', 'holdout-snapshots.json']) {
    const p = resolve(`src/data/scoring/${file}`);
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, 'utf8')) as FrozenSnapshot[];
      for (const s of data) map.set(`${s.sceneId}:${s.tier}`, s);
    }
  }
  return map;
}

function loadPlatformConfig(): Record<string, PlatformConfig> {
  const raw = JSON.parse(readFileSync(resolve('src/data/providers/platform-config.json'), 'utf8'));
  return raw.platforms as Record<string, PlatformConfig>;
}

function extractSystemPrompt(fileContent: string): string {
  const match = fileContent.match(/(?:const\s+(?:SYSTEM_PROMPT|systemPrompt)\s*=\s*`)([\s\S]*?)(?:`\s*;)/);
  if (match?.[1]) return match[1].trim();
  const funcMatch = fileContent.match(/function\s+build\w*SystemPrompt[\s\S]*?return\s*`([\s\S]*?)`/);
  if (funcMatch?.[1]) return funcMatch[1].trim();
  return '';
}

// ============================================================================
// API CALLS (with system prompt override)
// ============================================================================

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  let res = await fetch(url, init);
  for (let attempt = 0; attempt < maxRetries && res.status === 429; attempt++) {
    const retryAfter = res.headers.get('Retry-After');
    const waitSec = retryAfter ? Math.min(parseInt(retryAfter, 10) || 30, 60) : 30;
    log(`    ↻ Rate limited — waiting ${waitSec}s`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    res = await fetch(url, init);
  }
  return res;
}

async function callOptimiseWithOverride(
  assembledPrompt: string,
  originalSentence: string,
  platformId: string,
  platformConfig: PlatformConfig,
  systemPromptOverride: string,
): Promise<{ optimised: string; negative?: string; changes: string[] }> {
  const res = await fetchWithRetry(CALL3_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Builder-Quality-Key': BUILDER_QUALITY_KEY,
    },
    body: JSON.stringify({
      promptText: truncate(assembledPrompt, 5000),
      originalSentence: truncate(originalSentence, 1000),
      providerId: platformId,
      providerContext: {
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
      },
      // Part 12: System prompt override — tested through full route path
      systemPromptOverride,
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
  platformId: string,
  platformConfig: PlatformConfig,
  expectedAnchors: TestScene['expectedAnchors'],
): Promise<{ score: number; axes: Record<string, unknown>; directives: string[]; summary: string; anchorAudit?: unknown[] }> {
  const res = await fetchWithRetry(SCORE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Builder-Quality-Key': BUILDER_QUALITY_KEY },
    body: JSON.stringify({
      optimisedPrompt: truncate(optimisedPrompt, 2000),
      humanText: truncate(humanText, 1000),
      assembledPrompt: truncate(assembledPrompt, 2000),
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
      expectedAnchors,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    throw new Error(`Score failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return await res.json();
}

// ============================================================================
// OVERFITTING GUARD
// ============================================================================

function evaluateVerdict(coreDeltas: SceneDelta[], holdoutDeltas: SceneDelta[]): {
  verdict: Verdict;
  reason: string;
} {
  const coreMeanDelta = coreDeltas.length > 0
    ? coreDeltas.reduce((sum, d) => sum + d.delta, 0) / coreDeltas.length
    : 0;

  const holdoutMeanDelta = holdoutDeltas.length > 0
    ? holdoutDeltas.reduce((sum, d) => sum + d.delta, 0) / holdoutDeltas.length
    : 0;

  // Check if core improved
  if (coreMeanDelta <= 0) {
    return { verdict: 'REJECT', reason: `Core did not improve (Δ ${coreMeanDelta.toFixed(1)}). Patch had no positive effect.` };
  }

  // Check per-scene holdout guardrail
  const holdoutCrater = holdoutDeltas.find((d) => d.delta < -4);
  if (holdoutCrater) {
    return {
      verdict: 'CAUTION',
      reason: `Holdout scene "${holdoutCrater.sceneId}" dropped ${Math.abs(holdoutCrater.delta).toFixed(1)} pts. Review this specific regression before applying.`,
    };
  }

  // Check aggregate holdout regression
  if (holdoutMeanDelta < -2) {
    return { verdict: 'REJECT', reason: `Holdout regressed ${Math.abs(holdoutMeanDelta).toFixed(1)} pts aggregate. Overfitting detected.` };
  }

  if (holdoutMeanDelta < 0) {
    return { verdict: 'CAUTION', reason: `Holdout slightly regressed (Δ ${holdoutMeanDelta.toFixed(1)}). Apply with close monitoring.` };
  }

  return { verdict: 'SAFE', reason: `Core improved +${coreMeanDelta.toFixed(1)}, holdout improved/neutral +${holdoutMeanDelta.toFixed(1)}. Patch generalises.` };
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

  if (!existsSync(args.patchedFile)) {
    logError(`Patched file not found: ${args.patchedFile}`);
    process.exit(1);
  }

  log('═══ BUILDER QUALITY PATCH TEST v1.0.0 ═══');
  log(`Platform: ${args.platform}`);
  log(`Patched file: ${args.patchedFile}`);
  log(`Replicates: ${args.replicates}`);
  log('');

  // ── Extract patched system prompt ───────────────────────────────
  const patchedContent = readFileSync(resolve(args.patchedFile), 'utf8');
  const patchedSystemPrompt = extractSystemPrompt(patchedContent);

  if (!patchedSystemPrompt || patchedSystemPrompt.includes('Could not extract')) {
    logError('Could not extract system prompt from patched file.');
    logError('Ensure the file has a `const SYSTEM_PROMPT = \\`...\\`;` or `buildSystemPrompt()` pattern.');
    process.exit(1);
  }

  log(`Patched system prompt: ${patchedSystemPrompt.length} chars`);
  log('');

  // ── Load data ───────────────────────────────────────────────────
  const scenes = loadScenes();
  const snapshots = loadSnapshots();
  const platformConfig = loadPlatformConfig();
  const pConfig = platformConfig[args.platform];

  if (!pConfig) {
    logError(`Platform "${args.platform}" not found in platform-config.json`);
    process.exit(1);
  }

  const tier = pConfig.tier ?? 3;
  const coreScenes = scenes.filter((s) => !s.holdout);
  const holdoutScenes = scenes.filter((s) => s.holdout);

  log(`Core scenes: ${coreScenes.length}, Holdout scenes: ${holdoutScenes.length}`);
  log(`Replicates: ${args.replicates}`);
  const totalExpected = (coreScenes.length + holdoutScenes.length) * args.replicates;
  log(`Total expected: ${totalExpected}`);
  log('');

  // ── Database ────────────────────────────────────────────────────
  const sql = postgres(DATABASE_URL, { max: 3, idle_timeout: 20, ssl: 'require', onnotice: () => {} });
  sigintSql = sql;
  registerSigintHandler();

  // ── Create run ──────────────────────────────────────────────────
  const runId = generateRunId();
  sigintRunId = runId;
  const scorerPromptHash = md5(SCORER_VERSION + '-diagnostic-v2');

  await sql`
    INSERT INTO builder_quality_runs (
      run_id, mode, scope, scorer_mode, replicate_count,
      include_holdout, scorer_version, scorer_prompt_hash,
      gpt_model, status, total_expected, total_completed,
      last_progress_at
    ) VALUES (
      ${runId}, 'patch_test', ${'patch:' + args.platform},
      'gpt_only', ${args.replicates}, ${true},
      ${SCORER_VERSION}, ${scorerPromptHash}, ${GPT_MODEL},
      'running', ${totalExpected}, 0, NOW()
    )
  `;
  log(`Run created: ${runId}`);
  log('');

  // ── Run all scenes ──────────────────────────────────────────────
  const allScenes = [...coreScenes, ...holdoutScenes];
  let completed = 0;
  let errors = 0;
  const sceneScores = new Map<string, { scores: number[]; isHoldout: boolean }>();

  for (const scene of allScenes) {
    const snapshotKey = `${scene.id}:${tier}`;
    const snapshot = snapshots.get(snapshotKey);
    if (!snapshot) {
      logError(`  ${scene.id}: no snapshot for T${tier} — skipping`);
      errors++;
      continue;
    }

    const tag = scene.holdout ? ' [holdout]' : '';
    log(`── ${scene.id}${tag} ──`);

    const rScores: number[] = [];

    for (let rep = 1; rep <= args.replicates; rep++) {
      try {
        // Call 3 with system prompt override — through full route
        const c3Result = await callOptimiseWithOverride(
          snapshot.assembledPrompt,
          scene.humanText,
          args.platform,
          pConfig,
          patchedSystemPrompt,
        );

        if (!c3Result.optimised?.trim()) throw new Error('Empty optimised prompt');

        // Score
        const scoreResult = await callScore(
          c3Result.optimised,
          scene.humanText,
          snapshot.assembledPrompt,
          args.platform,
          pConfig,
          scene.expectedAnchors as TestScene['expectedAnchors'],
        );

        const audit = (scoreResult.anchorAudit || []) as { status: string; severity: string }[];
        const preserved = audit.filter((a) => a.status === 'exact' || a.status === 'approximate').length;
        const dropped = audit.filter((a) => a.status === 'dropped').length;
        const critDropped = audit.filter((a) => a.status === 'dropped' && a.severity === 'critical').length;

        // Store result
        await sql`
          INSERT INTO builder_quality_results (
            run_id, platform_id, platform_name, scene_id, scene_name,
            tier, call3_mode, builder_version, replicate_index,
            human_text, assembled_prompt, raw_optimised_prompt, optimised_prompt,
            input_hash, output_hash,
            assembled_char_count, raw_optimised_char_count, optimised_char_count,
            post_processing_changed,
            gpt_score, gpt_axes, gpt_directives, gpt_summary,
            scorer_version, median_score,
            anchor_audit, anchors_expected, anchors_preserved,
            anchors_dropped, critical_anchors_dropped,
            source, status, is_holdout
          ) VALUES (
            ${runId}, ${args.platform}, ${args.platform}, ${scene.id}, ${scene.name},
            ${tier}, ${pConfig.call3Mode ?? 'gpt_rewrite'}, ${'patched-' + md5(patchedSystemPrompt).slice(0, 8)}, ${rep},
            ${scene.humanText}, ${snapshot.assembledPrompt}, ${c3Result.optimised}, ${c3Result.optimised},
            ${md5(snapshot.assembledPrompt)}, ${md5(c3Result.optimised)},
            ${snapshot.assembledPrompt.length}, ${c3Result.optimised.length}, ${c3Result.optimised.length},
            ${false},
            ${scoreResult.score}, ${JSON.stringify(scoreResult.axes)},
            ${JSON.stringify(scoreResult.directives)}, ${scoreResult.summary},
            ${SCORER_VERSION}, ${scoreResult.score},
            ${JSON.stringify(scoreResult.anchorAudit ?? [])},
            ${scene.expectedAnchors.length}, ${preserved}, ${dropped}, ${critDropped},
            'batch', 'complete', ${scene.holdout}
          )
        `;

        completed++;
        rScores.push(scoreResult.score);

        await sql`UPDATE builder_quality_runs SET total_completed = ${completed}, last_progress_at = NOW() WHERE run_id = ${runId}`;

        const anchTag = audit.length > 0 ? ` anchors: ${preserved}/${scene.expectedAnchors.length}` : '';
        log(`  rep${rep}: score=${scoreResult.score}${anchTag}`);

      } catch (e) {
        errors++;
        logError(`  rep${rep}: ${e}`);
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    if (rScores.length > 0) {
      sceneScores.set(scene.id, { scores: rScores, isHoldout: scene.holdout });
    }
  }

  // ── Finalise run ────────────────────────────────────────────────
  const finalStatus = errors === 0 && completed > 0 ? 'complete' : 'partial';
  const allScoreValues = Array.from(sceneScores.values()).flatMap((s) => s.scores);
  const overallMean = allScoreValues.length > 0
    ? Math.round((allScoreValues.reduce((a, b) => a + b, 0) / allScoreValues.length) * 100) / 100
    : null;

  await sql`
    UPDATE builder_quality_runs
    SET status = ${finalStatus}, completed_at = NOW(), total_completed = ${completed},
        mean_gpt_score = ${overallMean}, error_detail = ${errors > 0 ? `${errors} errors` : null}
    WHERE run_id = ${runId}
  `;

  // ── Load baseline ───────────────────────────────────────────────
  let baselineRunId = args.baseline;
  if (!baselineRunId) {
    const latestRows = await sql`
      SELECT run_id FROM builder_quality_runs
      WHERE mode = 'builder' AND status = 'complete' AND scope IN ('all', ${args.platform})
      ORDER BY completed_at DESC LIMIT 1
    `;
    baselineRunId = latestRows.length > 0 ? (latestRows[0] as Record<string, unknown>).run_id as string : null;
  }

  // ── Compute deltas ──────────────────────────────────────────────
  const coreDeltas: SceneDelta[] = [];
  const holdoutDeltas: SceneDelta[] = [];

  if (baselineRunId) {
    const baselineResults = await sql`
      SELECT scene_id, AVG(gpt_score)::numeric(5,2) AS mean_score, bool_or(is_holdout) AS is_holdout
      FROM builder_quality_results
      WHERE run_id = ${baselineRunId} AND platform_id = ${args.platform} AND status = 'complete'
      GROUP BY scene_id
    `;
    const baselineMap = new Map<string, { mean: number; isHoldout: boolean }>();
    for (const r of baselineResults) {
      const row = r as Record<string, unknown>;
      baselineMap.set(row.scene_id as string, {
        mean: parseFloat(String(row.mean_score)),
        isHoldout: row.is_holdout as boolean,
      });
    }

    for (const [sceneId, data] of sceneScores) {
      const patchMean = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const baseline = baselineMap.get(sceneId);
      const baselineMean = baseline?.mean ?? patchMean;
      const delta: SceneDelta = {
        sceneId,
        baselineMean: Math.round(baselineMean * 10) / 10,
        patchMean: Math.round(patchMean * 10) / 10,
        delta: Math.round((patchMean - baselineMean) * 10) / 10,
        isHoldout: data.isHoldout,
      };
      if (data.isHoldout) holdoutDeltas.push(delta);
      else coreDeltas.push(delta);
    }
  }

  // ── Overfitting guard ───────────────────────────────────────────
  const { verdict, reason } = evaluateVerdict(coreDeltas, holdoutDeltas);

  // ── Print results ───────────────────────────────────────────────
  log('');
  log(`═══ PATCH TEST: ${args.platform} ═══`);
  log('');

  if (coreDeltas.length > 0) {
    const coreMean = coreDeltas.reduce((s, d) => s + d.delta, 0) / coreDeltas.length;
    log(`Core Scenes (${coreDeltas.length}):`);
    log(`  Baseline mean → Patch mean → Δ ${coreMean >= 0 ? '+' : ''}${coreMean.toFixed(1)}`);
    for (const d of coreDeltas.sort((a, b) => b.delta - a.delta)) {
      const icon = d.delta > 2 ? '✓' : d.delta < -2 ? '✗' : '—';
      log(`  ${d.sceneId.padEnd(38)} ${d.baselineMean} → ${d.patchMean} (${d.delta >= 0 ? '+' : ''}${d.delta})  ${icon}`);
    }
  }

  if (holdoutDeltas.length > 0) {
    const holdoutMean = holdoutDeltas.reduce((s, d) => s + d.delta, 0) / holdoutDeltas.length;
    log('');
    log(`Holdout Scenes (${holdoutDeltas.length}):`);
    log(`  Baseline mean → Patch mean → Δ ${holdoutMean >= 0 ? '+' : ''}${holdoutMean.toFixed(1)}`);
    for (const d of holdoutDeltas) {
      const icon = d.delta > 2 ? '✓' : d.delta < -2 ? '✗' : '—';
      log(`  ${d.sceneId.padEnd(38)} ${d.baselineMean} → ${d.patchMean} (${d.delta >= 0 ? '+' : ''}${d.delta})  ${icon}`);
    }
  }

  log('');
  const verdictColour = verdict === 'SAFE' ? '✓' : verdict === 'CAUTION' ? '⚠' : '✗';
  log(`OVERFITTING CHECK: ${verdictColour} ${verdict}`);
  log(`  ${reason}`);
  log('');

  if (verdict === 'SAFE') {
    log('VERDICT: SAFE TO REVIEW');
    log('  Manually apply the patch, then run a normal batch to confirm.');
  } else if (verdict === 'CAUTION') {
    log('VERDICT: CAUTION');
    log('  Review the specific regression before applying. Monitor closely after deployment.');
  } else {
    log('VERDICT: REJECT');
    log('  Do not apply this patch.');
  }

  // ── Save report ─────────────────────────────────────────────────
  mkdirSync(resolve('reports'), { recursive: true });
  const reportPath = resolve(`reports/patch-test-${args.platform}-${runId}.json`);
  writeFileSync(reportPath, JSON.stringify({
    platformId: args.platform,
    runId,
    baselineRunId,
    patchedFile: args.patchedFile,
    patchedPromptHash: md5(patchedSystemPrompt),
    coreDeltas,
    holdoutDeltas,
    verdict,
    reason,
    overallMean,
    completed,
    errors,
    generatedAt: new Date().toISOString(),
  }, null, 2), 'utf8');

  log('');
  log(`Report saved: ${reportPath}`);
  log(`Run ID: ${runId}`);

  await sql.end();
}

main().catch((e) => {
  logError(`Fatal error: ${e}`);
  process.exit(1);
});
