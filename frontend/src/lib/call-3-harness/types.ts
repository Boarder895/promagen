// src/lib/call-3-harness/types.ts
// ============================================================================
// PHASE 10 — Call 3 Harness Types
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §10
// Build plan:   call-3-quality-build-plan-v1.md §14
//
// Mirrors the Call 2 harness pattern (src/lib/call-2-harness/mechanical-scorer/types.ts)
// but adapted for Call 3's pipeline stages and failure modes.
// ============================================================================

import type { TransformId } from '@/data/platform-dna/types';

// ============================================================================
// PIPELINE STAGES — Architecture §10
// ============================================================================

/**
 * Call 3 pipeline stages for route-stage attribution.
 *
 * Architecture §10:
 *   P = Preflight decision (which path?)
 *   D = Deterministic transforms (DNA catalogue)
 *   G = GPT output (first attempt)
 *   R = Retry output (if APS said RETRY)
 *   C = Compliance gate (group + generic)
 *   Q = Quality gate (APS + regression guard)
 *   F = Final output (what the user sees)
 */
export type Call3Stage = 'P' | 'D' | 'G' | 'R' | 'C' | 'Q' | 'F';

export const ALL_CALL3_STAGES: readonly Call3Stage[] = Object.freeze([
  'P', 'D', 'G', 'R', 'C', 'Q', 'F',
]);

// ============================================================================
// FAILURE MODE CLUSTERS — Call 3 specific
// ============================================================================

/**
 * Call 3 failure-mode clusters.
 * These are distinct from Call 2's clusters because Call 3 has different
 * concerns: anchor preservation, transform accuracy, retry effectiveness.
 */
export type Call3Cluster =
  | 'anchor_loss'           // Critical/important anchors dropped
  | 'invented_content'      // Visual elements added that weren't in input
  | 'quality_degradation'   // Output scores lower than input
  | 'transform_regression'  // A specific transform made things worse
  | 'syntax_violation'      // Platform syntax rules broken
  | 'ceiling_breach'        // Output exceeds character ceiling
  | 'negative_contradiction'// Negative prompt contradicts positive
  | 'retry_waste';          // Retry fired but never recovers (cost with no gain)

export const ALL_CALL3_CLUSTERS: readonly Call3Cluster[] = Object.freeze([
  'anchor_loss',
  'invented_content',
  'quality_degradation',
  'transform_regression',
  'syntax_violation',
  'ceiling_breach',
  'negative_contradiction',
  'retry_waste',
]);

// ============================================================================
// RULE DEFINITIONS
// ============================================================================

/** Output of a single rule check. */
export interface Call3RuleOutput {
  readonly passed: boolean;
  readonly details?: string;
}

/** Context passed to each rule check function. */
export interface Call3RuleContext {
  /** The original assembled prompt (input to Call 3) */
  readonly assembledPrompt: string;
  /** The final optimised prompt (output of Call 3) */
  readonly optimisedPrompt: string;
  /** The negative prompt (if generated) */
  readonly negative: string | null;
  /** Platform ID */
  readonly platformId: string;
  /** Platform tier */
  readonly tier: number;
  /** Character ceiling from DNA */
  readonly charCeiling: number;
  /** Which transforms were applied */
  readonly transformsApplied: readonly TransformId[];
  /** Which path was taken (deterministic or GPT) */
  readonly path: 'deterministic' | 'gpt' | 'pass_through';
  /** Whether retry was attempted */
  readonly retryAttempted: boolean;
  /** Whether retry was accepted */
  readonly retryAccepted: boolean;
}

/** A rule definition for the Call 3 mechanical scorer. */
export interface Call3RuleDefinition {
  readonly id: string;
  readonly cluster: Call3Cluster;
  readonly description: string;
  readonly severity: 'critical' | 'important' | 'informational';
  check(ctx: Call3RuleContext): Call3RuleOutput;
}

/** Per-rule result tagged with cluster. */
export interface Call3RuleResult {
  readonly ruleId: string;
  readonly cluster: Call3Cluster;
  readonly severity: 'critical' | 'important' | 'informational';
  readonly passed: boolean;
  readonly details?: string;
}

/** Output of one full mechanical-scorer run. */
export interface Call3MechanicalResult {
  readonly platformId: string;
  readonly path: 'deterministic' | 'gpt' | 'pass_through';
  readonly results: readonly Call3RuleResult[];
  readonly passCount: number;
  readonly failCount: number;
  readonly criticalFailCount: number;
  readonly totalRules: number;
  readonly failsByCluster: Readonly<Record<Call3Cluster, number>>;
}

// ============================================================================
// INVENTORY — Per-stage artefact capture
// ============================================================================

/** A single pipeline stage artefact. */
export interface Call3StageArtefact {
  readonly stage: Call3Stage;
  readonly text: string;
  readonly charCount: number;
  readonly timestamp: string;
  readonly changes: readonly string[];
}

/** Full inventory for one Call 3 run. */
export interface Call3Inventory {
  readonly platformId: string;
  readonly sceneId: string;
  readonly runId: string;
  readonly timestamp: string;
  readonly path: 'deterministic' | 'gpt' | 'pass_through';
  readonly stages: readonly Call3StageArtefact[];
  readonly mechanicalResult: Call3MechanicalResult;
  readonly retryAttempted: boolean;
  readonly retryAccepted: boolean;
}
