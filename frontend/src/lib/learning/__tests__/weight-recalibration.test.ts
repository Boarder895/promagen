// src/lib/learning/__tests__/weight-recalibration.test.ts
// ============================================================================
// SELF-IMPROVING SCORER — Weight Recalibration Tests
// ============================================================================
//
// Verifies Pearson correlation, normalisation, smoothing, and the main
// computeScoringWeights function for Phase 6.
//
// Authority: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.2
//
// Version: 1.0.0
// Created: 25 February 2026
// ============================================================================

import {
  pearsonCorrelation,
  normaliseToWeights,
  smoothWeights,
  computeScoringWeights,
  STATIC_DEFAULTS,
  MIN_EVENTS_PER_TIER,
  MIN_EVENTS_GLOBAL,
  WEIGHT_FLOOR,
  SMOOTHING_FACTOR,
} from '../weight-recalibration';

import type { ScoringWeights } from '../weight-recalibration';
import type { PromptEventRow } from '../database';

// ============================================================================
// HELPERS
// ============================================================================

/** Round to N decimal places */
function r(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

/** Sum of all values in a Record<string, number> */
function sumWeights(w: Record<string, number>): number {
  return Object.values(w).reduce((a, b) => a + b, 0);
}

/**
 * Create a mock PromptEventRow with specified score_factors and outcome.
 * Minimal fields — only what the computation layer reads.
 */
function mockEvent(
  opts: {
    tier?: number;
    scoreFactors?: Record<string, number>;
    copied?: boolean;
    saved?: boolean;
    returnedWithin60s?: boolean;
    reusedFromLibrary?: boolean;
  } = {},
): PromptEventRow {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    session_id: 'sess_test',
    attempt_number: 1,
    selections: { subject: ['test'] },
    category_count: 5,
    char_length: 100,
    score: 92,
    score_factors: opts.scoreFactors ?? {
      categoryCount: 20,
      coherence: 18,
      promptLength: 15,
      tierFormat: 12,
      negative: 8,
      fidelity: 10,
      density: 7,
    },
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: {
      copied: opts.copied ?? true,
      saved: opts.saved ?? false,
      returnedWithin60s: opts.returnedWithin60s ?? false,
      reusedFromLibrary: opts.reusedFromLibrary ?? false,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate N events with a known correlation between one factor and outcomes.
 *
 * High factorValue → high outcome (positive correlation).
 * This creates a testable dataset where we KNOW the Pearson r should be
 * close to +1.0 for the correlated factor.
 */
function generateCorrelatedEvents(
  n: number,
  correlatedFactor: string,
  tier: number = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  for (let i = 0; i < n; i++) {
    const ratio = i / (n - 1); // 0 to 1

    // Correlated factor scales linearly with ratio
    const highValue = Math.round(ratio * 30);
    // Other factors are random noise
    const noise = () => Math.round(Math.random() * 20);

    events.push(
      mockEvent({
        tier,
        scoreFactors: {
          categoryCount: correlatedFactor === 'categoryCount' ? highValue : noise(),
          coherence: correlatedFactor === 'coherence' ? highValue : noise(),
          promptLength: correlatedFactor === 'promptLength' ? highValue : noise(),
          tierFormat: correlatedFactor === 'tierFormat' ? highValue : noise(),
          negative: correlatedFactor === 'negative' ? highValue : noise(),
          fidelity: correlatedFactor === 'fidelity' ? highValue : noise(),
          density: correlatedFactor === 'density' ? highValue : noise(),
        },
        // High ratio → saved + reused (high outcome), low ratio → just copied (low outcome)
        copied: true,
        saved: ratio > 0.4,
        reusedFromLibrary: ratio > 0.7,
        returnedWithin60s: ratio < 0.2,
      }),
    );
  }
  return events;
}

// ============================================================================
// pearsonCorrelation
// ============================================================================

describe('pearsonCorrelation', () => {
  it('returns 0 for empty arrays', () => {
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it('returns 0 for different-length arrays', () => {
    expect(pearsonCorrelation([1, 2], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for zero-variance X (all same values)', () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBe(0);
  });

  it('returns 0 for zero-variance Y (all same values)', () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBe(0);
  });

  it('returns 1.0 for perfect positive correlation', () => {
    expect(r(pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]))).toBe(1);
  });

  it('returns -1.0 for perfect negative correlation', () => {
    expect(r(pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]))).toBe(-1);
  });

  it('returns ~0 for uncorrelated data', () => {
    // Alternating: no linear relationship
    const xs = [1, 2, 3, 4, 5, 6, 7, 8];
    const ys = [5, 2, 8, 1, 7, 3, 6, 4];
    const result = Math.abs(pearsonCorrelation(xs, ys));
    expect(result).toBeLessThan(0.3);
  });

  it('returns moderate positive for partial correlation', () => {
    // Y roughly increases with X but with noise
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [2, 1, 4, 5, 3, 7, 6, 9, 8, 10];
    const result = pearsonCorrelation(xs, ys);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThan(1.0);
  });

  it('handles single-element arrays', () => {
    // Single element → zero variance → return 0
    expect(pearsonCorrelation([5], [3])).toBe(0);
  });

  it('handles two-element arrays', () => {
    // Two points always define a perfect line
    expect(r(pearsonCorrelation([1, 2], [3, 5]))).toBe(1);
  });
});

// ============================================================================
// normaliseToWeights
// ============================================================================

describe('normaliseToWeights', () => {
  it('returns empty object for empty input', () => {
    expect(normaliseToWeights({})).toEqual({});
  });

  it('weights sum to 1.0', () => {
    const result = normaliseToWeights({
      a: 0.5,
      b: 0.3,
      c: 0.1,
    });
    expect(r(sumWeights(result), 3)).toBeCloseTo(1.0, 2);
  });

  it('takes absolute values (negative correlations become positive weights)', () => {
    const result = normaliseToWeights({
      a: 0.5,
      b: -0.5,
    });
    // Both should get equal weight since |0.5| === |-0.5|
    expect(r(result['a']!, 4)).toBe(r(result['b']!, 4));
  });

  it('applies weight floor', () => {
    const result = normaliseToWeights({
      dominant: 0.9,
      tiny: 0.001,
    });
    // tiny should be floored, not near-zero
    expect(result['tiny']!).toBeGreaterThanOrEqual(WEIGHT_FLOOR * 0.5);
  });

  it('returns equal weights when all correlations are zero', () => {
    const result = normaliseToWeights({
      a: 0,
      b: 0,
      c: 0,
    });
    const expected = 1 / 3;
    expect(r(result['a']!, 4)).toBeCloseTo(expected, 2);
    expect(r(result['b']!, 4)).toBeCloseTo(expected, 2);
    expect(r(result['c']!, 4)).toBeCloseTo(expected, 2);
  });

  it('higher correlation → higher weight', () => {
    const result = normaliseToWeights({
      strong: 0.8,
      weak: 0.1,
    });
    expect(result['strong']!).toBeGreaterThan(result['weak']!);
  });
});

// ============================================================================
// smoothWeights
// ============================================================================

describe('smoothWeights', () => {
  it('returns discovered weights when previous is null (first run)', () => {
    const discovered = { a: 0.6, b: 0.4 };
    const result = smoothWeights(null, discovered);
    expect(result).toEqual(discovered);
  });

  it('applies smoothing formula correctly', () => {
    const previous = { a: 0.8, b: 0.2 };
    const discovered = { a: 0.2, b: 0.8 };
    const result = smoothWeights(previous, discovered, 0.7);

    // a: 0.7 × 0.8 + 0.3 × 0.2 = 0.62
    // b: 0.7 × 0.2 + 0.3 × 0.8 = 0.38
    // Re-normalised: 0.62/1.0, 0.38/1.0
    expect(r(result['a']!, 2)).toBe(0.62);
    expect(r(result['b']!, 2)).toBe(0.38);
  });

  it('smoothed weights sum to ~1.0', () => {
    const previous = { a: 0.5, b: 0.3, c: 0.2 };
    const discovered = { a: 0.1, b: 0.6, c: 0.3 };
    const result = smoothWeights(previous, discovered);
    expect(r(sumWeights(result), 2)).toBeCloseTo(1.0, 1);
  });

  it('handles new factor not in previous (uses discovered value)', () => {
    const previous = { a: 0.6, b: 0.4 };
    const discovered = { a: 0.5, b: 0.3, c: 0.2 };
    const result = smoothWeights(previous, discovered);
    // c not in previous → uses discovered[c] for both sides of smoothing
    expect(result['c']!).toBeGreaterThan(0);
  });
});

// ============================================================================
// computeScoringWeights — Cold Start
// ============================================================================

describe('computeScoringWeights — cold start', () => {
  it('returns static defaults when events array is empty', () => {
    const result = computeScoringWeights([]);
    expect(result.eventCount).toBe(0);
    expect(result.global.weights).toEqual(STATIC_DEFAULTS);
  });

  it('returns static defaults when below MIN_EVENTS_GLOBAL', () => {
    const events = Array.from({ length: MIN_EVENTS_GLOBAL - 1 }, () =>
      mockEvent(),
    );
    const result = computeScoringWeights(events);
    expect(result.global.weights).toEqual(STATIC_DEFAULTS);
  });

  it('all tier weights match static defaults in cold start', () => {
    const result = computeScoringWeights([]);
    for (const tierId of ['1', '2', '3', '4']) {
      expect(result.tiers[tierId]!.weights).toEqual(STATIC_DEFAULTS);
    }
  });

  it('correlations are all 0 in cold start', () => {
    const result = computeScoringWeights([]);
    for (const key of Object.keys(STATIC_DEFAULTS)) {
      expect(result.global.correlations[key]).toBe(0);
    }
  });

  it('includes version and generatedAt', () => {
    const result = computeScoringWeights([]);
    expect(result.version).toBe('1.0.0');
    expect(result.generatedAt).toBeTruthy();
  });
});

// ============================================================================
// computeScoringWeights — With Data
// ============================================================================

describe('computeScoringWeights — with data', () => {
  it('produces weights that sum to ~1.0 for global', () => {
    const events = generateCorrelatedEvents(200, 'coherence');
    const result = computeScoringWeights(events);
    expect(r(sumWeights(result.global.weights), 2)).toBeCloseTo(1.0, 1);
  });

  it('coherence gets highest weight when correlated with outcomes', () => {
    const events = generateCorrelatedEvents(200, 'coherence');
    const result = computeScoringWeights(events);

    const coherenceWeight = result.global.weights['coherence'] ?? 0;
    const otherWeights = Object.entries(result.global.weights)
      .filter(([k]) => k !== 'coherence')
      .map(([, v]) => v);

    // Coherence should be the highest weight (or close to it)
    const maxOther = Math.max(...otherWeights);
    expect(coherenceWeight).toBeGreaterThanOrEqual(maxOther * 0.8);
  });

  it('tier with enough events gets its own weights', () => {
    const events = generateCorrelatedEvents(200, 'coherence', 2);
    const result = computeScoringWeights(events);

    // Tier 2 has 200 events → its own profile
    expect(result.tiers['2']!.eventCount).toBe(200);
    expect(r(sumWeights(result.tiers['2']!.weights), 2)).toBeCloseTo(1.0, 1);
  });

  it('tier with insufficient events falls back to global weights', () => {
    // All 200 events on tier 2, none on tier 1
    const events = generateCorrelatedEvents(200, 'coherence', 2);
    const result = computeScoringWeights(events);

    // Tier 1 has 0 events → should use global weights
    expect(result.tiers['1']!.eventCount).toBe(0);
    expect(result.tiers['1']!.weights).toEqual(result.global.weights);
  });

  it('different tiers get different weights when data differs', () => {
    // Tier 1: coherence correlates with outcomes
    const tier1Events = generateCorrelatedEvents(200, 'coherence', 1);
    // Tier 2: density correlates with outcomes
    const tier2Events = generateCorrelatedEvents(200, 'density', 2);

    const result = computeScoringWeights([...tier1Events, ...tier2Events]);

    // Tier 1 coherence should be higher than tier 2 coherence
    const t1Coherence = result.tiers['1']!.weights['coherence'] ?? 0;
    const t2Coherence = result.tiers['2']!.weights['coherence'] ?? 0;
    expect(t1Coherence).toBeGreaterThan(t2Coherence);

    // Tier 2 density should be higher than tier 1 density
    const t1Density = result.tiers['1']!.weights['density'] ?? 0;
    const t2Density = result.tiers['2']!.weights['density'] ?? 0;
    expect(t2Density).toBeGreaterThan(t1Density);
  });

  it('no weight drops below the floor', () => {
    const events = generateCorrelatedEvents(200, 'coherence');
    const result = computeScoringWeights(events);

    for (const [, weight] of Object.entries(result.global.weights)) {
      // After normalisation, the floor effect means no weight should be
      // near-zero. The normalised floor depends on factor count, but
      // should be > 0.01.
      expect(weight).toBeGreaterThan(0.01);
    }
  });

  it('correlations are stored for diagnostics', () => {
    const events = generateCorrelatedEvents(200, 'coherence');
    const result = computeScoringWeights(events);

    // Coherence correlation should be positive
    expect(result.global.correlations['coherence']).toBeGreaterThan(0);
    // All factors should have a correlation value
    for (const key of Object.keys(result.global.weights)) {
      expect(typeof result.global.correlations[key]).toBe('number');
    }
  });
});

// ============================================================================
// computeScoringWeights — Smoothing with Previous
// ============================================================================

describe('computeScoringWeights — smoothing', () => {
  it('applies smoothing when previous weights provided', () => {
    const events = generateCorrelatedEvents(200, 'coherence');

    // First run (no previous)
    const first = computeScoringWeights(events);

    // Second run with previous
    const second = computeScoringWeights(events, first);

    // Weights should exist and sum to ~1.0
    expect(r(sumWeights(second.global.weights), 2)).toBeCloseTo(1.0, 1);

    // With identical data + smoothing, weights should be similar to first run
    // (smoothing blends 70% previous + 30% new, and new ≈ previous here)
    for (const key of Object.keys(first.global.weights)) {
      const firstW = first.global.weights[key] ?? 0;
      const secondW = second.global.weights[key] ?? 0;
      // Should be within 20% of each other
      expect(Math.abs(firstW - secondW)).toBeLessThan(0.2);
    }
  });
});

// ============================================================================
// STATIC_DEFAULTS — Integrity
// ============================================================================

describe('STATIC_DEFAULTS', () => {
  it('weights sum to 1.0', () => {
    expect(r(sumWeights(STATIC_DEFAULTS), 2)).toBe(1);
  });

  it('contains all expected factors', () => {
    const expected = [
      'categoryCount',
      'coherence',
      'promptLength',
      'tierFormat',
      'negative',
      'fidelity',
      'density',
    ];
    for (const factor of expected) {
      expect(STATIC_DEFAULTS[factor]).toBeDefined();
      expect(STATIC_DEFAULTS[factor]).toBeGreaterThan(0);
    }
  });

  it('all weights are between 0 and 1', () => {
    for (const [, weight] of Object.entries(STATIC_DEFAULTS)) {
      expect(weight).toBeGreaterThan(0);
      expect(weight).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Constants — Sanity
// ============================================================================

describe('Constants', () => {
  it('MIN_EVENTS_PER_TIER is reasonable', () => {
    expect(MIN_EVENTS_PER_TIER).toBeGreaterThanOrEqual(50);
    expect(MIN_EVENTS_PER_TIER).toBeLessThanOrEqual(500);
  });

  it('MIN_EVENTS_GLOBAL is reasonable', () => {
    expect(MIN_EVENTS_GLOBAL).toBeGreaterThanOrEqual(50);
    expect(MIN_EVENTS_GLOBAL).toBeLessThanOrEqual(500);
  });

  it('WEIGHT_FLOOR is small but positive', () => {
    expect(WEIGHT_FLOOR).toBeGreaterThan(0);
    expect(WEIGHT_FLOOR).toBeLessThan(0.1);
  });

  it('SMOOTHING_FACTOR is between 0.5 and 0.9', () => {
    expect(SMOOTHING_FACTOR).toBeGreaterThanOrEqual(0.5);
    expect(SMOOTHING_FACTOR).toBeLessThanOrEqual(0.9);
  });
});
