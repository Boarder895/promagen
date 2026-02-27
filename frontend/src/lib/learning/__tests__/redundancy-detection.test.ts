// src/lib/learning/__tests__/redundancy-detection.test.ts
// ============================================================================
// SEMANTIC REDUNDANCY DETECTION — Unit Tests
// ============================================================================
//
// Phase 7.3, Part 7.3b — Tests for the redundancy detection engine.
//
// Verifies mutual exclusivity × outcome similarity computation, union-find
// grouping, canonical term selection, tier independence, global aggregation,
// group size caps, and edge cases.
//
// Authority: docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { PromptEventRow } from '../database';
import { LEARNING_CONSTANTS } from '../constants';
import {
  computeRedundancyGroups,
  type RedundancyGroupsData,
  type RedundancyGroup,
} from '../redundancy-detection';

// ============================================================================
// HELPERS
// ============================================================================

const C = LEARNING_CONSTANTS;

/**
 * Filler categories to pad every test event to 4+ categories.
 *
 * Why: confidence multiplier uses depth factor based on category_count.
 * 2 categories → DEPTH_SHALLOW (0.80) → drops weighted outcome.
 * 4+ categories → DEPTH_NORMAL (1.0) → weighted = raw.
 *
 * Filler terms are always the same in every event, so they become
 * high-co-occurrence and never form redundancy groups (they always
 * appear together, so mutualExclusivity ≈ 0).
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

/**
 * Create a PromptEventRow with specific outcome signals.
 *
 * Padded to 4+ categories so confidence depth factor = NORMAL (1.0).
 */
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
 * Low-outcome event: no signals = 0.0.
 * With 4+ categories → confidence 1.0 → weighted = 0.0.
 */
function makeLow(
  terms: Record<string, string[]>,
  tier = 2,
): PromptEventRow {
  return makeEvent({
    tier,
    terms,
    copied: false,
    saved: false,
    returnedWithin60s: false,
  });
}

/**
 * Generate a redundancy-friendly dataset for two terms in the SAME category.
 *
 * Creates N solo events for term A, N solo events for term B, and
 * optionally M together events. All with the same outcome level.
 *
 * Default: 10 solo each, 0 together (perfect mutual exclusivity).
 * All high outcome (perfect outcome similarity).
 */
function generateRedundancyData(
  termA: string,
  termB: string,
  category: string,
  opts: {
    soloCount?: number;
    togetherCount?: number;
    tier?: number;
    outcomeA?: 'high' | 'low';
    outcomeB?: 'high' | 'low';
  } = {},
): PromptEventRow[] {
  const soloCount = opts.soloCount ?? 10;
  const togetherCount = opts.togetherCount ?? 0;
  const tier = opts.tier ?? 2;
  const makeA = opts.outcomeA === 'low' ? makeLow : makeHigh;
  const makeB = opts.outcomeB === 'low' ? makeLow : makeHigh;

  return [
    // Solo A events: only termA in this category
    ...Array.from({ length: soloCount }, () =>
      makeA({ [category]: [termA] }, tier),
    ),
    // Solo B events: only termB in this category
    ...Array.from({ length: soloCount }, () =>
      makeB({ [category]: [termB] }, tier),
    ),
    // Together events: both terms in same category
    ...Array.from({ length: togetherCount }, () =>
      makeHigh({ [category]: [termA, termB] }, tier),
    ),
  ];
}

/** Find a redundancy group containing a specific term in results */
function findGroupContaining(
  data: RedundancyGroupsData,
  term: string,
  scope: 'global' | string = 'global',
): RedundancyGroup | undefined {
  const groups =
    scope === 'global'
      ? data.global.groups
      : data.tiers[scope]?.groups ?? [];
  return groups.find((g) => g.members.includes(term));
}

// ============================================================================
// TESTS — Basic behaviour
// ============================================================================

describe('computeRedundancyGroups', () => {
  // ── 1. Empty events → null ────────────────────────────────────────────

  it('returns null for no events', () => {
    const result = computeRedundancyGroups([]);
    expect(result).toBeNull();
  });

  // ── 2. Too few solo events → no groups ────────────────────────────────

  it('returns zero groups when terms have fewer than MIN_SOLO_EVENTS', () => {
    // Only 3 solo events per term (below threshold of 8)
    const events = generateRedundancyData('term A', 'term B', 'lighting', {
      soloCount: 3,
    });

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();
    expect(result!.global.groupCount).toBe(0);
    expect(result!.global.groups).toHaveLength(0);
  });

  // ── 3. Perfect redundancy → detected ──────────────────────────────────

  it('detects two terms in same category with perfect exclusivity and same outcomes', () => {
    // 10 solo events each, 0 together, both high outcome
    // mutualExclusivity = 1.0, outcomeSimilarity = 1.0, redundancyScore = 1.0
    const events = generateRedundancyData(
      'cinematic lighting', 'dramatic lighting', 'lighting',
      { soloCount: 10 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'cinematic lighting');
    expect(group).toBeDefined();
    expect(group!.members).toContain('cinematic lighting');
    expect(group!.members).toContain('dramatic lighting');
    expect(group!.category).toBe('lighting');
    expect(group!.meanRedundancy).toBeGreaterThanOrEqual(C.REDUNDANCY_MIN_SCORE);
  });

  // ── 4. Different outcomes → NOT detected ──────────────────────────────

  it('does not detect terms with very different outcomes (similarity too low)', () => {
    // Term A: high outcome (0.60), Term B: low outcome (0.0)
    // outcomeSimilarity = 1.0 - |0.60 - 0.0| = 0.40 < 0.80 threshold
    const events = generateRedundancyData(
      'good term', 'bad term', 'lighting',
      { soloCount: 10, outcomeA: 'high', outcomeB: 'low' },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'good term');
    expect(group).toBeUndefined();
  });

  // ── 5. High co-occurrence → NOT detected ──────────────────────────────

  it('does not detect terms that frequently co-occur (exclusivity too low)', () => {
    // 10 solo each, 10 together → mutualExclusivity = 1 - 10/30 ≈ 0.67 < 0.85
    const events = generateRedundancyData(
      'often paired A', 'often paired B', 'lighting',
      { soloCount: 10, togetherCount: 10 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'often paired A');
    expect(group).toBeUndefined();
  });

  // ── 6. Different categories → NOT detected ────────────────────────────

  it('does not detect terms in different categories', () => {
    // Term A in "lighting", Term B in "style" — different categories
    // The engine only checks within-category pairs
    const events = [
      ...Array.from({ length: 10 }, () =>
        makeHigh({ lighting: ['term X'] }),
      ),
      ...Array.from({ length: 10 }, () =>
        makeHigh({ style: ['term Y'] }),
      ),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const groupX = findGroupContaining(result!, 'term X');
    const groupY = findGroupContaining(result!, 'term Y');
    expect(groupX).toBeUndefined();
    expect(groupY).toBeUndefined();
  });

  // ── 7. Barely below exclusivity threshold → NOT detected ──────────────

  it('does not detect when mutual exclusivity is just below threshold', () => {
    // 8 solo each, 3 together → total = 19
    // mutualExclusivity = 1 - 3/19 ≈ 0.842 < 0.85 threshold
    const events = generateRedundancyData(
      'borderline A', 'borderline B', 'lighting',
      { soloCount: 8, togetherCount: 3 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'borderline A');
    expect(group).toBeUndefined();
  });

  // ── 8. Just above all thresholds → detected ───────────────────────────

  it('detects when just above all thresholds (1 together event)', () => {
    // 10 solo each, 1 together → total = 21
    // mutualExclusivity = 1 - 1/21 ≈ 0.952 > 0.85 ✓
    // outcomeSimilarity = 1.0 (both high) ✓
    // redundancyScore = 0.952 × 1.0 ≈ 0.952 > 0.70 ✓
    const events = generateRedundancyData(
      'just above A', 'just above B', 'lighting',
      { soloCount: 10, togetherCount: 1 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'just above A');
    expect(group).toBeDefined();
  });
});

// ============================================================================
// TESTS — Union-find grouping
// ============================================================================

describe('computeRedundancyGroups — union-find', () => {
  // ── 9. Transitive grouping: A≈B and B≈C → {A, B, C} ──────────────────

  it('groups terms transitively (A≈B, B≈C → {A, B, C})', () => {
    // Three terms, each pairs with the other but not all three together
    // We create enough solo events for each pair to be detected
    const events = [
      // A solo
      ...Array.from({ length: 10 }, () =>
        makeHigh({ lighting: ['light A'] }),
      ),
      // B solo
      ...Array.from({ length: 10 }, () =>
        makeHigh({ lighting: ['light B'] }),
      ),
      // C solo
      ...Array.from({ length: 10 }, () =>
        makeHigh({ lighting: ['light C'] }),
      ),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    // All three should be in the same group
    const group = findGroupContaining(result!, 'light A');
    expect(group).toBeDefined();
    expect(group!.members).toContain('light A');
    expect(group!.members).toContain('light B');
    expect(group!.members).toContain('light C');
    expect(group!.members).toHaveLength(3);
  });

  // ── 10. Group size cap ────────────────────────────────────────────────

  it('caps group size at REDUNDANCY_MAX_GROUP_SIZE', () => {
    // Create MAX_GROUP_SIZE + 2 terms, all mutually exclusive with same outcomes
    const termCount = C.REDUNDANCY_MAX_GROUP_SIZE + 2;
    const events: PromptEventRow[] = [];

    for (let i = 0; i < termCount; i++) {
      events.push(
        ...Array.from({ length: 10 }, () =>
          makeHigh({ lighting: [`capped term ${i}`] }),
        ),
      );
    }

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    // Every group should have at most MAX_GROUP_SIZE members
    for (const group of result!.global.groups) {
      expect(group.members.length).toBeLessThanOrEqual(C.REDUNDANCY_MAX_GROUP_SIZE);
    }
  });

  // ── 11. Canonical term = highest solo count ───────────────────────────

  it('selects the most-used term as canonical', () => {
    // Term A: 20 solo events, Term B: 10 solo events
    const events = [
      ...Array.from({ length: 20 }, () =>
        makeHigh({ lighting: ['popular light'] }),
      ),
      ...Array.from({ length: 10 }, () =>
        makeHigh({ lighting: ['niche light'] }),
      ),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'popular light');
    expect(group).toBeDefined();
    expect(group!.canonical).toBe('popular light');
    // Canonical should be first in members array
    expect(group!.members[0]).toBe('popular light');
  });
});

// ============================================================================
// TESTS — Tier grouping
// ============================================================================

describe('computeRedundancyGroups — tier grouping', () => {
  // ── 12. Per-tier results are independent ──────────────────────────────

  it('produces separate results per tier', () => {
    const events = [
      // Tier 1: redundancy detected (both high, never co-occur)
      ...generateRedundancyData('tier1 A', 'tier1 B', 'lighting', {
        tier: 1, soloCount: 10,
      }),
      // Tier 3: no redundancy (different outcomes)
      ...generateRedundancyData('tier3 A', 'tier3 B', 'lighting', {
        tier: 3, soloCount: 10, outcomeA: 'high', outcomeB: 'low',
      }),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    // Tier 1: should have groups
    const tier1Group = result!.tiers['1']?.groups ?? [];
    const tier1Has = tier1Group.some((g) => g.members.includes('tier1 A'));
    expect(tier1Has).toBe(true);

    // Tier 3: should NOT have groups (different outcomes)
    const tier3Group = result!.tiers['3']?.groups ?? [];
    const tier3Has = tier3Group.some((g) => g.members.includes('tier3 A'));
    expect(tier3Has).toBe(false);
  });

  // ── 13. Tier keys are strings ─────────────────────────────────────────

  it('stores tier keys as strings', () => {
    const events = generateRedundancyData('str A', 'str B', 'lighting', {
      tier: 4, soloCount: 10,
    });

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();
    expect(result!.tiers['4']).toBeDefined();
    expect(result!.tiers['4']!.eventCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS — Global aggregation
// ============================================================================

describe('computeRedundancyGroups — global', () => {
  // ── 14. Global includes all tiers ─────────────────────────────────────

  it('global result includes events from all tiers', () => {
    const events = [
      ...generateRedundancyData('global A', 'global B', 'lighting', {
        tier: 1, soloCount: 5,
      }),
      ...generateRedundancyData('global A', 'global B', 'lighting', {
        tier: 2, soloCount: 5,
      }),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    // Global event count = all events
    expect(result!.global.eventCount).toBe(events.length);

    // Global should detect the group (5+5 = 10 solo events per term across tiers)
    const group = findGroupContaining(result!, 'global A');
    expect(group).toBeDefined();
  });

  // ── 15. Cross-tier boost: terms not detected per-tier but detected globally

  it('detects redundancy globally when per-tier data is insufficient', () => {
    // Each tier has only 5 solo events (below 8 threshold),
    // but globally they combine to 10
    const events = [
      ...generateRedundancyData('cross A', 'cross B', 'lighting', {
        tier: 1, soloCount: 5,
      }),
      ...generateRedundancyData('cross A', 'cross B', 'lighting', {
        tier: 2, soloCount: 5,
      }),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    // Per-tier: should NOT detect (only 5 solo events each)
    const tier1Group = result!.tiers['1']?.groups ?? [];
    expect(tier1Group.some((g) => g.members.includes('cross A'))).toBe(false);

    const tier2Group = result!.tiers['2']?.groups ?? [];
    expect(tier2Group.some((g) => g.members.includes('cross A'))).toBe(false);

    // Global: SHOULD detect (5+5 = 10 solo events each)
    const globalGroup = findGroupContaining(result!, 'cross A');
    expect(globalGroup).toBeDefined();
  });
});

// ============================================================================
// TESTS — Group sorting and trimming
// ============================================================================

describe('computeRedundancyGroups — sorting and trimming', () => {
  // ── 16. Groups sorted by meanRedundancy descending ────────────────────

  it('sorts groups by meanRedundancy descending', () => {
    // Group 1: perfect exclusivity + same outcomes → high meanRedundancy
    // Group 2: near-threshold exclusivity → lower meanRedundancy
    const events = [
      // Group 1: 0 together → exclusivity = 1.0
      ...generateRedundancyData('perfect A', 'perfect B', 'lighting', {
        soloCount: 10, togetherCount: 0,
      }),
      // Group 2: 1 together → exclusivity ≈ 0.95 → lower score
      ...generateRedundancyData('near A', 'near B', 'style', {
        soloCount: 10, togetherCount: 1,
      }),
    ];

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();
    expect(result!.global.groups.length).toBeGreaterThanOrEqual(2);

    // First group should have higher meanRedundancy
    const groups = result!.global.groups;
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1]!.meanRedundancy).toBeGreaterThanOrEqual(
        groups[i]!.meanRedundancy,
      );
    }
  });

  // ── 17. Trim to MAX_GROUPS_PER_TIER ───────────────────────────────────

  it('trims groups to MAX_GROUPS_PER_TIER', () => {
    // Create many distinct categories with redundant pairs
    // Each category produces one group → many groups
    const events: PromptEventRow[] = [];
    const groupCount = C.REDUNDANCY_MAX_GROUPS_PER_TIER + 5;

    for (let i = 0; i < groupCount; i++) {
      events.push(
        ...generateRedundancyData(
          `cat${i} termA`, `cat${i} termB`, `category_${i}`,
          { soloCount: 10 },
        ),
      );
    }

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    expect(result!.global.groups.length).toBeLessThanOrEqual(C.REDUNDANCY_MAX_GROUPS_PER_TIER);
    expect(result!.global.groupCount).toBeLessThanOrEqual(C.REDUNDANCY_MAX_GROUPS_PER_TIER);
  });
});

// ============================================================================
// TESTS — Output shape and metadata
// ============================================================================

describe('computeRedundancyGroups — output shape', () => {
  // ── 18. Output includes expected metadata ─────────────────────────────

  it('includes version, generatedAt, and correct counts', () => {
    const refDate = new Date('2026-02-26T14:00:00Z');
    const events = generateRedundancyData(
      'meta A', 'meta B', 'lighting', { soloCount: 10 },
    );

    const result = computeRedundancyGroups(events, refDate);
    expect(result).not.toBeNull();

    expect(result!.version).toBe('1.0.0');
    expect(result!.generatedAt).toBe('2026-02-26T14:00:00.000Z');
    expect(result!.eventCount).toBe(events.length);
    expect(typeof result!.totalGroups).toBe('number');
    expect(result!.totalGroups).toBeGreaterThan(0);
  });

  // ── 19. Group ID format ───────────────────────────────────────────────

  it('generates group IDs with correct format', () => {
    const events = generateRedundancyData(
      'id A', 'id B', 'lighting', { soloCount: 10 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'id A');
    expect(group).toBeDefined();
    expect(group!.id).toMatch(/^rg_lighting_/);
  });

  // ── 20. Pair data preserved in groups ─────────────────────────────────

  it('includes pair data within each group', () => {
    const events = generateRedundancyData(
      'pair A', 'pair B', 'style', { soloCount: 10 },
    );

    const result = computeRedundancyGroups(events);
    expect(result).not.toBeNull();

    const group = findGroupContaining(result!, 'pair A');
    expect(group).toBeDefined();
    expect(group!.pairs.length).toBeGreaterThan(0);

    const pair = group!.pairs[0]!;
    expect(pair.terms).toHaveLength(2);
    expect(pair.category).toBe('style');
    expect(pair.mutualExclusivity).toBeGreaterThanOrEqual(C.REDUNDANCY_MIN_MUTUAL_EXCLUSIVITY);
    expect(pair.outcomeSimilarity).toBeGreaterThanOrEqual(C.REDUNDANCY_MIN_OUTCOME_SIMILARITY);
    expect(pair.redundancyScore).toBeGreaterThanOrEqual(C.REDUNDANCY_MIN_SCORE);
    expect(typeof pair.soloCountA).toBe('number');
    expect(typeof pair.soloCountB).toBe('number');
    expect(typeof pair.togetherCount).toBe('number');
  });
});
