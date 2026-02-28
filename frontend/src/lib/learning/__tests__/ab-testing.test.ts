// src/lib/learning/__tests__/ab-testing.test.ts
// ============================================================================
// A/B TESTING — Core Engine Tests
// ============================================================================
//
// Tests for the pure-computation A/B testing engine.
//
// Build plan § 6 (Part 7.6b) test cases 1–10, plus extras:
// - normalCDF accuracy (verifies the A&S 7.1.26 erfc→Φ conversion)
// - O'Brien-Fleming sequential testing (obrienFlemingAlpha)
// - Power calculator (computeRequiredSampleSize, estimateDaysRemaining)
//
// Authority: docs/authority/phase-7_6-ab-testing-pipeline-buildplan.md § 6 (7.6b)
//
// Version: 1.4.0 — Lift distribution + adaptive peek scheduling tests
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import {
  shouldCreateTest,
  twoProportionZTest,
  evaluateTest,
  createABTest,
  normalCDF,
  obrienFlemingAlpha,
  computeRequiredSampleSize,
  estimateDaysRemaining,
  betaCredibleInterval,
  bayesianProbVariantWins,
  bayesianProbLiftExceedsThreshold,
  computeLiftDistribution,
} from '../ab-testing';
import type { ABTest, ABTestEventCounts } from '../ab-testing';
import { LEARNING_CONSTANTS } from '../constants';

// ============================================================================
// HELPERS
// ============================================================================

const C = LEARNING_CONSTANTS;

/** Create a mock running ABTest with sensible defaults. */
function mockTest(opts: Partial<ABTest> = {}): ABTest {
  return {
    id: 'ab_test-mock-001',
    name: 'test_weight_change',
    status: 'running',
    controlWeights: { coherence: 20, variety: 15 },
    variantWeights: { coherence: 25, variety: 15 },
    splitPct: C.AB_DEFAULT_SPLIT_PCT,
    minEvents: C.AB_MIN_EVENTS_PER_VARIANT,
    maxDurationDays: C.AB_MAX_DURATION_DAYS,
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    endedAt: null,
    peekCount: 2,
    resultSummary: null,
    ...opts,
  };
}

/** Create mock event counts with defaults. */
function mockCounts(opts: Partial<ABTestEventCounts> = {}): ABTestEventCounts {
  return {
    controlEvents: 500,
    variantEvents: 500,
    controlCopies: 200,
    variantCopies: 200,
    controlSaves: 50,
    variantSaves: 50,
    ...opts,
  };
}

// ============================================================================
// normalCDF — Verifies the A&S 7.1.26 erfc→Φ conversion
// ============================================================================

describe('normalCDF', () => {
  it('returns ≈ 0.5 for z = 0', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it('returns ≈ 0.8413 for z = 1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns ≈ 0.9772 for z = 2', () => {
    expect(normalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it('returns ≈ 0.0228 for z = -2 (symmetry)', () => {
    expect(normalCDF(-2)).toBeCloseTo(0.0228, 3);
  });

  it('returns values in [0, 1] for extreme inputs', () => {
    expect(normalCDF(10)).toBeGreaterThanOrEqual(0.999);
    expect(normalCDF(10)).toBeLessThanOrEqual(1);
    expect(normalCDF(-10)).toBeGreaterThanOrEqual(0);
    expect(normalCDF(-10)).toBeLessThanOrEqual(0.001);
  });

  it('returns ≈ 0.9987 for z = 3', () => {
    expect(normalCDF(3)).toBeCloseTo(0.9987, 3);
  });
});

// ============================================================================
// Test 1–2: shouldCreateTest
// ============================================================================

describe('shouldCreateTest', () => {
  it('returns null when delta is below threshold', () => {
    const current = { coherence: 20, variety: 15, depth: 10 };
    const proposed = { coherence: 20.005, variety: 15.005, depth: 10 };
    expect(shouldCreateTest(current, proposed)).toBeNull();
  });

  it('returns null when weights are identical', () => {
    const weights = { coherence: 20, variety: 15 };
    expect(shouldCreateTest(weights, { ...weights })).toBeNull();
  });

  it('returns test name and delta for significant changes', () => {
    const current = { coherence: 20, variety: 15, depth: 10 };
    const proposed = { coherence: 25, variety: 15, depth: 10 };

    const result = shouldCreateTest(current, proposed);
    expect(result).not.toBeNull();
    expect(result!.name).toContain('coherence');
    expect(result!.delta).toBe(5);
  });

  it('includes multiple changed keys in name', () => {
    const current = { coherence: 20, variety: 15, depth: 10 };
    const proposed = { coherence: 25, variety: 20, depth: 10 };

    const result = shouldCreateTest(current, proposed);
    expect(result).not.toBeNull();
    expect(result!.name).toContain('coherence');
    expect(result!.name).toContain('variety');
    expect(result!.delta).toBe(10);
  });

  it('handles keys present in only one set', () => {
    const current = { coherence: 20 };
    const proposed = { coherence: 20, newFactor: 10 };

    const result = shouldCreateTest(current, proposed);
    expect(result).not.toBeNull();
    expect(result!.delta).toBe(10);
  });
});

// ============================================================================
// Test 3–4: twoProportionZTest
// ============================================================================

describe('twoProportionZTest', () => {
  it('returns z ≈ 0 and high p for identical rates', () => {
    const { zScore, pValue } = twoProportionZTest(200, 500, 200, 500);
    expect(Math.abs(zScore)).toBeLessThan(0.01);
    expect(pValue).toBeGreaterThan(0.9);
  });

  it('returns significant p for large rate difference', () => {
    const { zScore, pValue } = twoProportionZTest(150, 500, 225, 500);
    expect(Math.abs(zScore)).toBeGreaterThan(2);
    expect(pValue).toBeLessThan(0.05);
  });

  it('returns z > 0 when group 2 rate is higher', () => {
    const { zScore } = twoProportionZTest(100, 500, 200, 500);
    expect(zScore).toBeGreaterThan(0);
  });

  it('returns z < 0 when group 1 rate is higher', () => {
    const { zScore } = twoProportionZTest(200, 500, 100, 500);
    expect(zScore).toBeLessThan(0);
  });

  it('handles zero observations gracefully', () => {
    const { zScore, pValue } = twoProportionZTest(0, 0, 0, 0);
    expect(zScore).toBe(0);
    expect(pValue).toBe(1);
  });

  it('handles zero successes in both groups', () => {
    const { zScore, pValue } = twoProportionZTest(0, 500, 0, 500);
    expect(zScore).toBe(0);
    expect(pValue).toBe(1);
  });

  it('handles all successes in both groups', () => {
    const { zScore, pValue } = twoProportionZTest(500, 500, 500, 500);
    expect(zScore).toBe(0);
    expect(pValue).toBe(1);
  });
});

// ============================================================================
// Test 5–9: evaluateTest
// ============================================================================

describe('evaluateTest', () => {
  it('extends when insufficient data in control', () => {
    const test = mockTest();
    const counts = mockCounts({ controlEvents: 50, controlCopies: 20 });
    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('Insufficient data');
    expect(result.zScore).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.peekNumber).toBe(3);
  });

  it('extends when insufficient data in variant', () => {
    const test = mockTest();
    const counts = mockCounts({ variantEvents: 50, variantCopies: 20 });
    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('Insufficient data');
  });

  it('promotes when variant wins with statistical significance', () => {
    // Final peek so O'Brien-Fleming alpha ≈ 0.05 (standard)
    const test = mockTest({ peekCount: 13 });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 150,
      variantCopies: 225,
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('promote');
    expect(result.reason).toContain('Variant wins');
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.variantCopyRate).toBeGreaterThan(result.controlCopyRate);
    expect(result.adjustedAlpha).toBeGreaterThan(0);
    expect(result.peekNumber).toBe(14);
  });

  it('rolls back when control wins with statistical significance', () => {
    const test = mockTest({ peekCount: 13 });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 225,
      variantCopies: 150,
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('rollback');
    expect(result.reason).toContain('Control wins');
    expect(result.pValue).toBeLessThan(0.05);
  });

  it('extends when inconclusive and under max duration', () => {
    const test = mockTest({
      peekCount: 4,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,
      variantCopies: 205,
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('Not yet significant');
    expect(result.peekNumber).toBe(5);
  });

  it('rolls back when inconclusive and over max duration', () => {
    const test = mockTest({
      peekCount: 14,
      startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      maxDurationDays: 14,
    });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,
      variantCopies: 205,
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('rollback');
    expect(result.reason).toContain('Inconclusive');
  });

  it('computes rates correctly', () => {
    const test = mockTest({ peekCount: 13 });
    const counts = mockCounts({
      controlEvents: 400,
      variantEvents: 600,
      controlCopies: 100,
      variantCopies: 300,
      controlSaves: 40,
      variantSaves: 120,
    });

    const result = evaluateTest(test, counts);

    expect(result.controlCopyRate).toBeCloseTo(0.25, 4);
    expect(result.variantCopyRate).toBeCloseTo(0.5, 4);
    expect(result.controlSaveRate).toBeCloseTo(0.1, 4);
    expect(result.variantSaveRate).toBeCloseTo(0.2, 4);
  });

  it('handles zero events without error', () => {
    const test = mockTest();
    const counts = mockCounts({
      controlEvents: 0,
      variantEvents: 0,
      controlCopies: 0,
      variantCopies: 0,
      controlSaves: 0,
      variantSaves: 0,
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('extend');
    expect(result.controlCopyRate).toBe(0);
    expect(result.variantCopyRate).toBe(0);
  });

  it("is more conservative at early peeks (O'Brien-Fleming)", () => {
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 150,
      variantCopies: 225,
    });

    // Final peek: should promote (standard alpha)
    const finalPeek = evaluateTest(mockTest({ peekCount: 13, maxDurationDays: 14 }), counts);
    expect(finalPeek.decision).toBe('promote');

    // Early peek (peek 1): O'Brien-Fleming alpha is extremely strict...
    const earlyPeek = evaluateTest(
      mockTest({
        peekCount: 0,
        maxDurationDays: 14,
        startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      counts,
    );
    expect(earlyPeek.adjustedAlpha).toBeLessThan(0.001);

    // ...but with 30% vs 45% (15pp lift), the Bayesian early stop correctly
    // catches this obvious winner before the frequentist threshold is met.
    // This proves both: O'Brien-Fleming IS conservative AND Bayesian catches
    // clear winners that frequentist would miss at early peeks.
    expect(earlyPeek.decision).toBe('promote');
    expect(earlyPeek.reason).toContain('Bayesian early stop');
  });
});

// ============================================================================
// Test 10: createABTest
// ============================================================================

describe('createABTest', () => {
  it('produces valid test object with correct defaults', () => {
    const control = { coherence: 20, variety: 15 };
    const variant = { coherence: 25, variety: 15 };

    const test = createABTest('test_coherence_bump', control, variant);

    expect(test.id).toMatch(/^ab_[0-9a-f-]{36}$/);
    expect(test.name).toBe('test_coherence_bump');
    expect(test.status).toBe('running');
    expect(test.controlWeights).toEqual(control);
    expect(test.variantWeights).toEqual(variant);
    expect(test.splitPct).toBe(C.AB_DEFAULT_SPLIT_PCT);
    expect(test.minEvents).toBe(C.AB_MIN_EVENTS_PER_VARIANT);
    expect(test.maxDurationDays).toBe(C.AB_MAX_DURATION_DAYS);
    expect(test.endedAt).toBeNull();
    expect(test.peekCount).toBe(0);
    expect(test.resultSummary).toBeNull();
  });

  it('generates unique IDs for consecutive calls', () => {
    const test1 = createABTest('test_1', { a: 1 }, { a: 2 });
    const test2 = createABTest('test_2', { a: 1 }, { a: 2 });
    expect(test1.id).not.toBe(test2.id);
  });

  it('sets startedAt to approximately now', () => {
    const before = Date.now();
    const test = createABTest('test_time', { a: 1 }, { a: 2 });
    const after = Date.now();

    const startedMs = new Date(test.startedAt).getTime();
    expect(startedMs).toBeGreaterThanOrEqual(before);
    expect(startedMs).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// O'Brien-Fleming alpha spending
// ============================================================================

describe('obrienFlemingAlpha', () => {
  it('returns base alpha at the final peek', () => {
    const alpha = obrienFlemingAlpha(14, 14, 0.05);
    expect(alpha).toBeCloseTo(0.05, 2);
  });

  it('returns very small alpha at peek 1 of 14', () => {
    const alpha = obrienFlemingAlpha(1, 14, 0.05);
    expect(alpha).toBeLessThan(0.001);
  });

  it('is monotonically increasing across peeks', () => {
    const alphas: number[] = [];
    for (let k = 1; k <= 14; k++) {
      alphas.push(obrienFlemingAlpha(k, 14, 0.05));
    }
    for (let i = 1; i < alphas.length; i++) {
      expect(alphas[i]!).toBeGreaterThanOrEqual(alphas[i - 1]!);
    }
  });

  it('handles peekNumber >= maxPeeks → returns baseAlpha', () => {
    expect(obrienFlemingAlpha(15, 14, 0.05)).toBeCloseTo(0.05, 4);
  });

  it('handles maxPeeks <= 0 → returns baseAlpha', () => {
    expect(obrienFlemingAlpha(1, 0, 0.05)).toBeCloseTo(0.05, 4);
  });
});

// ============================================================================
// Power calculator
// ============================================================================

describe('computeRequiredSampleSize', () => {
  it('returns ~1531 for 40% base, 5% lift, default alpha/power', () => {
    const n = computeRequiredSampleSize(0.4, 0.05);
    // Unpooled two-proportion formula: n ≈ 1531 per group
    // (z_{0.025} + z_{0.80})² × (p1(1-p1) + p2(1-p2)) / (p2-p1)²
    // = (1.96 + 0.842)² × (0.24 + 0.2475) / 0.0025 ≈ 1531
    expect(n).toBeGreaterThan(1400);
    expect(n).toBeLessThan(1650);
  });

  it('requires more samples for smaller lifts', () => {
    const n5 = computeRequiredSampleSize(0.4, 0.05);
    const n3 = computeRequiredSampleSize(0.4, 0.03);
    const n1 = computeRequiredSampleSize(0.4, 0.01);

    expect(n3).toBeGreaterThan(n5);
    expect(n1).toBeGreaterThan(n3);
  });

  it('requires more samples for higher power', () => {
    const n80 = computeRequiredSampleSize(0.4, 0.05, 0.05, 0.8);
    const n90 = computeRequiredSampleSize(0.4, 0.05, 0.05, 0.9);
    const n95 = computeRequiredSampleSize(0.4, 0.05, 0.05, 0.95);

    expect(n90).toBeGreaterThan(n80);
    expect(n95).toBeGreaterThan(n90);
  });

  it('returns Infinity for invalid inputs', () => {
    expect(computeRequiredSampleSize(0, 0.05)).toBe(Infinity);
    expect(computeRequiredSampleSize(1, 0.05)).toBe(Infinity);
    expect(computeRequiredSampleSize(-0.1, 0.05)).toBe(Infinity);
    expect(computeRequiredSampleSize(0.98, 0.05)).toBe(Infinity);
    expect(computeRequiredSampleSize(0.4, 0)).toBe(Infinity);
    expect(computeRequiredSampleSize(0.4, -0.05)).toBe(Infinity);
  });
});

describe('estimateDaysRemaining', () => {
  it('estimates days for a typical scenario', () => {
    const test = mockTest({ splitPct: 50 });
    const days = estimateDaysRemaining(test, 200, 0.4, 0.05);

    expect(days).not.toBeNull();
    expect(days!).toBeGreaterThan(0);
    expect(days!).toBeLessThan(30);
  });

  it('returns null for zero daily rate', () => {
    expect(estimateDaysRemaining(mockTest(), 0, 0.4)).toBeNull();
  });

  it('returns null for invalid base rate', () => {
    expect(estimateDaysRemaining(mockTest(), 200, 0)).toBeNull();
    expect(estimateDaysRemaining(mockTest(), 200, 1)).toBeNull();
  });

  it('returns higher estimate for smaller lifts', () => {
    const test = mockTest({ splitPct: 50 });
    const days5 = estimateDaysRemaining(test, 200, 0.4, 0.05)!;
    const days3 = estimateDaysRemaining(test, 200, 0.4, 0.03)!;
    expect(days3).toBeGreaterThan(days5);
  });
});

// ============================================================================
// Bayesian credible interval
// ============================================================================

describe('betaCredibleInterval', () => {
  it('returns [0, 1] for zero observations', () => {
    const [lo, hi] = betaCredibleInterval(0, 0);
    expect(lo).toBe(0);
    expect(hi).toBe(1);
  });

  it('returns interval centered near the observed rate', () => {
    // 200 copies out of 500 = 40%
    const [lo, hi] = betaCredibleInterval(200, 500);
    expect(lo).toBeLessThan(0.40);
    expect(hi).toBeGreaterThan(0.40);
    expect(lo).toBeGreaterThan(0.30);
    expect(hi).toBeLessThan(0.50);
  });

  it('narrows with more data', () => {
    const [lo100, hi100] = betaCredibleInterval(40, 100);
    const [lo1000, hi1000] = betaCredibleInterval(400, 1000);
    const width100 = hi100 - lo100;
    const width1000 = hi1000 - lo1000;
    expect(width1000).toBeLessThan(width100);
  });

  it('returns values clamped to [0, 1]', () => {
    const [lo, hi] = betaCredibleInterval(1, 1);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
  });
});

describe('bayesianProbVariantWins', () => {
  it('returns ~0.5 for identical groups', () => {
    const prob = bayesianProbVariantWins(200, 500, 200, 500);
    expect(prob).toBeGreaterThan(0.4);
    expect(prob).toBeLessThan(0.6);
  });

  it('returns high probability when variant clearly wins', () => {
    // Control: 30% copy rate, Variant: 45% copy rate
    const prob = bayesianProbVariantWins(150, 500, 225, 500);
    expect(prob).toBeGreaterThan(0.95);
  });

  it('returns low probability when control clearly wins', () => {
    // Control: 45%, Variant: 30%
    const prob = bayesianProbVariantWins(225, 500, 150, 500);
    expect(prob).toBeLessThan(0.05);
  });

  it('returns 0.5 when either group has zero events', () => {
    expect(bayesianProbVariantWins(0, 0, 100, 500)).toBe(0.5);
    expect(bayesianProbVariantWins(100, 500, 0, 0)).toBe(0.5);
  });

  it('is deterministic (seeded PRNG)', () => {
    const p1 = bayesianProbVariantWins(200, 500, 250, 500);
    const p2 = bayesianProbVariantWins(200, 500, 250, 500);
    expect(p1).toBe(p2);
  });
});

// ============================================================================
// evaluateTest — Bayesian fields integration
// ============================================================================

describe('evaluateTest Bayesian fields', () => {
  it('includes Bayesian fields when data is sufficient', () => {
    const test = mockTest({ peekCount: 13 });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 150,
      variantCopies: 225,
    });

    const result = evaluateTest(test, counts);

    expect(result.bayesianProbVariantWins).not.toBeNull();
    expect(result.bayesianProbVariantWins!).toBeGreaterThan(0.95);
    expect(result.controlCredibleInterval).not.toBeNull();
    expect(result.variantCredibleInterval).not.toBeNull();
    expect(result.controlCredibleInterval![0]).toBeLessThan(result.controlCopyRate);
    expect(result.controlCredibleInterval![1]).toBeGreaterThan(result.controlCopyRate);
  });

  it('returns null Bayesian fields when data is insufficient', () => {
    const test = mockTest();
    const counts = mockCounts({
      controlEvents: 5,
      variantEvents: 5,
      controlCopies: 2,
      variantCopies: 3,
    });

    const result = evaluateTest(test, counts);

    expect(result.bayesianProbVariantWins).toBeNull();
    expect(result.controlCredibleInterval).toBeNull();
    expect(result.variantCredibleInterval).toBeNull();
  });
});

// ============================================================================
// bayesianProbLiftExceedsThreshold
// ============================================================================

describe('bayesianProbLiftExceedsThreshold', () => {
  it('returns high probability when lift clearly exceeds threshold', () => {
    // Control: 30%, Variant: 45% — lift is 15pp which is well above 1%
    const prob = bayesianProbLiftExceedsThreshold(150, 500, 225, 500, 0.01);
    expect(prob).toBeGreaterThan(0.95);
  });

  it('returns low probability when rates are nearly equal', () => {
    // Control: 40%, Variant: 40.5% — lift is 0.5pp which is below 1%
    const prob = bayesianProbLiftExceedsThreshold(200, 500, 202, 500, 0.01);
    expect(prob).toBeLessThan(0.5);
  });

  it('returns 0 when either group has zero events', () => {
    expect(bayesianProbLiftExceedsThreshold(0, 0, 100, 500, 0.01)).toBe(0);
    expect(bayesianProbLiftExceedsThreshold(100, 500, 0, 0, 0.01)).toBe(0);
  });

  it('returns lower probability for higher thresholds', () => {
    const prob1 = bayesianProbLiftExceedsThreshold(150, 500, 225, 500, 0.01);
    const prob5 = bayesianProbLiftExceedsThreshold(150, 500, 225, 500, 0.05);
    const prob10 = bayesianProbLiftExceedsThreshold(150, 500, 225, 500, 0.10);
    expect(prob1).toBeGreaterThan(prob5);
    expect(prob5).toBeGreaterThan(prob10);
  });

  it('is deterministic (seeded PRNG)', () => {
    const p1 = bayesianProbLiftExceedsThreshold(200, 500, 250, 500, 0.01);
    const p2 = bayesianProbLiftExceedsThreshold(200, 500, 250, 500, 0.01);
    expect(p1).toBe(p2);
  });
});

// ============================================================================
// evaluateTest — Bayesian early stopping
// ============================================================================

describe('evaluateTest Bayesian early stop', () => {
  it('promotes via Bayesian early stop when evidence is overwhelming', () => {
    // Setup: peek 3 of 14 — O'Brien-Fleming alpha is VERY strict (~0.000023).
    // With 800/group and 8pp lift, z ≈ 3.38, p ≈ 0.0007 — NOT below O'Brien-Fleming.
    // But 800 observations per group makes Bayesian posteriors very tight:
    // P(variant wins) > 0.99 and P(lift > 1%) > 0.95 → Bayesian early promote.
    const test = mockTest({
      peekCount: 2,
      maxDurationDays: 14,
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 800,
      variantEvents: 800,
      controlCopies: 240,  // 30%
      variantCopies: 304,  // 38% — 8pp lift, z≈3.38 but O'Brien α≈0.000023
    });

    const result = evaluateTest(test, counts);

    expect(result.decision).toBe('promote');
    expect(result.reason).toContain('Bayesian early stop');
    expect(result.reason).toContain('P(variant wins)');
    expect(result.reason).toContain('P(lift>1%)');
  });

  it('does NOT Bayesian-early-stop when lift is too small', () => {
    // Setup: variant only slightly better — P(lift > 1%) should be low
    const test = mockTest({
      peekCount: 4,
      maxDurationDays: 14,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,  // 40%
      variantCopies: 205,  // 41% — only 1pp lift
    });

    const result = evaluateTest(test, counts);

    // Should extend (not promote via Bayesian) — insufficient lift confidence
    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('Not yet significant');
  });
});

// ============================================================================
// computeLiftDistribution
// ============================================================================

describe('computeLiftDistribution', () => {
  it('returns bins with center and density properties', () => {
    const bins = computeLiftDistribution(150, 500, 225, 500);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins[0]).toHaveProperty('center');
    expect(bins[0]).toHaveProperty('density');
  });

  it('returns empty array for zero events', () => {
    expect(computeLiftDistribution(0, 0, 100, 500)).toEqual([]);
    expect(computeLiftDistribution(100, 500, 0, 0)).toEqual([]);
  });

  it('densities sum to approximately 1', () => {
    const bins = computeLiftDistribution(200, 500, 250, 500);
    const sum = bins.reduce((s, b) => s + b.density, 0);
    expect(sum).toBeGreaterThan(0.95);
    expect(sum).toBeLessThanOrEqual(1.001);
  });

  it('centers span positive lift for winning variant', () => {
    // Variant: 50% vs Control: 30% → lift clearly positive
    const bins = computeLiftDistribution(150, 500, 250, 500);
    const medianIdx = Math.floor(bins.length / 2);
    expect(bins[medianIdx]!.center).toBeGreaterThan(0);
  });

  it('is deterministic (seeded PRNG)', () => {
    const b1 = computeLiftDistribution(200, 500, 250, 500);
    const b2 = computeLiftDistribution(200, 500, 250, 500);
    expect(b1).toEqual(b2);
  });

  it('respects custom numBins', () => {
    const bins20 = computeLiftDistribution(200, 500, 250, 500, 20);
    const bins60 = computeLiftDistribution(200, 500, 250, 500, 60);
    expect(bins20.length).toBe(20);
    expect(bins60.length).toBe(60);
  });
});

// ============================================================================
// evaluateTest — Adaptive peek scheduling (Improvement 2)
// ============================================================================

describe('evaluateTest adaptive peek scheduling', () => {
  it('returns nextPeekAt on extend decisions', () => {
    const test = mockTest({
      peekCount: 4,
      maxDurationDays: 14,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,
      variantCopies: 205,
    });

    const result = evaluateTest(test, counts);
    expect(result.decision).toBe('extend');
    expect(result.nextPeekAt).not.toBeNull();
    expect(new Date(result.nextPeekAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns null nextPeekAt on terminal decisions (promote)', () => {
    const test = mockTest({ peekCount: 13, maxDurationDays: 14 });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 150,
      variantCopies: 225,
    });

    const result = evaluateTest(test, counts);
    expect(result.decision).toBe('promote');
    expect(result.nextPeekAt).toBeNull();
  });

  it('returns null nextPeekAt on rollback decisions', () => {
    const test = mockTest({
      peekCount: 13,
      maxDurationDays: 14,
      startedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,
      variantCopies: 205,
    });

    const result = evaluateTest(test, counts);
    expect(result.decision).toBe('rollback');
    expect(result.nextPeekAt).toBeNull();
  });

  it('uses 12h interval for high-velocity tests (>500 events/day)', () => {
    const now = new Date();
    const test = mockTest({
      peekCount: 2,
      maxDurationDays: 14,
      startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // 2000 total events over 2 days = 1000/day → 12h interval
    const counts = mockCounts({
      controlEvents: 1000,
      variantEvents: 1000,
      controlCopies: 400,
      variantCopies: 405,
    });

    const result = evaluateTest(test, counts, now);
    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('12h');
  });

  it('uses 72h interval for low-velocity tests (<50 events/day)', () => {
    const now = new Date();
    const test = mockTest({
      peekCount: 2,
      maxDurationDays: 14,
      startedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // 400 total events over 10 days = 40/day → 72h interval
    const counts = mockCounts({
      controlEvents: 200,
      variantEvents: 200,
      controlCopies: 80,
      variantCopies: 82,
    });

    const result = evaluateTest(test, counts, now);
    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('72h');
  });

  it('uses 24h interval for normal-velocity tests (50–500 events/day)', () => {
    const now = new Date();
    const test = mockTest({
      peekCount: 2,
      maxDurationDays: 14,
      startedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // 1000 total events over 5 days = 200/day → 24h interval
    const counts = mockCounts({
      controlEvents: 500,
      variantEvents: 500,
      controlCopies: 200,
      variantCopies: 205,
    });

    const result = evaluateTest(test, counts, now);
    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('24h');
  });

  it('includes nextPeekAt on insufficient-data extend', () => {
    const test = mockTest({
      peekCount: 0,
      maxDurationDays: 14,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const counts = mockCounts({
      controlEvents: 50,
      variantEvents: 50,
      controlCopies: 20,
      variantCopies: 25,
    });

    const result = evaluateTest(test, counts);
    expect(result.decision).toBe('extend');
    expect(result.reason).toContain('Insufficient data');
    expect(result.nextPeekAt).not.toBeNull();
  });
});
