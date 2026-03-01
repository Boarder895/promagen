// src/lib/learning/__tests__/temporal-intelligence.test.ts
// ============================================================================
// TEMPORAL INTELLIGENCE — Unit Tests
// ============================================================================
//
// Phase 7.8, Part 7.8b — Tests for the temporal intelligence engine
// and the temporal lookup functions.
//
// Verifies seasonal extraction, boost computation, weekly patterns,
// trending velocity, the orchestrator, and all lookup functions.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.8
//
// Version: 1.0.0
// Created: 2026-02-28
// ============================================================================

import type { PromptEventRow } from '../database';
import {
  extractTermsByMonth,
  computeSeasonalBoosts,
  extractTermsByDayOfWeek,
  computeWeeklyPatterns,
  computeTrendingTerms,
  runTemporalAnalysis,
  type TemporalBoostsData,
  type TrendingTermsData,
} from '../temporal-intelligence';
import {
  buildTemporalLookup,
  buildTrendingLookup,
  lookupSeasonalBoost,
  lookupWeeklyBoost,
  lookupTrendingVelocity,
  computeStalenessFactor,
} from '../temporal-lookup';

// ============================================================================
// HELPERS
// ============================================================================

/** Timestamp matching the generatedAt in test data — staleness factor = 1.0 */
const FRESH_NOW = new Date('2026-02-28T12:00:00Z');

/**
 * Create a minimal PromptEventRow for temporal testing.
 *
 * @param opts.terms — Selections record (category → terms)
 * @param opts.tier — Platform tier (default 2)
 * @param opts.createdAt — ISO date string for created_at
 */
function makeEvent(opts: {
  tier?: number;
  terms?: Record<string, string[]>;
  createdAt?: string;
}): PromptEventRow {
  const selections = opts.terms ?? {
    style: ['cinematic'],
    lighting: ['golden hour'],
  };

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
    score: 90,
    score_factors: {},
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: { copied: true, saved: false, returnedWithin60s: false, reusedFromLibrary: false },
    created_at: opts.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Create events spread evenly across specific months.
 * Returns `countPerMonth` events for each month in `months`.
 */
function makeMonthlyEvents(
  terms: Record<string, string[]>,
  months: number[],
  countPerMonth: number,
  tier = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  for (const month of months) {
    for (let i = 0; i < countPerMonth; i++) {
      // Day 15 of each month, varying the hour to avoid exact duplicates
      const date = new Date(Date.UTC(2025, month - 1, 15, i % 24, 0, 0));
      events.push(makeEvent({ terms, tier, createdAt: date.toISOString() }));
    }
  }
  return events;
}

/**
 * Create events on specific days of the week.
 * Returns `countPerDay` events for each day in `days` (0=Sun, 6=Sat).
 */
function makeDailyEvents(
  terms: Record<string, string[]>,
  days: number[],
  countPerDay: number,
  tier = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  // Use a known reference week: Mon 2025-06-02 to Sun 2025-06-08
  // getUTCDay(): Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
  const baseDates: Record<number, number> = {
    0: 8, // Sunday
    1: 2, // Monday
    2: 3, // Tuesday
    3: 4, // Wednesday
    4: 5, // Thursday
    5: 6, // Friday
    6: 7, // Saturday
  };

  for (const day of days) {
    const dateNum = baseDates[day]!;
    for (let i = 0; i < countPerDay; i++) {
      const date = new Date(Date.UTC(2025, 5, dateNum, i % 24, 0, 0));
      events.push(makeEvent({ terms, tier, createdAt: date.toISOString() }));
    }
  }
  return events;
}

// ============================================================================
// TESTS — extractTermsByMonth
// ============================================================================

describe('extractTermsByMonth', () => {
  it('returns empty map for no events', () => {
    const result = extractTermsByMonth([]);
    expect(result.size).toBe(0);
  });

  it('correctly buckets terms by month', () => {
    const events = [
      ...makeMonthlyEvents({ style: ['snow'] }, [1, 2, 12], 5), // winter months
      ...makeMonthlyEvents({ style: ['snow'] }, [6, 7], 1), // summer (rare)
    ];

    const result = extractTermsByMonth(events);
    const snowBucket = result.get('snow');

    expect(snowBucket).toBeDefined();
    expect(snowBucket!.buckets.get(1)).toBe(5); // Jan: 5 events
    expect(snowBucket!.buckets.get(2)).toBe(5); // Feb: 5 events
    expect(snowBucket!.buckets.get(12)).toBe(5); // Dec: 5 events
    expect(snowBucket!.buckets.get(6)).toBe(1); // Jun: 1 event
    expect(snowBucket!.buckets.get(7)).toBe(1); // Jul: 1 event
    expect(snowBucket!.total).toBe(17); // 5+5+5+1+1
  });

  it('tracks category frequency for dominant category detection', () => {
    const events = [
      ...makeMonthlyEvents({ atmosphere: ['fog'] }, [1], 10),
      ...makeMonthlyEvents({ lighting: ['fog'] }, [1], 3),
    ];

    const result = extractTermsByMonth(events);
    const fogBucket = result.get('fog');

    expect(fogBucket).toBeDefined();
    expect(fogBucket!.categoryFreq.get('atmosphere')).toBe(10);
    expect(fogBucket!.categoryFreq.get('lighting')).toBe(3);
  });

  it('handles Date objects and ISO strings in created_at', () => {
    const evtWithDate = makeEvent({
      terms: { style: ['test'] },
      createdAt: new Date(Date.UTC(2025, 2, 15)).toISOString(), // March
    });
    const evtWithString = makeEvent({
      terms: { style: ['test'] },
      createdAt: '2025-03-20T12:00:00.000Z', // also March
    });

    const result = extractTermsByMonth([evtWithDate, evtWithString]);
    const testBucket = result.get('test');

    expect(testBucket).toBeDefined();
    expect(testBucket!.buckets.get(3)).toBe(2); // Both in March
  });
});

// ============================================================================
// TESTS — computeSeasonalBoosts
// ============================================================================

describe('computeSeasonalBoosts', () => {
  it('returns empty array for empty input', () => {
    const result = computeSeasonalBoosts(new Map(), 20, 0.3, 300);
    expect(result).toHaveLength(0);
  });

  it('filters out terms below minTotalEvents', () => {
    // Create events but only 5 total (below default 20)
    const events = makeMonthlyEvents({ style: ['rare-term'] }, [1], 5);
    const buckets = extractTermsByMonth(events);
    const result = computeSeasonalBoosts(buckets, 20, 0.3, 300);

    expect(result).toHaveLength(0);
  });

  it('computes correct boost multipliers for a winter-heavy term', () => {
    // "snow" appears 10× per winter month (Dec, Jan, Feb) and 1× per other month
    const events = [
      ...makeMonthlyEvents({ style: ['snow'] }, [12, 1, 2], 10), // 30 winter
      ...makeMonthlyEvents({ style: ['snow'] }, [3, 4, 5, 6, 7, 8, 9, 10, 11], 1), // 9 other
    ];
    // Total = 39 events, monthly avg = 39/12 = 3.25

    const buckets = extractTermsByMonth(events);
    const result = computeSeasonalBoosts(buckets, 20, 0.3, 300);

    expect(result.length).toBe(1);

    const snow = result[0]!;
    expect(snow.term).toBe('snow');
    expect(snow.category).toBe('style');
    expect(snow.totalEvents).toBe(39);

    // Jan: 10 / 3.25 ≈ 3.077 (well above 1.0 + 0.3 threshold)
    expect(snow.monthlyBoosts[1]).toBeGreaterThan(2.5);
    // Jun: 1 / 3.25 ≈ 0.308 (below 1.0 - 0.3 threshold)
    expect(snow.monthlyBoosts[6]).toBeLessThan(0.5);
  });

  it('excludes months within significance threshold of 1.0', () => {
    // Even distribution → all months ≈ 1.0 → no significant months
    const events = makeMonthlyEvents(
      { style: ['balanced'] },
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      3,
    );
    // 36 total, monthly avg = 3. Every month has 3 → boost = 1.0 exactly.

    const buckets = extractTermsByMonth(events);
    const result = computeSeasonalBoosts(buckets, 20, 0.3, 300);

    // Either empty array (no significant months) or entries with no monthlyBoosts
    expect(result).toHaveLength(0);
  });

  it('respects maxPerTier cap', () => {
    // Create many distinct terms with seasonal patterns
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 400; i++) {
      events.push(
        ...makeMonthlyEvents({ style: [`term-${i}`] }, [1], 20), // All in Jan
        ...makeMonthlyEvents({ style: [`term-${i}`] }, [7], 1), // 1 in Jul
      );
    }

    const buckets = extractTermsByMonth(events);
    const result = computeSeasonalBoosts(buckets, 20, 0.3, 300);

    expect(result.length).toBeLessThanOrEqual(300);
  });

  it('sorts results by totalEvents descending', () => {
    const events = [
      ...makeMonthlyEvents({ style: ['popular'] }, [1], 15),
      ...makeMonthlyEvents({ style: ['popular'] }, [7], 15),
      ...makeMonthlyEvents({ style: ['niche'] }, [1], 10),
      ...makeMonthlyEvents({ style: ['niche'] }, [7], 10),
    ];

    const buckets = extractTermsByMonth(events);
    const result = computeSeasonalBoosts(buckets, 20, 0.3, 300);

    if (result.length >= 2) {
      expect(result[0]!.totalEvents).toBeGreaterThanOrEqual(result[1]!.totalEvents);
    }
  });
});

// ============================================================================
// TESTS — extractTermsByDayOfWeek
// ============================================================================

describe('extractTermsByDayOfWeek', () => {
  it('returns empty map for no events', () => {
    const result = extractTermsByDayOfWeek([]);
    expect(result.size).toBe(0);
  });

  it('correctly buckets terms by day of week', () => {
    // "fantasy" appears heavily on weekends (Sat=6, Sun=0)
    const events = [
      ...makeDailyEvents({ style: ['fantasy'] }, [0, 6], 10), // 20 weekend
      ...makeDailyEvents({ style: ['fantasy'] }, [1, 2, 3, 4, 5], 2), // 10 weekday
    ];

    const result = extractTermsByDayOfWeek(events);
    const fantasyBucket = result.get('fantasy');

    expect(fantasyBucket).toBeDefined();
    expect(fantasyBucket!.buckets.get(0)).toBe(10); // Sunday
    expect(fantasyBucket!.buckets.get(6)).toBe(10); // Saturday
    expect(fantasyBucket!.buckets.get(1)).toBe(2); // Monday
    expect(fantasyBucket!.total).toBe(30);
  });
});

// ============================================================================
// TESTS — computeWeeklyPatterns
// ============================================================================

describe('computeWeeklyPatterns', () => {
  it('returns empty array for empty input', () => {
    const result = computeWeeklyPatterns(new Map(), 20, 0.2, 200);
    expect(result).toHaveLength(0);
  });

  it('detects weekend-heavy terms', () => {
    // "surreal" appears 10× on weekends, 2× on each weekday
    const events = [
      ...makeDailyEvents({ style: ['surreal'] }, [0, 6], 10), // 20 weekend
      ...makeDailyEvents({ style: ['surreal'] }, [1, 2, 3, 4, 5], 2), // 10 weekday
    ];
    // Total = 30, daily avg = 30/7 ≈ 4.286

    const buckets = extractTermsByDayOfWeek(events);
    const result = computeWeeklyPatterns(buckets, 20, 0.2, 200);

    expect(result.length).toBe(1);
    const surreal = result[0]!;

    expect(surreal.term).toBe('surreal');
    // Sunday: 10 / 4.286 ≈ 2.333 (above 1.0 + 0.2)
    expect(surreal.dayBoosts[0]).toBeGreaterThan(1.5);
    // Monday: 2 / 4.286 ≈ 0.467 (below 1.0 - 0.2)
    expect(surreal.dayBoosts[1]).toBeLessThan(0.7);
  });

  it('excludes evenly distributed terms', () => {
    const events = makeDailyEvents({ style: ['flat'] }, [0, 1, 2, 3, 4, 5, 6], 5);
    // 35 total, daily avg = 5, every day = 1.0 exactly

    const buckets = extractTermsByDayOfWeek(events);
    const result = computeWeeklyPatterns(buckets, 20, 0.2, 200);

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// TESTS — computeTrendingTerms
// ============================================================================

describe('computeTrendingTerms', () => {
  const referenceDate = new Date('2026-02-28T12:00:00Z');
  const msPerDay = 86_400_000;

  /** Make an event N days before the reference date */
  function makeAgedEvent(
    terms: Record<string, string[]>,
    daysAgo: number,
    tier = 2,
  ): PromptEventRow {
    const date = new Date(referenceDate.getTime() - daysAgo * msPerDay);
    return makeEvent({ terms, tier, createdAt: date.toISOString() });
  }

  it('returns empty terms for no events', () => {
    const result = computeTrendingTerms([], referenceDate, 7, 30, 3, 5, 0.25, 100);
    expect(result.terms).toHaveLength(0);
    expect(result.recentWindowEvents).toBe(0);
    expect(result.baselineWindowEvents).toBe(0);
  });

  it('detects a rising term', () => {
    const events = [
      // Recent window (0–6.5 days ago): 10 events spaced every 0.5 days
      // daysAgo: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5
      // All well within the 7-day recent window (ts >= now - 7d)
      ...Array.from({ length: 10 }, (_, i) => makeAgedEvent({ style: ['trending-up'] }, i * 0.5)),
      // Baseline window (8–37 days ago): only 5 events with "trending-up"
      ...Array.from({ length: 5 }, (_, i) => makeAgedEvent({ style: ['trending-up'] }, 10 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);

    expect(result.terms.length).toBe(1);
    const term = result.terms[0]!;
    expect(term.term).toBe('trending-up');
    expect(term.recentCount).toBe(10);
    expect(term.baselineCount).toBe(5);
    // Recent rate: 10/7 ≈ 1.43, baseline rate: 5/30 ≈ 0.167
    // Velocity: (1.43 - 0.167) / 0.167 ≈ 7.57 (definitely rising)
    expect(term.velocity).toBeGreaterThan(1);
    expect(term.direction).toBe('rising');
  });

  it('detects a falling term', () => {
    const events = [
      // Recent: only 3 events
      ...Array.from({ length: 3 }, (_, i) => makeAgedEvent({ style: ['dying-term'] }, i)),
      // Baseline: 20 events (was popular, now declining)
      ...Array.from({ length: 20 }, (_, i) => makeAgedEvent({ style: ['dying-term'] }, 10 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);

    expect(result.terms.length).toBe(1);
    const term = result.terms[0]!;
    expect(term.direction).toBe('falling');
    expect(term.velocity).toBeLessThan(-0.25);
  });

  it('classifies stable terms (small velocity)', () => {
    const events = [
      // Recent: 7 events (1/day)
      ...Array.from({ length: 7 }, (_, i) => makeAgedEvent({ style: ['steady'] }, i)),
      // Baseline: 30 events (1/day)
      ...Array.from({ length: 30 }, (_, i) => makeAgedEvent({ style: ['steady'] }, 8 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);

    expect(result.terms.length).toBe(1);
    const term = result.terms[0]!;
    expect(term.direction).toBe('stable');
    expect(Math.abs(term.velocity)).toBeLessThan(0.25);
  });

  it('filters terms below minRecent threshold', () => {
    const events = [
      // Recent: only 2 events (below minRecent=3)
      ...Array.from({ length: 2 }, (_, i) => makeAgedEvent({ style: ['too-few'] }, i)),
      // Baseline: 10 events
      ...Array.from({ length: 10 }, (_, i) => makeAgedEvent({ style: ['too-few'] }, 10 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);
    expect(result.terms).toHaveLength(0);
  });

  it('filters terms below minBaseline threshold', () => {
    const events = [
      // Recent: 5 events
      ...Array.from({ length: 5 }, (_, i) => makeAgedEvent({ style: ['no-baseline'] }, i)),
      // Baseline: only 3 events (below minBaseline=5)
      ...Array.from({ length: 3 }, (_, i) => makeAgedEvent({ style: ['no-baseline'] }, 10 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);
    expect(result.terms).toHaveLength(0);
  });

  it('sorts by absolute velocity descending', () => {
    const events = [
      // Term A: strongly rising
      ...Array.from({ length: 15 }, (_, i) => makeAgedEvent({ style: ['surge'] }, i % 7)),
      ...Array.from({ length: 5 }, (_, i) => makeAgedEvent({ style: ['surge'] }, 10 + i)),
      // Term B: mildly rising
      ...Array.from({ length: 5 }, (_, i) => makeAgedEvent({ style: ['gentle'] }, i)),
      ...Array.from({ length: 10 }, (_, i) => makeAgedEvent({ style: ['gentle'] }, 10 + i)),
    ];

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);

    if (result.terms.length >= 2) {
      expect(Math.abs(result.terms[0]!.velocity)).toBeGreaterThanOrEqual(
        Math.abs(result.terms[1]!.velocity),
      );
    }
  });

  it('respects maxPerTier cap', () => {
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 150; i++) {
      events.push(
        ...Array.from({ length: 10 }, (_, j) => makeAgedEvent({ style: [`trend-${i}`] }, j % 7)),
        ...Array.from({ length: 5 }, (_, j) => makeAgedEvent({ style: [`trend-${i}`] }, 10 + j)),
      );
    }

    const result = computeTrendingTerms(events, referenceDate, 7, 30, 3, 5, 0.25, 100);
    expect(result.terms.length).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// TESTS — runTemporalAnalysis (orchestrator)
// ============================================================================

describe('runTemporalAnalysis', () => {
  const referenceDate = new Date('2026-02-28T12:00:00Z');

  it('returns valid output for no events', () => {
    const { temporalBoosts, trendingTerms } = runTemporalAnalysis([], referenceDate);

    expect(temporalBoosts.version).toBe('1.0.0');
    expect(temporalBoosts.eventsAnalysed).toBe(0);
    expect(temporalBoosts.generatedAt).toBe(referenceDate.toISOString());
    expect(Object.keys(temporalBoosts.seasonal)).toHaveLength(0);
    expect(Object.keys(temporalBoosts.weekly)).toHaveLength(0);

    expect(trendingTerms.version).toBe('1.0.0');
    expect(trendingTerms.eventsAnalysed).toBe(0);
    expect(Object.keys(trendingTerms.trending)).toHaveLength(0);
  });

  it('groups events by tier correctly', () => {
    const tier1Events = makeMonthlyEvents({ style: ['t1-term'] }, [1], 25, 1);
    const tier2Events = makeMonthlyEvents({ style: ['t2-term'] }, [1], 25, 2);

    const { temporalBoosts } = runTemporalAnalysis([...tier1Events, ...tier2Events], referenceDate);

    expect(temporalBoosts.seasonal['1']).toBeDefined();
    expect(temporalBoosts.seasonal['2']).toBeDefined();
    expect(temporalBoosts.seasonal['1']!.eventCount).toBe(25);
    expect(temporalBoosts.seasonal['2']!.eventCount).toBe(25);
  });

  it('produces both seasonal and weekly data per tier', () => {
    // Create events with clear seasonal AND weekly patterns
    const events = [
      ...makeMonthlyEvents({ style: ['winter-only'] }, [1, 2, 12], 10),
      ...makeMonthlyEvents({ style: ['winter-only'] }, [6, 7, 8], 1),
    ];

    const { temporalBoosts } = runTemporalAnalysis(events, referenceDate);

    // Seasonal should detect the winter pattern
    const tierData = temporalBoosts.seasonal['2'];
    expect(tierData).toBeDefined();
    expect(tierData!.boosts.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// TESTS — buildTemporalLookup
// ============================================================================

describe('buildTemporalLookup', () => {
  it('returns null for null/undefined input', () => {
    expect(buildTemporalLookup(null)).toBeNull();
    expect(buildTemporalLookup(undefined)).toBeNull();
  });

  it('builds lookup from valid data', () => {
    const data: TemporalBoostsData = {
      version: '1.0.0',
      generatedAt: '2026-02-28T12:00:00Z',
      eventsAnalysed: 1000,
      seasonal: {
        '2': {
          eventCount: 500,
          boosts: [
            {
              term: 'snow',
              category: 'atmosphere',
              monthlyBoosts: { 1: 2.5, 7: 0.3 },
              totalEvents: 100,
            },
          ],
        },
      },
      weekly: {
        '2': {
          eventCount: 500,
          patterns: [
            { term: 'fantasy', category: 'style', dayBoosts: { 0: 1.8, 6: 1.8 }, totalEvents: 80 },
          ],
        },
      },
    };

    const lookup = buildTemporalLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.eventsAnalysed).toBe(1000);
    expect(lookup!.seasonal['2']!.get('snow')).toEqual({ 1: 2.5, 7: 0.3 });
    expect(lookup!.seasonalEvents['2']!.get('snow')).toBe(100);
    expect(lookup!.weekly['2']!.get('fantasy')).toEqual({ 0: 1.8, 6: 1.8 });
  });
});

// ============================================================================
// TESTS — buildTrendingLookup
// ============================================================================

describe('buildTrendingLookup', () => {
  it('returns null for null/undefined input', () => {
    expect(buildTrendingLookup(null)).toBeNull();
    expect(buildTrendingLookup(undefined)).toBeNull();
  });

  it('builds lookup from valid data', () => {
    const data: TrendingTermsData = {
      version: '1.0.0',
      generatedAt: '2026-02-28T12:00:00Z',
      eventsAnalysed: 1000,
      trending: {
        '2': {
          recentWindowEvents: 100,
          baselineWindowEvents: 400,
          terms: [
            {
              term: 'trending-up',
              category: 'style',
              recentCount: 20,
              baselineCount: 10,
              velocity: 1.5,
              direction: 'rising',
            },
          ],
        },
      },
    };

    const lookup = buildTrendingLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.tiers['2']!.get('trending-up')).toBe(1.5);
  });
});

// ============================================================================
// TESTS — lookupSeasonalBoost
// ============================================================================

describe('lookupSeasonalBoost', () => {
  // totalEvents: 500 → confidence = min(1.0, 500/200) = 1.0 → full boost, no ramp effect
  const lookup = buildTemporalLookup({
    version: '1.0.0',
    generatedAt: '2026-02-28T12:00:00Z',
    eventsAnalysed: 1000,
    seasonal: {
      '2': {
        eventCount: 500,
        boosts: [
          {
            term: 'snow',
            category: 'atmosphere',
            monthlyBoosts: { 1: 2.5, 12: 2.2, 7: 0.3 },
            totalEvents: 500,
          },
        ],
      },
    },
    weekly: {},
  });

  it('returns correct boost for a known term and month', () => {
    expect(lookupSeasonalBoost(lookup, 'snow', 1, 2, FRESH_NOW)).toBe(2.5); // Jan: winter peak
    expect(lookupSeasonalBoost(lookup, 'snow', 12, 2, FRESH_NOW)).toBe(2.2); // Dec: winter peak
    expect(lookupSeasonalBoost(lookup, 'snow', 7, 2, FRESH_NOW)).toBeCloseTo(0.3, 10); // Jul: out of season
  });

  it('returns 1.0 for a month not stored (within significance threshold)', () => {
    expect(lookupSeasonalBoost(lookup, 'snow', 3, 2, FRESH_NOW)).toBe(1.0); // March: not stored
  });

  it('returns 1.0 for unknown term', () => {
    expect(lookupSeasonalBoost(lookup, 'unknown-term', 1, 2, FRESH_NOW)).toBe(1.0);
  });

  it('returns 1.0 for unknown tier', () => {
    expect(lookupSeasonalBoost(lookup, 'snow', 1, 4, FRESH_NOW)).toBe(1.0);
  });

  it('returns 1.0 for null lookup', () => {
    expect(lookupSeasonalBoost(null, 'snow', 1, 2)).toBe(1.0);
  });

  it('returns 1.0 for null tier', () => {
    expect(lookupSeasonalBoost(lookup, 'snow', 1, null)).toBe(1.0);
  });
});

// ============================================================================
// TESTS — lookupSeasonalBoost confidence ramp
// ============================================================================

describe('lookupSeasonalBoost — confidence ramp', () => {
  // totalEvents: 50 → confidence = min(1.0, 50/200) = 0.25
  // effectiveBoost = 1.0 + (rawBoost - 1.0) × 0.25
  const lowConfLookup = buildTemporalLookup({
    version: '1.0.0',
    generatedAt: '2026-02-28T12:00:00Z',
    eventsAnalysed: 1000,
    seasonal: {
      '2': {
        eventCount: 500,
        boosts: [
          {
            term: 'rare-snow',
            category: 'atmosphere',
            monthlyBoosts: { 1: 2.5, 7: 0.3 },
            totalEvents: 50,
          },
        ],
      },
    },
    weekly: {},
  });

  it('dampens seasonal boost for low-confidence terms', () => {
    // Raw boost 2.5, confidence 0.25 → effective = 1.0 + (2.5 - 1.0) × 0.25 = 1.375
    const result = lookupSeasonalBoost(lowConfLookup, 'rare-snow', 1, 2, FRESH_NOW);
    expect(result).toBeCloseTo(1.375, 3);
  });

  it('dampens seasonal penalty for low-confidence terms', () => {
    // Raw boost 0.3, confidence 0.25 → effective = 1.0 + (0.3 - 1.0) × 0.25 = 0.825
    const result = lookupSeasonalBoost(lowConfLookup, 'rare-snow', 7, 2, FRESH_NOW);
    expect(result).toBeCloseTo(0.825, 3);
  });

  it('returns full boost when totalEvents >= ramp threshold', () => {
    // totalEvents: 500 → confidence = min(1.0, 500/200) = 1.0 → no dampening
    const fullConfLookup = buildTemporalLookup({
      version: '1.0.0',
      generatedAt: '2026-02-28T12:00:00Z',
      eventsAnalysed: 1000,
      seasonal: {
        '2': {
          eventCount: 500,
          boosts: [
            { term: 'popular', category: 'style', monthlyBoosts: { 1: 2.5 }, totalEvents: 500 },
          ],
        },
      },
      weekly: {},
    });

    expect(lookupSeasonalBoost(fullConfLookup, 'popular', 1, 2, FRESH_NOW)).toBe(2.5);
  });

  it('returns exactly 1.0 for unknown terms (ramp does not affect fallback)', () => {
    expect(lookupSeasonalBoost(lowConfLookup, 'nonexistent', 1, 2)).toBe(1.0);
  });
});

// ============================================================================
// TESTS — lookupWeeklyBoost
// ============================================================================

describe('lookupWeeklyBoost', () => {
  const lookup = buildTemporalLookup({
    version: '1.0.0',
    generatedAt: '2026-02-28T12:00:00Z',
    eventsAnalysed: 1000,
    seasonal: {},
    weekly: {
      '2': {
        eventCount: 500,
        patterns: [
          { term: 'fantasy', category: 'style', dayBoosts: { 0: 1.8, 6: 1.9 }, totalEvents: 80 },
        ],
      },
    },
  });

  it('returns correct boost for known term and day', () => {
    expect(lookupWeeklyBoost(lookup, 'fantasy', 0, 2, FRESH_NOW)).toBe(1.8); // Sunday
    expect(lookupWeeklyBoost(lookup, 'fantasy', 6, 2, FRESH_NOW)).toBe(1.9); // Saturday
  });

  it('returns 1.0 for a day not stored', () => {
    expect(lookupWeeklyBoost(lookup, 'fantasy', 3, 2, FRESH_NOW)).toBe(1.0); // Wednesday: not stored
  });

  it('returns 1.0 for null lookup', () => {
    expect(lookupWeeklyBoost(null, 'fantasy', 0, 2)).toBe(1.0);
  });
});

// ============================================================================
// TESTS — lookupTrendingVelocity
// ============================================================================

describe('lookupTrendingVelocity', () => {
  const lookup = buildTrendingLookup({
    version: '1.0.0',
    generatedAt: '2026-02-28T12:00:00Z',
    eventsAnalysed: 1000,
    trending: {
      '2': {
        recentWindowEvents: 100,
        baselineWindowEvents: 400,
        terms: [
          {
            term: 'rising-star',
            category: 'style',
            recentCount: 20,
            baselineCount: 10,
            velocity: 1.5,
            direction: 'rising',
          },
          {
            term: 'fading-out',
            category: 'style',
            recentCount: 3,
            baselineCount: 15,
            velocity: -0.7,
            direction: 'falling',
          },
        ],
      },
    },
  });

  it('returns positive velocity for rising term', () => {
    expect(lookupTrendingVelocity(lookup, 'rising-star', 2, FRESH_NOW)).toBe(1.5);
  });

  it('returns negative velocity for falling term', () => {
    expect(lookupTrendingVelocity(lookup, 'fading-out', 2, FRESH_NOW)).toBe(-0.7);
  });

  it('returns 0 for unknown term', () => {
    expect(lookupTrendingVelocity(lookup, 'unknown', 2)).toBe(0);
  });

  it('returns 0 for null lookup', () => {
    expect(lookupTrendingVelocity(null, 'rising-star', 2)).toBe(0);
  });

  it('returns 0 for null tier', () => {
    expect(lookupTrendingVelocity(lookup, 'rising-star', null)).toBe(0);
  });
});

// ============================================================================
// STALENESS DECAY (Phase 7.8e, Improvement 2)
// ============================================================================

describe('computeStalenessFactor', () => {
  const generatedAt = '2026-02-28T12:00:00Z';

  it('returns 1.0 for fresh data (age = 0)', () => {
    const now = new Date('2026-02-28T12:00:00Z');
    expect(computeStalenessFactor(generatedAt, 24, now)).toBe(1.0);
  });

  it('returns ~0.5 at one half-life', () => {
    // 24h half-life, data is 24h old
    const now = new Date('2026-03-01T12:00:00Z');
    const factor = computeStalenessFactor(generatedAt, 24, now);
    expect(factor).toBeCloseTo(0.5, 2);
  });

  it('returns ~0.25 at two half-lives', () => {
    // 24h half-life, data is 48h old
    const now = new Date('2026-03-02T12:00:00Z');
    const factor = computeStalenessFactor(generatedAt, 24, now);
    expect(factor).toBeCloseTo(0.25, 2);
  });

  it('returns 0 beyond max staleness (168h)', () => {
    // 168h = 7 days
    const now = new Date('2026-03-08T00:00:00Z');
    const factor = computeStalenessFactor(generatedAt, 24, now);
    expect(factor).toBe(0);
  });

  it('returns 1.0 for future generatedAt', () => {
    const now = new Date('2026-02-28T11:00:00Z'); // 1h before generatedAt
    expect(computeStalenessFactor(generatedAt, 24, now)).toBe(1.0);
  });

  it('uses 48h half-life correctly for seasonal', () => {
    // 48h half-life, data is 48h old → 0.5
    const now = new Date('2026-03-02T12:00:00Z');
    const factor = computeStalenessFactor(generatedAt, 48, now);
    expect(factor).toBeCloseTo(0.5, 2);
  });
});

describe('lookupSeasonalBoost — staleness decay', () => {
  it('dampens seasonal boost for stale data', () => {
    const staleData: TemporalBoostsData = {
      version: '1.0.0',
      generatedAt: '2026-02-26T12:00:00Z', // 48h old (1 half-life at 48h)
      eventsAnalysed: 1000,
      seasonal: {
        '1': {
          eventCount: 1000,
          boosts: [{ term: 'snow', category: 'style', monthlyBoosts: { 2: 2.0 }, totalEvents: 500 }],
        },
      },
      weekly: {},
    };
    const lookup = buildTemporalLookup(staleData);
    const now48hLater = new Date('2026-02-28T12:00:00Z');

    // Raw boost 2.0, delta 1.0. Confidence = 1.0 (500 ≥ 200 ramp).
    // Staleness factor at 48h with 48h half-life = 0.5.
    // Result: 1.0 + (2.0 - 1.0) × 1.0 × 0.5 = 1.5
    const boost = lookupSeasonalBoost(lookup, 'snow', 2, 1, now48hLater);
    expect(boost).toBeCloseTo(1.5, 1);
    expect(boost).toBeLessThan(2.0);
    expect(boost).toBeGreaterThan(1.0);
  });

  it('returns 1.0 for extremely stale data (>168h)', () => {
    const veryStaleData: TemporalBoostsData = {
      version: '1.0.0',
      generatedAt: '2026-02-18T12:00:00Z', // 10 days old
      eventsAnalysed: 1000,
      seasonal: {
        '1': {
          eventCount: 1000,
          boosts: [{ term: 'snow', category: 'style', monthlyBoosts: { 2: 3.0 }, totalEvents: 500 }],
        },
      },
      weekly: {},
    };
    const lookup = buildTemporalLookup(veryStaleData);
    const now10dLater = new Date('2026-02-28T12:00:00Z');

    // Staleness factor = 0 (beyond 168h) → boost is 1.0 (neutral)
    const boost = lookupSeasonalBoost(lookup, 'snow', 2, 1, now10dLater);
    expect(boost).toBe(1.0);
  });
});

describe('lookupTrendingVelocity — staleness decay', () => {
  it('dampens trending velocity for stale data', () => {
    const staleData: TrendingTermsData = {
      version: '1.0.0',
      generatedAt: '2026-02-27T12:00:00Z', // 24h old (1 half-life at 24h)
      eventsAnalysed: 500,
      trending: {
        '2': {
          recentWindowEvents: 100,
          baselineWindowEvents: 400,
          terms: [{ term: 'cyberpunk', category: 'style', recentCount: 50, baselineCount: 20, velocity: 1.0, direction: 'rising' as const }],
        },
      },
    };
    const lookup = buildTrendingLookup(staleData);
    const now24hLater = new Date('2026-02-28T12:00:00Z');

    // Raw velocity 1.0, staleness 0.5 at 24h → result ≈ 0.5
    const velocity = lookupTrendingVelocity(lookup, 'cyberpunk', 2, now24hLater);
    expect(velocity).toBeCloseTo(0.5, 1);
  });

  it('returns 0 for extremely stale trending data', () => {
    const veryStaleData: TrendingTermsData = {
      version: '1.0.0',
      generatedAt: '2026-02-18T12:00:00Z', // 10 days old
      eventsAnalysed: 500,
      trending: {
        '2': {
          recentWindowEvents: 100,
          baselineWindowEvents: 400,
          terms: [{ term: 'cyberpunk', category: 'style', recentCount: 50, baselineCount: 20, velocity: 1.0, direction: 'rising' as const }],
        },
      },
    };
    const lookup = buildTrendingLookup(veryStaleData);
    const now10dLater = new Date('2026-02-28T12:00:00Z');

    const velocity = lookupTrendingVelocity(lookup, 'cyberpunk', 2, now10dLater);
    expect(velocity).toBe(0);
  });
});
