// src/lib/learning/__tests__/compression-intelligence.test.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Engine Unit Tests
// ============================================================================
//
// Phase 7.9, Part 7.9d — Tests for the core compression intelligence engine.
//
// Verifies computeOptimalLength, computeExpendableTerms,
// computePlatformLengthProfiles, analyseCompressionProfiles orchestrator,
// index builders, override integration, and edge cases.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.0.0
// Created: 2026-02-28
// ============================================================================

import type { PromptEventRow } from '../database';
import type { TermQualityScores, TierTermQuality } from '../term-quality-scoring';
import type { IterationInsightsData, TierIterationInsights } from '../iteration-tracking';
import type { RedundancyGroupsData, TierRedundancyGroups } from '../redundancy-detection';
import type { AntiPatternData, TierAntiPatterns } from '../anti-pattern-detection';
import {
  computeOptimalLength,
  computeExpendableTerms,
  computePlatformLengthProfiles,
  analyseCompressionProfiles,
  buildQualityIndex,
  buildWeakTermIndex,
  buildRedundancyIndex,
  buildAntiPatternIndex,
} from '../compression-intelligence';

// ============================================================================
// HELPERS
// ============================================================================

let _eventId = 0;

/** Create a minimal PromptEventRow for compression testing. */
function makeEvent(opts: {
  tier?: number;
  charLength?: number;
  platform?: string;
  terms?: Record<string, string[]>;
  outcome?: Record<string, boolean>;
}): PromptEventRow {
  const selections = opts.terms ?? {
    style: ['cinematic'],
    lighting: ['golden hour'],
  };

  const categoryCount = Object.keys(selections).filter(
    (k) => selections[k] && selections[k]!.length > 0,
  ).length;

  _eventId++;

  return {
    id: `evt_comp_${_eventId}`,
    session_id: `sess_comp_${_eventId}`,
    attempt_number: 1,
    selections,
    category_count: categoryCount,
    char_length: opts.charLength ?? 150,
    score: 80,
    score_factors: {},
    platform: opts.platform ?? 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: opts.outcome ?? {
      copied: true,
      saved: false,
      returnedWithin60s: false,
      reusedFromLibrary: false,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate N events at a specific char_length.
 * Good = copied + not returned (outcome ~0.5–0.7).
 * Bad  = returned + not copied (outcome lower).
 */
function makeEventsAtLength(
  count: number,
  charLength: number,
  good: boolean,
  opts: { tier?: number; platform?: string; terms?: Record<string, string[]> } = {},
): PromptEventRow[] {
  const outcome = good
    ? { copied: true, saved: false, returnedWithin60s: false, reusedFromLibrary: false }
    : { copied: false, saved: false, returnedWithin60s: true, reusedFromLibrary: false };

  return Array.from({ length: count }, () =>
    makeEvent({
      charLength,
      outcome,
      tier: opts.tier ?? 2,
      platform: opts.platform ?? 'midjourney',
      terms: opts.terms,
    }),
  );
}

/** Create minimal TermQualityScores for index builder testing. */
function makeQualityData(
  entries: { tier: string; term: string; score: number }[],
): TermQualityScores {
  const tiers: Record<string, TierTermQuality> = {};

  for (const e of entries) {
    if (!tiers[e.tier]) {
      tiers[e.tier] = { terms: {}, termCount: 0, averageScore: 50 };
    }
    tiers[e.tier]!.terms[e.term] = { score: e.score, eventCount: 50, trend: 0 };
    tiers[e.tier]!.termCount++;
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 1000,
    tiers,
    global: { terms: {}, termCount: 0, averageScore: 50 },
  };
}

/** Create minimal IterationInsightsData for index builder testing. */
function makeInsightsData(
  entries: { tier: string; term: string; replacementRate: number }[],
): IterationInsightsData {
  const tiers: Record<string, TierIterationInsights> = {};
  const emptyTier = (): TierIterationInsights => ({
    sessionCount: 100,
    multiAttemptCount: 50,
    avgIterations: 2.5,
    multiAttemptPercent: 0.5,
    categoryFixOrder: [],
    scoreJumps: [],
    weakTerms: [],
    finalAttemptCount: 50,
  });

  for (const e of entries) {
    if (!tiers[e.tier]) tiers[e.tier] = emptyTier();
    tiers[e.tier]!.weakTerms.push({
      term: e.term,
      category: 'style',
      replacedCount: Math.round(e.replacementRate * 100),
      retainedCount: Math.round((1 - e.replacementRate) * 100),
      replacementRate: e.replacementRate,
      weaknessScore: e.replacementRate,
      topReplacement: null,
    });
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 500,
    sessionCount: 100,
    totalWeakTerms: entries.length,
    tiers,
    global: emptyTier(),
  };
}

/** Create minimal RedundancyGroupsData. */
function makeRedundancyData(
  groups: { tier: string; canonical: string; members: string[] }[],
): RedundancyGroupsData {
  const tiers: Record<string, TierRedundancyGroups> = {};

  for (const g of groups) {
    if (!tiers[g.tier]) tiers[g.tier] = { eventCount: 500, groupCount: 0, groups: [] };
    tiers[g.tier]!.groups.push({
      id: `rg_${g.canonical}`,
      category: 'style',
      canonical: g.canonical,
      members: g.members,
      meanRedundancy: 0.8,
      totalUsage: 100,
      pairs: [],
    });
    tiers[g.tier]!.groupCount++;
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 500,
    totalGroups: groups.length,
    tiers,
    global: { eventCount: 500, groupCount: 0, groups: [] },
  };
}

/** Create minimal AntiPatternData. */
function makeAntiPatternData(
  patterns: { tier: string; terms: [string, string] }[],
): AntiPatternData {
  const tiers: Record<string, TierAntiPatterns> = {};

  for (const p of patterns) {
    if (!tiers[p.tier]) {
      tiers[p.tier] = { eventCount: 500, lowEventCount: 100, highEventCount: 400, patterns: [] };
    }
    tiers[p.tier]!.patterns.push({
      terms: p.terms,
      severity: 0.6,
      lowCount: 30,
      highCount: 5,
      enrichment: 6.0,
      categories: ['style', 'lighting'],
    });
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 500,
    totalPatterns: patterns.length,
    tiers,
    global: { eventCount: 500, lowEventCount: 100, highEventCount: 400, patterns: [] },
  };
}

// ============================================================================
// TESTS — Index Builders
// ============================================================================

describe('buildQualityIndex', () => {
  it('returns empty map for null data', () => {
    expect(buildQualityIndex(null).size).toBe(0);
  });

  it('indexes tier:term → score', () => {
    const idx = buildQualityIndex(
      makeQualityData([
        { tier: '2', term: 'cinematic', score: 75 },
        { tier: '2', term: 'moody', score: 30 },
      ]),
    );
    expect(idx.get('2:cinematic')).toBe(75);
    expect(idx.get('2:moody')).toBe(30);
  });
});

describe('buildWeakTermIndex', () => {
  it('returns empty map for null data', () => {
    expect(buildWeakTermIndex(null).size).toBe(0);
  });

  it('indexes tier:term → replacementRate', () => {
    const idx = buildWeakTermIndex(
      makeInsightsData([{ tier: '2', term: 'filler', replacementRate: 0.7 }]),
    );
    expect(idx.get('2:filler')).toBe(0.7);
  });
});

describe('buildRedundancyIndex', () => {
  it('returns empty set for null data', () => {
    expect(buildRedundancyIndex(null).size).toBe(0);
  });

  it('includes non-canonical members only', () => {
    const idx = buildRedundancyIndex(
      makeRedundancyData([
        { tier: '2', canonical: 'warm lighting', members: ['warm lighting', 'warm light', 'warm glow'] },
      ]),
    );
    expect(idx.has('2:warm lighting')).toBe(false); // canonical — NOT expendable
    expect(idx.has('2:warm light')).toBe(true);
    expect(idx.has('2:warm glow')).toBe(true);
  });
});

describe('buildAntiPatternIndex', () => {
  it('returns empty map for null data', () => {
    expect(buildAntiPatternIndex(null).size).toBe(0);
  });

  it('counts pair memberships per term', () => {
    const idx = buildAntiPatternIndex(
      makeAntiPatternData([
        { tier: '2', terms: ['dark', 'bright'] },
        { tier: '2', terms: ['dark', 'neon'] },
      ]),
    );
    expect(idx.get('2:dark')).toBe(2);
    expect(idx.get('2:bright')).toBe(1);
    expect(idx.get('2:neon')).toBe(1);
  });
});

// ============================================================================
// TESTS — computeOptimalLength
// ============================================================================

describe('computeOptimalLength', () => {
  it('finds the bucket with highest average outcome', () => {
    const events = [
      ...makeEventsAtLength(15, 110, false, { tier: 2 }), // bucket 100: bad
      ...makeEventsAtLength(15, 210, true, { tier: 2 }),   // bucket 200: good
      ...makeEventsAtLength(15, 310, false, { tier: 2 }),  // bucket 300: bad
    ];

    const profile = computeOptimalLength(events, 2, 20, 10, 0.15);
    expect(profile.optimalChars).toBe(200);
    expect(profile.tier).toBe(2);
    expect(profile.eventCount).toBe(45);
  });

  it('computes diminishing returns at or past the peak', () => {
    const events = [
      ...makeEventsAtLength(15, 110, false),
      ...makeEventsAtLength(15, 210, true),
      ...makeEventsAtLength(15, 310, true),
      ...makeEventsAtLength(15, 410, false),
    ];

    const profile = computeOptimalLength(events, 2, 20, 10, 0.15);
    expect(profile.diminishingReturnsAt).toBeGreaterThanOrEqual(profile.optimalChars);
  });

  it('returns 0 optimalChars when no buckets qualify', () => {
    // Only 3 events — below minEventsPerBucket of 10
    const events = makeEventsAtLength(3, 150, true);
    const profile = computeOptimalLength(events, 2, 20, 10, 0.15);
    expect(profile.optimalChars).toBe(0);
    expect(profile.lengthHistogram.length).toBe(0);
  });

  it('produces a sorted histogram', () => {
    const events = [
      ...makeEventsAtLength(12, 110, true),
      ...makeEventsAtLength(12, 210, true),
    ];

    const profile = computeOptimalLength(events, 2, 20, 10, 0.15);
    expect(profile.lengthHistogram.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < profile.lengthHistogram.length; i++) {
      expect(profile.lengthHistogram[i]!.bucket)
        .toBeGreaterThanOrEqual(profile.lengthHistogram[i - 1]!.bucket);
    }
  });
});

// ============================================================================
// TESTS — computeExpendableTerms
// ============================================================================

describe('computeExpendableTerms', () => {
  const terms = { style: ['bland-a', 'bland-b'], lighting: ['golden hour'] };
  const events = Array.from({ length: 20 }, () => makeEvent({ tier: 2, terms }));

  it('flags terms with multiple bad signals', () => {
    const result = computeExpendableTerms(
      events,
      2,
      new Map([['2:bland-a', 30]]),           // low quality → penalty 0.7
      new Map([['2:bland-a', 0.6]]),           // high replacement
      new Set(['2:bland-a']),                   // has better alternative
      new Map([['2:bland-a', 2]]),              // in 2 anti-pattern pairs
      5,    // minTermEvents
      0.40, // minExpendability
      200,  // maxPerTier
    );

    const entry = result.find((e) => e.term === 'bland-a');
    expect(entry).toBeDefined();
    expect(entry!.expendability).toBeGreaterThanOrEqual(0.40);
    expect(entry!.signals.replacementRate).toBe(0.6);
    expect(entry!.signals.hasRedundantAlternative).toBe(true);
  });

  it('requires at least 2 contributing signals', () => {
    // Only 1 signal (replacement rate) — not enough
    const result = computeExpendableTerms(
      events,
      2,
      new Map(),                     // no quality data
      new Map([['2:bland-a', 0.8]]), // replacement only
      new Set(),                      // no redundancy
      new Map(),                      // no anti-patterns
      5, 0.40, 200,
    );

    expect(result.find((e) => e.term === 'bland-a')).toBeUndefined();
  });

  it('skips terms below minTermEvents', () => {
    const rareEvents = [
      makeEvent({ tier: 2, terms: { style: ['rare-term'] } }),
      makeEvent({ tier: 2, terms: { style: ['rare-term'] } }),
    ];

    const result = computeExpendableTerms(
      rareEvents,
      2,
      new Map([['2:rare-term', 20]]),
      new Map([['2:rare-term', 0.9]]),
      new Set(['2:rare-term']),
      new Map([['2:rare-term', 3]]),
      5, 0.40, 200,
    );

    expect(result.find((e) => e.term === 'rare-term')).toBeUndefined();
  });

  it('skips override-protected terms regardless of signals', () => {
    // "cinematic" is in the override list
    const cinematicEvents = Array.from({ length: 20 }, () =>
      makeEvent({ tier: 2, terms: { style: ['cinematic'] } }),
    );

    const result = computeExpendableTerms(
      cinematicEvents,
      2,
      new Map([['2:cinematic', 10]]),
      new Map([['2:cinematic', 0.9]]),
      new Set(['2:cinematic']),
      new Map([['2:cinematic', 5]]),
      5, 0.40, 200,
    );

    expect(result.find((e) => e.term === 'cinematic')).toBeUndefined();
  });

  it('sorts results by expendability descending', () => {
    const multiTermEvents = Array.from({ length: 20 }, () =>
      makeEvent({ tier: 2, terms: { style: ['term-a', 'term-b', 'term-c'] } }),
    );

    const result = computeExpendableTerms(
      multiTermEvents,
      2,
      new Map([['2:term-a', 20], ['2:term-b', 40], ['2:term-c', 60]]),
      new Map([['2:term-a', 0.8], ['2:term-b', 0.5], ['2:term-c', 0.3]]),
      new Set(['2:term-a', '2:term-b', '2:term-c']),
      new Map(),
      5, 0.0, 200,
    );

    for (let i = 1; i < result.length; i++) {
      expect(result[i]!.expendability).toBeLessThanOrEqual(result[i - 1]!.expendability);
    }
  });

  it('respects maxPerTier cap', () => {
    const manyTermEvents = Array.from({ length: 20 }, () =>
      makeEvent({ tier: 2, terms: { style: ['a', 'b', 'c', 'd', 'e'] } }),
    );

    const allTerms = ['a', 'b', 'c', 'd', 'e'];
    const result = computeExpendableTerms(
      manyTermEvents,
      2,
      new Map(allTerms.map((t) => [`2:${t}`, 30])),
      new Map(allTerms.map((t) => [`2:${t}`, 0.6])),
      new Set(allTerms.map((t) => `2:${t}`)),
      new Map(),
      5, 0.0, 2, // cap at 2
    );

    expect(result.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================================
// TESTS — computePlatformLengthProfiles
// ============================================================================

describe('computePlatformLengthProfiles', () => {
  it('groups events by platform and filters by min events', () => {
    const events = [
      ...makeEventsAtLength(60, 200, true, { platform: 'midjourney' }),
      ...makeEventsAtLength(60, 250, true, { platform: 'leonardo' }),
      ...makeEventsAtLength(10, 180, true, { platform: 'dall-e-3' }), // below threshold
    ];

    const result = computePlatformLengthProfiles(events, 2, 200, 50, 20, 10, 0.15, 20);
    expect(result.qualifiedPlatforms).toBe(2);
    expect(result.totalPlatforms).toBe(3);
    expect(result.platforms.map((p) => p.platformId)).not.toContain('dall-e-3');
  });

  it('computes deltaFromTier correctly', () => {
    const events = makeEventsAtLength(60, 180, true, { platform: 'midjourney' });
    const result = computePlatformLengthProfiles(events, 2, 200, 50, 20, 5, 0.15, 20);

    if (result.platforms.length > 0) {
      expect(result.platforms[0]!.deltaFromTier).toBe(result.platforms[0]!.optimalChars - 200);
    }
  });

  it('sorts platforms by eventCount descending', () => {
    const events = [
      ...makeEventsAtLength(100, 200, true, { platform: 'platform-big' }),
      ...makeEventsAtLength(55, 200, true, { platform: 'platform-small' }),
    ];

    const result = computePlatformLengthProfiles(events, 2, 200, 50, 20, 5, 0.15, 20);
    expect(result.platforms[0]!.platformId).toBe('platform-big');
  });

  it('respects maxPlatforms cap', () => {
    const events = [
      ...makeEventsAtLength(60, 200, true, { platform: 'p1' }),
      ...makeEventsAtLength(60, 200, true, { platform: 'p2' }),
      ...makeEventsAtLength(60, 200, true, { platform: 'p3' }),
    ];

    const result = computePlatformLengthProfiles(events, 2, 200, 50, 20, 5, 0.15, 2);
    expect(result.qualifiedPlatforms).toBe(2);
  });
});

// ============================================================================
// TESTS — analyseCompressionProfiles (orchestrator)
// ============================================================================

describe('analyseCompressionProfiles', () => {
  it('produces all three profile types', () => {
    const events = makeEventsAtLength(120, 200, true, { tier: 2 });
    const result = analyseCompressionProfiles(events, null, null, null, null);

    expect(result.version).toBe('1.1.0');
    expect(result.totalEventsAnalysed).toBe(120);
    expect(result.lengthProfiles).toBeDefined();
    expect(result.expendableTerms).toBeDefined();
    expect(result.platformLengthProfiles).toBeDefined();
  });

  it('skips tiers with too few events', () => {
    const events = makeEventsAtLength(50, 200, true, { tier: 1 });
    const result = analyseCompressionProfiles(events, null, null, null, null);

    expect(result.lengthProfiles['1']).toBeUndefined();
  });

  it('handles null dependency data gracefully', () => {
    const events = makeEventsAtLength(120, 200, true, { tier: 2 });
    expect(() => {
      analyseCompressionProfiles(events, null, null, null, null);
    }).not.toThrow();
  });

  it('integrates dependency data when provided', () => {
    const termEvents = Array.from({ length: 120 }, () =>
      makeEvent({ tier: 2, terms: { style: ['filler-x'] } }),
    );

    const quality = makeQualityData([{ tier: '2', term: 'filler-x', score: 15 }]);
    const insights = makeInsightsData([{ tier: '2', term: 'filler-x', replacementRate: 0.8 }]);
    const redundancy = makeRedundancyData([
      { tier: '2', canonical: 'better-term', members: ['better-term', 'filler-x'] },
    ]);

    const result = analyseCompressionProfiles(termEvents, quality, insights, redundancy, null);
    const expendable = result.expendableTerms['2'] ?? [];
    const entry = expendable.find((e) => e.term === 'filler-x');
    expect(entry).toBeDefined();
    expect(entry!.expendability).toBeGreaterThanOrEqual(0.4);
  });

  it('processes multiple tiers independently', () => {
    const events = [
      ...makeEventsAtLength(120, 200, true, { tier: 1 }),
      ...makeEventsAtLength(120, 300, true, { tier: 3 }),
    ];

    const result = analyseCompressionProfiles(events, null, null, null, null);
    expect(result.lengthProfiles['1']).toBeDefined();
    expect(result.lengthProfiles['3']).toBeDefined();
    expect(result.lengthProfiles['1']!.tier).toBe(1);
    expect(result.lengthProfiles['3']!.tier).toBe(3);
  });

  it('returns empty profiles for empty events', () => {
    const result = analyseCompressionProfiles([], null, null, null, null);
    expect(result.totalEventsAnalysed).toBe(0);
    expect(Object.keys(result.lengthProfiles).length).toBe(0);
  });
});
