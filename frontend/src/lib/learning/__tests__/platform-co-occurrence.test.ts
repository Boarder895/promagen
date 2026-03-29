// src/lib/learning/__tests__/platform-co-occurrence.test.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Co-occurrence Mining Tests
// ============================================================================
//
// Verifies that per-platform co-occurrence mining correctly produces
// independent pair matrices for each platform, with confidence blending,
// stale decay, graduation tracking, and proper normalisation.
//
// Authority: phase-7.5-per-platform-learning-buildplan.md § 8
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import { computePlatformCoOccurrence } from '../platform-co-occurrence';
import type { PromptEventRow } from '../database';
import { LEARNING_CONSTANTS } from '../constants';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock event with specified platform, tier, and terms.
 */
function mockEvent(opts: {
  platform?: string;
  tier?: number;
  terms?: Record<string, string[]>;
  createdAt?: Date | string;
}): PromptEventRow {
  const selections = opts.terms ?? { style: ['alpha'], lighting: ['beta'] };

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
      copied: true,
      saved: false,
      returnedWithin60s: false,
      reusedFromLibrary: false,
    },
    created_at: opts.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Generate N events with the same term pair on a given platform/tier.
 */
function generatePairEvents(opts: {
  n: number;
  platform: string;
  tier: number;
  termA: string;
  termB: string;
  createdAt?: Date;
}): PromptEventRow[] {
  const events: PromptEventRow[] = [];
  for (let i = 0; i < opts.n; i++) {
    events.push(
      mockEvent({
        platform: opts.platform,
        tier: opts.tier,
        terms: { style: [opts.termA], lighting: [opts.termB] },
        createdAt: opts.createdAt ?? new Date(),
      }),
    );
  }
  return events;
}

// ============================================================================
// TESTS: NULL / EMPTY / INSUFFICIENT
// ============================================================================

describe('computePlatformCoOccurrence', () => {
  describe('guard rails', () => {
    it('returns null for null events', () => {
      expect(computePlatformCoOccurrence(null as unknown as PromptEventRow[])).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(computePlatformCoOccurrence([])).toBeNull();
    });

    it('returns null when events below PLATFORM_MIN_EVENTS', () => {
      const events = generatePairEvents({
        n: LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS - 1,
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });
      expect(computePlatformCoOccurrence(events)).toBeNull();
    });

    it('returns null when no platform meets PLATFORM_MIN_EVENTS', () => {
      const events = [
        ...generatePairEvents({ n: 20, platform: 'leonardo', tier: 1, termA: 'a', termB: 'b' }),
        ...generatePairEvents({ n: 20, platform: 'stability', tier: 1, termA: 'a', termB: 'b' }),
        ...generatePairEvents({ n: 20, platform: 'craiyon', tier: 1, termA: 'a', termB: 'b' }),
      ];
      expect(computePlatformCoOccurrence(events)).toBeNull();
    });
  });

  // ============================================================================
  // TESTS: SINGLE PLATFORM
  // ============================================================================

  describe('single platform pairs', () => {
    it('produces pairs for a single platform with enough events', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'leonardo',
        tier: 1,
        termA: 'neon glow',
        termB: 'cyberpunk',
      });

      const result = computePlatformCoOccurrence(events);
      expect(result).not.toBeNull();
      const slice = result!.tiers['1']!.platforms['leonardo']!;
      expect(slice.platformId).toBe('leonardo');
      expect(slice.eventCount).toBe(60);
      expect(slice.pairCount).toBeGreaterThan(0);
    });

    it('normalises weights to 0–100', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      for (const pair of slice.pairs) {
        expect(pair.weight).toBeGreaterThanOrEqual(0);
        expect(pair.weight).toBeLessThanOrEqual(100);
      }
      // The single pair should be weight 100 (max)
      expect(slice.pairs[0]!.weight).toBe(100);
    });

    it('sorts terms alphabetically in pair keys', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'leonardo',
        tier: 1,
        termA: 'zebra stripes',
        termB: 'alpha rays',
      });

      const result = computePlatformCoOccurrence(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;

      for (const pair of slice.pairs) {
        expect(pair.terms[0]! <= pair.terms[1]!).toBe(true);
      }
    });

    it('counts raw occurrences correctly', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      const pair = slice.pairs.find(
        (p) => p.terms.includes('alpha') && p.terms.includes('beta'),
      );
      expect(pair).toBeDefined();
      expect(pair!.count).toBe(60);
    });
  });

  // ============================================================================
  // TESTS: MULTI-PLATFORM INDEPENDENCE
  // ============================================================================

  describe('multi-platform independence', () => {
    it('produces independent pair matrices per platform', () => {
      const events = [
        // Leonardo: alpha+beta co-occur
        ...generatePairEvents({
          n: 60,
          platform: 'leonardo',
          tier: 1,
          termA: 'alpha',
          termB: 'beta',
        }),
        // NightCafe: gamma+delta co-occur
        ...generatePairEvents({
          n: 60,
          platform: 'stability',
          tier: 1,
          termA: 'gamma',
          termB: 'delta',
        }),
      ];

      const result = computePlatformCoOccurrence(events)!;
      const leonardo = result.tiers['1']!.platforms['leonardo']!;
      const stabilityResult = result.tiers['1']!.platforms['stability']!;

      // Leonardo should have alpha|beta, not gamma|delta
      const leoPairs = leonardo.pairs.map((p) => p.terms.join('|'));
      expect(leoPairs).toContainEqual(expect.stringContaining('alpha'));
      expect(leoPairs).not.toContainEqual(expect.stringContaining('gamma'));

      // NightCafe should have gamma|delta, not alpha|beta
      const ncPairs = stabilityResult.pairs.map((p) => p.terms.join('|'));
      expect(ncPairs).toContainEqual(expect.stringContaining('gamma'));
      expect(ncPairs).not.toContainEqual(expect.stringContaining('alpha'));
    });

    it('reports correct platform counts in metadata', () => {
      const events = [
        ...generatePairEvents({ n: 60, platform: 'leonardo', tier: 1, termA: 'a', termB: 'b' }),
        ...generatePairEvents({ n: 60, platform: 'stability', tier: 1, termA: 'c', termB: 'd' }),
        ...generatePairEvents({ n: 60, platform: 'midjourney', tier: 2, termA: 'e', termB: 'f' }),
      ];

      const result = computePlatformCoOccurrence(events)!;
      expect(result.totalPlatforms).toBe(3);
      expect(result.tiers['1']!.platformCount).toBe(2);
      expect(result.tiers['2']!.platformCount).toBe(1);
    });
  });

  // ============================================================================
  // TESTS: CROSS-TIER ISOLATION
  // ============================================================================

  describe('cross-tier isolation', () => {
    it('same platform on different tiers produces separate slices', () => {
      const events = [
        ...generatePairEvents({ n: 60, platform: 'leonardo', tier: 1, termA: 'alpha', termB: 'beta' }),
        ...generatePairEvents({ n: 60, platform: 'leonardo', tier: 3, termA: 'gamma', termB: 'delta' }),
      ];

      const result = computePlatformCoOccurrence(events)!;
      const tier1 = result.tiers['1']!.platforms['leonardo']!;
      const tier3 = result.tiers['3']!.platforms['leonardo']!;

      const t1Pairs = tier1.pairs.map((p) => p.terms.join('|'));
      const t3Pairs = tier3.pairs.map((p) => p.terms.join('|'));

      expect(t1Pairs).toContainEqual(expect.stringContaining('alpha'));
      expect(t1Pairs).not.toContainEqual(expect.stringContaining('gamma'));
      expect(t3Pairs).toContainEqual(expect.stringContaining('gamma'));
      expect(t3Pairs).not.toContainEqual(expect.stringContaining('alpha'));
    });
  });

  // ============================================================================
  // TESTS: CONFIDENCE & GRADUATION
  // ============================================================================

  describe('confidence and graduation', () => {
    it('computes confidence as eventCount / CONFIDENCE_THRESHOLD', () => {
      const events = generatePairEvents({
        n: 50, // 50/500 = 0.1
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.confidence).toBe(0.1);
    });

    it('caps confidence at 1.0', () => {
      const events = generatePairEvents({
        n: 600, // 600/500 > 1.0
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.confidence).toBe(1.0);
    });

    it('marks graduated platform correctly', () => {
      const events = generatePairEvents({
        n: 120, // > GRADUATION_THRESHOLD (100)
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.graduated).toBe(true);
      expect(result.graduatedPlatforms).toBe(1);
    });

    it('does NOT mark as graduated below threshold', () => {
      const events = generatePairEvents({
        n: 60, // < GRADUATION_THRESHOLD (100)
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.graduated).toBe(false);
    });
  });

  // ============================================================================
  // TESTS: STALE DECAY
  // ============================================================================

  describe('stale decay', () => {
    it('applies stale decay to confidence for old data', () => {
      const now = new Date('2026-06-01T00:00:00Z');
      const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
      // 1.5 × STALE_DAYS ago → staleFactor = 0.5
      const staleDate = new Date(
        now.getTime() - staleDays * 1.5 * 24 * 60 * 60 * 1000,
      );

      const events = generatePairEvents({
        n: 500, // rawConfidence = 1.0
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
        createdAt: staleDate,
      });

      const result = computePlatformCoOccurrence(events, now)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      // rawConfidence=1.0 × staleFactor=0.5 = 0.5
      expect(slice.confidence).toBe(0.5);
    });

    it('does not decay fresh data', () => {
      const now = new Date('2026-03-01T00:00:00Z');
      const freshDate = new Date('2026-02-28T00:00:00Z'); // 1 day ago

      const events = generatePairEvents({
        n: 250, // rawConfidence = 0.5
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
        createdAt: freshDate,
      });

      const result = computePlatformCoOccurrence(events, now)!;
      expect(result.tiers['1']!.platforms['leonardo']!.confidence).toBe(0.5);
    });
  });

  // ============================================================================
  // TESTS: PAIR CAPS & FILTERING
  // ============================================================================

  describe('pair caps and filtering', () => {
    it('caps pairs at PLATFORM_MAX_PAIRS per platform', () => {
      // Generate many unique pairs
      const events: PromptEventRow[] = [];
      const maxPairs = LEARNING_CONSTANTS.PLATFORM_MAX_PAIRS;

      // Create enough unique term combinations to exceed MAX_PAIRS
      // Each event has 3 terms → 3 pairs per event
      // Need > MAX_PAIRS / 3 unique combinations, each repeated 3 times
      for (let i = 0; i < maxPairs + 100; i++) {
        for (let rep = 0; rep < 3; rep++) {
          events.push(
            mockEvent({
              platform: 'leonardo',
              tier: 1,
              terms: {
                style: [`term_${i}_a`],
                lighting: [`term_${i}_b`],
              },
            }),
          );
        }
      }

      const result = computePlatformCoOccurrence(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      expect(slice.pairCount).toBeLessThanOrEqual(maxPairs);
    });

    it('filters out pairs with fewer than MIN_PAIR_OCCURRENCES', () => {
      const events: PromptEventRow[] = [];

      // Pair that appears 50 times (well above min)
      for (let i = 0; i < 50; i++) {
        events.push(
          mockEvent({
            platform: 'leonardo',
            tier: 1,
            terms: { style: ['common_a'], lighting: ['common_b'] },
          }),
        );
      }

      // Pair that appears only once (below min)
      events.push(
        mockEvent({
          platform: 'leonardo',
          tier: 1,
          terms: { style: ['rare_a'], lighting: ['rare_b'] },
        }),
      );

      const result = computePlatformCoOccurrence(events)!;
      const slice = result.tiers['1']!.platforms['leonardo']!;
      const pairTerms = slice.pairs.flatMap((p) => p.terms);
      expect(pairTerms).toContain('common_a');
      expect(pairTerms).not.toContain('rare_a');
    });
  });

  // ============================================================================
  // TESTS: METADATA
  // ============================================================================

  describe('metadata', () => {
    it('includes version, generatedAt, and counts', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'leonardo',
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.version).toBe('1.0.0');
      expect(result.generatedAt).toBeDefined();
      expect(result.eventCount).toBe(60);
      expect(result.totalPlatforms).toBe(1);
      expect(result.totalPairs).toBeGreaterThan(0);
    });

    it('tracks newestEventAt per platform slice', () => {
      const oldDate = new Date('2026-01-01T00:00:00Z');
      const newDate = new Date('2026-02-15T00:00:00Z');

      const events = [
        ...generatePairEvents({
          n: 30,
          platform: 'leonardo',
          tier: 1,
          termA: 'a',
          termB: 'b',
          createdAt: oldDate,
        }),
        ...generatePairEvents({
          n: 30,
          platform: 'leonardo',
          tier: 1,
          termA: 'c',
          termB: 'd',
          createdAt: newDate,
        }),
      ];

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']!.newestEventAt).toBe(
        newDate.toISOString(),
      );
    });

    it('normalises platform IDs to lowercase', () => {
      const events = generatePairEvents({
        n: 60,
        platform: 'Leonardo', // uppercase
        tier: 1,
        termA: 'alpha',
        termB: 'beta',
      });

      const result = computePlatformCoOccurrence(events)!;
      expect(result.tiers['1']!.platforms['leonardo']).toBeDefined();
      expect(result.tiers['1']!.platforms['Leonardo']).toBeUndefined();
    });
  });
});
