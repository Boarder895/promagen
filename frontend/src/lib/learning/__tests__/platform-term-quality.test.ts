// src/lib/learning/__tests__/platform-term-quality.test.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Term Quality Scoring Tests
// ============================================================================
//
// Verifies that per-platform term quality scoring correctly produces
// independent quality scores for each platform, with confidence blending,
// stale decay, and graduation tracking.
//
// Authority: phase-7.5-per-platform-learning-buildplan.md § 8
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import {
  computePlatformTermQuality,
  computeStaleFactor,
} from '../platform-term-quality';

import type {
  PlatformTermQualityData,
  PlatformTermSlice,
} from '../platform-term-quality';
import type { PromptEventRow } from '../database';
import { LEARNING_CONSTANTS } from '../constants';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock event with specified platform, tier, terms, and outcome.
 */
function mockEvent(opts: {
  platform?: string;
  tier?: number;
  terms?: Record<string, string[]>;
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
  createdAt?: Date | string;
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
    platform: opts.platform ?? 'leonardo',
    tier: opts.tier ?? 1,
    scene_used: null,
    outcome: {
      copied: opts.copied ?? false,
      saved: opts.saved ?? false,
      returnedWithin60s: opts.returnedWithin60s ?? false,
      reusedFromLibrary: opts.reusedFromLibrary ?? false,
    },
    created_at: opts.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Generate N events for a given platform + tier with a specific term.
 * High-outcome events: copied + saved. Low-outcome events: no signals.
 */
function generatePlatformEvents(opts: {
  n: number;
  platform: string;
  tier: number;
  term: string;
  highOutcome?: boolean;
  createdAt?: Date;
}): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  for (let i = 0; i < opts.n; i++) {
    events.push(
      mockEvent({
        platform: opts.platform,
        tier: opts.tier,
        terms: { style: [opts.term] },
        copied: opts.highOutcome ?? false,
        saved: opts.highOutcome ?? false,
        createdAt: opts.createdAt ?? new Date(),
      }),
    );
  }
  return events;
}

/**
 * Generate a mixed set: some events with a "good" term (high outcome)
 * and some with a "bad" term (low outcome) on the same platform.
 */
function generateMixedPlatformEvents(opts: {
  platform: string;
  tier: number;
  goodTerm: string;
  badTerm: string;
  countPerTerm: number;
}): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  // Good term: high outcome
  for (let i = 0; i < opts.countPerTerm; i++) {
    events.push(
      mockEvent({
        platform: opts.platform,
        tier: opts.tier,
        terms: { style: [opts.goodTerm] },
        copied: true,
        saved: true,
      }),
    );
  }
  // Bad term: no outcome
  for (let i = 0; i < opts.countPerTerm; i++) {
    events.push(
      mockEvent({
        platform: opts.platform,
        tier: opts.tier,
        terms: { style: [opts.badTerm] },
        copied: false,
        saved: false,
      }),
    );
  }
  return events;
}

// ============================================================================
// TESTS: NULL / EMPTY / INSUFFICIENT
// ============================================================================

describe('computePlatformTermQuality', () => {
  describe('guard rails', () => {
    it('returns null for null events', () => {
      expect(computePlatformTermQuality(null as unknown as PromptEventRow[])).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(computePlatformTermQuality([])).toBeNull();
    });

    it('returns null when events below PLATFORM_MIN_EVENTS', () => {
      const events = generatePlatformEvents({
        n: LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS - 1,
        platform: 'leonardo',
        tier: 1,
        term: 'neon glow',
      });
      expect(computePlatformTermQuality(events)).toBeNull();
    });

    it('returns null when no platform meets PLATFORM_MIN_EVENTS (spread across platforms)', () => {
      // 60 total events, but spread across 3 platforms = 20 each (below 50)
      const events = [
        ...generatePlatformEvents({ n: 20, platform: 'leonardo', tier: 1, term: 'test' }),
        ...generatePlatformEvents({ n: 20, platform: 'stability', tier: 1, term: 'test' }),
        ...generatePlatformEvents({ n: 20, platform: 'craiyon', tier: 1, term: 'test' }),
      ];
      expect(computePlatformTermQuality(events)).toBeNull();
    });
  });

  // ============================================================================
  // TESTS: SINGLE PLATFORM
  // ============================================================================

  describe('single platform scoring', () => {
    it('produces scores for a single platform with enough events', () => {
      // 30 good events + 30 bad events = 60 total, 6 events per term
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'neon glow',
        badTerm: 'boring flat',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events);

      expect(result).not.toBeNull();
      expect(result!.tiers['1']!.platforms['leonardo']).toBeDefined();
      const slice = result!.tiers['1']!.platforms['leonardo']!;
      expect(slice.platformId).toBe('leonardo');
      expect(slice.eventCount).toBe(60);
      expect(slice.termCount).toBe(2);
    });

    it('scores good terms higher than bad terms', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'neon glow',
        badTerm: 'boring flat',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      expect(slice.terms['neon glow']!.score).toBeGreaterThan(50);
      expect(slice.terms['boring flat']!.score).toBeLessThan(50);
      expect(slice.terms['neon glow']!.score).toBeGreaterThan(
        slice.terms['boring flat']!.score,
      );
    });

    it('tracks event count per term', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'neon glow',
        badTerm: 'boring flat',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      expect(slice.terms['neon glow']!.eventCount).toBe(30);
      expect(slice.terms['boring flat']!.eventCount).toBe(30);
    });
  });

  // ============================================================================
  // TESTS: MULTI-PLATFORM INDEPENDENCE
  // ============================================================================

  describe('multi-platform independence', () => {
    it('produces independent scores per platform', () => {
      // "neon glow" is GOOD on Leonardo, BAD on NightCafe
      const events = [
        // Leonardo: neon glow = good, boring flat = bad
        ...generateMixedPlatformEvents({
          platform: 'leonardo',
          tier: 1,
          goodTerm: 'neon glow',
          badTerm: 'boring flat',
          countPerTerm: 30,
        }),
        // NightCafe: neon glow = bad, boring flat = good (reversed!)
        ...generateMixedPlatformEvents({
          platform: 'stability',
          tier: 1,
          goodTerm: 'boring flat',
          badTerm: 'neon glow',
          countPerTerm: 30,
        }),
      ];

      const result = computePlatformTermQuality(events)!;
      const leonardo = result.tiers['1']!.platforms['leonardo']!;
      const stabilityResult = result.tiers['1']!.platforms['stability']!;

      // Neon glow: high on Leonardo, low on NightCafe
      expect(leonardo.terms['neon glow']!.score).toBeGreaterThan(50);
      expect(stabilityResult.terms['neon glow']!.score).toBeLessThan(50);

      // Boring flat: low on Leonardo, high on NightCafe
      expect(leonardo.terms['boring flat']!.score).toBeLessThan(50);
      expect(stabilityResult.terms['boring flat']!.score).toBeGreaterThan(50);
    });

    it('counts platforms independently in metadata', () => {
      const events = [
        ...generateMixedPlatformEvents({
          platform: 'leonardo',
          tier: 1,
          goodTerm: 'termA',
          badTerm: 'termB',
          countPerTerm: 30,
        }),
        ...generateMixedPlatformEvents({
          platform: 'midjourney',
          tier: 2,
          goodTerm: 'termC',
          badTerm: 'termD',
          countPerTerm: 30,
        }),
      ];

      const result = computePlatformTermQuality(events)!;
      expect(result.totalPlatforms).toBe(2);
      expect(result.tiers['1']!.platformCount).toBe(1);
      expect(result.tiers['2']!.platformCount).toBe(1);
    });
  });

  // ============================================================================
  // TESTS: CROSS-TIER ISOLATION
  // ============================================================================

  describe('cross-tier isolation', () => {
    it('same platform on different tiers produces separate slices', () => {
      // Leonardo is both Tier 1 (CLIP-based) and some custom config
      // Here we simulate the same platform being used across tiers
      const events = [
        ...generateMixedPlatformEvents({
          platform: 'leonardo',
          tier: 1,
          goodTerm: 'neon glow',
          badTerm: 'flat matte',
          countPerTerm: 30,
        }),
        ...generateMixedPlatformEvents({
          platform: 'leonardo',
          tier: 3,
          goodTerm: 'flat matte', // reversed preference per tier
          badTerm: 'neon glow',
          countPerTerm: 30,
        }),
      ];

      const result = computePlatformTermQuality(events)!;
      const tier1 = result.tiers['1']!.platforms['leonardo']!;
      const tier3 = result.tiers['3']!.platforms['leonardo']!;

      // Same term, different score by tier
      expect(tier1.terms['neon glow']!.score).toBeGreaterThan(50);
      expect(tier3.terms['neon glow']!.score).toBeLessThan(50);
    });
  });

  // ============================================================================
  // TESTS: CONFIDENCE
  // ============================================================================

  describe('confidence calculation', () => {
    it('computes confidence as eventCount / CONFIDENCE_THRESHOLD', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 25, // = 50 events total = 50/500 = 0.1
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      expect(slice.confidence).toBe(0.1);
    });

    it('caps confidence at 1.0 for large event counts', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 300, // = 600 events > 500 threshold
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      expect(slice.confidence).toBe(1.0);
    });

    it('returns confidence 0.5 at 250 events', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 125, // = 250 events = 250/500 = 0.5
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      expect(slice.confidence).toBe(0.5);
    });
  });

  // ============================================================================
  // TESTS: GRADUATION
  // ============================================================================

  describe('graduation', () => {
    it('marks platform as graduated when eventCount >= GRADUATION_THRESHOLD', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 60, // = 120 events > 100 threshold
      });

      const result = computePlatformTermQuality(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.graduated).toBe(true);
      expect(result.graduatedPlatforms).toBe(1);
    });

    it('does NOT mark as graduated when below threshold', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 30, // = 60 events < 100 threshold
      });

      const result = computePlatformTermQuality(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.graduated).toBe(false);
      expect(result.graduatedPlatforms).toBe(0);
    });
  });

  // ============================================================================
  // TESTS: STALE DECAY
  // ============================================================================

  describe('stale decay', () => {
    it('returns 1.0 for fresh data (within STALE_DAYS)', () => {
      const now = new Date('2026-03-01T00:00:00Z');
      const recent = new Date('2026-02-15T00:00:00Z'); // 14 days ago
      expect(computeStaleFactor(recent, now)).toBe(1.0);
    });

    it('returns 1.0 at exactly STALE_DAYS', () => {
      const now = new Date('2026-06-01T00:00:00Z');
      const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
      const exact = new Date(
        now.getTime() - staleDays * 24 * 60 * 60 * 1000,
      );
      expect(computeStaleFactor(exact, now)).toBe(1.0);
    });

    it('returns 0.5 halfway through decay window', () => {
      const now = new Date('2026-06-01T00:00:00Z');
      const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
      // 1.5 × STALE_DAYS = halfway through the decay window (decay 0→1 over STALE_DAYS)
      const halfway = new Date(
        now.getTime() - staleDays * 1.5 * 24 * 60 * 60 * 1000,
      );
      expect(computeStaleFactor(halfway, now)).toBe(0.5);
    });

    it('returns 0.0 at 2× STALE_DAYS (fully stale)', () => {
      const now = new Date('2026-06-01T00:00:00Z');
      const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
      const fullyStale = new Date(
        now.getTime() - staleDays * 2 * 24 * 60 * 60 * 1000,
      );
      expect(computeStaleFactor(fullyStale, now)).toBe(0.0);
    });

    it('applies stale decay to confidence in mining output', () => {
      const now = new Date('2026-06-01T00:00:00Z');
      const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
      // 1.5 × STALE_DAYS ago → staleFactor = 0.5
      const staleDate = new Date(
        now.getTime() - staleDays * 1.5 * 24 * 60 * 60 * 1000,
      );

      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 250, // = 500 events → rawConfidence = 1.0
      });
      // Override all event dates to stale
      for (const evt of events) {
        evt.created_at = staleDate;
      }

      const result = computePlatformTermQuality(events, null, now)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      // rawConfidence=1.0 × staleFactor=0.5 = 0.5
      expect(slice.confidence).toBe(0.5);
    });
  });

  // ============================================================================
  // TESTS: TERM FILTERING & CAPS
  // ============================================================================

  describe('term filtering and caps', () => {
    it('excludes terms with fewer than MIN_EVENTS_PER_TERM appearances', () => {
      const events: PromptEventRow[] = [];

      // "common" term: 30 events (well above min)
      for (let i = 0; i < 30; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['common'] },
            copied: true,
          }),
        );
      }

      // "rare" term: 2 events (below MIN_EVENTS_PER_TERM = 5)
      for (let i = 0; i < 2; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['rare'] },
            copied: true,
          }),
        );
      }

      // Pad to meet platform min
      for (let i = 0; i < 20; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['filler'] },
          }),
        );
      }

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      expect(slice.terms['common']).toBeDefined();
      expect(slice.terms['rare']).toBeUndefined();
      expect(slice.terms['filler']).toBeDefined();
    });

    it('caps terms at PLATFORM_MAX_TERMS per platform', () => {
      // Generate many unique terms
      const events: PromptEventRow[] = [];
      const maxTerms = LEARNING_CONSTANTS.PLATFORM_MAX_TERMS;

      // Create maxTerms + 50 unique terms, each appearing 6 times
      for (let termIdx = 0; termIdx < maxTerms + 50; termIdx++) {
        for (let rep = 0; rep < 6; rep++) {
          events.push(
            mockEvent({
              platform: 'leonardo',
              tier: 1,
              terms: { style: [`term_${String(termIdx).padStart(4, '0')}`] },
              copied: rep % 2 === 0,
            }),
          );
        }
      }

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      expect(slice.termCount).toBeLessThanOrEqual(maxTerms);
    });
  });

  // ============================================================================
  // TESTS: TREND
  // ============================================================================

  describe('trend calculation', () => {
    it('returns 0 for first run (no previous data)', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      for (const termData of Object.values(slice.terms)) {
        expect(termData.trend).toBe(0);
      }
    });

    it('computes trend vs previous scores', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 30,
      });

      // First run
      const first = computePlatformTermQuality(events)!;

      // Second run with same data — trend should be 0 (no change)
      const second = computePlatformTermQuality(events, first)!;
      const slice = second.tiers['1']!.platforms['leonardo']!;
      expect(slice.terms['alpha']!.trend).toBe(0);
    });
  });

  // ============================================================================
  // TESTS: METADATA
  // ============================================================================

  describe('metadata', () => {
    it('includes version, generatedAt, and event counts', () => {
      const events = generateMixedPlatformEvents({
        platform: 'leonardo',
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events)!;

      expect(result.version).toBe('1.0.0');
      expect(result.generatedAt).toBeDefined();
      expect(result.eventCount).toBe(60);
      expect(result.totalPlatforms).toBe(1);
      expect(result.totalTermsScored).toBeGreaterThan(0);
    });

    it('tracks newestEventAt per platform slice', () => {
      const oldDate = new Date('2026-01-01T00:00:00Z');
      const newDate = new Date('2026-02-15T00:00:00Z');

      const events: PromptEventRow[] = [];
      for (let i = 0; i < 30; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['alpha'] },
            copied: true,
            createdAt: oldDate,
          }),
        );
      }
      for (let i = 0; i < 30; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['beta'] },
            createdAt: newDate,
          }),
        );
      }

      const result = computePlatformTermQuality(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      expect(slice.newestEventAt).toBe(newDate.toISOString());
    });

    it('normalises platform IDs to lowercase', () => {
      const events = generateMixedPlatformEvents({
        platform: 'Leonardo', // uppercase
        tier: 1,
        goodTerm: 'alpha',
        badTerm: 'beta',
        countPerTerm: 30,
      });

      const result = computePlatformTermQuality(events)!;
      expect(result.tiers['1']!.platforms['leonardo']).toBeDefined();
      expect(result.tiers['1']!.platforms['Leonardo']).toBeUndefined();
    });
  });
});
