// src/lib/call-2-harness/rescue-dependency.ts
// ============================================================================
// Call 2 Quality Harness — Rescue Dependency Index (Phase D)
// ============================================================================
// The single most important metric the v0.3 harness adds over v0.2.
//
// "A rule with 98% Stage D pass rate but 85% Stage A fail rate is not the
//  same as a rule with 98% Stage D pass rate and 5% Stage A fail rate. The
//  first is one cleanup change away from a large latent failure pool. The
//  second is genuinely healthy."  — architecture §11.2
//
// Formula:
//
//   rescue_dependency = (samples where Stage A failed AND Stage D passed)
//                     / (samples where Stage D passed)
//
// A rescue dependency of 0.0 means the model produced the correct answer on
// its own. A rescue dependency near 1.0 means cleanup is doing all the work
// and the rule is structurally fragile.
//
// Authority: call-2-quality-architecture-v0.3.1.md §11.2, §14
// Existing features preserved: Yes (this is a new module).
// ============================================================================

import type { MechanicalResult, StageId } from './mechanical-scorer';

/**
 * One sample's mechanical-scorer results across all four route stages.
 * Produced by runMechanicalScorerAllStages() from Phase C.
 */
export interface SampleStageResults {
  readonly sceneId: string;
  readonly sampleIndex: number;
  readonly stages: Readonly<Record<StageId, MechanicalResult>>;
}

/**
 * Look up whether a specific rule passed at a specific stage in one sample.
 * Returns null if the rule wasn't found in that stage's results (which would
 * be a data integrity issue — the scorer always runs every rule).
 */
export function findRuleResult(
  sample: SampleStageResults,
  stageId: StageId,
  ruleId: string,
): boolean | null {
  const stageResult = sample.stages[stageId];
  const result = stageResult.results.find((r) => r.ruleId === ruleId);
  return result ? result.passed : null;
}

/**
 * Calculate the rescue dependency index for one rule across N samples.
 *
 * Formula (architecture §11.2):
 *   rescue_dependency = |{ s : A_fail(s) ∧ D_pass(s) }|
 *                     / |{ s : D_pass(s) }|
 *
 * Edge cases:
 *   - If no samples pass at Stage D, returns 0 (the rule never passed at all,
 *     so there's nothing to rescue).
 *   - Samples where the rule isn't found in either stage are skipped.
 *
 * @param samples - Array of per-sample stage results
 * @param ruleId  - The rule ID to compute rescue dependency for
 * @returns A number in [0, 1]
 */
export function calculateRescueDependency(
  samples: readonly SampleStageResults[],
  ruleId: string,
): number {
  let stageDPasses = 0;
  let stageARescues = 0;

  for (const sample of samples) {
    const aPassed = findRuleResult(sample, 'a', ruleId);
    const dPassed = findRuleResult(sample, 'd', ruleId);

    // Skip samples where the rule wasn't found in either stage
    if (aPassed === null || dPassed === null) continue;

    if (dPassed) {
      stageDPasses += 1;
      if (!aPassed) {
        // Stage A failed but Stage D passed — that's a rescue
        stageARescues += 1;
      }
    }
  }

  if (stageDPasses === 0) return 0;
  return stageARescues / stageDPasses;
}

/**
 * Calculate the per-stage fail rate for one rule across N samples.
 *
 * @returns A number in [0, 1] — fraction of samples where the rule failed at this stage
 */
export function calculateFailRate(
  samples: readonly SampleStageResults[],
  ruleId: string,
  stageId: StageId,
): number {
  let total = 0;
  let failed = 0;

  for (const sample of samples) {
    const passed = findRuleResult(sample, stageId, ruleId);
    if (passed === null) continue;
    total += 1;
    if (!passed) failed += 1;
  }

  if (total === 0) return 0;
  return failed / total;
}

/**
 * Per-rule health classification from architecture §14 (extended slightly to
 * cover the four-quadrant decision space cleanly).
 *
 * - HEALTHY      — Stage D fail rate ≤ 5% AND rescue_dependency < 0.30.
 *                  The model produces the correct output on its own.
 * - FRAGILE      — Stage D fail rate ≤ 5% AND rescue_dependency ≥ 0.30.
 *                  Cleanup is rescuing the model. One cleanup change away
 *                  from a latent failure pool.
 * - BORDERLINE   — Stage D fail rate in (5%, 10%]. Mid-band; needs more
 *                  samples or a decision-support run before action.
 * - CHRONIC      — Stage D fail rate > 10% AND rescue_dependency ≥ 0.30.
 *                  Cleanup catches some but the model is still wrong often.
 * - REAL_FAILURE — Stage D fail rate > 10% AND rescue_dependency < 0.30.
 *                  Nothing rescues this. Fix at the model level.
 */
export type RuleHealth =
  | 'HEALTHY'
  | 'FRAGILE'
  | 'BORDERLINE'
  | 'CHRONIC'
  | 'REAL_FAILURE';

const HEALTHY_DFAIL_MAX = 0.05;
const BORDERLINE_DFAIL_MAX = 0.10;
const RESCUE_HIGH_THRESHOLD = 0.30;

export function classifyRuleHealth(
  stageDFailRate: number,
  rescueDependency: number,
): RuleHealth {
  if (stageDFailRate <= HEALTHY_DFAIL_MAX) {
    return rescueDependency >= RESCUE_HIGH_THRESHOLD ? 'FRAGILE' : 'HEALTHY';
  }
  if (stageDFailRate <= BORDERLINE_DFAIL_MAX) {
    return 'BORDERLINE';
  }
  return rescueDependency >= RESCUE_HIGH_THRESHOLD ? 'CHRONIC' : 'REAL_FAILURE';
}

/**
 * Human-readable interpretation string for inventory output, keyed off the
 * rule's health classification. Used in the inventory's `interpretation`
 * field per architecture §14.
 */
export function interpretRuleHealth(
  health: RuleHealth,
  rescueDependency: number,
  stageDFailRate: number,
): string {
  const rdPct = Math.round(rescueDependency * 100);
  const dPct = Math.round(stageDFailRate * 100);
  switch (health) {
    case 'HEALTHY':
      return 'Model produces this rule correctly on its own.';
    case 'FRAGILE':
      return `Cleanup layer rescues ${rdPct}% of model failures. One cleanup change away from a latent failure pool.`;
    case 'BORDERLINE':
      return `Stage D fails ${dPct}% of the time. Run a decision-support pass before acting.`;
    case 'CHRONIC':
      return `Cleanup catches ${rdPct}% of model failures but Stage D still fails ${dPct}% of the time. Cleanup is doing maximum work; fix at the model level.`;
    case 'REAL_FAILURE':
      return `No layer fixes this — Stage D fails ${dPct}%, rescue dependency only ${rdPct}%. Fix at the model level.`;
  }
}
