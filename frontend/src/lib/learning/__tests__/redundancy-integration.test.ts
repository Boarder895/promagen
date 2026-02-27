// src/lib/learning/__tests__/redundancy-integration.test.ts
// ============================================================================
// SEMANTIC REDUNDANCY DETECTION — Integration Tests
// ============================================================================
//
// Phase 7.3, Part 7.3e — End-to-end integration tests.
//
// Tests the complete flow: events → redundancy groups → lookup → penalty score.
// Also tests backward compatibility when Phase 7.3 data doesn't exist.
//
// Authority: docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { PromptEventRow } from '../database';
import { computeRedundancyGroups } from '../redundancy-detection';
import type { RedundancyGroupsData } from '../redundancy-detection';
import {
  buildRedundancyLookup,
  lookupRedundancy,
  lookupRedundancyInfo,
} from '../redundancy-lookup';
import type { RedundancyLookup, RedundancyInfo } from '../redundancy-lookup';

// ============================================================================
// HELPERS
// ============================================================================

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

function padSelections(terms: Record<string, string[]>): Record<string, string[]> {
  const padded = { ...terms };
  for (const [cat, vals] of Object.entries(FILLER_CATEGORIES)) {
    if (Object.keys(padded).length >= 4) break;
    if (!(cat in padded)) {
      padded[cat] = vals;
    }
  }
  return padded;
}

function makeEvent(opts: {
  tier?: number;
  terms: Record<string, string[]>;
  copied?: boolean;
  saved?: boolean;
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
      copied: opts.copied ?? true,
      saved: opts.saved ?? true,
      returnedWithin60s: false,
      reusedFromLibrary: false,
    },
    user_tier: null,
    account_age_days: null,
    created_at: new Date().toISOString(),
  };
}

/** High-outcome event: copied + saved = 0.60 weighted outcome */
function makeHigh(terms: Record<string, string[]>, tier = 2): PromptEventRow {
  return makeEvent({ tier, terms, copied: true, saved: true });
}

/**
 * Generate redundancy-friendly test data: two terms in the same category
 * that never co-occur, both with high outcomes.
 */
function generateRedundancyEvents(
  termA: string,
  termB: string,
  category: string,
  opts: { soloCount?: number; tier?: number } = {},
): PromptEventRow[] {
  const soloCount = opts.soloCount ?? 10;
  const tier = opts.tier ?? 2;
  return [
    ...Array.from({ length: soloCount }, () => makeHigh({ [category]: [termA] }, tier)),
    ...Array.from({ length: soloCount }, () => makeHigh({ [category]: [termB] }, tier)),
  ];
}

/**
 * Build a full pipeline: events → computeRedundancyGroups → buildRedundancyLookup.
 */
function buildPipeline(events: PromptEventRow[]): {
  data: RedundancyGroupsData | null;
  lookup: RedundancyLookup | null;
} {
  const data = computeRedundancyGroups(events);
  const lookup = buildRedundancyLookup(data);
  return { data, lookup };
}

// ============================================================================
// TESTS — Full pipeline: events → groups → lookup → score
// ============================================================================

describe('Redundancy Integration — full pipeline', () => {
  // ── 1. Two synonyms detected end-to-end ───────────────────────────────

  it('detects two synonymous terms and applies non-zero penalty', () => {
    const events = generateRedundancyEvents('cinematic lighting', 'dramatic lighting', 'lighting');

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    // If "cinematic lighting" is selected, "dramatic lighting" should get a penalty
    const score = lookupRedundancy('dramatic lighting', ['cinematic lighting'], 2, lookup);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  // ── 2. Non-redundant terms get zero score ─────────────────────────────

  it('returns zero for terms not in any redundancy group', () => {
    const events = generateRedundancyEvents('cinematic lighting', 'dramatic lighting', 'lighting');

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    // "unknown term" is not in any group
    const score = lookupRedundancy('unknown term', ['cinematic lighting'], 2, lookup);
    expect(score).toBe(0);
  });

  // ── 3. Different categories → no redundancy ───────────────────────────

  it('returns zero when terms are in different categories', () => {
    // Create events where two terms are in different categories
    const events = [
      ...Array.from({ length: 10 }, () => makeHigh({ lighting: ['golden hour'] })),
      ...Array.from({ length: 10 }, () => makeHigh({ style: ['oil painting'] })),
    ];

    const { lookup } = buildPipeline(events);

    const score = lookupRedundancy('oil painting', ['golden hour'], 2, lookup);
    expect(score).toBe(0);
  });

  // ── 4. Null lookup → zero (backward compat) ──────────────────────────

  it('returns zero when lookup is null (backward compatible)', () => {
    const score = lookupRedundancy('anything', ['something'], 2, null);
    expect(score).toBe(0);
  });

  // ── 5. Empty selectedTerms → zero ─────────────────────────────────────

  it('returns zero when no terms are selected', () => {
    const events = generateRedundancyEvents('term A', 'term B', 'lighting');
    const { lookup } = buildPipeline(events);

    const score = lookupRedundancy('term A', [], 2, lookup);
    expect(score).toBe(0);
  });
});

// ============================================================================
// TESTS — lookupRedundancyInfo
// ============================================================================

describe('Redundancy Integration — lookupRedundancyInfo', () => {
  // ── 6. Returns full group info ────────────────────────────────────────

  it('returns redundantWith, canonical, and groupMembers', () => {
    const events = [
      // "popular" has 20 solo events, "niche" has 10
      ...Array.from({ length: 20 }, () => makeHigh({ lighting: ['popular light'] })),
      ...Array.from({ length: 10 }, () => makeHigh({ lighting: ['niche light'] })),
    ];

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    const info: RedundancyInfo | null = lookupRedundancyInfo(
      'niche light',
      ['popular light'],
      2,
      lookup,
    );
    expect(info).not.toBeNull();
    expect(info!.redundantWith).toBe('popular light');
    expect(info!.canonical).toBe('popular light'); // highest usage
    expect(info!.groupMembers).toContain('popular light');
    expect(info!.groupMembers).toContain('niche light');
    expect(info!.redundancyScore).toBeGreaterThan(0);
  });

  // ── 7. Returns null when no redundancy ────────────────────────────────

  it('returns null for non-redundant terms', () => {
    const events = generateRedundancyEvents('term X', 'term Y', 'lighting');
    const { lookup } = buildPipeline(events);

    const info = lookupRedundancyInfo('unrelated term', ['term X'], 2, lookup);
    expect(info).toBeNull();
  });

  // ── 8. Returns null when lookup is null ───────────────────────────────

  it('returns null when lookup is null', () => {
    const info = lookupRedundancyInfo('a', ['b'], 2, null);
    expect(info).toBeNull();
  });
});

// ============================================================================
// TESTS — Tier-first → global fallback
// ============================================================================

describe('Redundancy Integration — tier fallback', () => {
  // ── 9. Tier-specific data used when available ─────────────────────────

  it('uses tier-specific data when available', () => {
    const events = generateRedundancyEvents('tier A', 'tier B', 'lighting', {
      tier: 2,
      soloCount: 10,
    });

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    // Should find via tier 2 map
    const score = lookupRedundancy('tier B', ['tier A'], 2, lookup);
    expect(score).toBeGreaterThan(0);
  });

  // ── 10. Falls back to global when tier has no data ────────────────────

  it('falls back to global when term not in tier-specific data', () => {
    // Create events split across tiers — each tier has only 5 solo events
    // (below threshold), but global has 10 (above threshold)
    const events = [
      ...generateRedundancyEvents('global A', 'global B', 'lighting', {
        tier: 1,
        soloCount: 5,
      }),
      ...generateRedundancyEvents('global A', 'global B', 'lighting', {
        tier: 2,
        soloCount: 5,
      }),
    ];

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    // Tier 3 has no data → should fall back to global
    const score = lookupRedundancy('global B', ['global A'], 3, lookup);
    expect(score).toBeGreaterThan(0);
  });

  // ── 11. Null tier → global only ───────────────────────────────────────

  it('uses global map when tier is null', () => {
    const events = generateRedundancyEvents('null tier A', 'null tier B', 'lighting', {
      soloCount: 10,
    });

    const { lookup } = buildPipeline(events);

    const score = lookupRedundancy('null tier B', ['null tier A'], null, lookup);
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS — buildRedundancyLookup
// ============================================================================

describe('Redundancy Integration — buildRedundancyLookup', () => {
  // ── 12. Null data → null lookup ───────────────────────────────────────

  it('returns null for null input', () => {
    expect(buildRedundancyLookup(null)).toBeNull();
    expect(buildRedundancyLookup(undefined)).toBeNull();
  });

  // ── 13. Lookup preserves event count ──────────────────────────────────

  it('preserves eventCount in lookup', () => {
    const events = generateRedundancyEvents('count A', 'count B', 'lighting');

    const { data, lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();
    expect(lookup!.eventCount).toBe(data!.eventCount);
  });

  // ── 14. Groups map populated correctly ────────────────────────────────

  it('populates groups map with canonical and members', () => {
    const events = generateRedundancyEvents('map A', 'map B', 'lighting');

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();
    expect(lookup!.groups.size).toBeGreaterThan(0);

    // Check first group has valid data
    const firstGroup = [...lookup!.groups.values()][0]!;
    expect(firstGroup.canonical).toBeTruthy();
    expect(firstGroup.members.length).toBeGreaterThanOrEqual(2);
    expect(firstGroup.meanRedundancy).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS — Edge cases
// ============================================================================

describe('Redundancy Integration — edge cases', () => {
  // ── 15. Self-reference → zero (option === selected) ───────────────────

  it('returns zero when option is the same as the selected term', () => {
    const events = generateRedundancyEvents('self A', 'self B', 'lighting');

    const { lookup } = buildPipeline(events);

    // Looking up "self A" against selectedTerms containing "self A"
    const score = lookupRedundancy('self A', ['self A'], 2, lookup);
    expect(score).toBe(0);
  });

  // ── 16. Transitive group: 3 members ───────────────────────────────────

  it('detects redundancy across transitive groups (A≈B, B≈C)', () => {
    // Three terms, each pair is detected as redundant
    const events = [
      ...Array.from({ length: 10 }, () => makeHigh({ lighting: ['light alpha'] })),
      ...Array.from({ length: 10 }, () => makeHigh({ lighting: ['light beta'] })),
      ...Array.from({ length: 10 }, () => makeHigh({ lighting: ['light gamma'] })),
    ];

    const { lookup } = buildPipeline(events);
    expect(lookup).not.toBeNull();

    // "light gamma" should be redundant with "light alpha"
    // even if they were never directly compared — they're in the same group
    const score = lookupRedundancy('light gamma', ['light alpha'], 2, lookup);
    expect(score).toBeGreaterThan(0);
  });
});
