/**
 * @jest-environment node
 *
 * Tests for Weight Drift computation (Section 2) and Heatmap Extremes (Section 3).
 * Pure logic tests — no fetch, no DOM, no React.
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 5
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  computeFactorDrift,
  findDriftExtremes,
  findHeatmapExtremes,
} from '@/lib/admin/scoring-health-types';
import type { TierProfile, SparklinePoint } from '@/lib/admin/scoring-health-types';

// =============================================================================
// computeFactorDrift
// =============================================================================

describe('computeFactorDrift', () => {
  it('returns empty array for empty weights', () => {
    expect(computeFactorDrift({})).toEqual([]);
  });

  it('computes correct baseline for N factors', () => {
    const weights = { a: 0.5, b: 0.3, c: 0.2 };
    const drifts = computeFactorDrift(weights);

    // Baseline = 1/3 ≈ 0.3333
    expect(drifts).toHaveLength(3);
    for (const d of drifts) {
      expect(d.startWeight).toBeCloseTo(1 / 3, 5);
    }
  });

  it('correctly identifies up/down/flat directions', () => {
    // 2 factors → baseline = 0.5 each
    const weights = { rising: 0.8, falling: 0.2 };
    const drifts = computeFactorDrift(weights);

    const rising = drifts.find((d) => d.factor === 'rising')!;
    const falling = drifts.find((d) => d.factor === 'falling')!;

    expect(rising.direction).toBe('up');
    expect(rising.changePercent).toBeCloseTo(60, 0); // (0.8 - 0.5) / 0.5 * 100

    expect(falling.direction).toBe('down');
    expect(falling.changePercent).toBeCloseTo(-60, 0); // (0.2 - 0.5) / 0.5 * 100
  });

  it('marks factor as flat when change < 1%', () => {
    // 1 factor → baseline = 1.0, endWeight ≈ 1.0
    const weights = { stable: 1.005 };
    const drifts = computeFactorDrift(weights);

    expect(drifts[0]!.direction).toBe('flat');
  });

  it('sorts by |changePercent| descending (biggest movers first)', () => {
    const weights = { small: 0.24, big: 0.60, medium: 0.16 };
    // baseline = 1/3 ≈ 0.333
    // big: (0.60 - 0.333) / 0.333 * 100 ≈ +80%
    // medium: (0.16 - 0.333) / 0.333 * 100 ≈ -52%
    // small: (0.24 - 0.333) / 0.333 * 100 ≈ -28%
    const drifts = computeFactorDrift(weights);

    expect(drifts[0]!.factor).toBe('big');
    expect(drifts[1]!.factor).toBe('medium');
    expect(drifts[2]!.factor).toBe('small');
  });

  it('passes sparkline data through to each factor', () => {
    const sparkline: SparklinePoint[] = [
      { label: '2026-01-01', value: 0.1 },
      { label: '2026-02-01', value: 0.2 },
    ];
    const weights = { a: 0.5, b: 0.5 };
    const drifts = computeFactorDrift(weights, sparkline);

    expect(drifts[0]!.sparkline).toBe(sparkline);
    expect(drifts[1]!.sparkline).toBe(sparkline);
  });

  it('handles single factor (baseline = 1.0)', () => {
    const weights = { only: 0.7 };
    const drifts = computeFactorDrift(weights);

    expect(drifts).toHaveLength(1);
    expect(drifts[0]!.startWeight).toBe(1);
    expect(drifts[0]!.endWeight).toBe(0.7);
    expect(drifts[0]!.changePercent).toBeCloseTo(-30, 0);
    expect(drifts[0]!.direction).toBe('down');
  });
});

// =============================================================================
// findDriftExtremes
// =============================================================================

describe('findDriftExtremes', () => {
  it('returns nulls for empty array', () => {
    const { biggestMover, biggestDecline } = findDriftExtremes([]);
    expect(biggestMover).toBeNull();
    expect(biggestDecline).toBeNull();
  });

  it('finds biggest mover and decline', () => {
    const weights = { big_up: 0.7, small_down: 0.1, medium: 0.2 };
    const drifts = computeFactorDrift(weights);
    const { biggestMover, biggestDecline } = findDriftExtremes(drifts);

    expect(biggestMover!.factor).toBe('big_up');
    expect(biggestMover!.changePercent).toBeGreaterThan(0);
    expect(biggestDecline!.factor).toBe('small_down');
    expect(biggestDecline!.changePercent).toBeLessThan(0);
  });

  it('ignores Infinity values', () => {
    const drifts = computeFactorDrift({ a: 0.5, b: 0.5 });
    // Manually inject an Infinity
    drifts.push({
      factor: 'inf',
      startWeight: 0,
      endWeight: 0.5,
      changePercent: Infinity,
      direction: 'up',
      sparkline: [],
    });

    const { biggestMover } = findDriftExtremes(drifts);
    // Should NOT be 'inf'
    expect(biggestMover?.factor).not.toBe('inf');
  });

  it('returns null for decline when all factors grew', () => {
    // 1 factor → baseline = 1.0, endWeight = 1.5 → +50%
    const drifts = computeFactorDrift({ a: 1.5 });
    const { biggestMover, biggestDecline } = findDriftExtremes(drifts);

    expect(biggestMover).not.toBeNull();
    expect(biggestDecline).toBeNull();
  });
});

// =============================================================================
// findHeatmapExtremes
// =============================================================================

describe('findHeatmapExtremes', () => {
  it('returns nulls for empty tiers', () => {
    const { hottest, coldest } = findHeatmapExtremes([], []);
    expect(hottest).toBeNull();
    expect(coldest).toBeNull();
  });

  it('finds hottest and coldest cells', () => {
    const tiers: TierProfile[] = [
      { tier: '1', label: 'Tier 1', weights: { a: 0.5, b: 0.1 }, eventCount: 100 },
      { tier: '2', label: 'Tier 2', weights: { a: 0.3, b: 0.8 }, eventCount: 200 },
    ];
    const factors = ['a', 'b'];
    const { hottest, coldest } = findHeatmapExtremes(tiers, factors);

    expect(hottest).toEqual({ factor: 'b', tier: 'Tier 2', weight: 0.8 });
    expect(coldest).toEqual({ factor: 'b', tier: 'Tier 1', weight: 0.1 });
  });

  it('ignores zero-weight cells for coldest', () => {
    const tiers: TierProfile[] = [
      { tier: '1', label: 'T1', weights: { a: 0, b: 0.3 }, eventCount: 10 },
      { tier: '2', label: 'T2', weights: { a: 0.6, b: 0 }, eventCount: 20 },
    ];
    const factors = ['a', 'b'];
    const { coldest } = findHeatmapExtremes(tiers, factors);

    // 0 is excluded → coldest should be 0.3 on T1
    expect(coldest).toEqual({ factor: 'b', tier: 'T1', weight: 0.3 });
  });

  it('handles single tier with single factor', () => {
    const tiers: TierProfile[] = [
      { tier: 'global', label: 'Global', weights: { coherence: 0.42 }, eventCount: 500 },
    ];
    const { hottest, coldest } = findHeatmapExtremes(tiers, ['coherence']);

    expect(hottest).toEqual({ factor: 'coherence', tier: 'Global', weight: 0.42 });
    expect(coldest).toEqual({ factor: 'coherence', tier: 'Global', weight: 0.42 });
  });

  it('handles all-zero weights', () => {
    const tiers: TierProfile[] = [
      { tier: '1', label: 'T1', weights: { a: 0, b: 0 }, eventCount: 0 },
    ];
    const { hottest, coldest } = findHeatmapExtremes(tiers, ['a', 'b']);

    expect(hottest).toEqual({ factor: 'b', tier: 'T1', weight: 0 }); // last seen 0
    expect(coldest).toBeNull(); // no non-zero weight
  });
});
