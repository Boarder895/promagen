// src/lib/call-2-harness/diff.ts
// ============================================================================
// Call 2 Quality Harness — Version Diffing (Phase E)
// ============================================================================
// Compares two FailureModeInventory instances and produces the
// `diff_vs_previous` block from architecture §14, including the rescue
// dependency delta diagnostic and the cleanup-introducing-failure detector
// from architecture §11.3 pattern 2.
//
// This module is differential by design (architecture principle 9):
//   "The harness is differential. Built to compare versions of Call 2
//    against each other."
//
// Authority:
//   - call-2-quality-architecture-v0.3.1.md §11.3, §14, §16.1, §16.2, §16.3
//   - call-2-harness-build-plan-v1.md §9
//
// Three exports the build plan asks for:
//   - diffInventories(previous, current): DiffReport
//   - pairedRuleAnalysis(previous, current, ruleId): PairedDelta
//   - classifySignificance(delta, runClass): DecisionClass
//
// Plus the warnings array per Martin's confirmation: per-rule notes match
// the architecture example verbatim, AND a top-level warnings array surfaces
// the same diagnostics for the runner to print loudly.
//
// Existing features preserved: Yes (this is a new module).
// ============================================================================

import { ALL_CLUSTERS, type Cluster } from './mechanical-scorer';
import type {
  ClusterInventoryEntry,
  FailureModeInventory,
  RuleInventoryEntry,
} from './inventory-writer';
import type { RunClass } from './run-classes';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * The minimum run class at which a delta of a given magnitude is actionable.
 *
 * From architecture §16.1:
 *   - smoke_alarm  : 5 samples — only catches large failures
 *   - decision_support : 30 samples — catches most fix-or-don't-fix calls
 *   - dispute_resolution : 50 samples — resolves close calls
 *   - below_noise  : no run class can call this delta confidently
 *
 * This is operational discipline, not statistical confidence (§16.6).
 */
export type DecisionClass =
  | 'smoke_alarm'
  | 'decision_support'
  | 'dispute_resolution'
  | 'below_noise';

/**
 * Mechanical fail-rate decision thresholds from §16.1 and §16.2.
 * Mechanical thresholds can be more aggressive than judged because mechanical
 * checks are deterministic given an output (variance comes from sampling only).
 *
 * Phase F will add a parallel JUDGED_DECISION_THRESHOLDS table when the
 * judged scorer ships.
 */
export const MECHANICAL_DECISION_THRESHOLDS = Object.freeze({
  smoke_alarm: 0.30,        // 30 percentage points or more — visible in 5 samples
  decision_support: 0.10,   // 10 pp or more — needs 30 samples to call
  dispute_resolution: 0.05, // 5 pp or more — needs 50 samples to call
} as const);

/**
 * One rule's paired delta between two inventories.
 *
 * Matches the architecture §14 schema for `rules_improved` / `rules_regressed`
 * entries, with one addition: `stage_a_delta` is included so the cleanup-
 * introducing-failure pattern (§11.3 pattern 2) can be detected by readers
 * of the diff without re-fetching both inventories.
 *
 * Sign convention: deltas are CURRENT minus PREVIOUS.
 *   - stage_d_delta < 0  → fail rate dropped (improvement)
 *   - stage_d_delta > 0  → fail rate rose (regression)
 *   - rescue_dependency_delta > 0 → cleanup is now carrying more load
 *   - rescue_dependency_delta < 0 → model is now producing it on its own more
 */
export interface PairedDelta {
  readonly rule: string;
  readonly stage_a_delta: number;
  readonly stage_d_delta: number;
  readonly rescue_dependency_delta: number;
  readonly decision_class: DecisionClass;
  readonly note?: string;
}

/**
 * A top-level warning surfaced by the diff. Each warning has a type so the
 * runner can group/colourise them, plus a human-readable message.
 *
 * Five warning categories detected by Phase E:
 *   - rescue_dependency_rose      — hero diagnostic from §14
 *   - cleanup_introducing_failure — §11.3 pattern 2
 *   - cluster_schema_mismatch     — taxonomy versions differ
 *   - run_class_mismatch          — paired analysis is degraded
 *   - scene_count_mismatch        — sample plan differs
 */
export type DiffWarning =
  | {
      readonly type: 'rescue_dependency_rose';
      readonly ruleId: string;
      readonly message: string;
    }
  | {
      readonly type: 'cleanup_introducing_failure';
      readonly ruleId: string;
      readonly message: string;
    }
  | {
      readonly type: 'cluster_schema_mismatch';
      readonly message: string;
    }
  | {
      readonly type: 'run_class_mismatch';
      readonly message: string;
    }
  | {
      readonly type: 'scene_count_mismatch';
      readonly message: string;
    };

/**
 * The full diff report. Matches the `diff_vs_previous` block in architecture
 * §14 with three additions:
 *   - `current_version` — self-describing standalone diffs
 *   - `rules_unchanged` — count only, keeps the report lean
 *   - `warnings` — top-level warning surface for the runner to print loudly
 *
 * The architecture's example only shows `previous_version`, but the current
 * version is implicit (it's the inventory containing the diff). For
 * standalone DiffReport objects we include both for clarity.
 */
export interface DiffReport {
  readonly previous_version: string;
  readonly current_version: string;
  readonly rules_improved: readonly PairedDelta[];
  readonly rules_regressed: readonly PairedDelta[];
  readonly rules_unchanged: number;
  readonly clusters_improved: readonly Cluster[];
  readonly clusters_regressed: readonly Cluster[];
  readonly warnings: readonly DiffWarning[];
}

// ============================================================================
// SIGNIFICANCE CLASSIFIER
// ============================================================================

/**
 * The finest decision tier each run class can credibly call. A run class can
 * never return a tier finer than its floor — that would be claiming more
 * confidence than the sample size supports.
 *
 * Architecture §16.1 sample sizes:
 *   smoke_alarm        : 5  samples → only large failures (≥30pp) are credible
 *   mutation           : 5  samples → same floor as smoke_alarm
 *   decision_support   : 30 samples → ≥10pp deltas are credible
 *   milestone          : 30 samples → same floor as decision_support
 *   dispute_resolution : 50 samples → ≥5pp deltas are credible
 *
 * This is operational discipline, not statistical confidence (§16.6).
 */
const CALLABLE_FLOOR: Readonly<Record<RunClass, Exclude<DecisionClass, 'below_noise'>>> =
  Object.freeze({
    smoke_alarm: 'smoke_alarm',
    mutation: 'smoke_alarm',
    decision_support: 'decision_support',
    milestone: 'decision_support',
    dispute_resolution: 'dispute_resolution',
  });

/**
 * Tier rank, coarsest first. Used by classifySignificance to compare an
 * "ideal" classification against the run class's callable floor. A higher
 * rank means a finer (more confident) tier.
 *
 *   0 = smoke_alarm        (coarsest — only catches ≥30pp deltas)
 *   1 = decision_support
 *   2 = dispute_resolution (finest — catches ≥5pp deltas)
 */
const TIER_RANK: Readonly<Record<Exclude<DecisionClass, 'below_noise'>, number>> =
  Object.freeze({
    smoke_alarm: 0,
    decision_support: 1,
    dispute_resolution: 2,
  });

/**
 * Classify a fail-rate delta against operational decision thresholds, capped
 * by the credible-claim floor of the actual run class.
 *
 * Returns the LOWEST run class at which a delta of this magnitude would be
 * actionable, BUT capped so a run class can never return a finer tier than
 * its sample size supports. A 0.15 delta on a 5-sample smoke_alarm run is
 * NOT decision_support — it is below_noise, because a 5-sample run cannot
 * credibly resolve a 15pp delta no matter how confident the magnitude looks.
 *
 * Note: this function operates on the absolute value of the delta. The
 * direction (improvement vs regression) is decided by the caller from the
 * sign of the original delta.
 *
 * Architecture §16.6 honest framing: "It can give you a defensible vocabulary
 * for reporting changes; prevent you from chasing noise; prevent you from
 * acting on smoke-alarm runs as if they were decision-support runs. It cannot
 * replace actual statistical analysis." This implementation enforces that
 * second clause literally — finer claims than the run class supports collapse
 * to below_noise rather than overstating confidence.
 *
 * Phase E follow-up (ChatGPT): the previous version of this function ignored
 * its runClass argument entirely. The signature suggested run-aware behaviour
 * the implementation didn't deliver. The fix is principled, not cosmetic:
 * paired and cluster diff sites both pass the actual run class, and both
 * benefit from the cap.
 */
export function classifySignificance(
  delta: number,
  runClass: RunClass,
): DecisionClass {
  const magnitude = Math.abs(delta);

  // Step 1: ideal classification — the lowest tier this magnitude would clear
  // if the run were arbitrarily large.
  let ideal: Exclude<DecisionClass, 'below_noise'>;
  if (magnitude >= MECHANICAL_DECISION_THRESHOLDS.smoke_alarm) {
    ideal = 'smoke_alarm';
  } else if (magnitude >= MECHANICAL_DECISION_THRESHOLDS.decision_support) {
    ideal = 'decision_support';
  } else if (magnitude >= MECHANICAL_DECISION_THRESHOLDS.dispute_resolution) {
    ideal = 'dispute_resolution';
  } else {
    return 'below_noise';
  }

  // Step 2: cap to what the actual run class can credibly call.
  // noUncheckedIndexedAccess: both lookups go through the frozen Records
  // above which exhaustively cover RunClass and the non-noise DecisionClass
  // values, so the ?? fallbacks are unreachable but satisfy strict mode.
  const floor = CALLABLE_FLOOR[runClass] ?? 'smoke_alarm';
  const idealRank = TIER_RANK[ideal] ?? 0;
  const floorRank = TIER_RANK[floor] ?? 0;

  if (idealRank > floorRank) {
    // The magnitude would justify a finer tier than this run class can call.
    // Collapse to below_noise rather than overstate confidence.
    return 'below_noise';
  }
  return ideal;
}

// ============================================================================
// PAIRED RULE ANALYSIS
// ============================================================================

/**
 * Compare a single rule across two inventories.
 *
 * Architecture §16.3: paired analysis is the preferred mode for version
 * comparisons because most variance comes from scene-to-scene difficulty,
 * which is held constant in a paired comparison.
 *
 * Returns null if the rule is missing from either inventory (would happen
 * if Phase C's ALL_RULES grew between Call 2 versions). Callers should
 * handle the null case explicitly — silently filtering would hide drift.
 */
export function pairedRuleAnalysis(
  previous: FailureModeInventory,
  current: FailureModeInventory,
  ruleId: string,
): PairedDelta | null {
  const prev = previous.by_rule[ruleId];
  const curr = current.by_rule[ruleId];
  if (!prev || !curr) return null;

  const stage_a_delta = round4(curr.stage_a_fail_rate - prev.stage_a_fail_rate);
  const stage_d_delta = round4(curr.stage_d_fail_rate - prev.stage_d_fail_rate);
  const rescue_dependency_delta = round4(
    curr.rescue_dependency - prev.rescue_dependency,
  );

  // Use the LESS sensitive of the two run classes to set the action floor.
  // (Architecture §16.3: paired analysis assumes same-plan; mismatched plans
  // get a top-level warning AND a more conservative classification.)
  const runClassForClassification = lessSensitiveRunClass(
    previous.run_class,
    current.run_class,
  );
  const decision_class = classifySignificance(stage_d_delta, runClassForClassification);

  // Build the optional note. Per architecture §14, the note is the place to
  // surface the rescue-dependency-rose-with-D-improvement diagnostic.
  const note = buildRuleNote(prev, curr, stage_a_delta, stage_d_delta, rescue_dependency_delta);

  return {
    rule: ruleId,
    stage_a_delta,
    stage_d_delta,
    rescue_dependency_delta,
    decision_class,
    ...(note !== undefined ? { note } : {}),
  };
}

/**
 * Build the optional note string for a rule delta. Returns undefined when
 * there's nothing notable to flag.
 *
 * Two notable patterns from architecture §11.3 + §14:
 *   1. Stage D improved but rescue dependency rose (the hero case from §14)
 *   2. Stage A improved but Stage D got worse (§11.3 pattern 2 — cleanup
 *      introducing the failure)
 */
function buildRuleNote(
  _prev: RuleInventoryEntry,
  _curr: RuleInventoryEntry,
  stage_a_delta: number,
  stage_d_delta: number,
  rescue_dependency_delta: number,
): string | undefined {
  // Pattern 1: Stage D improved (delta < 0) but rescue dependency rose (delta > 0)
  // Threshold: only flag rescue dependency moves of ≥5 percentage points to
  // avoid spamming below-noise rescue jitter.
  if (stage_d_delta < 0 && rescue_dependency_delta >= 0.05) {
    return 'Stage D pass rate improved but rescue dependency rose — cleanup is now doing more work';
  }

  // Pattern 2: Stage A improved (delta < 0) but Stage D got worse (delta > 0)
  // Cleanup is INTRODUCING failures the model gets right.
  if (stage_a_delta < 0 && stage_d_delta > 0) {
    return 'Stage A improved but Stage D regressed — cleanup layer is introducing failures';
  }

  return undefined;
}

// ============================================================================
// FULL DIFF
// ============================================================================

/**
 * Compare two complete inventories and produce a DiffReport.
 *
 * Default mode is paired-by-rule-id analysis (architecture §16.3). The
 * function makes no assumption about which inventory is "older" — `previous`
 * is the baseline and `current` is what's being evaluated. Callers
 * comparing v4.5 and v4.6 should pass v4.5 as previous and v4.6 as current.
 */
export function diffInventories(
  previous: FailureModeInventory,
  current: FailureModeInventory,
): DiffReport {
  const warnings: DiffWarning[] = [];

  // ── Top-level integrity warnings ────────────────────────────────────────

  if (previous.cluster_schema_version !== current.cluster_schema_version) {
    warnings.push({
      type: 'cluster_schema_mismatch',
      message: `Previous inventory uses cluster schema ${previous.cluster_schema_version}; current uses ${current.cluster_schema_version}. Cluster rollup comparisons may be misleading.`,
    });
  }

  if (previous.run_class !== current.run_class) {
    warnings.push({
      type: 'run_class_mismatch',
      message: `Previous run class is ${previous.run_class} (${previous.samples_per_scene} samples/scene); current is ${current.run_class} (${current.samples_per_scene} samples/scene). Paired analysis (§16.3) prefers same-plan comparisons.`,
    });
  }

  if (previous.scene_count !== current.scene_count) {
    warnings.push({
      type: 'scene_count_mismatch',
      message: `Previous inventory had ${previous.scene_count} scenes; current has ${current.scene_count}. Per-rule deltas reflect both system change AND library drift.`,
    });
  }

  // ── Per-rule paired analysis ────────────────────────────────────────────

  const rulesImproved: PairedDelta[] = [];
  const rulesRegressed: PairedDelta[] = [];
  let rulesUnchanged = 0;

  // Iterate the union of rule IDs from both inventories so new/removed rules
  // are not silently dropped.
  const allRuleIds = new Set<string>([
    ...Object.keys(previous.by_rule),
    ...Object.keys(current.by_rule),
  ]);

  for (const ruleId of allRuleIds) {
    const delta = pairedRuleAnalysis(previous, current, ruleId);
    if (!delta) {
      // Rule present in only one inventory — skip from improved/regressed.
      // The cluster schema mismatch warning above will already have fired
      // if the taxonomy itself changed; rule-set drift inside the same
      // schema version is rare and not worth a separate warning here.
      continue;
    }

    // Surface per-rule notes as top-level warnings too, so the runner can
    // print them at the head of the report regardless of which bucket the
    // rule lands in (improved/regressed/unchanged).
    if (delta.note?.includes('rescue dependency rose')) {
      warnings.push({
        type: 'rescue_dependency_rose',
        ruleId,
        message: `${ruleId}: ${delta.note} (Stage D delta ${formatDelta(delta.stage_d_delta)}, rescue dependency delta ${formatDelta(delta.rescue_dependency_delta)})`,
      });
    } else if (delta.note?.includes('cleanup layer is introducing')) {
      warnings.push({
        type: 'cleanup_introducing_failure',
        ruleId,
        message: `${ruleId}: ${delta.note} (Stage A delta ${formatDelta(delta.stage_a_delta)}, Stage D delta ${formatDelta(delta.stage_d_delta)})`,
      });
    }

    // Bucket assignment based on Stage D direction and significance.
    // A rule with decision_class === 'below_noise' is unchanged regardless
    // of sign — that's the whole point of the noise floor.
    if (delta.decision_class === 'below_noise') {
      rulesUnchanged += 1;
    } else if (delta.stage_d_delta < 0) {
      rulesImproved.push(delta);
    } else if (delta.stage_d_delta > 0) {
      rulesRegressed.push(delta);
    } else {
      rulesUnchanged += 1;
    }
  }

  // ── Per-cluster diff ────────────────────────────────────────────────────

  const clustersImproved: Cluster[] = [];
  const clustersRegressed: Cluster[] = [];

  for (const c of ALL_CLUSTERS) {
    const prev = previous.by_cluster[c];
    const curr = current.by_cluster[c];
    if (!prev || !curr) continue;

    const clusterDelta = curr.fail_rate - prev.fail_rate;
    const clusterClass = classifySignificance(clusterDelta, current.run_class);
    if (clusterClass === 'below_noise') continue;

    if (clusterDelta < 0) {
      clustersImproved.push(c);
    } else if (clusterDelta > 0) {
      clustersRegressed.push(c);
    }
  }

  // Sort improved/regressed rule lists by absolute Stage D delta descending
  // so the most significant changes appear first.
  rulesImproved.sort((a, b) => Math.abs(b.stage_d_delta) - Math.abs(a.stage_d_delta));
  rulesRegressed.sort((a, b) => Math.abs(b.stage_d_delta) - Math.abs(a.stage_d_delta));

  return {
    previous_version: previous.version,
    current_version: current.version,
    rules_improved: Object.freeze(rulesImproved),
    rules_regressed: Object.freeze(rulesRegressed),
    rules_unchanged: rulesUnchanged,
    clusters_improved: Object.freeze(clustersImproved),
    clusters_regressed: Object.freeze(clustersRegressed),
    warnings: Object.freeze(warnings),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Run-class sensitivity ordering — used to pick the LESS sensitive run class
 * when comparing two inventories with different run classes.
 *
 * Sensitivity (lowest first):
 *   smoke_alarm < mutation < decision_support < dispute_resolution < milestone
 *
 * `mutation` is conceptually a 5-sample run too (architecture §15.2), so
 * it sits next to smoke_alarm. `milestone` is the most rigorous because it
 * adds holdout + spot audit on top of decision_support's 30 samples.
 */
const RUN_CLASS_RANK: Readonly<Record<RunClass, number>> = Object.freeze({
  smoke_alarm: 0,
  mutation: 0,
  decision_support: 1,
  dispute_resolution: 2,
  milestone: 3,
});

function lessSensitiveRunClass(a: RunClass, b: RunClass): RunClass {
  // noUncheckedIndexedAccess: Record lookups return T | undefined even though
  // the RunClass union guarantees every key exists. Use ?? 99 fallback so an
  // unknown future RunClass would sort as "most sensitive" rather than crash.
  const rankA = RUN_CLASS_RANK[a] ?? 99;
  const rankB = RUN_CLASS_RANK[b] ?? 99;
  return rankA <= rankB ? a : b;
}

/**
 * Format a numeric delta with explicit sign for human-readable warnings.
 */
function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(4)}`;
}

/**
 * Round to 4 decimal places — matches inventory-writer's resolution so
 * deltas don't carry false precision past the source data.
 */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// Re-export for consumer convenience.
export type { ClusterInventoryEntry, RuleInventoryEntry };
