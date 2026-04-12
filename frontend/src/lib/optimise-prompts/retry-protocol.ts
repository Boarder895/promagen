// src/lib/optimise-prompts/retry-protocol.ts
// ============================================================================
// PHASE 8 — Iterative Retry Protocol
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §8
// Build plan:   call-3-quality-build-plan-v1.md §12
//
// When APS says RETRY (score 0.70–0.84, no vetoes), GPT gets a second
// chance with tighter constraints and an explicit list of the anchors
// it dropped on the first attempt.
//
// Platform-gated: only fires on platforms where DNA.retryEnabled is true.
// Currently: recraft, openai, flux, kling.
//
// Architecture §8 flow:
//   Attempt 1 → APS → RETRY band
//     ↓
//   Attempt 2: tighter prompt + explicit anchor list + lower temperature
//   "Your first attempt lost these anchors: [list]. Rewrite preserving ALL."
//     ↓
//   APS ≥ 0.88 + vetoes pass → ACCEPT
//   Anything else → REJECT, fallback to assembled prompt
//
// Cost discipline (§8.4): retry doubles API cost for ~15–25% of calls.
// On platforms where retry recovery rate < 30%, retry should be disabled.
// ============================================================================

import type { APSResult, AnchorSurvival } from './aps-gate';
import type { PlatformDNA } from '@/data/platform-dna/types';

// ============================================================================
// TYPES
// ============================================================================

/** Result of the retry decision. */
export interface RetryDecision {
  /** Whether a retry should be attempted */
  readonly shouldRetry: boolean;
  /** Reason for the decision */
  readonly reason: string;
}

/** The retry user message and configuration to send to GPT. */
export interface RetryConfig {
  /** The tighter user message with explicit anchor list */
  readonly retryUserMessage: string;
  /** Lower temperature for retry attempt (architecture §8.1) */
  readonly retryTemperature: number;
  /** Minimum APS score for retry acceptance (stricter than first attempt) */
  readonly retryAcceptThreshold: number;
}

/** Result of a retry attempt (after the second GPT call). */
export interface RetryResult {
  /** Whether the retry was attempted */
  readonly attempted: boolean;
  /** Whether the retry produced an acceptable result */
  readonly accepted: boolean;
  /** The retry APS score (null if not attempted) */
  readonly retryApsScore: number | null;
  /** Human-readable summary */
  readonly summary: string;
}

// ============================================================================
// RETRY THRESHOLDS — Architecture §8.1
// ============================================================================

/**
 * Minimum APS score for retry acceptance.
 * Stricter than first-attempt threshold to justify the API cost.
 */
const RETRY_ACCEPT_THRESHOLD = 0.88;

/**
 * Temperature reduction for retry attempt.
 * Lower temperature = tighter adherence to instructions.
 */
const RETRY_TEMPERATURE_REDUCTION = 0.1;

/**
 * Minimum retry temperature floor.
 * Don't go below this even after reduction.
 */
const RETRY_TEMPERATURE_FLOOR = 0.1;

// ============================================================================
// RETRY DECISION
// ============================================================================

/**
 * Decide whether a retry should be attempted.
 *
 * Conditions for retry (all must be true):
 *   1. APS verdict is RETRY (not REJECT — REJECT is too far gone)
 *   2. Platform has retryEnabled: true in DNA
 *   3. No vetoes fired (vetoes indicate structural problems, not fixable by retry)
 *   4. There are dropped anchors to recover (otherwise retry has no target)
 *
 * @param apsResult  The APS result from the first GPT attempt
 * @param dna        The platform's DNA profile (null = no DNA)
 */
export function shouldRetry(
  apsResult: APSResult,
  dna: PlatformDNA | null,
): RetryDecision {
  // Must be in the RETRY band
  if (apsResult.verdict !== 'RETRY') {
    return {
      shouldRetry: false,
      reason: `APS verdict is ${apsResult.verdict}, not RETRY`,
    };
  }

  // Platform must have retry enabled
  if (!dna?.retryEnabled) {
    return {
      shouldRetry: false,
      reason: `Platform ${dna?.id ?? 'unknown'} does not have retry enabled`,
    };
  }

  // No vetoes — vetoes indicate structural problems
  if (apsResult.anyVetoFired) {
    return {
      shouldRetry: false,
      reason: 'Veto fired — structural problem not recoverable by retry',
    };
  }

  // Must have dropped anchors to recover
  if (apsResult.droppedAnchors.length === 0) {
    return {
      shouldRetry: false,
      reason: 'No dropped anchors to recover',
    };
  }

  return {
    shouldRetry: true,
    reason: `RETRY band (APS ${apsResult.score.toFixed(2)}), ${apsResult.droppedAnchors.length} anchor(s) to recover`,
  };
}

// ============================================================================
// RETRY MESSAGE BUILDER
// ============================================================================

/**
 * Build the retry configuration: tighter user message + lower temperature.
 *
 * Architecture §8.1:
 *   "Your first attempt lost these anchors: [list]. Rewrite preserving ALL.
 *    Do NOT add any visual elements not in the input.
 *    Do NOT use composition scaffolding."
 *
 * @param originalUserMessage  The user message from the first attempt
 * @param firstAttemptOutput   The GPT output from the first attempt
 * @param droppedAnchors       The anchors that were lost
 * @param originalTemperature  The temperature from the first attempt
 * @param dna                  The platform's DNA profile
 */
export function buildRetryConfig(
  originalUserMessage: string,
  firstAttemptOutput: string,
  droppedAnchors: readonly AnchorSurvival[],
  originalTemperature: number,
  dna: PlatformDNA,
): RetryConfig {
  // ── Build explicit anchor recovery list ────────────────────────────
  const anchorList = droppedAnchors
    .map((a) => `  - "${a.anchor}" (${a.severity}, ${a.category})`)
    .join('\n');

  // ── Build retry user message ───────────────────────────────────────
  const retryUserMessage = `RETRY — ANCHOR RECOVERY REQUIRED

Your first attempt scored below the acceptance threshold. These anchors were lost:
${anchorList}

RULES FOR THIS RETRY:
1. Every anchor listed above MUST appear in your output. This is non-negotiable.
2. Do NOT add any visual elements, subjects, or scene details not in the original input.
3. Do NOT use composition scaffolding (foreground/midground/background).
4. Do NOT substitute synonyms for the lost anchors — use the EXACT terms.
5. Keep within the platform character limit of ${dna.charCeiling} chars.

YOUR FIRST ATTEMPT (DO NOT COPY — IMPROVE):
${firstAttemptOutput.slice(0, 500)}

ORIGINAL INPUT:
${originalUserMessage}`;

  // ── Lower temperature for retry ────────────────────────────────────
  const retryTemperature = Math.max(
    originalTemperature - RETRY_TEMPERATURE_REDUCTION,
    RETRY_TEMPERATURE_FLOOR,
  );

  return {
    retryUserMessage,
    retryTemperature,
    retryAcceptThreshold: RETRY_ACCEPT_THRESHOLD,
  };
}

/**
 * Evaluate whether a retry attempt should be accepted.
 *
 * Stricter than first-attempt acceptance:
 *   - APS score must be ≥ 0.88 (vs 0.85 for first attempt)
 *   - No vetoes
 *   - All previously-dropped anchors must now be present
 *
 * @param retryApsResult      APS result from the retry attempt
 * @param originalDropped     Anchors that were dropped in the first attempt
 */
export function evaluateRetry(
  retryApsResult: APSResult,
  originalDropped: readonly AnchorSurvival[],
): RetryResult {
  // Check if retry met the stricter threshold
  const meetsThreshold = retryApsResult.score >= RETRY_ACCEPT_THRESHOLD;
  const noVetoes = !retryApsResult.anyVetoFired;

  // Check if previously-dropped anchors were recovered
  const stillDropped = originalDropped.filter((orig) => {
    const inRetry = retryApsResult.droppedAnchors.find(
      (d) => d.anchor.toLowerCase() === orig.anchor.toLowerCase(),
    );
    return inRetry !== undefined; // Still dropped in retry
  });

  // ChatGPT 95/100 fix: require recovery of critical+important anchors,
  // not just threshold + no vetoes. Optional anchors can still be missing.
  const criticalImportantStillDropped = stillDropped.filter(
    (a) => a.severity === 'critical' || a.severity === 'important',
  );
  const criticalImportantRecovered = criticalImportantStillDropped.length === 0;
  const allRecovered = stillDropped.length === 0;

  const accepted = meetsThreshold && noVetoes && criticalImportantRecovered;

  let summary: string;
  if (accepted) {
    const recovered = originalDropped.length - stillDropped.length;
    summary = `Retry accepted: APS ${retryApsResult.score.toFixed(2)} (≥${RETRY_ACCEPT_THRESHOLD}), recovered ${recovered}/${originalDropped.length} anchors`;
    if (!allRecovered) {
      const optionalStillDropped = stillDropped.filter((a) => a.severity === 'optional');
      summary += ` (${optionalStillDropped.length} optional still missing)`;
    }
  } else if (!meetsThreshold) {
    summary = `Retry rejected: APS ${retryApsResult.score.toFixed(2)} (below ${RETRY_ACCEPT_THRESHOLD} threshold)`;
  } else if (!criticalImportantRecovered) {
    summary = `Retry rejected: ${criticalImportantStillDropped.length} critical/important anchor(s) still missing: ${criticalImportantStillDropped.map((a) => a.anchor).join(', ')}`;
  } else {
    const vetoNames = [
      retryApsResult.criticalAnchorVeto ? 'critical_anchor_loss' : '',
      retryApsResult.inventedContentVeto ? 'invented_content' : '',
      retryApsResult.proseQualityVeto ? 'prose_quality' : '',
    ].filter(Boolean).join(', ');
    summary = `Retry rejected: veto fired (${vetoNames})`;
  }

  return {
    attempted: true,
    accepted,
    retryApsScore: retryApsResult.score,
    summary,
  };
}

/** Convenience: a "not attempted" result for non-retry paths. */
export const RETRY_NOT_ATTEMPTED: RetryResult = {
  attempted: false,
  accepted: false,
  retryApsScore: null,
  summary: 'Retry not attempted',
};
