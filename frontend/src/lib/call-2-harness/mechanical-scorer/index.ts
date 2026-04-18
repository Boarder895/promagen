// src/lib/call-2-harness/mechanical-scorer/index.ts
// ============================================================================
// Call 2 Quality Harness — Mechanical Scorer Coordinator
// ============================================================================
// Public entry point for the mechanical scorer. Runs every rule from
// t1-rules, t2-rules, t3-rules, t4-rules, coverage-rules, and quality-rules
// against a single tier bundle and returns a MechanicalResult tagged with
// the route stage ID.
//
// v2.0.0: Added 9 quality rules from quality-rules.ts (Phase 1).
//         ALL_RULES now contains 38 rules (29 structural + 9 quality).
//
// v2.1.0: Added 5 Phase A tiered coverage rules from coverage-rules.ts.
//         ALL_RULES now contains 43 rules (29 structural + 9 quality + 5 tiered coverage).
//         New rules: T3/T4.primary_subject_survival, T3/T4.critical_anchor_survival,
//         T4.secondary_anchor_survival. Wired to Aim 1 sub-aims 1.1, 1.2, 1.3.
//
// Usage from the harness runner:
//
//   import { runMechanicalScorer, ALL_RULES } from '@/lib/call-2-harness/mechanical-scorer';
//
//   const result = runMechanicalScorer(stageABundle, 'a', {
//     input: scene.input,
//     providerContext: scene.providerContext,
//   });
//
//   for (const r of result.results) {
//     if (!r.passed) console.log(`${r.ruleId} (${r.cluster}): ${r.details}`);
//   }
//
// Authority: api-call-2-v2_1_0.md §11, §15 Phase 1
// Existing features preserved: Yes — all 29 existing rules unchanged.
// ============================================================================

import { T1_RULES } from "./t1-rules";
import { T2_RULES } from "./t2-rules";
import { T3_RULES } from "./t3-rules";
import { T4_RULES } from "./t4-rules";
import { COVERAGE_RULES } from "./coverage-rules";
import { QUALITY_RULES } from "./quality-rules";
import {
  ALL_CLUSTERS,
  CLUSTER_SCHEMA_VERSION,
  type Cluster,
  type MechanicalResult,
  type RuleContext,
  type RuleDefinition,
  type RuleResult,
  type StageId,
  type TierBundle,
} from "./types";

// Re-exports so consumers only need to import from this index file.
export type {
  AnchorClass,
  Cluster,
  MechanicalResult,
  ProviderContext,
  RuleContext,
  RuleDefinition,
  RuleResult,
  StageId,
  Tier,
  TierBundle,
} from "./types";
export { ALL_CLUSTERS, CLUSTER_SCHEMA_VERSION } from "./types";
export { T1_RULES } from "./t1-rules";
export { T2_RULES } from "./t2-rules";
export { T3_RULES } from "./t3-rules";
export { T4_RULES } from "./t4-rules";
export { COVERAGE_RULES } from "./coverage-rules";
export { QUALITY_RULES } from "./quality-rules";

/**
 * The full ordered list of mechanical rules across all tiers.
 * Frozen at module load.
 *
 * v2.0.0: 38 rules (29 structural + 9 quality).
 * v2.1.0: 43 rules (+5 Phase A tiered coverage: Aim 1.1, 1.2, 1.3).
 */
export const ALL_RULES: readonly RuleDefinition[] = Object.freeze([
  ...T1_RULES,
  ...T2_RULES,
  ...T3_RULES,
  ...T4_RULES,
  ...COVERAGE_RULES,
  ...QUALITY_RULES,
]);

/**
 * Module-load integrity check: every rule ID must be unique.
 */
const _ruleIdSet = new Set<string>();
for (const rule of ALL_RULES) {
  if (_ruleIdSet.has(rule.id)) {
    throw new Error(`[mechanical-scorer] duplicate rule id: ${rule.id}`);
  }
  _ruleIdSet.add(rule.id);
}

function emptyClusterTally(): Record<Cluster, number> {
  const tally = {} as Record<Cluster, number>;
  for (const c of ALL_CLUSTERS) tally[c] = 0;
  return tally;
}

/**
 * Run every mechanical rule against the given tier bundle and produce a
 * structured result. Pure: same inputs always produce the same output.
 *
 * @param bundle  - The four-tier output to score (Stage A, B, C, or D)
 * @param stageId - Which route stage this bundle came from
 * @param ctx     - Original input + optional provider context
 */
export function runMechanicalScorer(
  bundle: TierBundle,
  stageId: StageId,
  ctx: RuleContext,
): MechanicalResult {
  const results: RuleResult[] = [];
  const failsByCluster = emptyClusterTally();

  let passCount = 0;
  let failCount = 0;

  for (const rule of ALL_RULES) {
    let output: { passed: boolean; details?: string };
    try {
      output = rule.check(bundle, ctx);
    } catch (err) {
      // A rule that throws is itself a finding — record as a fail with the
      // error message in details. Never let one rule crash the whole run.
      output = {
        passed: false,
        details: `RULE_THREW: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const result: RuleResult = {
      ruleId: rule.id,
      tier: rule.tier,
      cluster: rule.cluster,
      passed: output.passed,
      ...(output.details !== undefined ? { details: output.details } : {}),
    };
    results.push(result);

    if (output.passed) {
      passCount += 1;
    } else {
      failCount += 1;
      // noUncheckedIndexedAccess makes Record<Cluster, number> access return
      // number | undefined even though emptyClusterTally() populates every key.
      // Use ?? 0 fallback to satisfy the type checker.
      failsByCluster[rule.cluster] = (failsByCluster[rule.cluster] ?? 0) + 1;
    }
  }

  return {
    stage: stageId,
    results: Object.freeze(results),
    passCount,
    failCount,
    totalRules: ALL_RULES.length,
    failsByCluster: Object.freeze(failsByCluster),
    clusterSchemaVersion: CLUSTER_SCHEMA_VERSION,
  };
}

/**
 * Run the scorer against ALL FOUR route stages of a single sample.
 * Returns four MechanicalResults — one per stage. This is the input shape
 * the rescue-dependency calculator expects.
 */
export function runMechanicalScorerAllStages(
  stages: { a: TierBundle; b: TierBundle; c: TierBundle; d: TierBundle },
  ctx: RuleContext,
): {
  a: MechanicalResult;
  b: MechanicalResult;
  c: MechanicalResult;
  d: MechanicalResult;
} {
  return {
    a: runMechanicalScorer(stages.a, "a", ctx),
    b: runMechanicalScorer(stages.b, "b", ctx),
    c: runMechanicalScorer(stages.c, "c", ctx),
    d: runMechanicalScorer(stages.d, "d", ctx),
  };
}
