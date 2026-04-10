// src/lib/call-2-harness/run-classes.ts
// ============================================================================
// Call 2 Quality Harness — Run Classes (Phase D)
// ============================================================================
// The five run classes from architecture §16.1. Each class represents a
// different speed/cost/confidence tradeoff for harness invocations:
//
//   smoke_alarm        — 5 samples,  catches large failures only (triage)
//   decision_support   — 30 samples, sufficient for most fix-or-don't-fix calls
//   dispute_resolution — 50 samples, resolves close calls between adjacent versions
//   milestone          — 30 samples, full milestone evaluation (holdout + spot audit)
//   mutation           — 5 samples,  rule-deletion sweeps (Phase I)
//
// "A 5-sample run is a smoke alarm, not a measurement. It tells you something
//  is on fire. It does not tell you how big the fire is or whether yesterday's
//  was smaller. Use it for triage, not inference." — architecture §16.1
//
// Authority: call-2-quality-architecture-v0.3.1.md §16.1
// Existing features preserved: Yes (this is a new module).
// ============================================================================

export type RunClass =
  | 'smoke_alarm'
  | 'decision_support'
  | 'dispute_resolution'
  | 'milestone'
  | 'mutation';

export const ALL_RUN_CLASSES: readonly RunClass[] = Object.freeze([
  'smoke_alarm',
  'decision_support',
  'dispute_resolution',
  'milestone',
  'mutation',
]);

export interface RunClassConfig {
  /**
   * Samples per scene. The mechanical scorer runs against all 4 stages of
   * each sample, so the actual stage-evaluation count is samplesPerScene × 4.
   */
  readonly samplesPerScene: number;
  /**
   * Whether to run metamorphic perturbations alongside the main run.
   * Phase H — currently false for all classes until metamorphic ships.
   */
  readonly metamorphic: boolean;
  /**
   * Whether to include holdout-flagged scenes. Day-to-day runs SKIP holdout
   * by default per architecture §12. Only milestone runs include holdout.
   */
  readonly holdout: boolean;
  /**
   * Whether to collect human spot-audit pairs (architecture §9.4).
   * Only milestone runs trigger the spot audit.
   */
  readonly spotAudit: boolean;
  /**
   * Brief description shown in run logs and inventory metadata.
   */
  readonly description: string;
}

/**
 * The canonical run-class configuration table from architecture §16.1.
 *
 * Note: mutation runs use a SHALLOW sample count per mutation (5) because
 * the breadth comes from running many mutations, not many samples per
 * mutation. See architecture §8 for mutation testing details.
 */
export const RUN_CLASS_CONFIG: Readonly<Record<RunClass, RunClassConfig>> = Object.freeze({
  smoke_alarm: {
    samplesPerScene: 5,
    metamorphic: false,
    holdout: false,
    spotAudit: false,
    description: 'Triage. Catches large failures and obvious regressions only.',
  },
  decision_support: {
    samplesPerScene: 30,
    metamorphic: true,
    holdout: false,
    spotAudit: false,
    description: 'Sufficient evidence for most fix-or-don\'t-fix calls.',
  },
  dispute_resolution: {
    samplesPerScene: 50,
    metamorphic: true,
    holdout: false,
    spotAudit: false,
    description: 'Resolves close calls between adjacent Call 2 versions.',
  },
  milestone: {
    samplesPerScene: 30,
    metamorphic: true,
    holdout: true,
    spotAudit: true,
    description: 'Full milestone evaluation with holdout set and human spot audit.',
  },
  mutation: {
    samplesPerScene: 5,
    metamorphic: false,
    holdout: false,
    spotAudit: false,
    description: 'Rule-deletion sweep — depth in coverage breadth, not sample count.',
  },
});

/**
 * Look up a run class config. Throws on unknown class — runtime safety net
 * in case raw user input ever reaches this function.
 */
export function getRunClassConfig(runClass: RunClass): RunClassConfig {
  const cfg = RUN_CLASS_CONFIG[runClass];
  if (!cfg) {
    throw new Error(`[run-classes] unknown run class: ${runClass}`);
  }
  return cfg;
}
