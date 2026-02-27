// src/lib/learning/__tests__/platform-co-occurrence-lookup.test.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Co-occurrence Lookup Tests
// ============================================================================
//
// Verifies that the blending lookup correctly merges platform-specific
// co-occurrence weights with tier-level fallback using confidence weighting.
//
// Authority: phase-7.5-per-platform-learning-buildplan.md § 8
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import {
  buildPlatformCoOccurrenceLookup,
  lookupPlatformCoOccurrence,
} from '../platform-co-occurrence-lookup';

import type { PlatformCoOccurrenceLookup } from '../platform-co-occurrence-lookup';
import type { PlatformCoOccurrenceData } from '../platform-co-occurrence';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a minimal PlatformCoOccurrenceData for testing.
 */
function buildTestData(opts: {
  tier: string;
  platformId: string;
  pairs: Array<{ terms: [string, string]; weight: number }>;
  confidence: number;
}): PlatformCoOccurrenceData {
  const pairEntries = opts.pairs.map((p) => ({
    terms: p.terms,
    weight: p.weight,
    count: 10,
  }));

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 500,
    tiers: {
      [opts.tier]: {
        eventCount: 200,
        platformCount: 1,
        platforms: {
          [opts.platformId]: {
            platformId: opts.platformId,
            eventCount: 200,
            confidence: opts.confidence,
            graduated: true,
            newestEventAt: new Date().toISOString(),
            pairs: pairEntries,
            pairCount: pairEntries.length,
          },
        },
      },
    },
    totalPlatforms: 1,
    totalPairs: pairEntries.length,
    graduatedPlatforms: 1,
  };
}

/**
 * Build test data with multiple platforms.
 */
function buildMultiPlatformData(
  platforms: Array<{
    tier: string;
    platformId: string;
    pairs: Array<{ terms: [string, string]; weight: number }>;
    confidence: number;
  }>,
): PlatformCoOccurrenceData {
  const tiers: PlatformCoOccurrenceData['tiers'] = {};
  let totalPairs = 0;

  for (const p of platforms) {
    if (!tiers[p.tier]) {
      tiers[p.tier] = { eventCount: 0, platformCount: 0, platforms: {} };
    }
    const pairEntries = p.pairs.map((pair) => ({
      terms: pair.terms,
      weight: pair.weight,
      count: 10,
    }));
    tiers[p.tier]!.platforms[p.platformId] = {
      platformId: p.platformId,
      eventCount: 200,
      confidence: p.confidence,
      graduated: true,
      newestEventAt: new Date().toISOString(),
      pairs: pairEntries,
      pairCount: pairEntries.length,
    };
    tiers[p.tier]!.platformCount++;
    tiers[p.tier]!.eventCount += 200;
    totalPairs += pairEntries.length;
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: platforms.length * 200,
    tiers,
    totalPlatforms: platforms.length,
    totalPairs,
    graduatedPlatforms: platforms.length,
  };
}

// ============================================================================
// TESTS: buildPlatformCoOccurrenceLookup
// ============================================================================

describe('buildPlatformCoOccurrenceLookup', () => {
  it('returns null for null input', () => {
    expect(buildPlatformCoOccurrenceLookup(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildPlatformCoOccurrenceLookup(undefined)).toBeNull();
  });

  it('builds indexed maps from valid data', () => {
    const data = buildTestData({
      tier: '1',
      platformId: 'leonardo',
      pairs: [
        { terms: ['alpha', 'beta'], weight: 80 },
        { terms: ['gamma', 'delta'], weight: 45 },
      ],
      confidence: 0.7,
    });

    const lookup = buildPlatformCoOccurrenceLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.tiers['1']!['leonardo']).toBeInstanceOf(Map);
    expect(lookup!.tiers['1']!['leonardo']!.get('alpha|beta')).toBe(80);
    expect(lookup!.tiers['1']!['leonardo']!.get('gamma|delta')).toBe(45);
    expect(lookup!.confidences['1']!['leonardo']).toBe(0.7);
  });

  it('indexes multiple platforms across tiers', () => {
    const data = buildMultiPlatformData([
      {
        tier: '1',
        platformId: 'leonardo',
        pairs: [{ terms: ['a', 'b'], weight: 90 }],
        confidence: 0.5,
      },
      {
        tier: '2',
        platformId: 'midjourney',
        pairs: [{ terms: ['c', 'd'], weight: 60 }],
        confidence: 1.0,
      },
    ]);

    const lookup = buildPlatformCoOccurrenceLookup(data)!;
    expect(lookup.tiers['1']!['leonardo']!.get('a|b')).toBe(90);
    expect(lookup.tiers['2']!['midjourney']!.get('c|d')).toBe(60);
  });
});

// ============================================================================
// TESTS: lookupPlatformCoOccurrence
// ============================================================================

describe('lookupPlatformCoOccurrence', () => {
  describe('fallback behaviour', () => {
    it('returns tier fallback when lookup is null', () => {
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, null, 75),
      ).toBe(75);
    });

    it('returns tier fallback when platformId is null', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], null, 1, lookup, 75),
      ).toBe(75);
    });

    it('returns tier fallback when tier is null', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformCoOccurrence(
          'beta',
          ['alpha'],
          'leonardo',
          null,
          lookup,
          75,
        ),
      ).toBe(75);
    });

    it('returns tier fallback when selectedTerms is empty', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformCoOccurrence('beta', [], 'leonardo', 1, lookup, 75),
      ).toBe(75);
    });

    it('returns tier fallback for unknown platform', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'craiyon', 1, lookup, 75),
      ).toBe(75);
    });

    it('returns tier fallback when no matching pairs on platform', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      // Looking up gamma+delta which doesn't exist on this platform
      expect(
        lookupPlatformCoOccurrence(
          'delta',
          ['gamma'],
          'leonardo',
          1,
          lookup,
          75,
        ),
      ).toBe(75);
    });
  });

  describe('confidence blending', () => {
    it('returns pure platform weight at confidence 1.0', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        }),
      );
      // platformWeight=90 × 1.0 + tierFallback=50 × 0.0 = 90
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 50),
      ).toBe(90);
    });

    it('returns pure tier fallback at confidence 0.0', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 0.0,
        }),
      );
      // platformWeight=90 × 0.0 + tierFallback=50 × 1.0 = 50
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 50),
      ).toBe(50);
    });

    it('returns exact 50/50 blend at confidence 0.5', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 80 }],
          confidence: 0.5,
        }),
      );
      // platformWeight=80 × 0.5 + tierFallback=40 × 0.5 = 40 + 20 = 60
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 40),
      ).toBe(60);
    });

    it('blends with zero tier fallback', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 80 }],
          confidence: 0.5,
        }),
      );
      // platformWeight=80 × 0.5 + tierFallback=0 × 0.5 = 40
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 0),
      ).toBe(40);
    });
  });

  describe('pair matching', () => {
    it('matches pairs regardless of term order', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 80 }],
          confidence: 1.0,
        }),
      );
      // candidate="alpha", selected=["beta"] → should find alpha|beta
      expect(
        lookupPlatformCoOccurrence('alpha', ['beta'], 'leonardo', 1, lookup, 0),
      ).toBe(80);
      // candidate="beta", selected=["alpha"] → should also find alpha|beta
      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 0),
      ).toBe(80);
    });

    it('averages across multiple matching pairs', () => {
      const lookup = buildPlatformCoOccurrenceLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          pairs: [
            { terms: ['alpha', 'gamma'], weight: 80 },
            { terms: ['beta', 'gamma'], weight: 40 },
          ],
          confidence: 1.0,
        }),
      );
      // candidate="gamma", selected=["alpha","beta"]
      // alpha+gamma=80, beta+gamma=40, avg=60
      expect(
        lookupPlatformCoOccurrence(
          'gamma',
          ['alpha', 'beta'],
          'leonardo',
          1,
          lookup,
          0,
        ),
      ).toBe(60);
    });
  });

  describe('multi-platform scenarios', () => {
    it('returns different weights for different platforms', () => {
      const data = buildMultiPlatformData([
        {
          tier: '1',
          platformId: 'leonardo',
          pairs: [{ terms: ['alpha', 'beta'], weight: 90 }],
          confidence: 1.0,
        },
        {
          tier: '1',
          platformId: 'nightcafe',
          pairs: [{ terms: ['alpha', 'beta'], weight: 20 }],
          confidence: 1.0,
        },
      ]);
      const lookup = buildPlatformCoOccurrenceLookup(data)!;

      expect(
        lookupPlatformCoOccurrence('beta', ['alpha'], 'leonardo', 1, lookup, 50),
      ).toBe(90);
      expect(
        lookupPlatformCoOccurrence(
          'beta',
          ['alpha'],
          'nightcafe',
          1,
          lookup,
          50,
        ),
      ).toBe(20);
    });
  });
});
