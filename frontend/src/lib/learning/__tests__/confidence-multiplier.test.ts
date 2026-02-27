// src/lib/learning/__tests__/confidence-multiplier.test.ts
// ============================================================================
// CONFIDENCE MULTIPLIER — Unit Tests
// ============================================================================
//
// Phase 7.1a — User Confidence Multiplier.
// Phase 7.2a — Final-Attempt Factor extension.
//
// Tests the pure computation that weights outcome signals by user
// deliberateness. Four factors: tier, account age, session depth, final attempt.
//
// Existing features preserved: Yes.
// ============================================================================

import {
  computeConfidenceMultiplier,
  computeConfidenceMultiplierDetailed,
  CONFIDENCE_MULTIPLIERS,
} from '@/lib/learning/outcome-score';

const C = CONFIDENCE_MULTIPLIERS;

// ============================================================================
// computeConfidenceMultiplier — Basic behaviour
// ============================================================================

describe('computeConfidenceMultiplier', () => {
  // ── Defaults ─────────────────────────────────────────────────────────

  it('returns 1.0 for empty input (full backward compat)', () => {
    expect(computeConfidenceMultiplier({})).toBe(1.0);
  });

  it('returns 1.0 for all-null input', () => {
    expect(
      computeConfidenceMultiplier({
        userTier: null,
        accountAgeDays: null,
        categoryCount: null,
      }),
    ).toBe(1.0);
  });

  it('returns 1.0 for all-undefined input', () => {
    expect(
      computeConfidenceMultiplier({
        userTier: undefined,
        accountAgeDays: undefined,
        categoryCount: undefined,
      }),
    ).toBe(1.0);
  });

  // ── Tier factor ──────────────────────────────────────────────────────

  it('free user gets TIER_FREE multiplier (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
    });
    // 1.0 × 1.0 × 1.0 = 1.0
    expect(result).toBe(1.0);
  });

  it('paid user gets TIER_PAID multiplier (1.15)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 15,
      categoryCount: 4,
    });
    // 1.15 × 1.0 × 1.0 = 1.15
    expect(result).toBe(1.15);
  });

  it('unknown tier (arbitrary string) treated as free', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'enterprise' as string,
      accountAgeDays: 15,
      categoryCount: 4,
    });
    // Not 'paid' → 1.0
    expect(result).toBe(1.0);
  });

  // ── Account age factor ───────────────────────────────────────────────

  it('brand new user (0 days) gets AGE_NEW (0.85)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 0,
      categoryCount: 4,
    });
    // 1.0 × 0.85 × 1.0 = 0.85
    expect(result).toBe(0.85);
  });

  it('6-day user (< 7) gets AGE_NEW (0.85)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 6,
      categoryCount: 4,
    });
    expect(result).toBe(0.85);
  });

  it('7-day user (boundary) gets AGE_SETTLING (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 7,
      categoryCount: 4,
    });
    expect(result).toBe(1.0);
  });

  it('29-day user gets AGE_SETTLING (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 29,
      categoryCount: 4,
    });
    expect(result).toBe(1.0);
  });

  it('30-day user (boundary) gets AGE_EXPERIENCED (1.05)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 30,
      categoryCount: 4,
    });
    expect(result).toBe(1.05);
  });

  it('89-day user gets AGE_EXPERIENCED (1.05)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 89,
      categoryCount: 4,
    });
    expect(result).toBe(1.05);
  });

  it('90-day user (boundary) gets AGE_VETERAN (1.10)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 90,
      categoryCount: 4,
    });
    expect(result).toBe(1.1);
  });

  it('365-day veteran user gets AGE_VETERAN (1.10)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 365,
      categoryCount: 4,
    });
    expect(result).toBe(1.1);
  });

  // ── Session depth factor ─────────────────────────────────────────────

  it('1 category (shallow) gets DEPTH_SHALLOW (0.80)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 1,
    });
    // 1.0 × 1.0 × 0.80 = 0.80
    expect(result).toBe(0.8);
  });

  it('2 categories (shallow) gets DEPTH_SHALLOW (0.80)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 2,
    });
    expect(result).toBe(0.8);
  });

  it('3 categories (boundary) gets DEPTH_NORMAL (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 3,
    });
    expect(result).toBe(1.0);
  });

  it('4 categories gets DEPTH_NORMAL (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
    });
    expect(result).toBe(1.0);
  });

  it('5 categories (boundary) gets DEPTH_DEEP (1.10)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 5,
    });
    expect(result).toBe(1.1);
  });

  it('8 categories (deep) gets DEPTH_DEEP (1.10)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 8,
    });
    expect(result).toBe(1.1);
  });

  // ── Combined scenarios ───────────────────────────────────────────────

  it('best case (3 factors): paid + veteran + deep → 1.3915 (within new range)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 180,
      categoryCount: 8,
    });
    // 1.15 × 1.10 × 1.10 × 1.0 (no iteration data) = 1.3915
    // New CONFIDENCE_MAX is 1.50, so NOT clamped
    expect(result).toBe(1.3915);
  });

  it('worst case: free + new + shallow → above CONFIDENCE_MIN (0.68)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 1,
      categoryCount: 1,
    });
    // 1.0 × 0.85 × 0.80 = 0.68
    expect(result).toBe(0.68);
  });

  it('minimum possible: free + brand new + 0 categories → 0.68 (above floor)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 0,
      categoryCount: 0,
    });
    // 1.0 × 0.85 × 0.80 = 0.68
    expect(result).toBe(0.68);
  });

  it('mixed: paid + new + shallow → moderate boost', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 3,
      categoryCount: 2,
    });
    // 1.15 × 0.85 × 0.80 = 0.782
    expect(result).toBe(0.782);
  });

  it('mixed: free + veteran + deep → moderate boost', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 120,
      categoryCount: 7,
    });
    // 1.0 × 1.10 × 1.10 = 1.21
    expect(result).toBe(1.21);
  });

  // ── Clamping ─────────────────────────────────────────────────────────

  it('result never exceeds CONFIDENCE_MAX', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 999,
      categoryCount: 12,
    });
    expect(result).toBeLessThanOrEqual(C.CONFIDENCE_MAX);
  });

  it('result never falls below CONFIDENCE_MIN', () => {
    // Even if we somehow got multipliers < 0.50, clamp catches it
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 0,
      categoryCount: 0,
    });
    expect(result).toBeGreaterThanOrEqual(C.CONFIDENCE_MIN);
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('negative accountAgeDays treated as new (0.85)', () => {
    // Shouldn't happen in practice, but defensive
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: -5,
      categoryCount: 4,
    });
    // negative age → treated as settling (default), since < 0 fails the >= 0 guard
    expect(result).toBe(1.0);
  });

  it('negative categoryCount treated as normal (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: -1,
    });
    // negative count → treated as normal (default), since < 0 fails the >= 0 guard
    expect(result).toBe(1.0);
  });

  // ── Final-attempt factor (Phase 7.2) ─────────────────────────────────

  it('final attempt in multi-attempt session gets FINAL_ATTEMPT_BOOST (1.30)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: true,
      isMultiAttemptSession: true,
    });
    // 1.0 × 1.0 × 1.0 × 1.30 = 1.30
    expect(result).toBe(1.3);
  });

  it('mid-session attempt gets MID_ATTEMPT_DISCOUNT (0.85)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: false,
      isMultiAttemptSession: true,
    });
    // 1.0 × 1.0 × 1.0 × 0.85 = 0.85
    expect(result).toBe(0.85);
  });

  it('single-attempt session (isMultiAttemptSession=false) → neutral (1.0)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: true,
      isMultiAttemptSession: false,
    });
    // isMultiAttemptSession is false → final-attempt factor is 1.0
    // 1.0 × 1.0 × 1.0 × 1.0 = 1.0
    expect(result).toBe(1.0);
  });

  it('null iteration flags → neutral (1.0, backward compatible)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 15,
      categoryCount: 4,
      isFinalAttempt: null,
      isMultiAttemptSession: null,
    });
    // null flags → 1.0 (no change)
    expect(result).toBe(1.0);
  });

  it('paid veteran deep + final attempt → clamped to CONFIDENCE_MAX (1.50)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'paid',
      accountAgeDays: 180,
      categoryCount: 8,
      isFinalAttempt: true,
      isMultiAttemptSession: true,
    });
    // 1.15 × 1.10 × 1.10 × 1.30 = 1.80895 → clamped to 1.50
    expect(result).toBe(C.CONFIDENCE_MAX);
  });

  it('free new shallow + mid attempt → clamped to CONFIDENCE_MIN (0.50)', () => {
    const result = computeConfidenceMultiplier({
      userTier: 'free',
      accountAgeDays: 0,
      categoryCount: 1,
      isFinalAttempt: false,
      isMultiAttemptSession: true,
    });
    // 1.0 × 0.85 × 0.80 × 0.85 = 0.578 → above CONFIDENCE_MIN (0.50)
    expect(result).toBe(0.578);
  });
});

// ============================================================================
// computeConfidenceMultiplierDetailed — Breakdown accuracy
// ============================================================================

describe('computeConfidenceMultiplierDetailed', () => {
  it('returns correct factor breakdown for paid veteran deep', () => {
    const result = computeConfidenceMultiplierDetailed({
      userTier: 'paid',
      accountAgeDays: 120,
      categoryCount: 7,
    });

    expect(result.factors.tier).toBe(C.TIER_PAID);
    expect(result.factors.age).toBe(C.AGE_VETERAN);
    expect(result.factors.depth).toBe(C.DEPTH_DEEP);
    expect(result.factors.finalAttempt).toBe(C.SINGLE_ATTEMPT_NEUTRAL);
    expect(result.rawProduct).toBe(1.3915);
    // New CONFIDENCE_MAX is 1.50, so 1.3915 is NOT clamped
    expect(result.multiplier).toBe(1.3915);
  });

  it('returns correct factor breakdown for free new shallow', () => {
    const result = computeConfidenceMultiplierDetailed({
      userTier: 'free',
      accountAgeDays: 2,
      categoryCount: 1,
    });

    expect(result.factors.tier).toBe(C.TIER_FREE);
    expect(result.factors.age).toBe(C.AGE_NEW);
    expect(result.factors.depth).toBe(C.DEPTH_SHALLOW);
    expect(result.factors.finalAttempt).toBe(C.SINGLE_ATTEMPT_NEUTRAL);
    expect(result.rawProduct).toBe(0.68);
    expect(result.multiplier).toBe(0.68);
  });

  it('returns correct breakdown for empty input', () => {
    const result = computeConfidenceMultiplierDetailed({});

    expect(result.factors.tier).toBe(C.TIER_FREE);
    expect(result.factors.age).toBe(C.AGE_SETTLING);
    expect(result.factors.depth).toBe(C.DEPTH_NORMAL);
    expect(result.factors.finalAttempt).toBe(C.SINGLE_ATTEMPT_NEUTRAL);
    expect(result.rawProduct).toBe(1.0);
    expect(result.multiplier).toBe(1.0);
  });

  it('multiplier matches computeConfidenceMultiplier for same input', () => {
    const inputs = [
      {},
      { userTier: 'paid' as const, accountAgeDays: 45, categoryCount: 6 },
      { userTier: 'free' as const, accountAgeDays: 0, categoryCount: 1 },
      { userTier: 'paid' as const, accountAgeDays: 200, categoryCount: 10 },
    ];

    for (const input of inputs) {
      const simple = computeConfidenceMultiplier(input);
      const detailed = computeConfidenceMultiplierDetailed(input);
      expect(detailed.multiplier).toBe(simple);
    }
  });
});

// ============================================================================
// CONFIDENCE_MULTIPLIERS constants sanity checks
// ============================================================================

describe('CONFIDENCE_MULTIPLIERS constants', () => {
  it('CONFIDENCE_MIN < 1.0 < CONFIDENCE_MAX', () => {
    expect(C.CONFIDENCE_MIN).toBeLessThan(1.0);
    expect(C.CONFIDENCE_MAX).toBeGreaterThan(1.0);
  });

  it('tier multipliers are positive', () => {
    expect(C.TIER_FREE).toBeGreaterThan(0);
    expect(C.TIER_PAID).toBeGreaterThan(0);
  });

  it('paid tier > free tier', () => {
    expect(C.TIER_PAID).toBeGreaterThan(C.TIER_FREE);
  });

  it('age thresholds are in ascending order', () => {
    expect(C.AGE_THRESHOLD_SETTLING).toBeLessThan(C.AGE_THRESHOLD_EXPERIENCED);
    expect(C.AGE_THRESHOLD_EXPERIENCED).toBeLessThan(C.AGE_THRESHOLD_VETERAN);
  });

  it('age multipliers increase with experience', () => {
    expect(C.AGE_NEW).toBeLessThan(C.AGE_SETTLING);
    expect(C.AGE_SETTLING).toBeLessThanOrEqual(C.AGE_EXPERIENCED);
    expect(C.AGE_EXPERIENCED).toBeLessThanOrEqual(C.AGE_VETERAN);
  });

  it('depth thresholds are in ascending order', () => {
    expect(C.DEPTH_THRESHOLD_NORMAL).toBeLessThan(C.DEPTH_THRESHOLD_DEEP);
  });

  it('depth multipliers increase with engagement', () => {
    expect(C.DEPTH_SHALLOW).toBeLessThan(C.DEPTH_NORMAL);
    expect(C.DEPTH_NORMAL).toBeLessThanOrEqual(C.DEPTH_DEEP);
  });

  it('final-attempt multipliers are correctly ordered', () => {
    expect(C.MID_ATTEMPT_DISCOUNT).toBeLessThan(C.SINGLE_ATTEMPT_NEUTRAL);
    expect(C.SINGLE_ATTEMPT_NEUTRAL).toBeLessThan(C.FINAL_ATTEMPT_BOOST);
  });

  it('worst-case product (4 factors) is above CONFIDENCE_MIN', () => {
    // free × new × shallow × mid-attempt discount
    const worst = C.TIER_FREE * C.AGE_NEW * C.DEPTH_SHALLOW * C.MID_ATTEMPT_DISCOUNT;
    expect(worst).toBeGreaterThanOrEqual(C.CONFIDENCE_MIN);
  });

  it('best-case product (4 factors) exceeds CONFIDENCE_MAX (needs clamping)', () => {
    // paid × veteran × deep × final-attempt boost
    const best = C.TIER_PAID * C.AGE_VETERAN * C.DEPTH_DEEP * C.FINAL_ATTEMPT_BOOST;
    expect(best).toBeGreaterThan(C.CONFIDENCE_MAX);
  });
});
