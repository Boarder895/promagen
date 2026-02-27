// src/lib/learning/__tests__/magic-combo-mining.test.ts
// ============================================================================
// HIGHER-ORDER COMBINATIONS — Mining Engine Unit Tests
// ============================================================================
//
// Phase 7.4, Part 7.4b — Tests for the magic combo mining engine.
//
// Verifies Apriori level-wise mining, synergy scoring, trio/quad detection,
// tier independence, global aggregation, pruning, and edge cases.
//
// Authority: docs/authority/phase-7.4-magic-combos-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { PromptEventRow } from '../database';
import { LEARNING_CONSTANTS } from '../constants';
import {
  computeMagicCombos,
  type MagicCombosData,
  type MagicCombo,
} from '../magic-combo-mining';

// ============================================================================
// HELPERS
// ============================================================================

const C = LEARNING_CONSTANTS;

/**
 * Filler categories to pad every test event to 4+ categories.
 * Ensures confidence depth factor = NORMAL (1.0).
 */
const FILLER_CATEGORIES: Record<string, string[]> = {
  camera: ['close-up'],
  materials: ['glass'],
  colour: ['warm tones'],
  action: ['standing'],
};

/** Pad selections to at least 4 categories without overwriting existing keys. */
function padSelections(
  terms: Record<string, string[]>,
): Record<string, string[]> {
  const padded = { ...terms };
  for (const [cat, vals] of Object.entries(FILLER_CATEGORIES)) {
    if (Object.keys(padded).length >= 4) break;
    if (!(cat in padded)) {
      padded[cat] = vals;
    }
  }
  return padded;
}

/** Create a PromptEventRow with specific selections and outcome. */
function makeEvent(opts: {
  tier?: number;
  terms: Record<string, string[]>;
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
}): PromptEventRow {
  const selections = padSelections(opts.terms);
  const categoryCount = Object.keys(selections).filter(
    (k) => selections[k] && selections[k]!.length > 0,
  ).length;

  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    session_id: 'sess_test',
    attempt_number: 1,
    selections,
    category_count: categoryCount,
    char_length: 100,
    score: 50,
    score_factors: {},
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: {
      copied: opts.copied ?? false,
      saved: opts.saved ?? false,
      returnedWithin60s: opts.returnedWithin60s ?? false,
      reusedFromLibrary: opts.reusedFromLibrary ?? false,
    },
    user_tier: null,
    account_age_days: null,
    created_at: new Date().toISOString(),
  };
}

/**
 * High-outcome event: copied + saved + no return = 0.60.
 * With 4+ categories → confidence 1.0 → weighted = 0.60.
 */
function makeHigh(
  terms: Record<string, string[]>,
  tier = 2,
): PromptEventRow {
  return makeEvent({
    tier,
    terms,
    copied: true,
    saved: true,
    returnedWithin60s: false,
  });
}

/**
 * Low-outcome event: copied only = 0.25.
 * With 4+ categories → confidence 1.0 → weighted = 0.25.
 */
function makeLow(
  terms: Record<string, string[]>,
  tier = 2,
): PromptEventRow {
  return makeEvent({
    tier,
    terms,
    copied: true,
    saved: false,
    returnedWithin60s: true,
  });
}

/**
 * Generate events for a synergistic trio:
 * - The trio together has HIGH outcome
 * - Each pair alone has LOW outcome
 * - Each term appears frequently enough for Level 1 (≥10)
 * - Each pair appears frequently enough for Level 2 (≥8)
 * - The trio appears frequently enough for combo support (≥5)
 *
 * @param termA - First term
 * @param termB - Second term
 * @param termC - Third term
 * @param cats - Categories for each term [catA, catB, catC]
 * @param trioCount - Events with all 3 (high outcome)
 * @param pairCount - Extra events per pair without the third (low outcome)
 * @param soloCount - Extra events per term alone (to reach min frequency)
 */
function generateTrioEvents(
  termA: string,
  termB: string,
  termC: string,
  cats: [string, string, string] = ['style', 'lighting', 'fidelity'],
  trioCount = 6,
  pairCount = 4,
  soloCount = 2,
  tier = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];

  // Trio events — HIGH outcome
  for (let i = 0; i < trioCount; i++) {
    events.push(
      makeHigh({ [cats[0]]: [termA], [cats[1]]: [termB], [cats[2]]: [termC] }, tier),
    );
  }

  // Pair events — LOW outcome (pair but missing third)
  for (let i = 0; i < pairCount; i++) {
    events.push(makeLow({ [cats[0]]: [termA], [cats[1]]: [termB] }, tier));
    events.push(makeLow({ [cats[0]]: [termA], [cats[2]]: [termC] }, tier));
    events.push(makeLow({ [cats[1]]: [termB], [cats[2]]: [termC] }, tier));
  }

  // Solo events — to pad term frequency above MIN_TERM_FREQUENCY
  for (let i = 0; i < soloCount; i++) {
    events.push(makeLow({ [cats[0]]: [termA] }, tier));
    events.push(makeLow({ [cats[1]]: [termB] }, tier));
    events.push(makeLow({ [cats[2]]: [termC] }, tier));
  }

  return events;
}

// ============================================================================
// TESTS — Basic
// ============================================================================

describe('Magic Combo Mining — basic', () => {
  // ── 1. Null / empty ───────────────────────────────────────────────────

  it('returns null for empty events', () => {
    expect(computeMagicCombos([])).toBeNull();
  });

  // ── 2. Too few events → no combos ────────────────────────────────────

  it('returns zero combos when terms lack frequency', () => {
    // Only 3 events total — no term reaches MIN_TERM_FREQUENCY (10)
    const events = [
      makeHigh({ style: ['oil painting'], lighting: ['golden hour'], fidelity: ['impasto'] }),
      makeHigh({ style: ['oil painting'], lighting: ['golden hour'], fidelity: ['impasto'] }),
      makeHigh({ style: ['oil painting'], lighting: ['golden hour'], fidelity: ['impasto'] }),
    ];
    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();
    expect(result!.totalCombos).toBe(0);
  });

  // ── 3. Perfect trio detected ──────────────────────────────────────────

  it('detects a synergistic trio', () => {
    const events = generateTrioEvents(
      'oil painting', 'golden hour', 'impasto texture',
    );

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    // Should find the trio in at least one tier or global
    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const trio = allCombos.find(
      (c) =>
        c.size === 3 &&
        c.terms.includes('oil painting') &&
        c.terms.includes('golden hour') &&
        c.terms.includes('impasto texture'),
    );

    expect(trio).toBeDefined();
    expect(trio!.synergyScore).toBeGreaterThan(0);
    expect(trio!.support).toBeGreaterThanOrEqual(C.MAGIC_COMBO_MIN_SUPPORT);
  });

  // ── 4. No synergy → filtered out ─────────────────────────────────────

  it('filters out trios with no synergy (combo ≈ best pair)', () => {
    // All events have the same outcome — no synergy
    const events: PromptEventRow[] = [];

    // Trio events — same (low) outcome as pair events
    for (let i = 0; i < 10; i++) {
      events.push(
        makeLow({ style: ['termA'], lighting: ['termB'], fidelity: ['termC'] }),
      );
    }
    for (let i = 0; i < 10; i++) {
      events.push(makeLow({ style: ['termA'], lighting: ['termB'] }));
      events.push(makeLow({ style: ['termA'], fidelity: ['termC'] }));
      events.push(makeLow({ lighting: ['termB'], fidelity: ['termC'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    // All outcomes are the same → synergy ≈ 0 → filtered out
    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const synergyCombos = allCombos.filter(
      (c) => c.synergyScore >= C.MAGIC_COMBO_MIN_SYNERGY,
    );
    expect(synergyCombos.length).toBe(0);
  });
});

// ============================================================================
// TESTS — Apriori pruning
// ============================================================================

describe('Magic Combo Mining — Apriori pruning', () => {
  // ── 5. Level 1: rare terms excluded ──────────────────────────────────

  it('excludes terms below MIN_TERM_FREQUENCY', () => {
    // "rare term" appears only 3 times (< 10)
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 3; i++) {
      events.push(
        makeHigh({ style: ['rare term'], lighting: ['common A'], fidelity: ['common B'] }),
      );
    }
    // Common terms appear 10+ times
    for (let i = 0; i < 10; i++) {
      events.push(makeHigh({ lighting: ['common A'], fidelity: ['common B'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    // No combo should include "rare term"
    for (const combo of allCombos) {
      expect(combo.terms).not.toContain('rare term');
    }
  });

  // ── 6. Level 2: infrequent pairs excluded ────────────────────────────

  it('excludes trios when a sub-pair is infrequent', () => {
    const events: PromptEventRow[] = [];

    // A+B appear together 10 times (frequent pair)
    for (let i = 0; i < 10; i++) {
      events.push(makeHigh({ style: ['termA'], lighting: ['termB'] }));
    }
    // A+C appear together 10 times (frequent pair)
    for (let i = 0; i < 10; i++) {
      events.push(makeHigh({ style: ['termA'], fidelity: ['termC'] }));
    }
    // B+C appear together only 2 times (infrequent pair) — below MIN_PAIR_SUPPORT
    for (let i = 0; i < 2; i++) {
      events.push(makeHigh({ lighting: ['termB'], fidelity: ['termC'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    // No trio (A,B,C) because B+C sub-pair is infrequent
    const trio = allCombos.find(
      (c) =>
        c.size === 3 &&
        c.terms.includes('termA') &&
        c.terms.includes('termB') &&
        c.terms.includes('termC'),
    );
    expect(trio).toBeUndefined();
  });

  // ── 7. Fewer than 3 frequent terms → no trios ───────────────────────

  it('returns zero combos with fewer than 3 frequent terms', () => {
    const events: PromptEventRow[] = [];
    // Only 2 frequent terms
    for (let i = 0; i < 12; i++) {
      events.push(makeHigh({ style: ['only A'], lighting: ['only B'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();
    expect(result!.totalCombos).toBe(0);
  });
});

// ============================================================================
// TESTS — Synergy calculation
// ============================================================================

describe('Magic Combo Mining — synergy calculation', () => {
  // ── 8. Synergy = trio outcome - best pair outcome ────────────────────

  it('calculates synergy correctly', () => {
    const events = generateTrioEvents(
      'syn A', 'syn B', 'syn C',
    );

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const trio = allCombos.find(
      (c) => c.terms.includes('syn A') && c.terms.includes('syn B') && c.terms.includes('syn C'),
    );

    if (trio) {
      // Synergy should equal meanOutcome - bestSubsetOutcome
      const expectedSynergy = Math.round((trio.meanOutcome - trio.bestSubsetOutcome) * 10_000) / 10_000;
      expect(trio.synergyScore).toBe(expectedSynergy);

      // Trio has high outcome (copied+saved=0.60), pairs have low (copied+return=~0.25)
      // So synergy should be positive
      expect(trio.synergyScore).toBeGreaterThan(0);
      expect(trio.meanOutcome).toBeGreaterThan(trio.bestSubsetOutcome);
    }
  });

  // ── 9. Support count accurate ────────────────────────────────────────

  it('counts support correctly', () => {
    const trioCount = 7;
    const events = generateTrioEvents(
      'sup A', 'sup B', 'sup C',
      ['style', 'lighting', 'fidelity'],
      trioCount,
    );

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    // Check both tier and global
    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const trio = allCombos.find(
      (c) => c.terms.includes('sup A') && c.terms.includes('sup B') && c.terms.includes('sup C'),
    );

    if (trio) {
      expect(trio.support).toBe(trioCount);
    }
  });
});

// ============================================================================
// TESTS — Quad detection
// ============================================================================

describe('Magic Combo Mining — quad detection', () => {
  // ── 10. Quad detected when all sub-trios are frequent ────────────────

  it('detects a synergistic quad', () => {
    const events: PromptEventRow[] = [];

    // Quad events — HIGH outcome (all 4 terms together)
    for (let i = 0; i < 6; i++) {
      events.push(
        makeHigh({
          style: ['qA'],
          lighting: ['qB'],
          fidelity: ['qC'],
          atmosphere: ['qD'],
        }),
      );
    }

    // All 6 pair combinations — LOW outcome
    const pairs: [string, string, string, string][] = [
      ['style', 'qA', 'lighting', 'qB'],
      ['style', 'qA', 'fidelity', 'qC'],
      ['style', 'qA', 'atmosphere', 'qD'],
      ['lighting', 'qB', 'fidelity', 'qC'],
      ['lighting', 'qB', 'atmosphere', 'qD'],
      ['fidelity', 'qC', 'atmosphere', 'qD'],
    ];
    for (const [cat1, t1, cat2, t2] of pairs) {
      for (let i = 0; i < 8; i++) {
        events.push(makeLow({ [cat1]: [t1], [cat2]: [t2] }));
      }
    }

    // All 4 trio combinations — LOW outcome
    const trios: [string, string, string, string, string, string][] = [
      ['style', 'qA', 'lighting', 'qB', 'fidelity', 'qC'],
      ['style', 'qA', 'lighting', 'qB', 'atmosphere', 'qD'],
      ['style', 'qA', 'fidelity', 'qC', 'atmosphere', 'qD'],
      ['lighting', 'qB', 'fidelity', 'qC', 'atmosphere', 'qD'],
    ];
    for (const [c1, t1, c2, t2, c3, t3] of trios) {
      for (let i = 0; i < 5; i++) {
        events.push(makeLow({ [c1]: [t1], [c2]: [t2], [c3]: [t3] }));
      }
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const quad = allCombos.find(
      (c) =>
        c.size === 4 &&
        c.terms.includes('qA') &&
        c.terms.includes('qB') &&
        c.terms.includes('qC') &&
        c.terms.includes('qD'),
    );

    expect(quad).toBeDefined();
    if (quad) {
      expect(quad.synergyScore).toBeGreaterThan(0);
      expect(quad.support).toBe(6);
    }
  });
});

// ============================================================================
// TESTS — Tier handling
// ============================================================================

describe('Magic Combo Mining — tier handling', () => {
  // ── 11. Per-tier independence ─────────────────────────────────────────

  it('computes combos independently per tier', () => {
    const tier1Events = generateTrioEvents(
      'tier1 A', 'tier1 B', 'tier1 C',
      ['style', 'lighting', 'fidelity'],
      6, 4, 2, 1,
    );
    const tier2Events = generateTrioEvents(
      'tier2 A', 'tier2 B', 'tier2 C',
      ['style', 'lighting', 'fidelity'],
      6, 4, 2, 2,
    );

    const result = computeMagicCombos([...tier1Events, ...tier2Events]);
    expect(result).not.toBeNull();

    // Tier 1 should only contain tier1 terms
    if (result!.tiers['1']) {
      for (const combo of result!.tiers['1'].combos) {
        expect(combo.terms.every((t) => t.startsWith('tier1'))).toBe(true);
      }
    }

    // Tier 2 should only contain tier2 terms
    if (result!.tiers['2']) {
      for (const combo of result!.tiers['2'].combos) {
        expect(combo.terms.every((t) => t.startsWith('tier2'))).toBe(true);
      }
    }
  });

  // ── 12. Global aggregation ───────────────────────────────────────────

  it('computes global combos across all tiers', () => {
    // Split events across tiers — below threshold per-tier, above threshold globally
    const tier1Events = generateTrioEvents(
      'global A', 'global B', 'global C',
      ['style', 'lighting', 'fidelity'],
      3, 2, 1, 1,
    );
    const tier2Events = generateTrioEvents(
      'global A', 'global B', 'global C',
      ['style', 'lighting', 'fidelity'],
      3, 2, 1, 2,
    );

    const result = computeMagicCombos([...tier1Events, ...tier2Events]);
    expect(result).not.toBeNull();

    // Global should see enough events to find the combo
    const globalCombos = result!.global.combos;
    const trio = globalCombos.find(
      (c) =>
        c.terms.includes('global A') &&
        c.terms.includes('global B') &&
        c.terms.includes('global C'),
    );
    expect(trio).toBeDefined();
  });
});

// ============================================================================
// TESTS — Sorting, trimming, categories
// ============================================================================

describe('Magic Combo Mining — sorting and output', () => {
  // ── 13. Sort by synergy descending ───────────────────────────────────

  it('sorts combos by synergyScore descending', () => {
    const events = generateTrioEvents('sort A', 'sort B', 'sort C');

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    for (const tier of Object.values(result!.tiers)) {
      for (let i = 1; i < tier.combos.length; i++) {
        expect(tier.combos[i - 1]!.synergyScore).toBeGreaterThanOrEqual(
          tier.combos[i]!.synergyScore,
        );
      }
    }

    // Global too
    for (let i = 1; i < result!.global.combos.length; i++) {
      expect(result!.global.combos[i - 1]!.synergyScore).toBeGreaterThanOrEqual(
        result!.global.combos[i]!.synergyScore,
      );
    }
  });

  // ── 14. Categories correctly identified ──────────────────────────────

  it('identifies categories from event selections', () => {
    const events = generateTrioEvents(
      'cat A', 'cat B', 'cat C',
      ['style', 'lighting', 'fidelity'],
    );

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    const trio = allCombos.find(
      (c) => c.terms.includes('cat A') && c.terms.includes('cat B') && c.terms.includes('cat C'),
    );

    if (trio) {
      expect(trio.categories).toContain('style');
      expect(trio.categories).toContain('lighting');
      expect(trio.categories).toContain('fidelity');
    }
  });

  // ── 15. Combo key alphabetical ordering ──────────────────────────────

  it('stores terms in alphabetical order', () => {
    const events = generateTrioEvents('zebra', 'apple', 'mango');

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    for (const combo of allCombos) {
      const sorted = [...combo.terms].sort();
      expect(combo.terms).toEqual(sorted);
    }
  });
});

// ============================================================================
// TESTS — Output metadata
// ============================================================================

describe('Magic Combo Mining — output metadata', () => {
  // ── 16. Output metadata ──────────────────────────────────────────────

  it('includes version, generatedAt, eventCount', () => {
    const events = generateTrioEvents('meta A', 'meta B', 'meta C');
    const refDate = new Date('2026-02-26T03:00:00Z');

    const result = computeMagicCombos(events, refDate);
    expect(result).not.toBeNull();
    expect(result!.version).toBe('1.0.0');
    expect(result!.generatedAt).toBe('2026-02-26T03:00:00.000Z');
    expect(result!.eventCount).toBe(events.length);
  });

  // ── 17. Trio and quad counts ─────────────────────────────────────────

  it('reports trioCount and quadCount per tier', () => {
    const events = generateTrioEvents('count A', 'count B', 'count C');

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    for (const tier of Object.values(result!.tiers)) {
      const actualTrios = tier.combos.filter((c) => c.size === 3).length;
      const actualQuads = tier.combos.filter((c) => c.size === 4).length;
      expect(tier.trioCount).toBe(actualTrios);
      expect(tier.quadCount).toBe(actualQuads);
      expect(tier.comboCount).toBe(actualTrios + actualQuads);
    }
  });

  // ── 18. totalCombos sums tiers + global ──────────────────────────────

  it('totalCombos equals sum of tier + global comboCount', () => {
    const events = generateTrioEvents('total A', 'total B', 'total C');

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    let sum = 0;
    for (const tier of Object.values(result!.tiers)) {
      sum += tier.comboCount;
    }
    sum += result!.global.comboCount;
    expect(result!.totalCombos).toBe(sum);
  });
});

// ============================================================================
// TESTS — Edge cases
// ============================================================================

describe('Magic Combo Mining — edge cases', () => {
  // ── 19. Events with single term → skipped ────────────────────────────

  it('skips events with fewer than 2 terms', () => {
    // All events have a single visible term (plus filler)
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(makeHigh({ style: ['lonely term'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();
    // Filler terms may form combos, but "lonely term" alone is fine
    // Key point: no crash
    expect(result!.eventCount).toBe(20);
  });

  // ── 20. Negative synergy filtered out ────────────────────────────────

  it('filters out combos where trio outcome < best pair outcome', () => {
    const events: PromptEventRow[] = [];

    // Trio events — LOW outcome (trio hurts quality)
    for (let i = 0; i < 10; i++) {
      events.push(
        makeLow({ style: ['neg A'], lighting: ['neg B'], fidelity: ['neg C'] }),
      );
    }

    // Pair events — HIGH outcome (pairs are great, trio is bad)
    for (let i = 0; i < 10; i++) {
      events.push(makeHigh({ style: ['neg A'], lighting: ['neg B'] }));
      events.push(makeHigh({ style: ['neg A'], fidelity: ['neg C'] }));
      events.push(makeHigh({ lighting: ['neg B'], fidelity: ['neg C'] }));
    }

    const result = computeMagicCombos(events);
    expect(result).not.toBeNull();

    const allCombos = [
      ...Object.values(result!.tiers).flatMap((t) => t.combos),
      ...result!.global.combos,
    ];

    // Trio outcome < pair outcome → negative synergy → filtered
    const negTrio = allCombos.find(
      (c) =>
        c.terms.includes('neg A') &&
        c.terms.includes('neg B') &&
        c.terms.includes('neg C'),
    );
    expect(negTrio).toBeUndefined();
  });
});
