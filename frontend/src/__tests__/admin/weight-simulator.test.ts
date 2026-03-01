/**
 * Phase 7.11h — Weight Simulator Tests
 *
 * Tests:
 *   - computeWeightedScore (weighted sum formula)
 *   - normaliseWeights (sum = 1.0, zero handling, uniform fallback)
 *   - simulateBatch (re-scoring, rank movement, aggregate metrics)
 *   - computeWeightDiff (change detection, percentage, sorting)
 *   - estimateCorrelationPreservation (Pearson r proxy)
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  computeWeightedScore,
  normaliseWeights,
  simulateBatch,
  computeWeightDiff,
  estimateCorrelationPreservation,
  type SimulationEvent,
} from '@/lib/admin/weight-simulator';

// ============================================================================
// computeWeightedScore
// ============================================================================

describe('computeWeightedScore', () => {
  it('computes weighted sum correctly', () => {
    const score = computeWeightedScore(
      { a: 10, b: 20 },
      { a: 0.5, b: 0.5 },
    );
    // 0.5 * 10 + 0.5 * 20 = 15
    expect(score).toBe(15);
  });

  it('handles missing factors in scoreFactors (defaults to 0)', () => {
    const score = computeWeightedScore(
      { a: 10 }, // b missing
      { a: 0.5, b: 0.5 },
    );
    // 0.5 * 10 + 0.5 * 0 = 5
    expect(score).toBe(5);
  });

  it('handles empty weights', () => {
    expect(computeWeightedScore({ a: 10 }, {})).toBe(0);
  });

  it('handles empty score factors', () => {
    expect(computeWeightedScore({}, { a: 0.5 })).toBe(0);
  });

  it('rounds to 3 decimal places', () => {
    const score = computeWeightedScore(
      { a: 1 },
      { a: 0.333 },
    );
    expect(score).toBe(0.333);
  });
});

// ============================================================================
// normaliseWeights
// ============================================================================

describe('normaliseWeights', () => {
  it('normalises to sum = 1.0', () => {
    const norm = normaliseWeights({ a: 2, b: 3 });
    const sum = Object.values(norm).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    expect(norm.a).toBeCloseTo(0.4, 5);
    expect(norm.b).toBeCloseTo(0.6, 5);
  });

  it('returns uniform distribution when all weights are zero', () => {
    const norm = normaliseWeights({ a: 0, b: 0, c: 0 });
    expect(norm.a).toBeCloseTo(1 / 3, 5);
    expect(norm.b).toBeCloseTo(1 / 3, 5);
  });

  it('returns empty for empty input', () => {
    expect(normaliseWeights({})).toEqual({});
  });

  it('preserves already-normalised weights', () => {
    const norm = normaliseWeights({ a: 0.5, b: 0.5 });
    expect(norm.a).toBeCloseTo(0.5, 5);
  });
});

// ============================================================================
// simulateBatch
// ============================================================================

describe('simulateBatch', () => {
  const events: SimulationEvent[] = [
    { id: '1', promptPreview: 'prompt A', scoreFactors: { a: 10, b: 5 }, originalScore: 7.5, platform: 'test', tier: 1 },
    { id: '2', promptPreview: 'prompt B', scoreFactors: { a: 5, b: 10 }, originalScore: 7.5, platform: 'test', tier: 1 },
    { id: '3', promptPreview: 'prompt C', scoreFactors: { a: 8, b: 8 }, originalScore: 8.0, platform: 'test', tier: 1 },
  ];

  it('returns zero impact for empty events', () => {
    const result = simulateBatch([], { a: 0.5, b: 0.5 }, { a: 0.5, b: 0.5 });
    expect(result.avgScoreDelta).toBe(0);
    expect(result.rankChanges).toBe(0);
    expect(result.totalEvents).toBe(0);
  });

  it('returns zero rank changes for identical weights', () => {
    const weights = { a: 0.5, b: 0.5 };
    const result = simulateBatch(events, weights, weights);
    expect(result.rankChanges).toBe(0);
  });

  it('detects rank changes when weights shift', () => {
    // Shift weight heavily toward factor a
    const current = { a: 0.5, b: 0.5 };
    const proposed = { a: 0.9, b: 0.1 };
    const result = simulateBatch(events, current, proposed);

    // Event 1 has a=10, b=5 → benefits from a-heavy weights
    // Event 2 has a=5, b=10 → loses from a-heavy weights
    expect(result.rankChanges).toBeGreaterThan(0);
    expect(result.totalEvents).toBe(3);
  });

  it('produces simulated events sorted by new score descending', () => {
    const result = simulateBatch(events, { a: 0.5, b: 0.5 }, { a: 0.8, b: 0.2 });
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i]!.newScore).toBeLessThanOrEqual(result.events[i - 1]!.newScore);
    }
  });

  it('computes score delta for each event', () => {
    const result = simulateBatch(events, { a: 0.5, b: 0.5 }, { a: 0.7, b: 0.3 });
    for (const e of result.events) {
      expect(e.scoreDelta).toBeCloseTo(e.newScore - e.originalScore, 2);
    }
  });
});

// ============================================================================
// computeWeightDiff
// ============================================================================

describe('computeWeightDiff', () => {
  it('detects changed weights', () => {
    const diffs = computeWeightDiff(
      { a: 0.5, b: 0.3, c: 0.2 },
      { a: 0.4, b: 0.3, c: 0.3 },
    );
    // a changed, c changed, b unchanged
    expect(diffs).toHaveLength(2);
    const factorNames = diffs.map((d) => d.factor);
    expect(factorNames).toContain('a');
    expect(factorNames).toContain('c');
  });

  it('skips negligible changes (< 0.001)', () => {
    const diffs = computeWeightDiff(
      { a: 0.5000 },
      { a: 0.5009 },
    );
    expect(diffs).toHaveLength(0);
  });

  it('computes change percentage correctly', () => {
    const diffs = computeWeightDiff(
      { a: 0.2 },
      { a: 0.3 },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.changePercent).toBe(50); // (0.3-0.2)/0.2 = 50%
  });

  it('sorts by absolute change descending', () => {
    const diffs = computeWeightDiff(
      { a: 0.1, b: 0.5 },
      { a: 0.2, b: 0.4 },
    );
    // a: +100%, b: -20%  → a should be first
    expect(diffs[0]!.factor).toBe('a');
  });

  it('returns empty for identical weights', () => {
    const diffs = computeWeightDiff({ a: 0.5 }, { a: 0.5 });
    expect(diffs).toHaveLength(0);
  });
});

// ============================================================================
// estimateCorrelationPreservation
// ============================================================================

describe('estimateCorrelationPreservation', () => {
  it('returns 1.0 for identical weights (perfect correlation)', () => {
    const events: SimulationEvent[] = [
      { id: '1', promptPreview: '', scoreFactors: { a: 10, b: 5 }, originalScore: 7.5, platform: 'test', tier: 1 },
      { id: '2', promptPreview: '', scoreFactors: { a: 5, b: 10 }, originalScore: 7.5, platform: 'test', tier: 1 },
      { id: '3', promptPreview: '', scoreFactors: { a: 8, b: 2 }, originalScore: 5.0, platform: 'test', tier: 1 },
    ];
    const weights = { a: 0.5, b: 0.5 };
    const r = estimateCorrelationPreservation(events, weights);
    // Scores should correlate perfectly with originals
    expect(r).toBeCloseTo(1.0, 1);
  });

  it('returns 0 for too few events', () => {
    const events: SimulationEvent[] = [
      { id: '1', promptPreview: '', scoreFactors: { a: 10 }, originalScore: 5, platform: 'test', tier: 1 },
    ];
    expect(estimateCorrelationPreservation(events, { a: 1 })).toBe(0);
  });

  it('returns a valid number between -1 and 1', () => {
    const events: SimulationEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      promptPreview: '',
      scoreFactors: { a: i, b: 10 - i },
      originalScore: 5,
      platform: 'test',
      tier: 1,
    }));
    const r = estimateCorrelationPreservation(events, { a: 0.9, b: 0.1 });
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});
