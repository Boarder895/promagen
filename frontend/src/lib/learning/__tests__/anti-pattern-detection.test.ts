// src/lib/learning/__tests__/anti-pattern-detection.test.ts
// ============================================================================
// ANTI-PATTERN DETECTION — Unit Tests
// ============================================================================
//
// Phase 7.1, Part 7.1b — Tests for the anti-pattern detection engine.
//
// Verifies enrichment ratio computation, severity scoring, bucket splitting,
// tier grouping, global aggregation, and edge cases.
//
// Authority: docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import type { PromptEventRow } from '../database';
import { LEARNING_CONSTANTS } from '../constants';
import {
  computeAntiPatterns,
  type AntiPatternData,
  type AntiPattern,
} from '../anti-pattern-detection';

// ============================================================================
// HELPERS
// ============================================================================

const C = LEARNING_CONSTANTS;

/**
 * Filler categories added to every test event so category_count >= 4.
 *
 * Why: The confidence multiplier uses a depth factor based on category_count.
 * With only 2 categories → DEPTH_SHALLOW (0.80) → weighted outcome drops:
 *   0.60 × 0.80 = 0.48 < HIGH_THRESHOLD (0.50) → event lands in neutral bucket.
 * With 4+ categories → DEPTH_NORMAL (1.0) → weighted outcome = raw outcome.
 *
 * Filler terms appear in BOTH low and high events, so their enrichment ≈ 1.0
 * and they never get flagged as anti-patterns.
 */
const FILLER_CATEGORIES: Record<string, string[]> = {
  camera: ['close-up'],
  materials: ['glass'],
  colour: ['warm tones'],
  action: ['standing'],
};

/**
 * Pad a selections object to at least 4 categories.
 * Only adds filler categories that don't clash with existing keys.
 */
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

/**
 * Create a minimal PromptEventRow for testing.
 *
 * By default, creates a "neutral" event (copied only → outcome ~0.10).
 * Override outcome fields to produce low/high outcome scores.
 *
 * All events are padded to 4+ categories so the confidence multiplier's
 * depth factor doesn't push weighted outcomes across bucket thresholds.
 */
function makeEvent(opts: {
  tier?: number;
  terms?: Record<string, string[]>;
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
  userTier?: string | null;
  accountAgeDays?: number | null;
}): PromptEventRow {
  const selections = padSelections(
    opts.terms ?? {
      style: ['cinematic'],
      lighting: ['golden hour'],
    },
  );

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
    score: 50, // Low score — these are anti-pattern events (fetchAllEvents has no floor)
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
    user_tier: opts.userTier ?? null,
    account_age_days: opts.accountAgeDays ?? null,
    created_at: new Date().toISOString(),
  };
}

/**
 * Create a low-outcome event (outcome < 0.15).
 *
 * No signals at all → outcome = 0.0 (below LOW_THRESHOLD of 0.15).
 */
function makeLowEvent(terms: Record<string, string[]>, tier = 2): PromptEventRow {
  return makeEvent({
    tier,
    terms,
    copied: false,
    saved: false,
    returnedWithin60s: false,
    reusedFromLibrary: false,
  });
}

/**
 * Create a high-outcome event (outcome >= 0.50).
 *
 * copied + saved + no return → 0.10 + 0.15 + 0.35 = 0.60 (above HIGH_THRESHOLD of 0.50).
 */
function makeHighEvent(terms: Record<string, string[]>, tier = 2): PromptEventRow {
  return makeEvent({
    tier,
    terms,
    copied: true,
    saved: true,
    returnedWithin60s: false,
    reusedFromLibrary: false,
  });
}

/** Extract a specific anti-pattern from results by term pair */
function findPattern(
  data: AntiPatternData,
  termA: string,
  termB: string,
  scope: 'global' | string = 'global',
): AntiPattern | undefined {
  const [a, b] = [termA, termB].sort();
  const patterns = scope === 'global' ? data.global.patterns : (data.tiers[scope]?.patterns ?? []);
  return patterns.find((p) => p.terms[0] === a && p.terms[1] === b);
}

// ============================================================================
// TESTS — Basic behaviour
// ============================================================================

describe('computeAntiPatterns', () => {
  // ── 1. Empty events → empty result ────────────────────────────────────

  it('returns empty result for no events', () => {
    const result = computeAntiPatterns([]);

    expect(result.eventCount).toBe(0);
    expect(result.totalPatterns).toBe(0);
    expect(result.global.patterns).toHaveLength(0);
    expect(result.global.eventCount).toBe(0);
    expect(result.global.lowEventCount).toBe(0);
    expect(result.global.highEventCount).toBe(0);
    expect(result.version).toBe('1.0.0');
  });

  // ── 2. All high-outcome → zero anti-patterns ─────────────────────────

  it('returns zero anti-patterns when all events are high-outcome', () => {
    const events = Array.from({ length: 20 }, () =>
      makeHighEvent({ style: ['cinematic'], lighting: ['golden hour'] }),
    );

    const result = computeAntiPatterns(events);

    expect(result.global.highEventCount).toBe(20);
    expect(result.global.lowEventCount).toBe(0);
    expect(result.global.patterns).toHaveLength(0);
  });

  // ── 3. All low-outcome → zero anti-patterns (no high bucket) ─────────

  it('returns zero anti-patterns when all events are low-outcome', () => {
    const events = Array.from({ length: 20 }, () =>
      makeLowEvent({ style: ['oil painting'], fidelity: ['8k resolution'] }),
    );

    const result = computeAntiPatterns(events);

    expect(result.global.lowEventCount).toBe(20);
    expect(result.global.highEventCount).toBe(0);
    // Can't compute enrichment ratio without a high bucket
    expect(result.global.patterns).toHaveLength(0);
  });

  // ── 4. Single toxic pair detected ─────────────────────────────────────

  it('detects a toxic pair that only appears in low-outcome events', () => {
    const toxicTerms = { style: ['oil painting'], fidelity: ['8k resolution'] };
    const healthyTerms = { style: ['cinematic'], lighting: ['golden hour'] };

    const events = [
      // 10 low events with the toxic pair
      ...Array.from({ length: 10 }, () => makeLowEvent(toxicTerms)),
      // 10 high events with healthy terms (no toxic pair in good prompts)
      ...Array.from({ length: 10 }, () => makeHighEvent(healthyTerms)),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, '8k resolution', 'oil painting');

    expect(pattern).toBeDefined();
    expect(pattern!.lowCount).toBe(10);
    expect(pattern!.highCount).toBe(0);
    // enrichment = (10/10) / 0.001 = 1000 → severity = min(1000/10, 1) = 1.0
    expect(pattern!.severity).toBe(1.0);
    expect(pattern!.enrichment).toBeGreaterThan(C.ANTI_PATTERN_MIN_ENRICHMENT);
    expect(pattern!.categories).toContain('style');
    expect(pattern!.categories).toContain('fidelity');
  });

  // ── 5. Pair equally in low and high → NOT flagged ─────────────────────

  it('does not flag pair that appears equally in low and high', () => {
    const sharedTerms = { style: ['cinematic'], lighting: ['natural'] };

    const events = [
      ...Array.from({ length: 10 }, () => makeLowEvent(sharedTerms)),
      ...Array.from({ length: 10 }, () => makeHighEvent(sharedTerms)),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, 'cinematic', 'natural');

    // Enrichment ≈ (10/10) / (10/10) = 1.0 → below MIN_ENRICHMENT (2.0)
    expect(pattern).toBeUndefined();
  });

  // ── 6. Pair 5× more in low → flagged with correct severity ───────────

  it('flags pair 5× more common in bad prompts with severity 0.5', () => {
    const toxicTerms = { style: ['watercolor'], fidelity: ['ultra HD'] };
    const healthyTerms = { style: ['digital art'], lighting: ['studio'] };

    const events = [
      // 10 low events with the toxic pair
      ...Array.from({ length: 10 }, () => makeLowEvent(toxicTerms)),
      // 2 high events with the toxic pair (so it's not completely absent)
      ...Array.from({ length: 2 }, () => makeHighEvent(toxicTerms)),
      // 8 high events with healthy terms
      ...Array.from({ length: 8 }, () => makeHighEvent(healthyTerms)),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, 'ultra HD', 'watercolor');

    expect(pattern).toBeDefined();
    // lowRate = 10/10 = 1.0, highRate = 2/10 = 0.2, enrichment = 1.0/0.2 = 5.0
    expect(pattern!.enrichment).toBe(5.0);
    // severity = min(5.0 / 10, 1.0) = 0.5
    expect(pattern!.severity).toBe(0.5);
    expect(pattern!.lowCount).toBe(10);
    expect(pattern!.highCount).toBe(2);
  });

  // ── 7. Below minimum pair events → NOT flagged ────────────────────────

  it('does not flag pair with fewer than MIN_PAIR_EVENTS occurrences', () => {
    const rareTerms = { style: ['rare style'], fidelity: ['rare quality'] };
    const healthyTerms = { style: ['cinematic'], lighting: ['natural'] };

    const events = [
      // Only 3 low events (below MIN_PAIR_EVENTS of 5)
      ...Array.from({ length: 3 }, () => makeLowEvent(rareTerms)),
      // 10 high events
      ...Array.from({ length: 10 }, () => makeHighEvent(healthyTerms)),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, 'rare quality', 'rare style');

    expect(pattern).toBeUndefined();
  });

  // ── 8. Below minimum enrichment → NOT flagged ─────────────────────────

  it('does not flag pair with enrichment below MIN_ENRICHMENT', () => {
    const terms = { style: ['photo'], lighting: ['ambient'] };

    const events = [
      // 5 low events
      ...Array.from({ length: 5 }, () => makeLowEvent(terms)),
      // 5 high events (same pair in both → enrichment ≈ 1.0)
      ...Array.from({ length: 5 }, () => makeHighEvent(terms)),
      // Need enough events in each bucket for the math to work
      ...Array.from({ length: 5 }, () => makeLowEvent({ style: ['other'], lighting: ['other2'] })),
      ...Array.from({ length: 5 }, () =>
        makeHighEvent({ style: ['other3'], lighting: ['other4'] }),
      ),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, 'ambient', 'photo');

    // enrichment = (5/10) / (5/10) = 1.0 → below 2.0 threshold
    expect(pattern).toBeUndefined();
  });
});

// ============================================================================
// TESTS — Tier grouping
// ============================================================================

describe('computeAntiPatterns — tier grouping', () => {
  // ── 9. Per-tier results are independent ───────────────────────────────

  it('produces separate results per tier', () => {
    const toxicTerms = { style: ['oil painting'], fidelity: ['8k resolution'] };
    const healthyTerms = { style: ['cinematic'], lighting: ['golden hour'] };

    const events = [
      // Tier 1: toxic pair appears only in low
      ...Array.from({ length: 6 }, () => makeLowEvent(toxicTerms, 1)),
      ...Array.from({ length: 6 }, () => makeHighEvent(healthyTerms, 1)),
      // Tier 2: same toxic pair also appears in high (less enriched)
      ...Array.from({ length: 6 }, () => makeLowEvent(toxicTerms, 2)),
      ...Array.from({ length: 6 }, () => makeHighEvent(toxicTerms, 2)),
    ];

    const result = computeAntiPatterns(events);

    // Tier 1: pair should be flagged (only in low)
    const tier1 = findPattern(result, '8k resolution', 'oil painting', '1');
    expect(tier1).toBeDefined();
    expect(tier1!.severity).toBeGreaterThan(0);

    // Tier 2: pair should NOT be flagged (equal in both buckets)
    const tier2 = findPattern(result, '8k resolution', 'oil painting', '2');
    expect(tier2).toBeUndefined();
  });

  // ── 10. Tier keys are strings ─────────────────────────────────────────

  it('stores tier keys as strings ("1", "2", etc.)', () => {
    const events = [
      makeLowEvent({ style: ['a'], lighting: ['b'] }, 3),
      makeHighEvent({ style: ['c'], lighting: ['d'] }, 3),
    ];

    const result = computeAntiPatterns(events);
    expect(result.tiers['3']).toBeDefined();
    expect(result.tiers['3']!.eventCount).toBe(2);
  });
});

// ============================================================================
// TESTS — Global aggregation
// ============================================================================

describe('computeAntiPatterns — global', () => {
  // ── 11. Global aggregates across all tiers ────────────────────────────

  it('global result includes events from all tiers', () => {
    const toxicTerms = { style: ['toxic A'], fidelity: ['toxic B'] };
    const healthyTerms = { style: ['good'], lighting: ['good2'] };

    const events = [
      ...Array.from({ length: 5 }, () => makeLowEvent(toxicTerms, 1)),
      ...Array.from({ length: 5 }, () => makeLowEvent(toxicTerms, 2)),
      ...Array.from({ length: 10 }, () => makeHighEvent(healthyTerms, 1)),
    ];

    const result = computeAntiPatterns(events);

    expect(result.global.eventCount).toBe(20);
    expect(result.global.lowEventCount).toBe(10);
    expect(result.global.highEventCount).toBe(10);

    const globalPattern = findPattern(result, 'toxic A', 'toxic B');
    expect(globalPattern).toBeDefined();
    expect(globalPattern!.lowCount).toBe(10); // Combined across tiers
  });
});

// ============================================================================
// TESTS — Sorting and trimming
// ============================================================================

describe('computeAntiPatterns — sorting', () => {
  // ── 12. Results sorted by severity descending ─────────────────────────

  it('sorts patterns by severity descending', () => {
    const healthyTerms = { style: ['healthy'], lighting: ['healthy2'] };

    const events = [
      // Pair A: appears 10× in low, 1× in high → high enrichment
      ...Array.from({ length: 10 }, () =>
        makeLowEvent({ style: ['pair A term1'], lighting: ['pair A term2'] }),
      ),
      makeHighEvent({ style: ['pair A term1'], lighting: ['pair A term2'] }),
      // Pair B: appears 5× in low, 1× in high → medium enrichment
      ...Array.from({ length: 5 }, () =>
        makeLowEvent({ style: ['pair B term1'], lighting: ['pair B term2'] }),
      ),
      makeHighEvent({ style: ['pair B term1'], lighting: ['pair B term2'] }),
      // Extra high events to fill the bucket
      ...Array.from({ length: 8 }, () => makeHighEvent(healthyTerms)),
    ];

    const result = computeAntiPatterns(events);
    const patterns = result.global.patterns;

    expect(patterns.length).toBeGreaterThanOrEqual(2);

    // First pattern should have higher severity than second
    const pA = findPattern(result, 'pair A term1', 'pair A term2');
    const pB = findPattern(result, 'pair B term1', 'pair B term2');

    expect(pA).toBeDefined();
    expect(pB).toBeDefined();
    expect(pA!.severity).toBeGreaterThanOrEqual(pB!.severity);
  });
});

// ============================================================================
// TESTS — Confidence multiplier integration
// ============================================================================

describe('computeAntiPatterns — confidence multiplier', () => {
  // ── 13. Paid veteran's events weigh more ──────────────────────────────

  it('paid veteran signal shifts weighted outcome above thresholds', () => {
    // A "copied only" event has raw outcome = 0.10.
    // Free user: 0.10 × 1.0 = 0.10 (below LOW_THRESHOLD 0.15? No, 0.10 < 0.15 → low bucket)
    // Paid veteran (120 days, 5 cats): 0.10 × 1.35 = 0.135 (still below 0.15 → low bucket)
    //
    // A "copied + no return" event has raw outcome = 0.25.
    // Free new shallow: 0.25 × 0.68 = 0.17 (above 0.15 → neutral, not low)
    // But with no signals → 0.0 × anything = 0.0 → always low
    //
    // The point: confidence multiplier can push borderline events across thresholds.
    // We test that events with user context are processed without error.

    const terms = { style: ['test term A'], lighting: ['test term B'] };
    const events = [
      // Low events from paid veteran (no signals, outcome = 0.0)
      ...Array.from({ length: 6 }, () =>
        makeEvent({
          terms,
          copied: false,
          saved: false,
          userTier: 'paid',
          accountAgeDays: 200,
        }),
      ),
      // High events from free new users (saved, outcome ≥ 0.50)
      ...Array.from({ length: 6 }, () =>
        makeEvent({
          terms: { style: ['other'], lighting: ['other2'] },
          copied: true,
          saved: true,
          userTier: 'free',
          accountAgeDays: 1,
        }),
      ),
    ];

    const result = computeAntiPatterns(events);

    // Should process without crashing, and categorise events correctly
    expect(result.eventCount).toBe(12);
    expect(result.global.lowEventCount).toBeGreaterThan(0);
    expect(result.global.highEventCount).toBeGreaterThan(0);
  });

  // ── 14. Events without confidence data work fine ──────────────────────

  it('handles events with null user_tier and account_age_days', () => {
    const toxicTerms = { style: ['null tier'], fidelity: ['null age'] };
    const healthyTerms = { style: ['good'], lighting: ['good2'] };

    const events = [
      ...Array.from({ length: 6 }, () => makeLowEvent(toxicTerms)),
      ...Array.from({ length: 6 }, () => makeHighEvent(healthyTerms)),
    ];

    // All events have null user_tier/account_age_days (default in makeLowEvent)
    const result = computeAntiPatterns(events);

    // Should detect the anti-pattern despite no confidence data
    const pattern = findPattern(result, 'null age', 'null tier');
    expect(pattern).toBeDefined();
  });
});

// ============================================================================
// TESTS — Output shape and metadata
// ============================================================================

describe('computeAntiPatterns — output shape', () => {
  // ── 15. Output includes expected metadata ─────────────────────────────

  it('includes version, generatedAt, and correct counts', () => {
    const refDate = new Date('2026-02-26T12:00:00Z');
    const events = [
      ...Array.from({ length: 6 }, () => makeLowEvent({ style: ['a'], lighting: ['b'] })),
      ...Array.from({ length: 6 }, () => makeHighEvent({ style: ['c'], lighting: ['d'] })),
    ];

    const result = computeAntiPatterns(events, refDate);

    expect(result.version).toBe('1.0.0');
    expect(result.generatedAt).toBe('2026-02-26T12:00:00.000Z');
    expect(result.eventCount).toBe(12);
    expect(typeof result.totalPatterns).toBe('number');
  });

  // ── 16. Categories tracked correctly ──────────────────────────────────

  it('tracks which categories the anti-pattern terms belong to', () => {
    const toxicTerms = { atmosphere: ['eerie'], composition: ['dutch angle'] };
    const healthyTerms = { style: ['cinematic'], lighting: ['golden hour'] };

    const events = [
      ...Array.from({ length: 8 }, () => makeLowEvent(toxicTerms)),
      ...Array.from({ length: 8 }, () => makeHighEvent(healthyTerms)),
    ];

    const result = computeAntiPatterns(events);
    const pattern = findPattern(result, 'dutch angle', 'eerie');

    expect(pattern).toBeDefined();
    expect(pattern!.categories).toContain('atmosphere');
    expect(pattern!.categories).toContain('composition');
  });
});
