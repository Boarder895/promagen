#!/usr/bin/env npx tsx
// scripts/builder-quality-postrun.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Post-Run Mechanical Scorer
// ============================================================================
// Queries an existing BQI run from Postgres and pipes every completed result
// through the Phase 10 mechanical scorer (R01–R10). No API calls, no rerun.
//
// Usage (from frontend/):
//   npx tsx scripts/builder-quality-postrun.ts --run bqr-mnv1z0fi-s2nnh6
//   npx tsx scripts/builder-quality-postrun.ts --run bqr-mnv1z0fi-s2nnh6 --verbose
//
// Outputs:
//   1. Per-rule pass/fail summary (R01–R10)
//   2. Per-platform breakdown (which rules failed, how many)
//   3. Per-scene breakdown (which scenes trigger which failures)
//   4. Worst-offender detail (platforms with critical failures)
//
// v1.0.0 (12 Apr 2026)
// Authority: call-3-quality-build-plan-v1.md Phase 10
// ============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: resolve('.env.local') });
config({ path: resolve('.env') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// ============================================================================
// CLI ARGS
// ============================================================================

interface CliArgs {
  runId: string;
  verbose: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let runId = '';
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--run':
        runId = args[++i] || '';
        break;
      case '--verbose':
        verbose = true;
        break;
    }
  }

  if (!runId) {
    console.error('Usage: npx tsx scripts/builder-quality-postrun.ts --run <run_id> [--verbose]');
    process.exit(1);
  }

  return { runId, verbose };
}

// ============================================================================
// TYPES (minimal — avoids import path issues with @/ aliases)
// ============================================================================

interface RuleContext {
  readonly assembledPrompt: string;
  readonly optimisedPrompt: string;
  readonly negative: string | null;
  readonly platformId: string;
  readonly tier: number;
  readonly charCeiling: number;
  readonly transformsApplied: readonly string[];
  readonly path: 'deterministic' | 'gpt' | 'pass_through';
  readonly retryAttempted: boolean;
  readonly retryAccepted: boolean;
}

interface RuleOutput {
  passed: boolean;
  details?: string;
}

interface RuleDefinition {
  id: string;
  cluster: string;
  severity: 'critical' | 'important' | 'informational';
  check(ctx: RuleContext): RuleOutput;
}

interface RuleResult {
  ruleId: string;
  cluster: string;
  severity: string;
  passed: boolean;
  details?: string;
}

// ============================================================================
// RULES (inlined from mechanical-scorer.ts — avoids @/ path alias issues)
// ============================================================================

const RULES: RuleDefinition[] = [
  {
    id: 'R01_OUTPUT_NOT_EMPTY',
    cluster: 'quality_degradation',
    severity: 'critical',
    check(ctx) {
      const passed = ctx.optimisedPrompt.trim().length > 0;
      return { passed, details: passed ? undefined : 'Optimised prompt is empty' };
    },
  },
  {
    id: 'R02_CEILING_COMPLIANCE',
    cluster: 'ceiling_breach',
    severity: 'critical',
    check(ctx) {
      const len = ctx.optimisedPrompt.length;
      const passed = len <= ctx.charCeiling;
      return { passed, details: passed ? undefined : `Output ${len} chars exceeds ceiling ${ctx.charCeiling}` };
    },
  },
  {
    id: 'R03_NO_CATASTROPHIC_SHORTENING',
    cluster: 'quality_degradation',
    severity: 'important',
    check(ctx) {
      const inputLen = ctx.assembledPrompt.length;
      const outputLen = ctx.optimisedPrompt.length;
      if (inputLen === 0) return { passed: true };
      const ratio = outputLen / inputLen;
      const passed = ratio >= 0.5;
      return {
        passed,
        details: passed ? undefined : `Output is ${Math.round(ratio * 100)}% of input (${outputLen}/${inputLen} chars)`,
      };
    },
  },
  {
    id: 'R04_SUBJECT_SURVIVAL',
    cluster: 'anchor_loss',
    severity: 'critical',
    check(ctx) {
      const subjectMatch = ctx.assembledPrompt.match(
        /(?:^|,\s*)(?:a|an|the|one)\s+([^,.:;!?]{3,40}?)(?:\s+(?:stands?|sits?|walks?|holds?|grips?|leans?|pauses?|watches?|gazes?|waits?)\b|,|\.|$)/i,
      );
      if (!subjectMatch) return { passed: true, details: 'No clear subject phrase detected' };

      const subject = subjectMatch[1]!.trim().toLowerCase();
      const subjectWords = subject.split(/\s+/).filter((w) => w.length >= 3);
      const outputLower = ctx.optimisedPrompt.toLowerCase();
      const survivingWords = subjectWords.filter((w) => outputLower.includes(w));

      const passed = subjectWords.length === 0 || survivingWords.length / subjectWords.length >= 0.5;
      return {
        passed,
        details: passed ? undefined : `Subject "${subject}" — only ${survivingWords.length}/${subjectWords.length} words survived`,
      };
    },
  },
  {
    id: 'R05_COLOUR_SURVIVAL',
    cluster: 'anchor_loss',
    severity: 'important',
    check(ctx) {
      const colourRe = /\b(?:red|blue|green|yellow|orange|purple|violet|pink|cyan|magenta|crimson|scarlet|gold|golden|silver|copper|bronze|amber|teal|turquoise|emerald|cobalt|indigo|maroon|ivory)\b/gi;
      const inputColours = [...new Set([...ctx.assembledPrompt.matchAll(colourRe)].map((m) => m[0].toLowerCase()))];
      if (inputColours.length === 0) return { passed: true };

      const outputLower = ctx.optimisedPrompt.toLowerCase();
      const missing = inputColours.filter((c) => !outputLower.includes(c));

      const passed = missing.length === 0;
      return { passed, details: passed ? undefined : `Missing colours: ${missing.join(', ')}` };
    },
  },
  {
    id: 'R06_NO_INVENTED_CONTENT',
    cluster: 'invented_content',
    severity: 'important',
    check(ctx) {
      const inventionPatterns = [
        /\bforeground\b/i,
        /\bmidground\b/i,
        /\bbackground layer\b/i,
        /\bcomposition featuring\b/i,
        /\bcaptures the essence\b/i,
        /\bevokes a sense\b/i,
        /\bbreathes life\b/i,
      ];

      const inputLower = ctx.assembledPrompt.toLowerCase();
      const outputLower = ctx.optimisedPrompt.toLowerCase();

      const inventions = inventionPatterns.filter(
        (p) => p.test(outputLower) && !p.test(inputLower),
      );

      const passed = inventions.length === 0;
      return {
        passed,
        details: passed ? undefined : `Invented patterns found: ${inventions.map((p) => p.source).join(', ')}`,
      };
    },
  },
  {
    id: 'R07_SYNTAX_CONSISTENCY',
    cluster: 'syntax_violation',
    severity: 'important',
    check(ctx) {
      const hasMjParams = /--(?:ar|v|s|stylize|no|style|chaos|q)\b/.test(ctx.optimisedPrompt);

      if (ctx.path === 'deterministic' && hasMjParams) {
        return { passed: false, details: 'MJ params found in non-MJ platform output' };
      }

      const inputHasWeights = /\([^()]+:\d+\.?\d*\)/.test(ctx.assembledPrompt) || /\w+::\d+\.?\d*/.test(ctx.assembledPrompt);
      const outputHasWeights = /\([^()]+:\d+\.?\d*\)/.test(ctx.optimisedPrompt) || /\w+::\d+\.?\d*/.test(ctx.optimisedPrompt);

      if (inputHasWeights && !outputHasWeights && ctx.tier <= 2) {
        return { passed: false, details: 'Input had weight syntax, output lost it' };
      }

      return { passed: true };
    },
  },
  {
    id: 'R08_NEGATIVE_NO_CONTRADICTION',
    cluster: 'negative_contradiction',
    severity: 'informational',
    check(ctx) {
      if (!ctx.negative) return { passed: true };

      const negTerms = ctx.negative.replace(/^--no\s+/, '').split(',').map((t) => t.trim().toLowerCase());
      const posLower = ctx.optimisedPrompt.toLowerCase();

      const contradictions = negTerms.filter((t) => t.length > 2 && posLower.includes(t));

      const passed = contradictions.length === 0;
      return { passed, details: passed ? undefined : `Negative terms also in positive: ${contradictions.join(', ')}` };
    },
  },
  {
    id: 'R09_RETRY_EFFECTIVENESS',
    cluster: 'retry_waste',
    severity: 'informational',
    check(ctx) {
      if (!ctx.retryAttempted) return { passed: true, details: 'No retry attempted' };
      const passed = ctx.retryAccepted;
      return { passed, details: passed ? 'Retry accepted' : 'Retry attempted but rejected — cost wasted' };
    },
  },
  {
    id: 'R10_TRANSFORM_ACTIVITY',
    cluster: 'quality_degradation',
    severity: 'informational',
    check(ctx) {
      if (ctx.path === 'pass_through') return { passed: true, details: 'Pass-through path' };
      const passed = ctx.optimisedPrompt !== ctx.assembledPrompt;
      return { passed, details: passed ? undefined : 'Output identical to input — no transforms applied' };
    },
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function log(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logError(msg: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  console.error(`[${ts}] ✗ ${msg}`);
}

/** Map call3_mode string to scorer path */
function modeToPath(mode: string): 'deterministic' | 'gpt' | 'pass_through' {
  switch (mode) {
    case 'gpt_rewrite': return 'gpt';
    case 'pass_through': return 'pass_through';
    default: return 'deterministic';
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (!DATABASE_URL) {
    logError('DATABASE_URL or POSTGRES_URL not found in .env.local');
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { ssl: 'require' });

  // ── Load DNA profiles for charCeilings ──────────────────────────────
  const profilesPath = resolve('src/data/platform-dna/profiles.json');
  const profiles: Record<string, { charCeiling?: number }> = JSON.parse(readFileSync(profilesPath, 'utf8'));
  const ceilings = new Map<string, number>();
  for (const [pid, prof] of Object.entries(profiles)) {
    if (pid === '_meta') continue;
    ceilings.set(pid, prof.charCeiling ?? 2000);
  }

  // ── Verify run exists ───────────────────────────────────────────────
  const runCheck = await sql`
    SELECT run_id, status, scope, mode, total_expected, total_completed, mean_gpt_score
    FROM builder_quality_runs WHERE run_id = ${args.runId}
  `;

  if (runCheck.length === 0) {
    logError(`Run ${args.runId} not found in database`);
    await sql.end();
    process.exit(1);
  }

  const run = runCheck[0] as Record<string, unknown>;
  log(`═══ POST-RUN MECHANICAL SCORER v1.0.0 ═══`);
  log(`Run: ${args.runId}`);
  log(`Status: ${run.status}, Mode: ${run.mode}, Scope: ${run.scope}`);
  log(`Expected: ${run.total_expected}, Completed: ${run.total_completed}, Mean GPT: ${run.mean_gpt_score}`);
  log('');

  // ── Load all completed results ──────────────────────────────────────
  const rows = await sql`
    SELECT platform_id, platform_name, scene_id, scene_name, tier,
           call3_mode, assembled_prompt, optimised_prompt, negative_prompt,
           gpt_score, anchors_expected, anchors_preserved, critical_anchors_dropped
    FROM builder_quality_results
    WHERE run_id = ${args.runId} AND status = 'complete'
    ORDER BY platform_id, scene_id
  `;

  if (rows.length === 0) {
    logError('No completed results found for this run');
    await sql.end();
    process.exit(1);
  }

  log(`Loaded ${rows.length} completed results`);
  log('');

  // ── Run mechanical scorer on every result ───────────────────────────
  interface ScoredRow {
    platformId: string;
    platformName: string;
    sceneId: string;
    tier: number;
    gptScore: number;
    results: RuleResult[];
    failCount: number;
    criticalFailCount: number;
  }

  const scored: ScoredRow[] = [];

  // Per-rule aggregation
  const rulePass = new Map<string, number>();
  const ruleFail = new Map<string, number>();
  for (const rule of RULES) {
    rulePass.set(rule.id, 0);
    ruleFail.set(rule.id, 0);
  }

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const platformId = r.platform_id as string;
    const tier = r.tier as number;

    const ctx: RuleContext = {
      assembledPrompt: r.assembled_prompt as string,
      optimisedPrompt: r.optimised_prompt as string,
      negative: (r.negative_prompt as string) || null,
      platformId,
      tier,
      charCeiling: ceilings.get(platformId) ?? 2000,
      transformsApplied: [],
      path: modeToPath(r.call3_mode as string),
      retryAttempted: false,
      retryAccepted: false,
    };

    const results: RuleResult[] = [];
    let failCount = 0;
    let criticalFailCount = 0;

    for (const rule of RULES) {
      try {
        const output = rule.check(ctx);
        results.push({
          ruleId: rule.id,
          cluster: rule.cluster,
          severity: rule.severity,
          passed: output.passed,
          details: output.details,
        });
        if (output.passed) {
          rulePass.set(rule.id, (rulePass.get(rule.id) ?? 0) + 1);
        } else {
          ruleFail.set(rule.id, (ruleFail.get(rule.id) ?? 0) + 1);
          failCount++;
          if (rule.severity === 'critical') criticalFailCount++;
        }
      } catch {
        results.push({
          ruleId: rule.id,
          cluster: rule.cluster,
          severity: rule.severity,
          passed: true,
          details: 'Rule threw — skipped',
        });
        rulePass.set(rule.id, (rulePass.get(rule.id) ?? 0) + 1);
      }
    }

    scored.push({
      platformId,
      platformName: r.platform_name as string,
      sceneId: r.scene_id as string,
      tier,
      gptScore: r.gpt_score as number,
      results,
      failCount,
      criticalFailCount,
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // OUTPUT
  // ══════════════════════════════════════════════════════════════════════

  // ── 1. Per-rule summary ─────────────────────────────────────────────
  log('── Per-Rule Summary (R01–R10) ──');
  log('');

  const total = rows.length;
  for (const rule of RULES) {
    const pass = rulePass.get(rule.id) ?? 0;
    const fail = ruleFail.get(rule.id) ?? 0;
    const pct = ((pass / total) * 100).toFixed(1);
    const icon = fail === 0 ? '✓' : rule.severity === 'critical' ? '✗' : '⚠';
    log(`  ${icon} ${rule.id.padEnd(35)} pass=${pass}  fail=${fail}  (${pct}% pass)  [${rule.severity}]`);
  }
  log('');

  // ── 2. Per-platform breakdown ───────────────────────────────────────
  const byPlatform = new Map<string, ScoredRow[]>();
  for (const s of scored) {
    const arr = byPlatform.get(s.platformId) ?? [];
    arr.push(s);
    byPlatform.set(s.platformId, arr);
  }

  log('── Per-Platform Mechanical Failures (sorted by fail count) ──');
  log('');

  const platformSummaries = [...byPlatform.entries()]
    .map(([pid, rows]) => ({
      pid,
      name: rows[0]?.platformName ?? pid,
      tier: rows[0]?.tier ?? 0,
      totalFails: rows.reduce((sum, r) => sum + r.failCount, 0),
      criticalFails: rows.reduce((sum, r) => sum + r.criticalFailCount, 0),
      scenes: rows.length,
      failedRules: [...new Set(rows.flatMap((r) => r.results.filter((rr) => !rr.passed).map((rr) => rr.ruleId)))],
    }))
    .sort((a, b) => b.totalFails - a.totalFails);

  for (const p of platformSummaries) {
    if (p.totalFails === 0) continue;
    const rules = p.failedRules.map((r) => r.replace(/^R\d+_/, '')).join(', ');
    const critTag = p.criticalFails > 0 ? `  ⚠ ${p.criticalFails} CRITICAL` : '';
    log(`  ${p.name.padEnd(22)} T${p.tier}  fails=${p.totalFails}/${p.scenes * RULES.length}  rules: ${rules}${critTag}`);
  }

  const cleanPlatforms = platformSummaries.filter((p) => p.totalFails === 0);
  if (cleanPlatforms.length > 0) {
    log(`  (${cleanPlatforms.length} platforms with zero mechanical failures)`);
  }
  log('');

  // ── 3. Per-scene breakdown ──────────────────────────────────────────
  const byScene = new Map<string, ScoredRow[]>();
  for (const s of scored) {
    const arr = byScene.get(s.sceneId) ?? [];
    arr.push(s);
    byScene.set(s.sceneId, arr);
  }

  log('── Per-Scene Mechanical Failures (sorted by fail count) ──');
  log('');

  const sceneSummaries = [...byScene.entries()]
    .map(([sid, rows]) => ({
      sid,
      totalFails: rows.reduce((sum, r) => sum + r.failCount, 0),
      criticalFails: rows.reduce((sum, r) => sum + r.criticalFailCount, 0),
      platforms: rows.length,
      failedRules: [...new Set(rows.flatMap((r) => r.results.filter((rr) => !rr.passed).map((rr) => rr.ruleId)))],
    }))
    .sort((a, b) => b.totalFails - a.totalFails);

  for (const s of sceneSummaries) {
    const rules = s.failedRules.map((r) => r.replace(/^R\d+_/, '')).join(', ');
    const critTag = s.criticalFails > 0 ? `  ⚠ ${s.criticalFails} CRITICAL` : '';
    log(`  ${s.sid.padEnd(40)} fails=${s.totalFails}/${s.platforms * RULES.length}  rules: ${rules}${critTag}`);
  }
  log('');

  // ── 4. Verbose: per-cell detail for failures ────────────────────────
  if (args.verbose) {
    log('── Failure Detail (verbose) ──');
    log('');
    for (const s of scored) {
      const failures = s.results.filter((r) => !r.passed);
      if (failures.length === 0) continue;
      log(`  ${s.platformId} × ${s.sceneId} (score=${s.gptScore}):`);
      for (const f of failures) {
        log(`    ${f.ruleId} [${f.severity}]: ${f.details ?? 'no detail'}`);
      }
    }
    log('');
  }

  // ── 5. Red flags ────────────────────────────────────────────────────
  const r01Fails = ruleFail.get('R01_OUTPUT_NOT_EMPTY') ?? 0;
  const r02Fails = ruleFail.get('R02_CEILING_COMPLIANCE') ?? 0;
  const r10Fails = ruleFail.get('R10_TRANSFORM_ACTIVITY') ?? 0;

  log('── Red Flag Check ──');
  log('');
  if (r01Fails > 0) log('  🔴 R01 OUTPUT_NOT_EMPTY failed — Call 3 returned empty on some cells. Pipeline bug.');
  if (r02Fails > 0) log('  🔴 R02 CEILING_COMPLIANCE failed — char gate is broken on some platforms.');
  if (r01Fails === 0 && r02Fails === 0) log('  ✓ R01 + R02 at 100% — no wiring failures.');
  if (r10Fails > total * 0.2) log(`  ⚠ R10 TRANSFORM_ACTIVITY failing on ${r10Fails}/${total} cells — transforms may be dead.`);

  const r06Fails = ruleFail.get('R06_NO_INVENTED_CONTENT') ?? 0;
  if (r06Fails === 0) log('  ℹ R06 NO_INVENTED_CONTENT never fires — rule may be too narrow (or Call 3 is clean).');
  if (r06Fails > 0) log(`  ⚠ R06 NO_INVENTED_CONTENT fires on ${r06Fails}/${total} cells — Call 3 may be hallucinating.`);

  log('');
  log('── Notes ──');
  log('  R09 (retry): set to pass-by-default — retry data not stored in DB. Informational only.');
  log('  R10 (transform activity): compares assembled vs optimised text. If identical, flags as inactive.');
  log('');

  // ── Summary line ────────────────────────────────────────────────────
  const totalFails = scored.reduce((sum, s) => sum + s.failCount, 0);
  const totalCritical = scored.reduce((sum, s) => sum + s.criticalFailCount, 0);
  log(`═══ DONE: ${total} cells scored, ${totalFails} rule failures (${totalCritical} critical) ═══`);

  await sql.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
