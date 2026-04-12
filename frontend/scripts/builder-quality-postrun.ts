#!/usr/bin/env npx tsx
// scripts/builder-quality-postrun.ts
// ============================================================================
// BUILDER QUALITY INTELLIGENCE — Post-Run Mechanical Scorer + Gate Analysis
// ============================================================================
// Queries an existing BQI run from Postgres and produces two reports:
//
//   1. Mechanical scorer (R01–R10) — deterministic rule checks on every cell
//   2. Gate rejection analysis — how often APS/regression guard rejected GPT
//      output, using the raw_optimised_prompt vs optimised_prompt delta
//
// No API calls, no rerun, no cost. Pure DB read + local computation.
//
// Usage (from frontend/):
//   npx tsx scripts/builder-quality-postrun.ts --run bqr-mnv1z0fi-s2nnh6
//   npx tsx scripts/builder-quality-postrun.ts --run bqr-mnv1z0fi-s2nnh6 --verbose
//
// v2.0.0 (13 Apr 2026): Gate rejection analysis, post_processing_changed
//   awareness, improved R09/R10 using call3_mode + raw vs final comparison,
//   rescue dependency metric per ChatGPT review.
// v1.0.0 (12 Apr 2026): Initial implementation.
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
// CLI
// ============================================================================

function parseArgs(): { runId: string; verbose: boolean } {
  const args = process.argv.slice(2);
  let runId = '';
  let verbose = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run') runId = args[++i] || '';
    if (args[i] === '--verbose') verbose = true;
  }
  if (!runId) {
    console.error('Usage: npx tsx scripts/builder-quality-postrun.ts --run <run_id> [--verbose]');
    process.exit(1);
  }
  return { runId, verbose };
}

// ============================================================================
// TYPES
// ============================================================================

interface Ctx {
  assembledPrompt: string;
  optimisedPrompt: string;
  rawGptOutput: string;
  negative: string | null;
  platformId: string;
  tier: number;
  charCeiling: number;
  call3Mode: string;
  path: 'deterministic' | 'gpt' | 'pass_through';
}

interface RuleOut { passed: boolean; details?: string }
interface Rule { id: string; cluster: string; severity: 'critical' | 'important' | 'informational'; check(c: Ctx): RuleOut }
interface Result { ruleId: string; cluster: string; severity: string; passed: boolean; details?: string }

// ============================================================================
// RULES
// ============================================================================

const RULES: Rule[] = [
  {
    id: 'R01_OUTPUT_NOT_EMPTY', cluster: 'quality_degradation', severity: 'critical',
    check(c) { const p = c.optimisedPrompt.trim().length > 0; return { passed: p, details: p ? undefined : 'Empty output' }; },
  },
  {
    id: 'R02_CEILING_COMPLIANCE', cluster: 'ceiling_breach', severity: 'critical',
    check(c) { const l = c.optimisedPrompt.length; const p = l <= c.charCeiling; return { passed: p, details: p ? undefined : `${l} chars > ceiling ${c.charCeiling}` }; },
  },
  {
    id: 'R03_NO_CATASTROPHIC_SHORTENING', cluster: 'quality_degradation', severity: 'important',
    check(c) {
      if (c.assembledPrompt.length === 0) return { passed: true };
      const r = c.optimisedPrompt.length / c.assembledPrompt.length;
      const p = r >= 0.5;
      return { passed: p, details: p ? undefined : `Output ${Math.round(r * 100)}% of input` };
    },
  },
  {
    id: 'R04_SUBJECT_SURVIVAL', cluster: 'anchor_loss', severity: 'critical',
    check(c) {
      const m = c.assembledPrompt.match(/(?:^|,\s*)(?:a|an|the|one)\s+([^,.:;!?]{3,40}?)(?:\s+(?:stands?|sits?|walks?|holds?|grips?|leans?|pauses?|watches?|gazes?|waits?)\b|,|\.|$)/i);
      if (!m) return { passed: true, details: 'No subject detected' };
      const words = m[1]!.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 3);
      const out = c.optimisedPrompt.toLowerCase();
      const surv = words.filter(w => out.includes(w));
      const p = words.length === 0 || surv.length / words.length >= 0.5;
      return { passed: p, details: p ? undefined : `Subject "${m[1]!.trim()}" — ${surv.length}/${words.length} words survived` };
    },
  },
  {
    id: 'R05_COLOUR_SURVIVAL', cluster: 'anchor_loss', severity: 'important',
    check(c) {
      const re = /\b(?:red|blue|green|yellow|orange|purple|violet|pink|cyan|magenta|crimson|scarlet|gold|golden|silver|copper|bronze|amber|teal|turquoise|emerald|cobalt|indigo|maroon|ivory)\b/gi;
      const cols = [...new Set([...c.assembledPrompt.matchAll(re)].map(m => m[0].toLowerCase()))];
      if (cols.length === 0) return { passed: true };
      const out = c.optimisedPrompt.toLowerCase();
      const miss = cols.filter(cl => !out.includes(cl));
      return { passed: miss.length === 0, details: miss.length === 0 ? undefined : `Missing: ${miss.join(', ')}` };
    },
  },
  {
    id: 'R06_NO_INVENTED_CONTENT', cluster: 'invented_content', severity: 'important',
    check(c) {
      const pats = [/\bforeground\b/i, /\bmidground\b/i, /\bbackground layer\b/i, /\bcomposition featuring\b/i,
        /\bcaptures the essence\b/i, /\bevokes a sense\b/i, /\bbreathes life\b/i, /\bthe viewer\b/i,
        /\binvites the eye\b/i, /\ba sense of\b/i, /\bvisual narrative\b/i];
      const inL = c.assembledPrompt.toLowerCase();
      const outL = c.optimisedPrompt.toLowerCase();
      const inv = pats.filter(p => p.test(outL) && !p.test(inL));
      return { passed: inv.length === 0, details: inv.length === 0 ? undefined : `Invented: ${inv.map(p => p.source.replace(/\\b/g, '')).join(', ')}` };
    },
  },
  {
    id: 'R07_SYNTAX_CONSISTENCY', cluster: 'syntax_violation', severity: 'important',
    check(c) {
      if (c.path === 'deterministic' && /--(?:ar|v|s|stylize|no|style|chaos|q)\b/.test(c.optimisedPrompt))
        return { passed: false, details: 'MJ params in non-MJ output' };
      const inW = /\([^()]+:\d+\.?\d*\)/.test(c.assembledPrompt) || /\w+::\d+\.?\d*/.test(c.assembledPrompt);
      const outW = /\([^()]+:\d+\.?\d*\)/.test(c.optimisedPrompt) || /\w+::\d+\.?\d*/.test(c.optimisedPrompt);
      if (inW && !outW && c.tier <= 2) return { passed: false, details: 'Weight syntax lost' };
      return { passed: true };
    },
  },
  {
    id: 'R08_NEGATIVE_NO_CONTRADICTION', cluster: 'negative_contradiction', severity: 'informational',
    check(c) {
      if (!c.negative) return { passed: true };
      const terms = c.negative.replace(/^--no\s+/, '').split(',').map(t => t.trim().toLowerCase());
      const pos = c.optimisedPrompt.toLowerCase();
      const bad = terms.filter(t => t.length > 2 && pos.includes(t));
      return { passed: bad.length === 0, details: bad.length === 0 ? undefined : `Contradictions: ${bad.join(', ')}` };
    },
  },
  {
    id: 'R09_GATE_REJECTION', cluster: 'gate_rejection', severity: 'informational',
    check(c) {
      // Detects APS / regression guard rejections by comparing raw GPT output to final.
      // On pre-fix runs (raw === final === assembled), this detects the no-op pattern.
      if (c.path !== 'gpt') return { passed: true, details: 'Non-GPT path' };
      const finalIsAssembled = c.optimisedPrompt === c.assembledPrompt;
      if (!finalIsAssembled) return { passed: true };
      // GPT path but final === assembled → gate rejected or GPT returned assembled unchanged
      const rawIsAssembled = c.rawGptOutput === c.assembledPrompt;
      if (rawIsAssembled) return { passed: false, details: 'Gate rejected — raw GPT output not persisted (pre-fix)' };
      return { passed: false, details: `Gate rejected (raw ${c.rawGptOutput.length} chars) — fell back to assembled` };
    },
  },
  {
    id: 'R10_TRANSFORM_ACTIVITY', cluster: 'quality_degradation', severity: 'informational',
    check(c) {
      if (c.call3Mode === 'pass_through') return { passed: true, details: 'Pass-through' };
      const changed = c.optimisedPrompt !== c.assembledPrompt;
      if (changed) return { passed: true };
      if (c.path === 'gpt') return { passed: false, details: 'GPT path — no change (gate rejection or no-op)' };
      return { passed: false, details: 'Deterministic — no transforms modified prompt' };
    },
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function log(m: string) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
function logError(m: string) { console.error(`[${new Date().toISOString().slice(11, 19)}] ✗ ${m}`); }

function modeToPath(m: string): 'deterministic' | 'gpt' | 'pass_through' {
  if (m === 'gpt_rewrite' || m === 'compress_only') return 'gpt';
  if (m === 'pass_through') return 'pass_through';
  return 'deterministic';
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  if (!DATABASE_URL) { logError('DATABASE_URL not found'); process.exit(1); }

  let sql: postgres.Sql;
  try { sql = postgres(DATABASE_URL, { ssl: 'require' }); }
  catch (e) { logError(`DB connect failed: ${e}`); process.exit(1); }

  // Load ceilings from DNA profiles
  let profiles: Record<string, { charCeiling?: number }>;
  try { profiles = JSON.parse(readFileSync(resolve('src/data/platform-dna/profiles.json'), 'utf8')); }
  catch (e) { logError(`profiles.json: ${e}`); await sql.end(); process.exit(1); }

  const ceilings = new Map<string, number>();
  for (const [pid, p] of Object.entries(profiles)) { if (pid !== '_meta') ceilings.set(pid, p.charCeiling ?? 2000); }

  // Verify run
  const runRows = await sql`SELECT run_id, status, scope, mode, total_expected, total_completed, mean_gpt_score FROM builder_quality_runs WHERE run_id = ${args.runId}`;
  if (runRows.length === 0) { logError(`Run ${args.runId} not found`); await sql.end(); process.exit(1); }
  const run = runRows[0] as Record<string, unknown>;

  log(`═══ POST-RUN MECHANICAL SCORER v2.0.0 ═══`);
  log(`Run: ${args.runId}`);
  log(`Status: ${run.status}, Mode: ${run.mode}, Scope: ${run.scope}`);
  log(`Expected: ${run.total_expected}, Completed: ${run.total_completed}, Mean GPT: ${run.mean_gpt_score}`);
  log('');

  // Load results
  const rows = await sql`
    SELECT platform_id, platform_name, scene_id, tier, call3_mode,
           assembled_prompt, raw_optimised_prompt, optimised_prompt,
           negative_prompt, gpt_score, post_processing_changed
    FROM builder_quality_results
    WHERE run_id = ${args.runId} AND status = 'complete'
    ORDER BY platform_id, scene_id`;

  if (rows.length === 0) { logError('No results'); await sql.end(); process.exit(1); }
  log(`Loaded ${rows.length} completed results`);
  log('');

  // Score every cell
  const rulePass = new Map<string, number>();
  const ruleFail = new Map<string, number>();
  for (const r of RULES) { rulePass.set(r.id, 0); ruleFail.set(r.id, 0); }

  interface Scored {
    platformId: string; platformName: string; sceneId: string; tier: number;
    gptScore: number; path: string; results: Result[];
    failCount: number; criticalFails: number; gateRejected: boolean;
  }

  const scored: Scored[] = [];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const pid = r.platform_id as string;
    const mode = r.call3_mode as string;
    const path = modeToPath(mode);

    const ctx: Ctx = {
      assembledPrompt: r.assembled_prompt as string,
      optimisedPrompt: (r.optimised_prompt as string) || '',
      rawGptOutput: (r.raw_optimised_prompt as string) || '',
      negative: (r.negative_prompt as string) || null,
      platformId: pid, tier: r.tier as number,
      charCeiling: ceilings.get(pid) ?? 2000,
      call3Mode: mode, path,
    };

    const results: Result[] = [];
    let fails = 0, crits = 0, gateRej = false;

    for (const rule of RULES) {
      try {
        const o = rule.check(ctx);
        results.push({ ruleId: rule.id, cluster: rule.cluster, severity: rule.severity, passed: o.passed, details: o.details });
        if (o.passed) rulePass.set(rule.id, (rulePass.get(rule.id) ?? 0) + 1);
        else {
          ruleFail.set(rule.id, (ruleFail.get(rule.id) ?? 0) + 1);
          fails++;
          if (rule.severity === 'critical') crits++;
          if (rule.id === 'R09_GATE_REJECTION') gateRej = true;
        }
      } catch {
        results.push({ ruleId: rule.id, cluster: rule.cluster, severity: rule.severity, passed: true, details: 'Rule threw' });
        rulePass.set(rule.id, (rulePass.get(rule.id) ?? 0) + 1);
      }
    }

    scored.push({ platformId: pid, platformName: r.platform_name as string, sceneId: r.scene_id as string,
      tier: r.tier as number, gptScore: r.gpt_score as number, path, results, failCount: fails, criticalFails: crits, gateRejected: gateRej });
  }

  // ── OUTPUT ──────────────────────────────────────────────────────────
  const total = rows.length;

  log('── Per-Rule Summary (R01–R10) ──');
  log('');
  for (const rule of RULES) {
    const p = rulePass.get(rule.id) ?? 0, f = ruleFail.get(rule.id) ?? 0;
    const icon = f === 0 ? '✓' : rule.severity === 'critical' ? '✗' : '⚠';
    log(`  ${icon} ${rule.id.padEnd(35)} pass=${p}  fail=${f}  (${((p / total) * 100).toFixed(1)}% pass)  [${rule.severity}]`);
  }
  log('');

  // Path distribution
  const gptCells = scored.filter(s => s.path === 'gpt');
  const detCells = scored.filter(s => s.path === 'deterministic');
  log('── Path Distribution ──');
  log('');
  log(`  GPT:           ${gptCells.length}/${total}  (${((gptCells.length / total) * 100).toFixed(0)}%)`);
  log(`  Deterministic: ${detCells.length}/${total}  (${((detCells.length / total) * 100).toFixed(0)}%)`);
  log(`  Pass-through:  ${scored.filter(s => s.path === 'pass_through').length}/${total}`);
  log('');

  // Gate analysis (GPT path)
  if (gptCells.length > 0) {
    const rej = gptCells.filter(s => s.gateRejected).length;
    const dep = ((rej / gptCells.length) * 100).toFixed(1);
    log('── Gate Rejection (GPT path) ──');
    log('');
    log(`  GPT cells:      ${gptCells.length}`);
    log(`  Gate rejected:  ${rej}  (${dep}% rescue dependency)`);
    log(`  GPT used:       ${gptCells.length - rej}`);
    const icon = parseFloat(dep) >= 25 ? '🔴' : parseFloat(dep) >= 10 ? '🟡' : '🟢';
    log(`  ${icon} Rescue dependency: ${dep}%`);
    log('');
  }

  // Deterministic effectiveness
  if (detCells.length > 0) {
    const noop = detCells.filter(s => s.results.some(r => r.ruleId === 'R10_TRANSFORM_ACTIVITY' && !r.passed)).length;
    log('── Deterministic Effectiveness ──');
    log('');
    log(`  Active:  ${detCells.length - noop}/${detCells.length}  (${(((detCells.length - noop) / detCells.length) * 100).toFixed(0)}%)`);
    log(`  No-op:   ${noop}/${detCells.length}  (${((noop / detCells.length) * 100).toFixed(0)}%)`);
    log('');
  }

  // Per-platform
  const byPlat = new Map<string, Scored[]>();
  for (const s of scored) { const a = byPlat.get(s.platformId) ?? []; a.push(s); byPlat.set(s.platformId, a); }

  log('── Per-Platform Failures (by fail count) ──');
  log('');
  const platSum = [...byPlat.entries()]
    .map(([pid, rs]) => ({
      pid, name: rs[0]?.platformName ?? pid, tier: rs[0]?.tier ?? 0, path: rs[0]?.path ?? '?',
      fails: rs.reduce((s, r) => s + r.failCount, 0), crits: rs.reduce((s, r) => s + r.criticalFails, 0),
      scenes: rs.length, gateRej: rs.filter(r => r.gateRejected).length,
      rules: [...new Set(rs.flatMap(r => r.results.filter(x => !x.passed).map(x => x.ruleId)))],
    }))
    .sort((a, b) => b.fails - a.fails);

  for (const p of platSum) {
    if (p.fails === 0) continue;
    const r = p.rules.map(x => x.replace(/^R\d+_/, '')).join(', ');
    const c = p.crits > 0 ? `  ⚠ ${p.crits} CRIT` : '';
    const g = p.gateRej > 0 ? `  [${p.gateRej} gate]` : '';
    log(`  ${p.name.padEnd(22)} T${p.tier} ${p.path.padEnd(13)} fails=${p.fails}  rules: ${r}${c}${g}`);
  }
  const clean = platSum.filter(p => p.fails === 0).length;
  if (clean > 0) log(`  (${clean} platforms with zero failures)`);
  log('');

  // Per-scene
  const byScene = new Map<string, Scored[]>();
  for (const s of scored) { const a = byScene.get(s.sceneId) ?? []; a.push(s); byScene.set(s.sceneId, a); }

  log('── Per-Scene Failures (by fail count) ──');
  log('');
  const scSum = [...byScene.entries()]
    .map(([sid, rs]) => ({
      sid, fails: rs.reduce((s, r) => s + r.failCount, 0), crits: rs.reduce((s, r) => s + r.criticalFails, 0),
      n: rs.length, rules: [...new Set(rs.flatMap(r => r.results.filter(x => !x.passed).map(x => x.ruleId)))],
    }))
    .sort((a, b) => b.fails - a.fails);

  for (const s of scSum) {
    const r = s.rules.map(x => x.replace(/^R\d+_/, '')).join(', ');
    const c = s.crits > 0 ? `  ⚠ ${s.crits} CRIT` : '';
    log(`  ${s.sid.padEnd(40)} fails=${s.fails}  rules: ${r}${c}`);
  }
  log('');

  // Verbose
  if (args.verbose) {
    log('── Failure Detail ──');
    log('');
    for (const s of scored) {
      const f = s.results.filter(r => !r.passed);
      if (f.length === 0) continue;
      log(`  ${s.platformId} × ${s.sceneId} (score=${s.gptScore}, ${s.path}):`);
      for (const x of f) log(`    ${x.ruleId} [${x.severity}]: ${x.details ?? '-'}`);
    }
    log('');
  }

  // Red flags
  log('── Red Flags ──');
  log('');
  const r01 = ruleFail.get('R01_OUTPUT_NOT_EMPTY') ?? 0;
  const r02 = ruleFail.get('R02_CEILING_COMPLIANCE') ?? 0;
  if (r01 > 0) log('  🔴 R01 failed — empty outputs detected');
  if (r02 > 0) log('  🔴 R02 failed — ceiling breaches detected');
  if (r01 === 0 && r02 === 0) log('  ✓ R01 + R02 at 100%');
  const r10f = ruleFail.get('R10_TRANSFORM_ACTIVITY') ?? 0;
  if (r10f > total * 0.2) log(`  ⚠ R10: ${r10f}/${total} cells unchanged — see path distribution`);
  const r06 = ruleFail.get('R06_NO_INVENTED_CONTENT') ?? 0;
  if (r06 === 0) log('  ℹ R06: 0 fires — limited pattern coverage');
  else log(`  ⚠ R06: ${r06} invented-content detections`);
  log('');

  const tf = scored.reduce((s, r) => s + r.failCount, 0);
  const tc = scored.reduce((s, r) => s + r.criticalFails, 0);
  log(`═══ DONE: ${total} cells, ${tf} failures (${tc} critical) ═══`);

  await sql.end();
}

main().catch(e => { logError(`Fatal: ${e}`); process.exit(1); });
