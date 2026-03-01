/**
 * @jest-environment node
 *
 * Tests for Configuration Profiles — diff engine, validation, normalisation.
 * Pure logic tests — no fetch, no DOM, no React.
 *
 * Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
 *
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  computeProfileDiff,
  validateProfileName,
  validateWeight,
  normaliseWeights,
  generateProfileId,
  extractProfileWeights,
} from '@/lib/admin/scoring-profiles';
import type { ProfileWeights } from '@/lib/admin/scoring-profiles';

// =============================================================================
// validateProfileName
// =============================================================================

describe('validateProfileName', () => {
  it('accepts valid names', () => {
    expect(validateProfileName('Conservative v2')).toBeNull();
    expect(validateProfileName('Pre-launch safe')).toBeNull();
    expect(validateProfileName('test_profile.1')).toBeNull();
  });

  it('rejects empty names', () => {
    expect(validateProfileName('')).toBeTruthy();
    expect(validateProfileName('   ')).toBeTruthy();
  });

  it('rejects names over 60 characters', () => {
    const long = 'a'.repeat(61);
    expect(validateProfileName(long)).toBeTruthy();
  });

  it('rejects names with special characters', () => {
    expect(validateProfileName('test@profile')).toBeTruthy();
    expect(validateProfileName('test#profile')).toBeTruthy();
    expect(validateProfileName('test/profile')).toBeTruthy();
  });

  it('accepts boundary length (60 chars)', () => {
    const exact = 'a'.repeat(60);
    expect(validateProfileName(exact)).toBeNull();
  });
});

// =============================================================================
// validateWeight
// =============================================================================

describe('validateWeight', () => {
  it('accepts valid weights', () => {
    expect(validateWeight(0)).toBeNull();
    expect(validateWeight(0.5)).toBeNull();
    expect(validateWeight(1)).toBeNull();
  });

  it('rejects negative weights', () => {
    expect(validateWeight(-0.1)).toBeTruthy();
  });

  it('rejects weights over 1', () => {
    expect(validateWeight(1.1)).toBeTruthy();
  });

  it('rejects Infinity', () => {
    expect(validateWeight(Infinity)).toBeTruthy();
  });

  it('rejects NaN', () => {
    expect(validateWeight(NaN)).toBeTruthy();
  });
});

// =============================================================================
// normaliseWeights
// =============================================================================

describe('normaliseWeights', () => {
  it('normalises weights to sum to 1.0', () => {
    const result = normaliseWeights({ a: 0.3, b: 0.3, c: 0.4 });
    const sum = Object.values(result).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('handles unbalanced weights', () => {
    const result = normaliseWeights({ x: 2, y: 8 });
    expect(result.x).toBeCloseTo(0.2, 5);
    expect(result.y).toBeCloseTo(0.8, 5);
  });

  it('returns uniform for all-zero weights', () => {
    const result = normaliseWeights({ a: 0, b: 0, c: 0 });
    expect(result.a).toBeCloseTo(1 / 3, 5);
    expect(result.b).toBeCloseTo(1 / 3, 5);
    expect(result.c).toBeCloseTo(1 / 3, 5);
  });

  it('returns empty for empty input', () => {
    expect(normaliseWeights({})).toEqual({});
  });

  it('handles single factor', () => {
    const result = normaliseWeights({ only: 0.5 });
    expect(result.only).toBeCloseTo(1.0, 5);
  });
});

// =============================================================================
// generateProfileId
// =============================================================================

describe('generateProfileId', () => {
  it('generates a 12-character string', () => {
    const id = generateProfileId();
    expect(id).toHaveLength(12);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateProfileId()));
    expect(ids.size).toBe(100);
  });

  it('contains only alphanumeric characters', () => {
    const id = generateProfileId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});

// =============================================================================
// extractProfileWeights
// =============================================================================

describe('extractProfileWeights', () => {
  it('extracts tier weights correctly', () => {
    const scoringWeights = {
      tiers: {
        '1': { weights: { a: 0.5, b: 0.5 }, eventCount: 100 },
        '2': { weights: { a: 0.3, b: 0.7 }, eventCount: 200 },
      },
      global: { weights: { a: 0.4, b: 0.6 }, eventCount: 300 },
      eventCount: 300,
    };

    const result = extractProfileWeights(scoringWeights);

    expect(result.tiers['1']).toEqual({ a: 0.5, b: 0.5 });
    expect(result.tiers['2']).toEqual({ a: 0.3, b: 0.7 });
    expect(result.global).toEqual({ a: 0.4, b: 0.6 });
    expect(result.eventCount).toBe(300);
  });

  it('handles empty tiers', () => {
    const scoringWeights = {
      tiers: {},
      global: { weights: { a: 1.0 } },
      eventCount: 0,
    };

    const result = extractProfileWeights(scoringWeights);
    expect(Object.keys(result.tiers)).toHaveLength(0);
    expect(result.global).toEqual({ a: 1.0 });
  });
});

// =============================================================================
// computeProfileDiff
// =============================================================================

describe('computeProfileDiff', () => {
  const profileA: ProfileWeights = {
    tiers: {
      '1': { coherence: 0.3, creativity: 0.7 },
      '2': { coherence: 0.5, creativity: 0.5 },
    },
    global: { coherence: 0.4, creativity: 0.6 },
    eventCount: 100,
  };

  it('detects no changes for identical profiles', () => {
    const diff = computeProfileDiff(profileA, profileA);
    expect(diff.changedCells).toBe(0);
    expect(diff.unchangedCells).toBe(6); // 2 factors × 3 tier groups
    expect(diff.totalShift).toBe(0);
  });

  it('detects changes between different profiles', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.5, creativity: 0.5 },
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 200,
    };

    const diff = computeProfileDiff(profileA, profileB);
    expect(diff.changedCells).toBe(2); // Tier 1 coherence & creativity changed
    expect(diff.unchangedCells).toBe(4);
    expect(diff.totalShift).toBeGreaterThan(0);
  });

  it('sorts changes by |delta| descending', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.31, creativity: 0.9 }, // creativity changed more
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 100,
    };

    const diff = computeProfileDiff(profileA, profileB);
    expect(diff.changes.length).toBe(2);
    expect(Math.abs(diff.changes[0]!.delta)).toBeGreaterThanOrEqual(
      Math.abs(diff.changes[1]!.delta),
    );
  });

  it('handles new factors in profile B', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.3, creativity: 0.5, novelty: 0.2 },
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 100,
    };

    const diff = computeProfileDiff(profileA, profileB);
    // novelty exists in B but not A → counts as changed (0 → 0.2)
    const noveltyChange = diff.changes.find((c) => c.factor === 'novelty');
    expect(noveltyChange).toBeDefined();
    expect(noveltyChange!.weightA).toBe(0);
    expect(noveltyChange!.weightB).toBe(0.2);
  });

  it('handles new tier in profile B', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.3, creativity: 0.7 },
        '2': { coherence: 0.5, creativity: 0.5 },
        '3': { coherence: 0.6, creativity: 0.4 }, // New tier
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 150,
    };

    const diff = computeProfileDiff(profileA, profileB);
    // Tier 3 factors should show as new (0 → value)
    const tier3Changes = diff.changes.filter((c) => c.tier === '3');
    expect(tier3Changes.length).toBe(2);
  });

  it('correctly assigns direction', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.5, creativity: 0.5 }, // coherence up, creativity down
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 100,
    };

    const diff = computeProfileDiff(profileA, profileB);
    const coherenceUp = diff.changes.find(
      (c) => c.factor === 'coherence' && c.tier === '1',
    );
    const creativityDown = diff.changes.find(
      (c) => c.factor === 'creativity' && c.tier === '1',
    );

    expect(coherenceUp!.direction).toBe('up');
    expect(creativityDown!.direction).toBe('down');
  });

  it('handles empty profiles', () => {
    const empty: ProfileWeights = { tiers: {}, global: {}, eventCount: 0 };
    const diff = computeProfileDiff(empty, empty);
    expect(diff.totalCells).toBe(0);
    expect(diff.changedCells).toBe(0);
  });

  it('computes correct deltaPercent', () => {
    const profileB: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.6, creativity: 0.7 }, // coherence: 0.3 → 0.6 = +100%
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 100,
    };

    const diff = computeProfileDiff(profileA, profileB);
    const coherenceChange = diff.changes.find(
      (c) => c.factor === 'coherence' && c.tier === '1',
    );
    expect(coherenceChange!.deltaPercent).toBeCloseTo(100, 0);
  });

  it('handles deltaPercent Infinity when A weight is 0', () => {
    const profileBWithNew: ProfileWeights = {
      tiers: {
        '1': { coherence: 0.3, creativity: 0.5, brand_new: 0.2 },
        '2': { coherence: 0.5, creativity: 0.5 },
      },
      global: { coherence: 0.4, creativity: 0.6 },
      eventCount: 100,
    };

    const diff = computeProfileDiff(profileA, profileBWithNew);
    const newFactor = diff.changes.find((c) => c.factor === 'brand_new');
    expect(newFactor!.deltaPercent).toBe(Infinity);
  });
});
