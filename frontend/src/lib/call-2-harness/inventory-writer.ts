// src/lib/call-2-harness/inventory-writer.ts
// ============================================================================
// Call 2 Quality Harness — Failure-Mode Inventory Writer (Phase D)
// ============================================================================
// Aggregates N harness samples into the failure-mode inventory JSON shape
// from architecture §14. Computes per-rule fail rates per stage, the rescue
// dependency index, by-cluster rollups, health classification, and coverage
// gaps. Writes inventories to disk and reads them back for Phase E diffing.
//
// Authority: call-2-quality-architecture-v0.3.1.md §14, §11, §10
// Existing features preserved: Yes (this is a new module).
// ============================================================================

// ── Server-only guard ──────────────────────────────────────────────────────
// The runtime check at the bottom of the import block (after the last
// import) replaces the original `import 'server-only'` line, which threw
// unconditionally outside a Next.js Server Component context and broke the
// Phase E proof-of-life runner under tsx. The original guard was
// belt-and-braces: this file uses node:fs/promises which webpack and
// turbopack already refuse to bundle into client components, so accidental
// client-side import would fail at build time even without server-only.
// The runtime check provides the same defensive protection while remaining
// compatible with the harness runner's tsx-driven Node execution.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  ALL_CLUSTERS,
  ALL_RULES,
  CLUSTER_SCHEMA_VERSION,
  type Cluster,
  type TierBundle,
} from './mechanical-scorer';
import {
  calculateFailRate,
  calculateRescueDependency,
  classifyRuleHealth,
  interpretRuleHealth,
  type RuleHealth,
  type SampleStageResults,
} from './rescue-dependency';
import type { RunClass } from './run-classes';
// Type-only import to avoid a runtime circular dependency: diff.ts imports
// FailureModeInventory from this file. Both sides use `import type` so the
// cycle is erased at compile time and never reaches the runtime module graph.
import type { DiffReport } from './diff';
import type { AimCircuitBoard, FaultEntry } from './aim-rollup';
import type { StabilityReport } from './stability-tracker';
import type { SceneClassBreakdown } from './scene-class-separator';

// Runtime browser guard — see "Server-only guard" comment block above the
// imports. Throws at module load time if this file is somehow loaded into
// a browser context, providing the same defensive protection the original
// `import 'server-only'` line gave but without crashing under tsx.
if (typeof window !== 'undefined') {
  throw new Error(
    '[inventory-writer] this module is server-only — node:fs/promises is not available in browser contexts',
  );
}

// ============================================================================
// HARNESS RUN INPUT TYPES
// ============================================================================

/**
 * One full harness run against the scene library. The samples array contains
 * one entry per (scene × sample-index) pair, each with mechanical-scorer
 * output for all four route stages.
 */
export interface HarnessRun {
  readonly version: string; // Call 2 version, e.g. 'v4.5'
  readonly runClass: RunClass;
  readonly harnessVersion: string; // e.g. '0.3.1'
  readonly modelVersion: string; // e.g. 'gpt-5.4-mini-2026-02-15'
  readonly runTimestamp: string; // ISO 8601
  readonly sceneCount: number;
  readonly samplesPerScene: number;
  readonly wallClockSeconds: number;
  readonly samples: readonly SampleStageResults[];
}

// ============================================================================
// INVENTORY OUTPUT TYPES (matches architecture §14 schema)
// ============================================================================

export interface RuleInventoryEntry {
  readonly stage_a_fail_rate: number;
  readonly stage_b_fail_rate: number;
  readonly stage_c_fail_rate: number;
  readonly stage_d_fail_rate: number;
  readonly rescue_dependency: number;
  readonly health: RuleHealth;
  readonly interpretation: string;
  readonly evaluation_count: number;
  /**
   * Per-scene Stage D failure breakdown. Only populated for rules with at
   * least one Stage D failure — omitted entirely for healthy rules to keep
   * the inventory compact.
   *
   * Answers: "which scenes are causing this rule to fail, and how?"
   * For T3.char_count_in_range, the details strings include OVER/UNDER
   * direction tagging with exact character counts.
   */
  readonly stage_d_scene_detail?: Readonly<Record<string, SceneRuleDetail>>;
}

/**
 * Per-scene failure detail for one rule. Shows how many of the scene's
 * samples failed at Stage D and the mechanical scorer's details strings.
 */
export interface SceneRuleDetail {
  /** Number of samples from this scene that failed this rule at Stage D */
  readonly fail_count: number;
  /** Total samples from this scene (typically samplesPerScene) */
  readonly sample_count: number;
  /** Details strings from the mechanical scorer for each failing sample */
  readonly details: readonly string[];
}

export interface ClusterInventoryEntry {
  readonly fail_rate: number; // total_fails_in_cluster / total_evaluations_in_cluster
  readonly contributing_rules: readonly string[];
  readonly stage_d_fail_count: number;
  readonly rule_count: number;
}

/**
 * The full failure-mode inventory shape from architecture §14.
 *
 * Phase D ships by_rule, by_cluster, coverage_gaps, and the metadata block.
 * by_judge / metamorphic_stability / spot_audit / diff_vs_previous /
 * holdout_run are stubbed as null and will be populated by later phases.
 */
export interface FailureModeInventory {
  readonly version: string;
  readonly harness_version: string;
  readonly cluster_schema_version: string;
  readonly model_version: string;
  readonly run_timestamp: string;
  readonly scene_count: number;
  readonly samples_per_scene: number;
  readonly wall_clock_seconds: number;
  readonly run_class: RunClass;

  readonly by_rule: Readonly<Record<string, RuleInventoryEntry>>;
  readonly by_cluster: Readonly<Record<Cluster, ClusterInventoryEntry>>;

  readonly by_judge: null; // Phase F
  readonly metamorphic_stability: null; // Phase H
  readonly spot_audit: null; // Phase H milestone runs only
  readonly coverage_gaps: readonly string[];
  readonly diff_vs_previous: DiffReport | null; // Phase E (populated by attachDiff)
  readonly holdout_run: null; // populated when --include-holdout

  // Phase 1 — Aim Circuit Board (populated by attachAimCircuitBoard)
  readonly by_aim: AimCircuitBoard | null;
  readonly fault_register: readonly FaultEntry[] | null;

  // Phase 2 — Stability & Scene Class (populated by attach functions)
  readonly stability_bands: StabilityReport | null;
  readonly scene_class_breakdown: SceneClassBreakdown | null;
}

// ============================================================================
// CORE BUILDER
// ============================================================================

const INVENTORY_SCHEMA_VERSION = '2.0.0' as const;

/**
 * Options for buildInventory. Optional parameters allow callers to enrich the
 * inventory with information the writer cannot infer from the run alone.
 */
export interface BuildInventoryOptions {
  /**
   * The set of rule IDs that are exercised by at least one scene in the
   * scene library. The harness runner is expected to compute this from
   * scenes.json's `exercises_rules` field and pass it in.
   *
   * When provided, `coverage_gaps` is computed as the set of mechanical rules
   * (from ALL_RULES) that are NOT in this set — i.e. rules that no scene in
   * the library is designed to exercise. This matches architecture §14's
   * intent: coverage gaps are a scene-library traceability concern, not a
   * "no observed failures" concern.
   *
   * When omitted, `coverage_gaps` is an empty array — the writer makes no
   * claim either way. This avoids the previous implementation's mistake of
   * conflating "rule never failed" with "rule never exercised".
   */
  readonly ruleIdsExercisedByScenes?: ReadonlySet<string>;
}

/**
 * Build a failure-mode inventory from a completed harness run.
 *
 * The inventory shape matches architecture §14. Per-rule entries include
 * fail rates at all four stages plus the rescue dependency index. Per-cluster
 * entries roll up rule failures by primary cluster (the cluster declared on
 * each rule's RuleDefinition in Phase C).
 *
 * Pure: same input → same output.
 *
 * Contract note: this function takes ONE HarnessRun, producing ONE inventory.
 * The build plan §8.2 typed this as `buildInventory(runs: HarnessRun[])` but
 * architecture §14 is unambiguous that one inventory describes one harness run
 * ("Stored per Call 2 version, diffable across versions"). If a future use
 * case needs to merge multiple runs, add a `mergeHarnessRuns(runs[]): HarnessRun`
 * helper upstream rather than complicating this function's contract.
 */
export function buildInventory(
  run: HarnessRun,
  options: BuildInventoryOptions = {},
): FailureModeInventory {
  const samples = run.samples;

  // ── by_rule ──────────────────────────────────────────────────────────────
  const byRule: Record<string, RuleInventoryEntry> = {};
  for (const rule of ALL_RULES) {
    const stageA = calculateFailRate(samples, rule.id, 'a');
    const stageB = calculateFailRate(samples, rule.id, 'b');
    const stageC = calculateFailRate(samples, rule.id, 'c');
    const stageD = calculateFailRate(samples, rule.id, 'd');
    const rescue = calculateRescueDependency(samples, rule.id);
    const health = classifyRuleHealth(stageD, rescue);
    const interpretation = interpretRuleHealth(health, rescue, stageD);

    // Count how many sample-evaluations this rule actually got. This is the
    // total number of samples × 4 stages (every stage runs every rule), but
    // we count it explicitly to surface data integrity issues.
    let evaluationCount = 0;
    for (const sample of samples) {
      for (const stageId of ['a', 'b', 'c', 'd'] as const) {
        const found = sample.stages[stageId].results.find((r) => r.ruleId === rule.id);
        if (found) evaluationCount += 1;
      }
    }

    // ── Per-scene Stage D failure breakdown ────────────────────────────────
    // Only computed for rules with at least one Stage D failure.
    // Groups failures by sceneId so you can see which scenes cause the misses.
    let sceneDetail: Record<string, SceneRuleDetail> | undefined;
    if (stageD > 0) {
      const sceneMap = new Map<string, { fails: number; total: number; details: string[] }>();

      for (const sample of samples) {
        const found = sample.stages.d.results.find((r) => r.ruleId === rule.id);
        if (!found) continue;

        let entry = sceneMap.get(sample.sceneId);
        if (!entry) {
          entry = { fails: 0, total: 0, details: [] };
          sceneMap.set(sample.sceneId, entry);
        }
        entry.total += 1;
        if (!found.passed) {
          entry.fails += 1;
          if (found.details) entry.details.push(found.details);
        }
      }

      // Only include scenes that actually failed — no point listing 40 scenes
      // with 0 failures each
      const failingScenes: Record<string, SceneRuleDetail> = {};
      for (const [sceneId, entry] of sceneMap) {
        if (entry.fails > 0) {
          failingScenes[sceneId] = {
            fail_count: entry.fails,
            sample_count: entry.total,
            details: Object.freeze([...entry.details]),
          };
        }
      }

      if (Object.keys(failingScenes).length > 0) {
        sceneDetail = failingScenes;
      }
    }

    byRule[rule.id] = {
      stage_a_fail_rate: round4(stageA),
      stage_b_fail_rate: round4(stageB),
      stage_c_fail_rate: round4(stageC),
      stage_d_fail_rate: round4(stageD),
      rescue_dependency: round4(rescue),
      health,
      interpretation,
      evaluation_count: evaluationCount,
      ...(sceneDetail ? { stage_d_scene_detail: Object.freeze(sceneDetail) } : {}),
    };
  }

  // ── by_cluster ───────────────────────────────────────────────────────────
  // Each rule has a primary cluster declared in its definition. Aggregate
  // rule fails into clusters using that mapping (architecture §10.3).
  const clusterTotals: Record<Cluster, { fails: number; total: number; rules: string[] }> = {} as Record<
    Cluster,
    { fails: number; total: number; rules: string[] }
  >;
  for (const c of ALL_CLUSTERS) {
    clusterTotals[c] = { fails: 0, total: 0, rules: [] };
  }

  for (const rule of ALL_RULES) {
    const bucket = clusterTotals[rule.cluster];
    if (!bucket) continue; // unreachable but satisfies noUncheckedIndexedAccess

    bucket.rules.push(rule.id);

    // Count Stage D fails (the product-truth failure rate for the cluster)
    for (const sample of samples) {
      const found = sample.stages.d.results.find((r) => r.ruleId === rule.id);
      if (!found) continue;
      bucket.total += 1;
      if (!found.passed) bucket.fails += 1;
    }
  }

  const byCluster: Record<Cluster, ClusterInventoryEntry> = {} as Record<Cluster, ClusterInventoryEntry>;
  for (const c of ALL_CLUSTERS) {
    const bucket = clusterTotals[c];
    if (!bucket) continue;
    byCluster[c] = {
      fail_rate: bucket.total === 0 ? 0 : round4(bucket.fails / bucket.total),
      contributing_rules: Object.freeze([...bucket.rules]),
      stage_d_fail_count: bucket.fails,
      rule_count: bucket.rules.length,
    };
  }

  // ── coverage_gaps ────────────────────────────────────────────────────────
  // Coverage is a scene-library traceability concept (architecture §14):
  // a "gap" is a mechanical rule that no scene in the library is designed
  // to exercise. It is NOT a "this rule didn't fail in this run" check —
  // a well-covered rule can pass every sample because the system is doing
  // its job. The previous implementation conflated those two concepts and
  // ChatGPT correctly flagged it as the biggest issue in the Phase C&D drop.
  //
  // We can only detect coverage gaps if the caller passes us the set of
  // rule IDs that scenes claim to exercise (via options.ruleIdsExercisedByScenes).
  // If they don't, we report nothing — silence is better than a false claim.
  const coverageGaps: string[] = [];
  if (options.ruleIdsExercisedByScenes) {
    const exercised = options.ruleIdsExercisedByScenes;
    for (const rule of ALL_RULES) {
      if (!exercised.has(rule.id)) {
        coverageGaps.push(`${rule.id}: no scene in the library exercises this rule`);
      }
    }
  }

  return {
    version: run.version,
    harness_version: run.harnessVersion,
    cluster_schema_version: CLUSTER_SCHEMA_VERSION,
    model_version: run.modelVersion,
    run_timestamp: run.runTimestamp,
    scene_count: run.sceneCount,
    samples_per_scene: run.samplesPerScene,
    wall_clock_seconds: run.wallClockSeconds,
    run_class: run.runClass,
    by_rule: Object.freeze(byRule),
    by_cluster: Object.freeze(byCluster),
    by_judge: null,
    metamorphic_stability: null,
    spot_audit: null,
    coverage_gaps: Object.freeze(coverageGaps),
    diff_vs_previous: null,
    holdout_run: null,
    by_aim: null,
    fault_register: null,
    stability_bands: null,
    scene_class_breakdown: null,
  };
}

// ============================================================================
// FILE I/O
// ============================================================================

/**
 * Default output directory for harness runs. Per ChatGPT review (Phase A&B),
 * this lives under frontend/generated/ rather than at repo root, matching
 * the project's generated-artefacts convention.
 */
export const DEFAULT_HARNESS_RUNS_DIR = 'generated/call-2-harness/runs';

/**
 * Build a deterministic filename for an inventory based on its metadata.
 * Format: <version>-<run_class>-<timestamp>.json
 *
 * Timestamp colons and dots are replaced with hyphens to keep the filename
 * cross-platform safe (Windows rejects colons in filenames).
 */
export function inventoryFilename(inventory: FailureModeInventory): string {
  const safeTimestamp = inventory.run_timestamp.replace(/[:.]/g, '-');
  return `${inventory.version}-${inventory.run_class}-${safeTimestamp}.json`;
}

/**
 * Write an inventory to disk as pretty-printed JSON. Creates parent
 * directories if they don't exist.
 */
export async function writeInventoryToDisk(
  inventory: FailureModeInventory,
  filePath: string,
): Promise<void> {
  const parent = dirname(filePath);
  await mkdir(parent, { recursive: true });
  const content = JSON.stringify(
    { schema_version: INVENTORY_SCHEMA_VERSION, ...inventory },
    null,
    2,
  );
  await writeFile(filePath, content, 'utf8');
}

/**
 * Read an inventory back from disk. Throws if the file doesn't exist or
 * the JSON shape is unrecognised.
 */
export async function loadInventory(filePath: string): Promise<FailureModeInventory> {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<FailureModeInventory> & {
    schema_version?: string;
  };

  // Minimal shape validation — Phase E (diff) will do deeper validation.
  if (typeof parsed.version !== 'string') {
    throw new Error(`[loadInventory] missing or invalid 'version' field in ${filePath}`);
  }
  if (typeof parsed.by_rule !== 'object' || parsed.by_rule === null) {
    throw new Error(`[loadInventory] missing or invalid 'by_rule' field in ${filePath}`);
  }
  if (typeof parsed.by_cluster !== 'object' || parsed.by_cluster === null) {
    throw new Error(`[loadInventory] missing or invalid 'by_cluster' field in ${filePath}`);
  }

  // Strip schema_version (added by writeInventoryToDisk) before returning.
  // The runtime FailureModeInventory shape doesn't include it.
  const { schema_version: _schemaVersion, ...inventory } = parsed;
  void _schemaVersion;
  return inventory as FailureModeInventory;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Round to 4 decimal places. Inventory values are presented as percentages
 * downstream, so 4 decimals (0.0001 = 0.01%) is enough resolution.
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ============================================================================
// PHASE E — DIFF ATTACHMENT
// ============================================================================

/**
 * Return a NEW inventory with the diff_vs_previous field populated.
 *
 * The original inventory is not mutated — we return a fresh object so callers
 * can keep both the bare inventory and the diff-attached inventory in scope
 * without worrying about referential aliasing.
 *
 * Why does this take a pre-computed DiffReport rather than calling
 * diffInventories internally? To avoid a runtime circular import:
 * inventory-writer.ts imports types from diff.ts (type-only, erased at
 * compile time) and diff.ts imports types from inventory-writer.ts (also
 * type-only). If inventory-writer imported the diffInventories *function*
 * from diff.ts at runtime, we'd reintroduce the cycle. The runner is
 * therefore expected to call diffInventories(previous, current) first and
 * pass the result here. Two lines instead of one, zero cycles, cleaner
 * separation of concerns.
 *
 * Usage:
 *   const inv = buildInventory(run, options);
 *   const diff = diffInventories(previousInv, inv);   // from ./diff
 *   const final = attachDiff(inv, diff);
 *
 * Existing features preserved: yes — buildInventory itself still returns
 * an inventory with diff_vs_previous: null. Only attachDiff populates it.
 */
export function attachDiff(
  inventory: FailureModeInventory,
  diff: DiffReport,
): FailureModeInventory {
  return Object.freeze({
    ...inventory,
    diff_vs_previous: diff,
  });
}

// ============================================================================
// PHASE 1 — AIM CIRCUIT BOARD ATTACHMENT
// ============================================================================

/**
 * Return a NEW inventory with the aim circuit board data populated.
 * Same pattern as attachDiff — no mutation, no cycles.
 */
export function attachAimCircuitBoard(
  inventory: FailureModeInventory,
  circuitBoard: AimCircuitBoard,
): FailureModeInventory {
  return Object.freeze({
    ...inventory,
    by_aim: circuitBoard,
    fault_register: circuitBoard.fault_register,
  });
}

// ============================================================================
// PHASE 2 — STABILITY BANDS ATTACHMENT
// ============================================================================

/**
 * Return a NEW inventory with stability band data populated.
 */
export function attachStabilityBands(
  inventory: FailureModeInventory,
  stabilityReport: StabilityReport,
): FailureModeInventory {
  return Object.freeze({
    ...inventory,
    stability_bands: stabilityReport,
  });
}

// ============================================================================
// PHASE 2 — SCENE CLASS BREAKDOWN ATTACHMENT
// ============================================================================

/**
 * Return a NEW inventory with scene-class breakdown data populated.
 */
export function attachSceneClassBreakdown(
  inventory: FailureModeInventory,
  breakdown: SceneClassBreakdown,
): FailureModeInventory {
  return Object.freeze({
    ...inventory,
    scene_class_breakdown: breakdown,
  });
}

// ============================================================================
// TIER TEXT CAPTURE — Stage A + D raw tier strings per sample
// ============================================================================
//
// The harness scores tier output but until now discarded the actual text.
// This sidecar captures Stage A (what GPT produced) and Stage D (product
// truth) so engineers can inspect the exact strings that passed or failed.
//
// Written as a separate file alongside the inventory to keep diagnostic
// aggregation (inventory) separate from raw output inspection (tier texts).
//
// Authority: build_plan_efficiency_review_api-2.md §2.2 — "Stage D truth
// is the review standard" — and the operational need to read actual output
// for surgical prompt/code fixes.
// ============================================================================

/**
 * All four captured stage bundles for one sample.
 *
 * A = raw GPT output
 * B = post-processed
 * C = compliance-enforced
 * D = final product truth
 */
export interface TierTextStages {
  readonly a: TierBundle;
  readonly b: TierBundle;
  readonly c: TierBundle;
  readonly d: TierBundle;
}

/**
 * Minimal endpoint metadata useful for debugging without bloating the scorer
 * inventory JSON. Stored in the sidecar only.
 */
export interface TierTextMetadata {
  readonly model_version: string;
  readonly latency_ms: number;
  readonly tokens_used: {
    readonly prompt: number | null;
    readonly completion: number | null;
  };
  readonly stages_applied: readonly string[];
  readonly provider_context_present: boolean;
}

/**
 * One sample's captured tier text plus enough context to debug it.
 */
export interface TierTextEntry {
  readonly scene_id: string;
  readonly sample_index: number;
  readonly input: string;
  readonly expected_elements: readonly string[];
  readonly metadata: TierTextMetadata;
  readonly stages: TierTextStages;
}

/**
 * The full sidecar file shape. One per harness run, written alongside
 * the inventory JSON.
 */
export interface TierTextCapture {
  readonly version: string;
  readonly run_timestamp: string;
  readonly run_class: RunClass;
  readonly scene_count: number;
  readonly samples_per_scene: number;
  readonly sample_count: number;
  readonly samples: readonly TierTextEntry[];
}

/**
 * Build the sidecar filename from an inventory. Same pattern as the
 * inventory filename but with `.tier-texts.json` suffix.
 *
 * Example: v6.2-smoke_alarm-2026-04-13T21-40-10-257Z.tier-texts.json
 */
export function tierTextFilename(inventory: FailureModeInventory): string {
  const safeTimestamp = inventory.run_timestamp.replace(/[:.]/g, '-');
  return `${inventory.version}-${inventory.run_class}-${safeTimestamp}.tier-texts.json`;
}

/**
 * Write captured tier texts to disk as pretty-printed JSON. Creates parent
 * directories if they don't exist.
 */
export async function writeTierTextsToDisk(
  capture: TierTextCapture,
  filePath: string,
): Promise<void> {
  const parent = dirname(filePath);
  await mkdir(parent, { recursive: true });
  const content = JSON.stringify(capture, null, 2);
  await writeFile(filePath, content, 'utf8');
}
