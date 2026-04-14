// scripts/run-harness.ts
// ============================================================================
// Call 2 Quality Harness — Runner (Phase 1: Aim Circuit Board)
// ============================================================================
// Wires Phases A through E together plus the new Phase 1 aim circuit board.
// After mechanical scoring + inventory, the runner computes aim-level rollups
// and prints the full circuit board to console.
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
//      buildAimCircuitBoard(inventory.by_rule)              ← Phase 1 NEW
//      writeInventoryToDisk() — includes by_aim             ← Phase 1 NEW
//      printCircuitBoard()                                  ← Phase 1 NEW
//
// USAGE (PowerShell, run from C:\Users\Proma\Projects\promagen\frontend\):
//
//   # First, drop the snapshot file:
//   #   harness-snapshots\call-2-system-prompt-v6.1.txt
//   # Then start the dev server in another terminal so the dev endpoint is up:
//   pnpm dev
//   # Then in this terminal:
//   $env:CALL2_HARNESS_DEV_AUTH = "<the long secret from .env.local>"
//   pnpm exec tsx scripts/run-harness.ts --version v6.1 --run-class smoke_alarm
//
// FLAGS:
//   --version <string>             Required. Call 2 version label, e.g. v6.1
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
//   - api-call-2-v2_1_0.md §13, §14, §15 Phase 1
//   - call-2-harness-build-plan-v1.md §9 (proof-of-life)
//   - call-2-quality-architecture-v0.3.1.md §11, §14, §16
// Existing features preserved: Yes — all existing run logic unchanged.
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
  writeTierTextsToDisk,
  loadInventory,
  inventoryFilename,
  tierTextFilename,
  attachDiff,
  attachAimCircuitBoard,
  attachStabilityBands,
  attachSceneClassBreakdown,
  DEFAULT_HARNESS_RUNS_DIR,
  type HarnessRun,
  type FailureModeInventory,
  type TierTextEntry,
  type TierTextCapture,
} from '@/lib/call-2-harness/inventory-writer';
import { diffInventories } from '@/lib/call-2-harness/diff';
import {
  ALL_RUN_CLASSES,
  getRunClassConfig,
  type RunClass,
} from '@/lib/call-2-harness/run-classes';
import { loadSystemPrompt } from '@/lib/call-2-harness/system-prompt-loader';
import { buildAimCircuitBoard, type AimCircuitBoard } from '@/lib/call-2-harness/aim-rollup';
import { printCircuitBoard } from '@/lib/call-2-harness/circuit-printer';
import { computeStabilityBands, type StabilityReport } from '@/lib/call-2-harness/stability-tracker';
import { separateBySceneClass, type SceneClassBreakdown } from '@/lib/call-2-harness/scene-class-separator';

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
const HARNESS_VERSION = '1.0.0';

function normaliseExpectedElements(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return Object.freeze(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    );
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return Object.freeze(trimmed.length > 0 ? [trimmed] : []);
  }

  return Object.freeze([]);
}

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
    throw new Error('[run-harness] --version is required (e.g. --version v6.1)');
  }
  return args;
}

function printHelpAndExit(code: number): never {
  console.log(
    [
      'Usage: tsx scripts/run-harness.ts --version <v> [options]',
      '',
      'Required:',
      '  --version <string>            Call 2 version label, e.g. v6.1',
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

  header(`Call 2 Quality Harness — Aim Circuit Board Runner`);
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

  // ── Load the system prompt snapshot ───────────────────────────────────────
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
  const tierTextCaptures: TierTextEntry[] = [];
  const failures: Array<{ sceneId: string; sampleIndex: number; error: string }> = [];
  const t0 = performance.now();
  let modelVersionSeen = 'gpt-5.4-mini';
  let completed = 0;

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
      modelVersionSeen = data.metadata.model_version ?? modelVersionSeen;

      if (sampleIndex === 0 && completed < 3) {
        info(
          `[sample] ${scene.id} #${sampleIndex}  ` +
          `latency=${data.metadata.latency_ms}ms  ` +
          `stages=${data.metadata.stages_applied.join(',')}`,
        );
      }
      modelVersionSeen = data.metadata.model_version;

      const allStages = runMechanicalScorerAllStages(
        {
          a: data.stage_a_raw_model,
          b: data.stage_b_post_processed,
          c: data.stage_c_compliance_enforced,
          d: data.stage_d_final,
        },
        { input: scene.input, expectedElements: normaliseExpectedElements(scene.expected_elements) },
      );

      samples.push({
        sceneId: scene.id,
        sampleIndex,
        stages: allStages,
      });

      // Capture Stage A + Stage D tier text for the sidecar file.
      // Stage A = what GPT produced. Stage D = product truth.
      tierTextCaptures.push({
        scene_id: scene.id,
        sample_index: sampleIndex,
        stage_a: data.stage_a_raw_model,
        stage_d: data.stage_d_final,
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

  // Concurrency pool.
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

  // ── Aim Circuit Board (Phase 1) ─────────────────────────────────────────
  sub('Computing aim circuit board');
  const circuitBoard: AimCircuitBoard = buildAimCircuitBoard(inventory.by_rule);
  inventory = attachAimCircuitBoard(inventory, circuitBoard);
  info(`aims            : ${circuitBoard.summary.total_aims}`);
  info(`bright          : ${circuitBoard.summary.bright_count}`);
  info(`dim             : ${circuitBoard.summary.dim_count}`);
  info(`out             : ${circuitBoard.summary.out_count}`);
  info(`not wired       : ${circuitBoard.summary.not_wired_count}`);
  info(`faults          : ${circuitBoard.fault_register.length}`);

  // ── Stability Bands (Phase 2) ─────────────────────────────────────────
  sub('Computing stability bands');
  let stabilityReport: StabilityReport | null = null;
  try {
    stabilityReport = await computeStabilityBands(
      inventory.by_rule,
      resolve(process.cwd(), args.outDir),
    );
    inventory = attachStabilityBands(inventory, stabilityReport);
    info(`runs analysed   : ${stabilityReport.runs_analysed}`);
    info(`stable rules    : ${stabilityReport.stable_count}`);
    info(`real changes    : ${stabilityReport.real_change_count}`);
    info(`insufficient    : ${stabilityReport.insufficient_data_count}`);
  } catch (err) {
    warn(`stability bands failed: ${err instanceof Error ? err.message : String(err)}`);
    warn('continuing without stability data.');
  }

  // ── Scene-Class Separation (Phase 2) ──────────────────────────────────
  sub('Separating scores by scene class');
  let sceneClassBreakdown: SceneClassBreakdown | null = null;
  try {
    sceneClassBreakdown = separateBySceneClass(samples, filteredScenes);
    inventory = attachSceneClassBreakdown(inventory, sceneClassBreakdown);
    info(`input classes   : ${sceneClassBreakdown.class_count}`);
    for (const [className, classResult] of Object.entries(sceneClassBreakdown.classes)) {
      info(`  ${className.padEnd(16)}: ${classResult.scene_count} scenes, ${(classResult.stage_d_fail_rate * 100).toFixed(1)}% fail`);
    }
  } catch (err) {
    warn(`scene-class separation failed: ${err instanceof Error ? err.message : String(err)}`);
    warn('continuing without scene-class data.');
  }

  // ── Write to disk ─────────────────────────────────────────────────────
  sub('Writing inventory to disk');
  const filename = inventoryFilename(inventory);
  const outPath = resolve(process.cwd(), args.outDir, filename);
  await writeInventoryToDisk(inventory, outPath);
  info(`written to      : ${outPath}`);

  // ── Write tier text sidecar ─────────────────────────────────────────────
  const tierTextData: TierTextCapture = {
    version: args.version,
    run_timestamp: runStartedAtIso,
    run_class: args.runClass,
    scene_count: filteredScenes.length,
    samples_per_scene: cfg.samplesPerScene,
    sample_count: tierTextCaptures.length,
    samples: tierTextCaptures,
  };
  const ttFilename = tierTextFilename(inventory);
  const ttOutPath = resolve(process.cwd(), args.outDir, ttFilename);
  await writeTierTextsToDisk(tierTextData, ttOutPath);
  info(`tier texts      : ${ttOutPath}`);

  // ── Print circuit board (FIRST — this is what you read) ───────────────────
  printCircuitBoard(circuitBoard, args.version, args.runClass, runStartedAtIso, {
    stability: stabilityReport ?? undefined,
    sceneClasses: sceneClassBreakdown ?? undefined,
  });

  // ── Sample-level failures last ────────────────────────────────────────────
  if (failures.length > 0) {
    sub(`Sample-level failures (${failures.length})`);
    for (const f of failures.slice(0, 20)) {
      fail(`${f.sceneId}#${f.sampleIndex}: ${f.error}`);
    }
    if (failures.length > 20) {
      fail(`... and ${failures.length - 20} more`);
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
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
