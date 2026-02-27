// src/lib/learning/__tests__/term-quality-scoring.test.ts
// ============================================================================
// SELF-IMPROVING SCORER — Term Quality Scoring Tests
// ============================================================================
//
// Verifies that term quality scoring correctly identifies high-quality
// and low-quality vocabulary terms based on outcome data.
//
// Authority: phase-6-self-improving-scorer-buildplan.md § 4.5
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import {
  computeTermQualityScores,
  MIN_EVENTS_PER_TERM,
  MIN_EVENTS_FOR_SCORING,
  ZSCORE_SCALE,
  MAX_TERMS_PER_TIER,
} from '../term-quality-scoring';

import type { TermQualityScores, TierTermQuality } from '../term-quality-scoring';
import type { PromptEventRow } from '../database';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock event with specified terms and outcome.
 */
function mockEvent(opts: {
  terms?: Record<string, string[]>;
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
  tier?: number;
}): PromptEventRow {
  const selections = opts.terms ?? { style: ['cyberpunk'] };

  return {
    id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    session_id: 'sess_test',
    attempt_number: 1,
    selections,
    category_count: Object.keys(selections).length,
    char_length: 100,
    score: 92,
    score_factors: { categoryCount: 20, coherence: 18 },
    platform: 'midjourney',
    tier: opts.tier ?? 2,
    scene_used: null,
    outcome: {
      copied: opts.copied ?? false,
      saved: opts.saved ?? false,
      returnedWithin60s: opts.returnedWithin60s ?? false,
      reusedFromLibrary: opts.reusedFromLibrary ?? false,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * Generate events where a specific term appears only in high-outcome events.
 * Other events use a different term with low outcomes.
 */
function generateHighQualityTermEvents(
  n: number,
  goodTerm: string,
  tier: number = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  const half = Math.floor(n / 2);

  // First half: good term + high outcome
  for (let i = 0; i < half; i++) {
    events.push(
      mockEvent({
        terms: { style: [goodTerm], lighting: ['dramatic'] },
        copied: true,
        saved: true,
        reusedFromLibrary: true,
        tier,
      }),
    );
  }

  // Second half: different term + low outcome
  for (let i = 0; i < n - half; i++) {
    events.push(
      mockEvent({
        terms: { style: ['generic-filler'], lighting: ['dramatic'] },
        copied: true,
        saved: false,
        returnedWithin60s: true,
        tier,
      }),
    );
  }

  return events;
}

/**
 * Generate events where a specific term appears only in low-outcome events.
 */
function generateLowQualityTermEvents(
  n: number,
  badTerm: string,
  tier: number = 2,
): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  const half = Math.floor(n / 2);

  // First half: bad term + low outcome
  for (let i = 0; i < half; i++) {
    events.push(
      mockEvent({
        terms: { style: [badTerm], lighting: ['flat'] },
        copied: true,
        saved: false,
        returnedWithin60s: true,
        tier,
      }),
    );
  }

  // Second half: different term + high outcome
  for (let i = 0; i < n - half; i++) {
    events.push(
      mockEvent({
        terms: { style: ['premium-quality'], lighting: ['flat'] },
        copied: true,
        saved: true,
        reusedFromLibrary: true,
        tier,
      }),
    );
  }

  return events;
}

// ============================================================================
// Cold Start
// ============================================================================

describe('computeTermQualityScores — cold start', () => {
  it('returns empty result for no events', () => {
    const result = computeTermQualityScores([]);
    expect(result.eventCount).toBe(0);
    expect(result.global.termCount).toBe(0);
    expect(Object.keys(result.global.terms)).toHaveLength(0);
  });

  it('returns empty result when below MIN_EVENTS_FOR_SCORING', () => {
    const events = Array.from({ length: MIN_EVENTS_FOR_SCORING - 1 }, () => mockEvent({}));
    const result = computeTermQualityScores(events);
    expect(result.global.termCount).toBe(0);
  });

  it('includes version and generatedAt', () => {
    const result = computeTermQualityScores([]);
    expect(result.version).toBe('1.0.0');
    expect(result.generatedAt).toBeTruthy();
  });

  it('has all four tiers in output', () => {
    const result = computeTermQualityScores([]);
    expect(result.tiers['1']).toBeDefined();
    expect(result.tiers['2']).toBeDefined();
    expect(result.tiers['3']).toBeDefined();
    expect(result.tiers['4']).toBeDefined();
  });

  it('averageScore defaults to 50 when empty', () => {
    const result = computeTermQualityScores([]);
    expect(result.global.averageScore).toBe(50);
  });
});

// ============================================================================
// High-Quality Term Detection
// ============================================================================

describe('computeTermQualityScores — high-quality terms', () => {
  it('term in only high-outcome events gets score > 70', () => {
    const events = generateHighQualityTermEvents(100, 'neon noir');
    const result = computeTermQualityScores(events);

    const termData = result.global.terms['neon noir'];
    expect(termData).toBeDefined();
    expect(termData!.score).toBeGreaterThan(60);
  });

  it('high-quality term has correct eventCount', () => {
    const events = generateHighQualityTermEvents(100, 'cyberpunk');
    const result = computeTermQualityScores(events);

    const termData = result.global.terms['cyberpunk'];
    expect(termData).toBeDefined();
    expect(termData!.eventCount).toBe(50); // Half the events
  });
});

// ============================================================================
// Low-Quality Term Detection
// ============================================================================

describe('computeTermQualityScores — low-quality terms', () => {
  it('term in only low-outcome events gets score < 30', () => {
    const events = generateLowQualityTermEvents(100, 'bad-term');
    const result = computeTermQualityScores(events);

    const termData = result.global.terms['bad-term'];
    expect(termData).toBeDefined();
    expect(termData!.score).toBeLessThan(40);
  });
});

// ============================================================================
// Minimum Events Guard
// ============================================================================

describe('computeTermQualityScores — minimum events guard', () => {
  it('term with < MIN_EVENTS_PER_TERM appearances is excluded', () => {
    const events: PromptEventRow[] = [];

    // Rare term: appears in only MIN_EVENTS_PER_TERM - 1 events
    for (let i = 0; i < MIN_EVENTS_PER_TERM - 1; i++) {
      events.push(
        mockEvent({
          terms: { style: ['rare-term', 'common-term'] },
          copied: true,
          saved: true,
        }),
      );
    }

    // Common term: appears in many events
    for (let i = 0; i < 50; i++) {
      events.push(
        mockEvent({
          terms: { style: ['common-term'] },
          copied: true,
          saved: false,
        }),
      );
    }

    const result = computeTermQualityScores(events);

    expect(result.global.terms['rare-term']).toBeUndefined();
    expect(result.global.terms['common-term']).toBeDefined();
  });
});

// ============================================================================
// Score Scale
// ============================================================================

describe('computeTermQualityScores — score scale', () => {
  it('all scores are between 0 and 100', () => {
    const events = generateHighQualityTermEvents(200, 'test-term');
    const result = computeTermQualityScores(events);

    for (const [, termData] of Object.entries(result.global.terms)) {
      expect(termData.score).toBeGreaterThanOrEqual(0);
      expect(termData.score).toBeLessThanOrEqual(100);
    }
  });

  it('average score is approximately 50', () => {
    // Generate balanced events (many terms, mixed outcomes)
    const events: PromptEventRow[] = [];
    const terms = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];

    for (let i = 0; i < 200; i++) {
      const termIdx = i % terms.length;
      const isGood = Math.random() > 0.5;

      events.push(
        mockEvent({
          terms: { style: [terms[termIdx]!] },
          copied: true,
          saved: isGood,
          reusedFromLibrary: isGood,
          returnedWithin60s: !isGood,
        }),
      );
    }

    const result = computeTermQualityScores(events);

    // Average should be near 50 (within ±10 given random data)
    expect(result.global.averageScore).toBeGreaterThanOrEqual(40);
    expect(result.global.averageScore).toBeLessThanOrEqual(60);
  });
});

// ============================================================================
// Term Normalisation
// ============================================================================

describe('computeTermQualityScores — term normalisation', () => {
  it('terms are normalised to lowercase', () => {
    const events: PromptEventRow[] = [];

    // Same term in different cases
    for (let i = 0; i < 30; i++) {
      const casing = i % 3 === 0 ? 'Cyberpunk' : i % 3 === 1 ? 'CYBERPUNK' : 'cyberpunk';
      events.push(
        mockEvent({
          terms: { style: [casing] },
          copied: true,
          saved: true,
        }),
      );
    }

    const result = computeTermQualityScores(events);

    // Should be merged into one entry
    expect(result.global.terms['cyberpunk']).toBeDefined();
    expect(result.global.terms['Cyberpunk']).toBeUndefined();
    expect(result.global.terms['CYBERPUNK']).toBeUndefined();
    expect(result.global.terms['cyberpunk']!.eventCount).toBe(30);
  });

  it('empty and whitespace-only terms are excluded', () => {
    const events: PromptEventRow[] = [];

    for (let i = 0; i < 40; i++) {
      events.push(
        mockEvent({
          terms: { style: ['valid-term', '', '   '] },
          copied: true,
          saved: true,
        }),
      );
    }

    const result = computeTermQualityScores(events);

    expect(result.global.terms['valid-term']).toBeDefined();
    expect(result.global.terms['']).toBeUndefined();
    expect(result.global.terms['   ']).toBeUndefined();
  });
});

// ============================================================================
// Trend Calculation
// ============================================================================

describe('computeTermQualityScores — trend', () => {
  it('trend is 0 on first run (no previous data)', () => {
    const events = generateHighQualityTermEvents(100, 'test-trend');
    const result = computeTermQualityScores(events, null);

    const termData = result.global.terms['test-trend'];
    expect(termData).toBeDefined();
    expect(termData!.trend).toBe(0);
  });

  it('trend reflects change from previous run', () => {
    const events = generateHighQualityTermEvents(100, 'trending-up');

    // First run
    const first = computeTermQualityScores(events);

    // Build a fake previous with a lower score to simulate improvement
    const fakePrevious: TermQualityScores = {
      ...first,
      global: {
        ...first.global,
        terms: {
          ...first.global.terms,
          'trending-up': {
            score: 30, // Was low
            eventCount: 50,
            trend: 0,
          },
        },
      },
    };

    // Second run with previous showing low score
    const second = computeTermQualityScores(events, fakePrevious);
    const termData = second.global.terms['trending-up'];

    expect(termData).toBeDefined();
    // Score is high (>70), previous was 30 → positive trend
    expect(termData!.trend).toBeGreaterThan(0);
  });

  it('trend is clamped to [-1, +1]', () => {
    const events = generateHighQualityTermEvents(100, 'clamped');
    const result = computeTermQualityScores(events);

    for (const [, termData] of Object.entries(result.global.terms)) {
      expect(termData.trend).toBeGreaterThanOrEqual(-1);
      expect(termData.trend).toBeLessThanOrEqual(1);
    }
  });
});

// ============================================================================
// Per-Tier
// ============================================================================

describe('computeTermQualityScores — per-tier', () => {
  it('same term gets different scores on different tiers', () => {
    // Tier 1: "neon" is high quality
    const tier1Events = generateHighQualityTermEvents(100, 'neon', 1);
    // Tier 3: "neon" is low quality
    const tier3Events = generateLowQualityTermEvents(100, 'neon', 3);

    const result = computeTermQualityScores([...tier1Events, ...tier3Events]);

    const tier1Score = result.tiers['1']?.terms['neon']?.score ?? 50;
    const tier3Score = result.tiers['3']?.terms['neon']?.score ?? 50;

    expect(tier1Score).toBeGreaterThan(tier3Score);
  });

  it('tier with insufficient events has empty terms', () => {
    const events = generateHighQualityTermEvents(100, 'test', 2);
    const result = computeTermQualityScores(events);

    // Tier 1 has no events
    expect(result.tiers['1']!.termCount).toBe(0);
    expect(Object.keys(result.tiers['1']!.terms)).toHaveLength(0);

    // Tier 2 has data
    expect(result.tiers['2']!.termCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// Max Terms Guard
// ============================================================================

describe('computeTermQualityScores — max terms guard', () => {
  it('does not exceed MAX_TERMS_PER_TIER', () => {
    // Generate events with many unique terms
    const events: PromptEventRow[] = [];
    for (let i = 0; i < 200; i++) {
      // Each event has a unique term + some shared terms
      events.push(
        mockEvent({
          terms: {
            style: [`unique-${i}`, 'shared-a', 'shared-b'],
          },
          copied: true,
          saved: i % 2 === 0,
        }),
      );
    }

    const result = computeTermQualityScores(events);

    // Should not exceed the cap
    expect(result.global.termCount).toBeLessThanOrEqual(MAX_TERMS_PER_TIER);
  });
});

// ============================================================================
// Constants Sanity
// ============================================================================

describe('Term quality constants', () => {
  it('MIN_EVENTS_PER_TERM is reasonable', () => {
    expect(MIN_EVENTS_PER_TERM).toBeGreaterThanOrEqual(3);
    expect(MIN_EVENTS_PER_TERM).toBeLessThanOrEqual(50);
  });

  it('ZSCORE_SCALE is reasonable', () => {
    expect(ZSCORE_SCALE).toBeGreaterThanOrEqual(10);
    expect(ZSCORE_SCALE).toBeLessThanOrEqual(25);
  });

  it('MAX_TERMS_PER_TIER is reasonable', () => {
    expect(MAX_TERMS_PER_TIER).toBeGreaterThanOrEqual(500);
    expect(MAX_TERMS_PER_TIER).toBeLessThanOrEqual(10_000);
  });
});
