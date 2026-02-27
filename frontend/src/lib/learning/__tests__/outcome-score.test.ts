// src/lib/learning/__tests__/outcome-score.test.ts
// ============================================================================
// SELF-IMPROVING SCORER — Outcome Score Tests
// ============================================================================
//
// Verifies the outcome score computation logic for Phase 6.
// Every signal combination that matters is tested.
//
// Authority: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.1
//
// Version: 1.0.0
// Created: 25 February 2026
// ============================================================================

import {
  computeOutcomeScore,
  computeOutcomeScoreDetailed,
  OUTCOME_SIGNAL_WEIGHTS,
  OUTCOME_SCORE_MAX,
  OUTCOME_SCORE_MIN,
} from '../outcome-score';

// ============================================================================
// HELPERS
// ============================================================================

/** Round to 2 decimal places to avoid floating point noise in assertions */
function r(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// computeOutcomeScore — Core Logic
// ============================================================================

describe('computeOutcomeScore', () => {
  // ── Empty / No Signals ──────────────────────────────────────────────

  it('returns 0 when all signals are false', () => {
    expect(
      computeOutcomeScore({
        copied: false,
        saved: false,
        returnedWithin60s: false,
        reusedFromLibrary: false,
      }),
    ).toBe(0);
  });

  it('returns 0 when outcome is empty object', () => {
    expect(computeOutcomeScore({})).toBe(0);
  });

  it('returns 0 when outcome has undefined fields', () => {
    expect(
      computeOutcomeScore({
        copied: undefined,
        saved: undefined,
      }),
    ).toBe(0);
  });

  // ── Individual Signals ──────────────────────────────────────────────

  it('copied only → 0.25 (base + no-return bonus since returnedWithin60s is falsy)', () => {
    // copied = true, returnedWithin60s defaults to false (missing)
    // So copied (0.10) + copiedNoReturn (0.15) = 0.25
    expect(r(computeOutcomeScore({ copied: true }))).toBe(0.25);
  });

  it('copied + returned within 60s → 0.10 - 0.20 = 0 (floored)', () => {
    // copied (0.10) + returnedPenalty (-0.20) = -0.10 → clamped to 0
    expect(
      computeOutcomeScore({
        copied: true,
        returnedWithin60s: true,
      }),
    ).toBe(0);
  });

  it('saved only (not copied) → 0.35', () => {
    expect(r(computeOutcomeScore({ saved: true }))).toBe(0.35);
  });

  it('reusedFromLibrary only → 0.50', () => {
    expect(r(computeOutcomeScore({ reusedFromLibrary: true }))).toBe(0.5);
  });

  it('returnedWithin60s only (not copied) → 0 (floored from -0.20)', () => {
    expect(computeOutcomeScore({ returnedWithin60s: true })).toBe(0);
  });

  // ── Composite Signals ──────────────────────────────────────────────

  it('copied + no return → 0.25', () => {
    expect(
      r(
        computeOutcomeScore({
          copied: true,
          returnedWithin60s: false,
        }),
      ),
    ).toBe(0.25);
  });

  it('copied + saved + no return → 0.60', () => {
    // copied (0.10) + copiedNoReturn (0.15) + saved (0.35) = 0.60
    expect(
      r(
        computeOutcomeScore({
          copied: true,
          saved: true,
          returnedWithin60s: false,
        }),
      ),
    ).toBe(0.6);
  });

  it('copied + saved + returned → 0.25 (penalty offsets no-return bonus)', () => {
    // copied (0.10) + saved (0.35) + returnedPenalty (-0.20) = 0.25
    // (copiedNoReturn bonus does NOT apply because returnedWithin60s = true)
    expect(
      r(
        computeOutcomeScore({
          copied: true,
          saved: true,
          returnedWithin60s: true,
        }),
      ),
    ).toBe(0.25);
  });

  it('all positive signals → capped at 1.0', () => {
    // copied (0.10) + copiedNoReturn (0.15) + saved (0.35) + reused (0.50)
    // = 1.10 → capped at 1.0
    expect(
      computeOutcomeScore({
        copied: true,
        saved: true,
        returnedWithin60s: false,
        reusedFromLibrary: true,
      }),
    ).toBe(1.0);
  });

  it('reused + saved (not copied) → 0.85', () => {
    // saved (0.35) + reused (0.50) = 0.85
    expect(
      r(
        computeOutcomeScore({
          saved: true,
          reusedFromLibrary: true,
        }),
      ),
    ).toBe(0.85);
  });

  it('all signals true (including returned) → capped at 1.0', () => {
    // copied (0.10) + saved (0.35) + reused (0.50) + returnedPenalty (-0.20)
    // = 0.75 (copiedNoReturn does NOT apply)
    expect(
      r(
        computeOutcomeScore({
          copied: true,
          saved: true,
          returnedWithin60s: true,
          reusedFromLibrary: true,
        }),
      ),
    ).toBe(0.75);
  });

  // ── Score Bounds ───────────────────────────────────────────────────

  it('never returns below OUTCOME_SCORE_MIN', () => {
    // Only negative signal, no positives
    const score = computeOutcomeScore({ returnedWithin60s: true });
    expect(score).toBeGreaterThanOrEqual(OUTCOME_SCORE_MIN);
  });

  it('never returns above OUTCOME_SCORE_MAX', () => {
    const score = computeOutcomeScore({
      copied: true,
      saved: true,
      returnedWithin60s: false,
      reusedFromLibrary: true,
    });
    expect(score).toBeLessThanOrEqual(OUTCOME_SCORE_MAX);
  });

  // ── Defensive: DB row with Record<string, boolean> ─────────────────

  it('handles raw DB outcome record shape', () => {
    // PromptEventRow.outcome is Record<string, boolean>
    const dbOutcome: Record<string, boolean> = {
      copied: true,
      saved: false,
      returnedWithin60s: false,
      reusedFromLibrary: false,
    };
    expect(r(computeOutcomeScore(dbOutcome))).toBe(0.25);
  });

  it('handles DB row with extra fields gracefully', () => {
    const dbOutcome = {
      copied: true,
      saved: true,
      returnedWithin60s: false,
      reusedFromLibrary: false,
      someExtraField: true, // future-proofing
    };
    // Extra fields ignored, only known signals counted
    expect(r(computeOutcomeScore(dbOutcome))).toBe(0.6);
  });
});

// ============================================================================
// computeOutcomeScoreDetailed — Breakdown
// ============================================================================

describe('computeOutcomeScoreDetailed', () => {
  it('returns full breakdown for empty outcome', () => {
    const result = computeOutcomeScoreDetailed({});

    expect(result.score).toBe(0);
    expect(result.signals.copied).toBe(0);
    expect(result.signals.copiedNoReturn).toBe(0);
    expect(result.signals.saved).toBe(0);
    expect(result.signals.reusedFromLibrary).toBe(0);
    expect(result.signals.returnedPenalty).toBe(0);
    expect(result.raw.copied).toBe(false);
    expect(result.raw.saved).toBe(false);
    expect(result.raw.returnedWithin60s).toBe(false);
    expect(result.raw.reusedFromLibrary).toBe(false);
  });

  it('breakdown signals match weight constants', () => {
    const w = OUTCOME_SIGNAL_WEIGHTS;

    const result = computeOutcomeScoreDetailed({
      copied: true,
      saved: true,
      returnedWithin60s: false,
      reusedFromLibrary: false,
    });

    expect(result.signals.copied).toBe(w.copied);
    expect(result.signals.copiedNoReturn).toBe(w.copiedNoReturn);
    expect(result.signals.saved).toBe(w.saved);
    expect(result.signals.reusedFromLibrary).toBe(0);
    expect(result.signals.returnedPenalty).toBe(0);
  });

  it('breakdown score matches computeOutcomeScore', () => {
    const outcomes = [
      {},
      { copied: true },
      { saved: true },
      { reusedFromLibrary: true },
      { copied: true, saved: true, returnedWithin60s: false },
      { copied: true, returnedWithin60s: true },
      {
        copied: true,
        saved: true,
        returnedWithin60s: false,
        reusedFromLibrary: true,
      },
    ];

    for (const outcome of outcomes) {
      const simple = computeOutcomeScore(outcome);
      const detailed = computeOutcomeScoreDetailed(outcome);
      expect(detailed.score).toBe(simple);
    }
  });

  it('raw field reflects actual boolean inputs', () => {
    const result = computeOutcomeScoreDetailed({
      copied: true,
      saved: false,
      returnedWithin60s: true,
      reusedFromLibrary: false,
    });

    expect(result.raw.copied).toBe(true);
    expect(result.raw.saved).toBe(false);
    expect(result.raw.returnedWithin60s).toBe(true);
    expect(result.raw.reusedFromLibrary).toBe(false);
  });

  it('signal contributions sum to unclamped score or clamped score', () => {
    const result = computeOutcomeScoreDetailed({
      copied: true,
      saved: true,
      returnedWithin60s: false,
      reusedFromLibrary: true,
    });

    const signalSum =
      result.signals.copied +
      result.signals.copiedNoReturn +
      result.signals.saved +
      result.signals.reusedFromLibrary +
      result.signals.returnedPenalty;

    // Sum is 1.10 but score is capped at 1.0
    expect(r(signalSum)).toBe(1.1);
    expect(result.score).toBe(1.0);
  });
});

// ============================================================================
// OUTCOME_SIGNAL_WEIGHTS — Constants Integrity
// ============================================================================

describe('OUTCOME_SIGNAL_WEIGHTS', () => {
  it('all positive weights are between 0 and 1', () => {
    const w = OUTCOME_SIGNAL_WEIGHTS;
    expect(w.copied).toBeGreaterThan(0);
    expect(w.copied).toBeLessThanOrEqual(1);
    expect(w.copiedNoReturn).toBeGreaterThan(0);
    expect(w.copiedNoReturn).toBeLessThanOrEqual(1);
    expect(w.saved).toBeGreaterThan(0);
    expect(w.saved).toBeLessThanOrEqual(1);
    expect(w.reusedFromLibrary).toBeGreaterThan(0);
    expect(w.reusedFromLibrary).toBeLessThanOrEqual(1);
  });

  it('returnedPenalty is negative', () => {
    expect(OUTCOME_SIGNAL_WEIGHTS.returnedPenalty).toBeLessThan(0);
  });

  it('reusedFromLibrary is the strongest positive signal', () => {
    const w = OUTCOME_SIGNAL_WEIGHTS;
    expect(w.reusedFromLibrary).toBeGreaterThan(w.saved);
    expect(w.reusedFromLibrary).toBeGreaterThan(w.copiedNoReturn);
    expect(w.reusedFromLibrary).toBeGreaterThan(w.copied);
  });

  it('saved is stronger than copied signals', () => {
    const w = OUTCOME_SIGNAL_WEIGHTS;
    expect(w.saved).toBeGreaterThan(w.copied);
    expect(w.saved).toBeGreaterThan(w.copiedNoReturn);
  });

  it('signal hierarchy: reused > saved > copiedNoReturn > copied', () => {
    const w = OUTCOME_SIGNAL_WEIGHTS;
    expect(w.reusedFromLibrary).toBeGreaterThan(w.saved);
    expect(w.saved).toBeGreaterThan(w.copiedNoReturn);
    expect(w.copiedNoReturn).toBeGreaterThan(w.copied);
  });
});
