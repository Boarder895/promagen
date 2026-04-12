// scripts/run-harness.ts
// ============================================================================
// Call 2 Quality Harness — Proof-of-Life Runner (Phase E milestone)
// ============================================================================
// Wires Phases A through E together for the first real press-the-button run
// against Call 2 v4.5. Per build plan §9, this is the proof-of-life vehicle:
// it is meant to surface what the harness sees, not yet to make decisions.
//
// File location: top-level `scripts/` (not `src/scripts/`). Matches the
// project convention used by lint-venues.ts and verify-analytics-env.ts.
// tsconfig.json excludes the `scripts` directory from typecheck, which is
// the correct convention for Node CLI scripts that run outside the bundler.
// Path aliases (@/*) still resolve via tsconfig paths from project root.
//
//   loadScenes()                          ← Phase B
//      └─ for scene × N samples:
//             POST /api/dev/generate-tier-prompts   ← Phase A
//             runMechanicalScorerAllStages()         ← Phase C
//      buildInventory(run, { ruleIdsExercisedByScenes })   ← Phase D
//      diffInventories(previous, current) + attachDiff()   ← Phase E
//      writeInventoryToDisk()
//      printSummary()
//
// USAGE (PowerShell, run from C:\Users\Proma\Projects\promagen\frontend\):
//
//   # First, drop the snapshot file:
//   #   harness-snapshots\call-2-system-prompt-v4.5.txt
//   # Then start the dev server in another terminal so the dev endpoint is up:
//   pnpm dev
//   # Then in this terminal:
//   $env:CALL2_HARNESS_DEV_AUTH = "<the long secret from .env.local>"
//   pnpm exec tsx scripts/run-harness.ts --version v4.5 --run-class smoke_alarm
//
// FLAGS:
//   --version <string>             Required. Call 2 version label, e.g. v4.5
//   --run-class <smoke_alarm|...>  Default smoke_alarm. See run-classes.ts.
//   --previous <path>              Optional. Previous inventory file to diff against.
//   --out-dir <path>               Default generated/call-2-harness/runs
//   --max-calls <number>           Default 250. Hard ceiling on dev endpoint calls.
//   --system-prompt-file <path>    Override the default snapshot path.
//   --include-holdout              Include holdout scenes (milestone runs only).
//   --endpoint <url>               Override dev endpoint URL.
//   --concurrency <number>         Parallel in-flight requests. Default 1 (serial).
//   --dry-run                      Plan the run, refuse the OpenAI calls. Useful for wiring tests.
//
// SAFETY GATES:
//   1. Refuses to run against /api/generate-tier-prompts (production route).
//      Only /api/dev/generate-tier-prompts is allowed.
//   2. Refuses if total calls (scenes × samples) > --max-calls.
//   3. Refuses if dev_only scenes are present and the endpoint is non-dev.
//   4. Refuses without CALL2_HARNESS_DEV_AUTH set.
//   5. Refuses if the snapshot loader throws (missing file, truncation).
//
// Authority:
//   - call-2-harness-build-plan-v1.md §9 (proof-of-life)
//   - call-2-quality-architecture-v0.3.1.md §11, §14, §16
// Existing features preserved: Yes (this is a new script).
// ============================================================================

 
// Console output is the user interface for this script. ESLint's no-console
// rule is disabled module-wide rather than line-by-line for readability.

import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';

import {
  loadScenes,
  getDevOnlyScenes,
  type Scene,
} from '@/lib/call-2-harness/scene-library';
import {
  runMechanicalScorerAllStages,
  type TierBundle,
} from '@/lib/call-2-harness/mechanical-scorer';
import type { SampleStageResults } from '@/lib/call-2-harness/rescue-dependency';
import {
  buildInventory,
  writeInventoryToDisk,
  loadInventory,
  inventoryFilename,
  attachDiff,
  DEFAULT_HARNESS_RUNS_DIR,
  type HarnessRun,
  type FailureModeInventory,
} from '@/lib/call-2-harness/inventory-writer';
import { diffInventories } from '@/lib/call-2-harness/diff';
import {
  ALL_RUN_CLASSES,
  getRunClassConfig,
  type RunClass,
} from '@/lib/call-2-harness/run-classes';
import { loadSystemPrompt } from '@/lib/call-2-harness/system-prompt-loader';

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================
//
// Manual parser — no commander/yargs dep. Keeps the runner installable from
// the existing package.json with no new packages, and the surface area is
// small enough that a flag table is clearer than a library config.
//
interface ParsedArgs {
  version: string;
  runClass: RunClass;
  previousPath: string | null;
  outDir: string;
  maxCalls: number;
  systemPromptFile: string | null;
  includeHoldout: boolean;
  endpoint: string;
  concurrency: number;
  dryRun: boolean;
  sceneFilter: string[] | null;
}

const DEFAULT_ENDPOINT = 'http://localhost:3000/api/dev/generate-tier-prompts';
const HARNESS_VERSION = '0.3.1';

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = {
    version: '',
    runClass: 'smoke_alarm' as RunClass,
    previousPath: null as string | null,
    outDir: DEFAULT_HARNESS_RUNS_DIR,
    maxCalls: 250,
    systemPromptFile: null as string | null,
    includeHoldout: false,
    endpoint: DEFAULT_ENDPOINT,
    concurrency: 1,
    dryRun: false,
    sceneFilter: null as string[] | null,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = (): string => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        throw new Error(`[run-harness] flag ${flag} requires a value`);
      }
      i += 1;
      return v;
    };

    switch (flag) {
      case '--version':
        args.version = next();
        break;
      case '--run-class': {
        const v = next() as RunClass;
        if (!ALL_RUN_CLASSES.includes(v)) {
          throw new Error(
            `[run-harness] unknown --run-class "${v}". Valid: ${ALL_RUN_CLASSES.join(', ')}`,
          );
        }
        args.runClass = v;
        break;
      }
      case '--previous':
        args.previousPath = next();
        break;
      case '--out-dir':
        args.outDir = next();
        break;
      case '--max-calls':
        args.maxCalls = Number.parseInt(next(), 10);
        if (!Number.isFinite(args.maxCalls) || args.maxCalls < 1) {
          throw new Error('[run-harness] --max-calls must be a positive integer');
        }
        break;
      case '--system-prompt-file':
        args.systemPromptFile = next();
        break;
      case '--include-holdout':
        args.includeHoldout = true;
        break;
      case '--endpoint':
        args.endpoint = next();
        break;
      case '--concurrency':
        args.concurrency = Number.parseInt(next(), 10);
        if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
          throw new Error('[run-harness] --concurrency must be a positive integer');
        }
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--scenes':
        args.sceneFilter = next().split(',').map((s) => s.trim()).filter(Boolean);
        if (args.sceneFilter.length === 0) {
          throw new Error('[run-harness] --scenes requires at least one scene ID');
        }
        break;
      case '--help':
      case '-h':
        printHelpAndExit(0);
        break;
      default:
        throw new Error(`[run-harness] unknown flag: ${flag}`);
    }
  }

  if (!args.version) {
    throw new Error('[run-harness] --version is required (e.g. --version v4.5)');
  }
  return args;
}

function printHelpAndExit(code: number): never {
  console.log(
    [
      'Usage: tsx scripts/run-harness.ts --version <v> [options]',
      '',
      'Required:',
      '  --version <string>            Call 2 version label, e.g. v4.5',
      '',
      'Optional:',
      '  --run-class <class>           smoke_alarm (default) | decision_support |',
      '                                dispute_resolution | milestone | mutation',
      '  --previous <path>             Previous inventory JSON to diff against',
      `  --out-dir <path>              Default ${DEFAULT_HARNESS_RUNS_DIR}`,
      '  --max-calls <n>               Hard ceiling on dev endpoint calls (default 250)',
      '  --system-prompt-file <path>   Override default snapshot path',
      '  --include-holdout             Include holdout scenes (milestone runs only)',
      `  --endpoint <url>              Default ${DEFAULT_ENDPOINT}`,
      '  --concurrency <n>             Parallel in-flight requests (default 1)',
      '  --dry-run                     Plan the run, refuse the OpenAI calls',
      '  --scenes <ids>                Comma-separated scene IDs to run (default: all)',
      '  -h, --help                    Show this help and exit',
    ].join('\n'),
  );
  process.exit(code);
}

// ============================================================================
// LOGGING — loud, structured, easy to grep
// ============================================================================

const HEADER_BAR = '='.repeat(78);
const SUB_BAR = '-'.repeat(78);

function header(text: string): void {
  console.log(`\n${HEADER_BAR}\n${text}\n${HEADER_BAR}`);
}
function sub(text: string): void {
  console.log(`\n${text}\n${SUB_BAR}`);
}
function info(text: string): void {
  console.log(`[INFO] ${text}`);
}
function warn(text: string): void {
  console.log(`[WARN] ${text}`);
}
function fail(text: string): void {
  console.log(`[FAIL] ${text}`);
}

// ============================================================================
// DEV ENDPOINT CLIENT
// ============================================================================

interface DevEndpointResponse {
  stage_a_raw_model: TierBundle;
  stage_b_post_processed: TierBundle;
  stage_c_compliance_enforced: TierBundle;
  stage_d_final: TierBundle;
  metadata: {
    model_version: string;
    latency_ms: number;
    tokens_used: { prompt: number | null; completion: number | null };
    stages_applied: readonly string[];
    provider_context_present: boolean;
  };
}

/**
 * POST a single sample to the dev endpoint and return all four stages.
 *
 * Throws on any non-200 response. The runner catches and counts errors per
 * scene/sample so one bad sample doesn't kill the whole run.
 */
async function callDevEndpoint(
  endpoint: string,
  authSecret: string,
  systemPrompt: string,
  userMessage: string,
): Promise<DevEndpointResponse> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Auth': authSecret,
    },
    body: JSON.stringify({ systemPrompt, userMessage }),
  });

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as DevEndpointResponse;
  if (
    !data?.stage_a_raw_model ||
    !data?.stage_b_post_processed ||
    !data?.stage_c_compliance_enforced ||
    !data?.stage_d_final
  ) {
    throw new Error('dev endpoint returned a response missing one of the four stage fields');
  }
  return data;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const runStartedAt = new Date();
  const runStartedAtIso = runStartedAt.toISOString();

  header(`Call 2 Quality Harness — Proof-of-Life Runner`);
  info(`harness version : ${HARNESS_VERSION}`);
  info(`call 2 version  : ${args.version}`);
  info(`run class       : ${args.runClass}`);
  info(`endpoint        : ${args.endpoint}`);
  info(`out dir         : ${args.outDir}`);
  info(`max calls cap   : ${args.maxCalls}`);
  info(`concurrency     : ${args.concurrency}`);
  info(`include holdout : ${args.includeHoldout}`);
  info(`dry run         : ${args.dryRun}`);
  info(`started at      : ${runStartedAtIso}`);

  // ── Safety gate 1: refuse to hit the production route ─────────────────────
  if (!args.endpoint.includes('/api/dev/generate-tier-prompts')) {
    fail('refusing to run: --endpoint does not point at the dev route.');
    fail('the harness must NEVER hit /api/generate-tier-prompts (production).');
    process.exit(2);
  }

  // ── Safety gate 2: auth secret must be set ────────────────────────────────
  const authSecret = process.env.CALL2_HARNESS_DEV_AUTH ?? '';
  if (!args.dryRun && authSecret.length < 16) {
    fail('CALL2_HARNESS_DEV_AUTH env var is unset or too short.');
    fail('Set it to the same value the dev endpoint reads from .env.local.');
    process.exit(2);
  }

  // ── Load the system prompt snapshot (Phase E system-prompt-loader) ────────
  sub('Loading system prompt snapshot');
  let snapshot: Awaited<ReturnType<typeof loadSystemPrompt>>;
  try {
    snapshot = await loadSystemPrompt({
      version: args.version,
      ...(args.systemPromptFile !== null
        ? { explicitPath: args.systemPromptFile }
        : {}),
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  info(`snapshot path   : ${snapshot.absolutePath}`);
  info(`snapshot mtime  : ${snapshot.snapshotMtime}`);
  info(`snapshot length : ${snapshot.prompt.length} chars`);
  if (snapshot.warnings.length > 0) {
    for (const w of snapshot.warnings) {
      warn(w);
    }
  }

  // ── Load scenes (Phase B) ─────────────────────────────────────────────────
  sub('Loading scene library');
  const cfg = getRunClassConfig(args.runClass);
  const scenes = loadScenes({
    includeHoldout: args.includeHoldout || cfg.holdout,
  });
  info(`scenes loaded   : ${scenes.length}`);
  info(`samples / scene : ${cfg.samplesPerScene}`);

  // ── Optional scene filter (--scenes flag) ──────────────────────────────────
  let filteredScenes = scenes;
  if (args.sceneFilter !== null) {
    filteredScenes = scenes.filter((s) => args.sceneFilter!.includes(s.id));
    const missing = args.sceneFilter.filter(
      (id) => !scenes.some((s) => s.id === id),
    );
    if (missing.length > 0) {
      warn(`--scenes: ${missing.length} IDs not found in library: ${missing.join(', ')}`);
    }
    if (filteredScenes.length === 0) {
      fail('--scenes filter matched zero scenes. Check your scene IDs.');
      process.exit(2);
    }
    info(`scene filter    : ${filteredScenes.length}/${scenes.length} scenes selected`);
  }

  // ── Safety gate 3: dev_only scenes only allowed against the dev endpoint ──
  const devOnlyAll = getDevOnlyScenes();
  const devOnlyInRun = filteredScenes.filter((s) => s.dev_only === true);
  if (devOnlyInRun.length > 0) {
    info(`dev_only scenes : ${devOnlyInRun.length} (allowed against dev endpoint)`);
  } else {
    info(`dev_only scenes : 0 in this run (library has ${devOnlyAll.length} total)`);
  }

  // ── Safety gate 4: total calls must not exceed --max-calls ────────────────
  const totalCalls = filteredScenes.length * cfg.samplesPerScene;
  info(`total calls     : ${totalCalls} (${filteredScenes.length} scenes × ${cfg.samplesPerScene} samples)`);
  if (totalCalls > args.maxCalls) {
    fail(`total calls ${totalCalls} exceeds --max-calls ${args.maxCalls}.`);
    fail('Either raise --max-calls explicitly or pick a smaller run class.');
    process.exit(2);
  }

  // Build the exercised-rules set up front so we can pass it to buildInventory.
  // Architecture §14: coverage_gaps is a SCENE LIBRARY traceability concept,
  // not a "this rule didn't fail" check. The runner is the only place that
  // knows which rules the scenes claim to exercise.
  const ruleIdsExercisedByScenes = new Set<string>();
  for (const scene of filteredScenes) {
    for (const ruleId of scene.exercises_rules) {
      ruleIdsExercisedByScenes.add(ruleId);
    }
  }
  info(`rules exercised : ${ruleIdsExercisedByScenes.size} (by at least one scene)`);

  if (args.dryRun) {
    sub('DRY RUN — refusing to call OpenAI. Wiring proven.');
    info('all gates passed. Re-run without --dry-run to actually press the button.');
    process.exit(0);
  }

  // ── Run the loop (Phases A → C) ───────────────────────────────────────────
  sub(`Running ${totalCalls} samples (concurrency ${args.concurrency})`);

  const samples: SampleStageResults[] = [];
  const failures: Array<{ sceneId: string; sampleIndex: number; error: string }> = [];
  const t0 = performance.now();
  let modelVersionSeen = 'gpt-5.4-mini';
  let completed = 0;

  // The work plan is a flat list of (scene, sampleIndex) pairs. The
  // concurrency loop pulls from this queue. Serial mode (concurrency=1) is
  // recommended for the first run — easier to read the output, easier to
  // Ctrl-C if something goes sideways.
  type WorkItem = { scene: Scene; sampleIndex: number };
  const queue: WorkItem[] = [];
  for (const scene of filteredScenes) {
    for (let s = 0; s < cfg.samplesPerScene; s++) {
      queue.push({ scene, sampleIndex: s });
    }
  }

  async function processOne(item: WorkItem): Promise<void> {
    const { scene, sampleIndex } = item;
    try {
      const data = await callDevEndpoint(
        args.endpoint,
        authSecret,
        snapshot.prompt,
        scene.input,
      );
      modelVersionSeen = data.metadata.model_version;

      const allStages = runMechanicalScorerAllStages(
        {
          a: data.stage_a_raw_model,
          b: data.stage_b_post_processed,
          c: data.stage_c_compliance_enforced,
          d: data.stage_d_final,
        },
        { input: scene.input },
      );

      samples.push({
        sceneId: scene.id,
        sampleIndex,
        stages: allStages,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ sceneId: scene.id, sampleIndex, error: message });
    } finally {
      completed += 1;
      if (completed % 10 === 0 || completed === queue.length) {
        info(`progress        : ${completed}/${queue.length} (${failures.length} failures)`);
      }
    }
  }

  // Concurrency pool. Default 1 (strictly serial). Higher values run N
  // parallel workers off the same queue. Per build plan §9 the first run
  // SHOULD be serial — readable output is more valuable than speed.
  const workers: Promise<void>[] = [];
  let cursor = 0;
  for (let w = 0; w < args.concurrency; w++) {
    workers.push(
      (async () => {
        while (cursor < queue.length) {
          const item = queue[cursor];
          cursor += 1;
          if (!item) continue;
          await processOne(item);
        }
      })(),
    );
  }
  await Promise.all(workers);

  const wallClockSeconds = Math.round((performance.now() - t0) / 1000);
  info(`wall clock      : ${wallClockSeconds}s`);
  info(`samples scored  : ${samples.length}`);
  info(`samples failed  : ${failures.length}`);

  if (samples.length === 0) {
    fail('no samples produced any results — the run is unusable.');
    if (failures.length > 0) {
      fail(`first failure: ${failures[0]?.error ?? 'unknown'}`);
    }
    process.exit(3);
  }

  // ── Build inventory (Phase D) ─────────────────────────────────────────────
  sub('Building failure-mode inventory');
  const harnessRun: HarnessRun = {
    version: args.version,
    runClass: args.runClass,
    harnessVersion: HARNESS_VERSION,
    modelVersion: modelVersionSeen,
    runTimestamp: runStartedAtIso,
    sceneCount: filteredScenes.length,
    samplesPerScene: cfg.samplesPerScene,
    wallClockSeconds,
    samples,
  };
  let inventory: FailureModeInventory = buildInventory(harnessRun, {
    ruleIdsExercisedByScenes,
  });
  info(`by_rule entries : ${Object.keys(inventory.by_rule).length}`);
  info(`coverage_gaps   : ${inventory.coverage_gaps.length}`);

  // ── Diff against previous (Phase E) — only if --previous given ────────────
  if (args.previousPath) {
    sub('Diffing against previous inventory');
    info(`previous file   : ${args.previousPath}`);
    try {
      const previous = await loadInventory(resolve(process.cwd(), args.previousPath));
      const diff = diffInventories(previous, inventory);
      inventory = attachDiff(inventory, diff);
      info(`improved        : ${diff.rules_improved.length}`);
      info(`regressed       : ${diff.rules_regressed.length}`);
      info(`unchanged       : ${diff.rules_unchanged}`);
      info(`top warnings    : ${diff.warnings.length}`);
    } catch (err) {
      fail(`failed to load previous inventory: ${err instanceof Error ? err.message : String(err)}`);
      fail('continuing without diff. The current inventory will still be written.');
    }
  } else {
    info('no --previous given. Skipping diff (this is the first run).');
  }

  // ── Write to disk ─────────────────────────────────────────────────────────
  sub('Writing inventory to disk');
  const filename = inventoryFilename(inventory);
  const outPath = resolve(process.cwd(), args.outDir, filename);
  await writeInventoryToDisk(inventory, outPath);
  info(`written to      : ${outPath}`);

  // ── Loud summary (LAST so it stays on screen) ─────────────────────────────
  printSummary(inventory, failures);
  process.exit(failures.length > 0 ? 1 : 0);
}

// ============================================================================
// SUMMARY PRINTER
// ============================================================================
//
// Order matters: top-level warnings FIRST (loud), then improved/regressed
// counts, then coverage_gaps, then sample-level failures last. This is the
// order Martin will scan the terminal in.
//
function printSummary(
  inventory: FailureModeInventory,
  sampleFailures: ReadonlyArray<{ sceneId: string; sampleIndex: number; error: string }>,
): void {
  header('SUMMARY');

  // Warnings first — these are the things the runner most wants Martin to see.
  const diff = inventory.diff_vs_previous;
  if (diff && diff.warnings.length > 0) {
    sub(`Top-level warnings (${diff.warnings.length})`);
    for (const w of diff.warnings) {
      warn(`${w.type}: ${w.message}`);
    }
  } else if (diff) {
    info('no top-level diff warnings.');
  }

  // Improved / regressed / unchanged
  if (diff) {
    sub('Diff vs previous');
    info(`improved        : ${diff.rules_improved.length}`);
    info(`regressed       : ${diff.rules_regressed.length}`);
    info(`unchanged       : ${diff.rules_unchanged}`);

    if (diff.rules_regressed.length > 0) {
      sub('Top regressions (sorted by Stage D delta)');
      for (const r of diff.rules_regressed.slice(0, 10)) {
        const sign = r.stage_d_delta >= 0 ? '+' : '';
        const noteSuffix = r.note ? `  — ${r.note}` : '';
        warn(`${r.rule}  Δ${sign}${r.stage_d_delta.toFixed(4)}  [${r.decision_class}]${noteSuffix}`);
      }
    }
    if (diff.rules_improved.length > 0) {
      sub('Top improvements (sorted by Stage D delta)');
      for (const r of diff.rules_improved.slice(0, 10)) {
        const noteSuffix = r.note ? `  — ${r.note}` : '';
        info(`${r.rule}  Δ${r.stage_d_delta.toFixed(4)}  [${r.decision_class}]${noteSuffix}`);
      }
    }
  }

  // Coverage gaps — the scene library doing its job
  sub(`Coverage gaps (${inventory.coverage_gaps.length})`);
  if (inventory.coverage_gaps.length === 0) {
    info('every mechanical rule is exercised by at least one scene. Nice.');
  } else {
    info('the following mechanical rules have NO scene exercising them.');
    info('this is editorial work for the scene library, not a code bug:');
    for (const gap of inventory.coverage_gaps.slice(0, 30)) {
      console.log(`        ${gap}`);
    }
    if (inventory.coverage_gaps.length > 30) {
      console.log(`        ... and ${inventory.coverage_gaps.length - 30} more`);
    }
  }

  // Per-rule headline counts (rolled up to health classes)
  sub('Rule health rollup');
  const healthCounts: Record<string, number> = {};
  for (const entry of Object.values(inventory.by_rule)) {
    healthCounts[entry.health] = (healthCounts[entry.health] ?? 0) + 1;
  }
  for (const [health, count] of Object.entries(healthCounts)) {
    info(`${health.padEnd(20)}: ${count}`);
  }

  // Cluster fail rates
  sub('Cluster fail rates');
  for (const [cluster, entry] of Object.entries(inventory.by_cluster)) {
    const pct = (entry.fail_rate * 100).toFixed(2);
    info(`${cluster.padEnd(28)}: ${pct}%  (${entry.stage_d_fail_count} fails / ${entry.rule_count} rules)`);
  }

  // Sample-level failures last (least important if non-zero is small)
  if (sampleFailures.length > 0) {
    sub(`Sample-level failures (${sampleFailures.length})`);
    for (const f of sampleFailures.slice(0, 20)) {
      fail(`${f.sceneId}#${f.sampleIndex}: ${f.error}`);
    }
    if (sampleFailures.length > 20) {
      fail(`... and ${sampleFailures.length - 20} more`);
    }
  }

  console.log(`\n${HEADER_BAR}\n`);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
