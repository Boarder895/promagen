// src/lib/learning/__tests__/combo-lookup.test.ts
// ============================================================================
// HIGHER-ORDER COMBINATIONS — Combo Lookup Unit Tests
// ============================================================================
//
// Phase 7.4, Part 7.4c — Tests for the combo lookup bridge.
//
// Verifies buildComboLookup, lookupComboBoost, lookupComboInfo, tier fallback,
// completeness levels, null safety, and edge cases.
//
// Authority: docs/authority/phase-7.4-magic-combos-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { MagicCombosData, TierMagicCombos, MagicCombo } from '../magic-combo-mining';
import {
  buildComboLookup,
  lookupComboBoost,
  lookupComboInfo,
  type ComboLookup,
} from '../combo-lookup';

// ============================================================================
// HELPERS
// ============================================================================

/** Create a MagicCombo with defaults. */
function makeCombo(overrides: Partial<MagicCombo> & { terms: string[] }): MagicCombo {
  return {
    size: overrides.terms.length,
    meanOutcome: 0.6,
    bestSubsetOutcome: 0.4,
    synergyScore: 0.2,
    support: 10,
    categories: ['style', 'lighting', 'fidelity'],
    ...overrides,
  };
}

/** Create a TierMagicCombos with defaults. */
function makeTier(combos: MagicCombo[]): TierMagicCombos {
  return {
    eventCount: 100,
    comboCount: combos.length,
    trioCount: combos.filter((c) => c.size === 3).length,
    quadCount: combos.filter((c) => c.size === 4).length,
    combos,
  };
}

/** Create minimal MagicCombosData. */
function makeData(opts: {
  tiers?: Record<string, TierMagicCombos>;
  global?: TierMagicCombos;
}): MagicCombosData {
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 200,
    totalCombos: 0,
    tiers: opts.tiers ?? {},
    global: opts.global ?? makeTier([]),
  };
}

// ── Shared test combos ────────────────────────────────────────────────────

const TRIO_ABC = makeCombo({
  terms: ['alpha', 'bravo', 'charlie'],
  synergyScore: 0.15,
  categories: ['style', 'lighting', 'fidelity'],
});

const TRIO_DEF = makeCombo({
  terms: ['delta', 'echo', 'foxtrot'],
  synergyScore: 0.10,
  categories: ['atmosphere', 'colour', 'materials'],
});

const QUAD_ABCD = makeCombo({
  terms: ['alpha', 'bravo', 'charlie', 'delta'],
  synergyScore: 0.25,
  categories: ['style', 'lighting', 'fidelity', 'atmosphere'],
});

// ============================================================================
// TESTS — buildComboLookup
// ============================================================================

describe('buildComboLookup', () => {
  it('returns null for null input', () => {
    expect(buildComboLookup(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildComboLookup(undefined)).toBeNull();
  });

  it('returns null when no combos exist', () => {
    const data = makeData({ tiers: { '2': makeTier([]) }, global: makeTier([]) });
    expect(buildComboLookup(data)).toBeNull();
  });

  it('builds lookup with tier combos', () => {
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC]) },
      global: makeTier([]),
    });
    const lookup = buildComboLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.combos.length).toBe(1);
    expect(lookup!.tiers['2']?.get('alpha')).toEqual([0]);
    expect(lookup!.tiers['2']?.get('bravo')).toEqual([0]);
    expect(lookup!.tiers['2']?.get('charlie')).toEqual([0]);
  });

  it('builds lookup with global combos', () => {
    const data = makeData({
      tiers: {},
      global: makeTier([TRIO_DEF]),
    });
    const lookup = buildComboLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.global.get('delta')).toEqual([0]);
    expect(lookup!.global.get('echo')).toEqual([0]);
  });

  it('preserves eventCount', () => {
    const data = makeData({ tiers: { '1': makeTier([TRIO_ABC]) } });
    data.eventCount = 999;
    const lookup = buildComboLookup(data);
    expect(lookup!.eventCount).toBe(999);
  });

  it('indexes term appearing in multiple combos', () => {
    // 'alpha' is in both TRIO_ABC and QUAD_ABCD
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC, QUAD_ABCD]) },
    });
    const lookup = buildComboLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.tiers['2']?.get('alpha')?.length).toBe(2);
  });
});

// ============================================================================
// TESTS — lookupComboBoost
// ============================================================================

describe('lookupComboBoost', () => {
  let lookup: ComboLookup;

  beforeEach(() => {
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC, TRIO_DEF]) },
      global: makeTier([TRIO_ABC]),
    });
    lookup = buildComboLookup(data)!;
  });

  it('returns 0 for null lookup', () => {
    expect(lookupComboBoost('alpha', ['bravo', 'charlie'], 2, null)).toBe(0);
  });

  it('returns 0 for empty selected terms', () => {
    expect(lookupComboBoost('alpha', [], 2, lookup)).toBe(0);
  });

  it('boosts when option completes a trio (completeness 1.0)', () => {
    // alpha + bravo selected → charlie completes the trio
    const boost = lookupComboBoost('charlie', ['alpha', 'bravo'], 2, lookup);
    // boost = synergyScore(0.15) × 1.0 = 0.15
    expect(boost).toBe(0.15);
  });

  it('partial boost when one more term needed (completeness 0.5)', () => {
    // Only alpha selected → bravo brings it to 2 of 3, still need charlie
    const boost = lookupComboBoost('bravo', ['alpha'], 2, lookup);
    // boost = synergyScore(0.15) × 0.5 = 0.075
    expect(boost).toBe(0.075);
  });

  it('returns 0 when too far from completion', () => {
    // No combo terms selected — option alone can't start a boost
    const boost = lookupComboBoost('alpha', ['unrelated-x', 'unrelated-y'], 2, lookup);
    expect(boost).toBe(0);
  });

  it('returns 0 when option is not in any combo', () => {
    const boost = lookupComboBoost('not-a-combo-term', ['alpha', 'bravo'], 2, lookup);
    expect(boost).toBe(0);
  });

  it('returns 0 when option is already selected', () => {
    const boost = lookupComboBoost('alpha', ['alpha', 'bravo'], 2, lookup);
    expect(boost).toBe(0);
  });
});

// ============================================================================
// TESTS — lookupComboInfo
// ============================================================================

describe('lookupComboInfo', () => {
  let lookup: ComboLookup;

  beforeEach(() => {
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC]) },
      global: makeTier([]),
    });
    lookup = buildComboLookup(data)!;
  });

  it('returns null for null lookup', () => {
    expect(lookupComboInfo('alpha', ['bravo', 'charlie'], 2, null)).toBeNull();
  });

  it('returns full info when combo completes', () => {
    const info = lookupComboInfo('charlie', ['alpha', 'bravo'], 2, lookup);
    expect(info).not.toBeNull();
    expect(info!.completeness).toBe(1.0);
    expect(info!.selectedTerms).toEqual(expect.arrayContaining(['alpha', 'bravo']));
    expect(info!.missingTerms).toEqual([]);
    expect(info!.combo.terms).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('returns partial info when one more needed', () => {
    const info = lookupComboInfo('bravo', ['alpha'], 2, lookup);
    expect(info).not.toBeNull();
    expect(info!.completeness).toBe(0.5);
    expect(info!.selectedTerms).toEqual(['alpha']);
    expect(info!.missingTerms).toEqual(['charlie']);
  });

  it('returns null when too far from completion', () => {
    const info = lookupComboInfo('alpha', ['unrelated'], 2, lookup);
    expect(info).toBeNull();
  });
});

// ============================================================================
// TESTS — Tier fallback
// ============================================================================

describe('lookupComboBoost — tier fallback', () => {
  it('uses tier-specific combos first', () => {
    // Tier 2 has TRIO_ABC with synergy 0.15
    // Global has same combo with synergy 0.10
    const tierCombo = makeCombo({
      terms: ['alpha', 'bravo', 'charlie'],
      synergyScore: 0.20,
    });
    const globalCombo = makeCombo({
      terms: ['alpha', 'bravo', 'charlie'],
      synergyScore: 0.10,
    });

    const data = makeData({
      tiers: { '2': makeTier([tierCombo]) },
      global: makeTier([globalCombo]),
    });
    const lookup = buildComboLookup(data)!;

    // Both tier and global match — should return BEST boost
    const boost = lookupComboBoost('charlie', ['alpha', 'bravo'], 2, lookup);
    expect(boost).toBe(0.20); // Tier is higher
  });

  it('falls back to global when tier has no match', () => {
    const globalCombo = makeCombo({
      terms: ['alpha', 'bravo', 'charlie'],
      synergyScore: 0.12,
    });

    const data = makeData({
      tiers: { '2': makeTier([]) }, // Tier 2 has nothing
      global: makeTier([globalCombo]),
    });
    const lookup = buildComboLookup(data)!;

    const boost = lookupComboBoost('charlie', ['alpha', 'bravo'], 2, lookup);
    expect(boost).toBe(0.12);
  });

  it('works with null tier (global only)', () => {
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC]) },
      global: makeTier([TRIO_ABC]),
    });
    const lookup = buildComboLookup(data)!;

    // tier = null → only check global
    const boost = lookupComboBoost('charlie', ['alpha', 'bravo'], null, lookup);
    expect(boost).toBe(0.15);
  });
});

// ============================================================================
// TESTS — Quad completeness
// ============================================================================

describe('lookupComboBoost — quads', () => {
  let lookup: ComboLookup;

  beforeEach(() => {
    const data = makeData({
      tiers: { '2': makeTier([QUAD_ABCD]) },
      global: makeTier([]),
    });
    lookup = buildComboLookup(data)!;
  });

  it('full boost when option completes a quad (3 of 4 selected)', () => {
    // alpha, bravo, charlie selected → delta completes
    const boost = lookupComboBoost('delta', ['alpha', 'bravo', 'charlie'], 2, lookup);
    expect(boost).toBe(0.25); // synergyScore × 1.0
  });

  it('partial boost when 2 of 4 selected (one more needed after this)', () => {
    // alpha, bravo selected → charlie brings to 3 of 4, still need delta
    const boost = lookupComboBoost('charlie', ['alpha', 'bravo'], 2, lookup);
    expect(boost).toBe(0.125); // 0.25 × 0.5
  });

  it('no boost when only 1 of 4 selected', () => {
    // Only alpha → bravo brings to 2 of 4, still need 2 more — too far
    const boost = lookupComboBoost('bravo', ['alpha'], 2, lookup);
    expect(boost).toBe(0);
  });
});

// ============================================================================
// TESTS — Best match selection
// ============================================================================

describe('lookupComboBoost — best match', () => {
  it('selects the combo with highest boost score', () => {
    // alpha is in two combos:
    // TRIO_ABC (synergy 0.15) — with bravo+charlie selected → completeness 1.0 → boost 0.15
    // QUAD_ABCD (synergy 0.25) — with bravo+charlie selected → completeness 0.5 → boost 0.125
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC, QUAD_ABCD]) },
      global: makeTier([]),
    });
    const lookup = buildComboLookup(data)!;

    // bravo + charlie selected
    const info = lookupComboInfo('alpha', ['bravo', 'charlie'], 2, lookup);
    expect(info).not.toBeNull();
    // Trio completion (0.15) beats quad partial (0.125)
    expect(info!.boostScore).toBe(0.15);
    expect(info!.completeness).toBe(1.0);
  });
});

// ============================================================================
// TESTS — Edge cases
// ============================================================================

describe('lookupComboBoost — edge cases', () => {
  it('caps boost at 1.0', () => {
    // Absurdly high synergy score
    const bigCombo = makeCombo({
      terms: ['x', 'y', 'z'],
      synergyScore: 5.0,
    });
    const data = makeData({
      tiers: { '2': makeTier([bigCombo]) },
    });
    const lookup = buildComboLookup(data)!;

    const boost = lookupComboBoost('z', ['x', 'y'], 2, lookup);
    expect(boost).toBeLessThanOrEqual(1.0);
  });

  it('handles selected terms that overlap with multiple combos', () => {
    // alpha+bravo are in both TRIO_ABC and QUAD_ABCD
    const data = makeData({
      tiers: { '2': makeTier([TRIO_ABC, QUAD_ABCD]) },
    });
    const lookup = buildComboLookup(data)!;

    // delta is only in QUAD — should still find it
    const boost = lookupComboBoost('delta', ['alpha', 'bravo', 'charlie'], 2, lookup);
    expect(boost).toBe(0.25); // quad synergy × 1.0
  });

  it('returns 0 for zero synergy combo', () => {
    const zeroCombo = makeCombo({
      terms: ['zero-a', 'zero-b', 'zero-c'],
      synergyScore: 0,
    });
    const data = makeData({
      tiers: { '2': makeTier([zeroCombo]) },
    });
    const lookup = buildComboLookup(data)!;

    const boost = lookupComboBoost('zero-c', ['zero-a', 'zero-b'], 2, lookup);
    expect(boost).toBe(0);
  });
});
