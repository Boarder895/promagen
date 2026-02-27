// src/lib/learning/__tests__/platform-term-quality-lookup.test.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Term Quality Lookup Tests
// ============================================================================
//
// Verifies that the blending lookup correctly merges platform-specific
// term quality with tier-level fallback using confidence weighting.
//
// Authority: phase-7.5-per-platform-learning-buildplan.md § 8
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import {
  buildPlatformTermQualityLookup,
  lookupPlatformTermQuality,
} from '../platform-term-quality-lookup';

import type { PlatformTermQualityLookup } from '../platform-term-quality-lookup';
import type { PlatformTermQualityData } from '../platform-term-quality';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a minimal PlatformTermQualityData for testing.
 */
function buildTestData(opts: {
  tier: string;
  platformId: string;
  terms: Record<string, number>; // term → score
  confidence: number;
  eventCount?: number;
}): PlatformTermQualityData {
  const termEntries: Record<
    string,
    { score: number; eventCount: number; trend: number }
  > = {};
  for (const [term, score] of Object.entries(opts.terms)) {
    termEntries[term] = { score, eventCount: 10, trend: 0 };
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: opts.eventCount ?? 500,
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
            terms: termEntries,
            termCount: Object.keys(termEntries).length,
            averageScore: 50,
          },
        },
      },
    },
    totalPlatforms: 1,
    totalTermsScored: Object.keys(termEntries).length,
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
    terms: Record<string, number>;
    confidence: number;
  }>,
): PlatformTermQualityData {
  const tiers: PlatformTermQualityData['tiers'] = {};

  for (const p of platforms) {
    if (!tiers[p.tier]) {
      tiers[p.tier] = { eventCount: 0, platformCount: 0, platforms: {} };
    }
    const termEntries: Record<
      string,
      { score: number; eventCount: number; trend: number }
    > = {};
    for (const [term, score] of Object.entries(p.terms)) {
      termEntries[term] = { score, eventCount: 10, trend: 0 };
    }
    tiers[p.tier]!.platforms[p.platformId] = {
      platformId: p.platformId,
      eventCount: 200,
      confidence: p.confidence,
      graduated: true,
      newestEventAt: new Date().toISOString(),
      terms: termEntries,
      termCount: Object.keys(termEntries).length,
      averageScore: 50,
    };
    tiers[p.tier]!.platformCount++;
    tiers[p.tier]!.eventCount += 200;
  }

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: platforms.length * 200,
    tiers,
    totalPlatforms: platforms.length,
    totalTermsScored: platforms.reduce(
      (s, p) => s + Object.keys(p.terms).length,
      0,
    ),
    graduatedPlatforms: platforms.length,
  };
}

// ============================================================================
// TESTS: buildPlatformTermQualityLookup
// ============================================================================

describe('buildPlatformTermQualityLookup', () => {
  it('returns null for null input', () => {
    expect(buildPlatformTermQualityLookup(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildPlatformTermQualityLookup(undefined)).toBeNull();
  });

  it('builds indexed maps from valid data', () => {
    const data = buildTestData({
      tier: '1',
      platformId: 'leonardo',
      terms: { 'neon glow': 85, 'flat matte': 30 },
      confidence: 0.8,
    });

    const lookup = buildPlatformTermQualityLookup(data);
    expect(lookup).not.toBeNull();
    expect(lookup!.tiers['1']!['leonardo']).toBeInstanceOf(Map);
    expect(lookup!.tiers['1']!['leonardo']!.get('neon glow')).toBe(85);
    expect(lookup!.tiers['1']!['leonardo']!.get('flat matte')).toBe(30);
    expect(lookup!.confidences['1']!['leonardo']).toBe(0.8);
    expect(lookup!.eventCount).toBe(500);
  });

  it('indexes multiple platforms across tiers', () => {
    const data = buildMultiPlatformData([
      {
        tier: '1',
        platformId: 'leonardo',
        terms: { alpha: 70 },
        confidence: 0.5,
      },
      {
        tier: '1',
        platformId: 'nightcafe',
        terms: { beta: 40 },
        confidence: 0.3,
      },
      {
        tier: '2',
        platformId: 'midjourney',
        terms: { gamma: 90 },
        confidence: 1.0,
      },
    ]);

    const lookup = buildPlatformTermQualityLookup(data)!;
    expect(lookup.tiers['1']!['leonardo']!.get('alpha')).toBe(70);
    expect(lookup.tiers['1']!['nightcafe']!.get('beta')).toBe(40);
    expect(lookup.tiers['2']!['midjourney']!.get('gamma')).toBe(90);
    expect(lookup.confidences['1']!['nightcafe']).toBe(0.3);
  });
});

// ============================================================================
// TESTS: lookupPlatformTermQuality
// ============================================================================

describe('lookupPlatformTermQuality', () => {
  describe('fallback behaviour', () => {
    it('returns tier fallback when lookup is null', () => {
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, null, 65),
      ).toBe(65);
    });

    it('returns tier fallback when platformId is null', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformTermQuality('neon glow', null, 1, lookup, 65),
      ).toBe(65);
    });

    it('returns tier fallback when tier is null', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', null, lookup, 65),
      ).toBe(65);
    });

    it('returns 50 (neutral) when both lookup and tier fallback are null', () => {
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, null, null),
      ).toBe(50);
    });

    it('returns tier fallback for unknown platform', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformTermQuality('neon glow', 'craiyon', 1, lookup, 65),
      ).toBe(65);
    });

    it('returns tier fallback for unknown term', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      expect(
        lookupPlatformTermQuality('unknown term', 'leonardo', 1, lookup, 65),
      ).toBe(65);
    });
  });

  describe('confidence blending', () => {
    it('returns pure platform score at confidence 1.0', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      // platformScore=90 × 1.0 + tierFallback=50 × 0.0 = 90
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, lookup, 50),
      ).toBe(90);
    });

    it('returns pure tier fallback at confidence 0.0', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 0.0,
        }),
      );
      // platformScore=90 × 0.0 + tierFallback=50 × 1.0 = 50
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, lookup, 50),
      ).toBe(50);
    });

    it('returns exact 50/50 blend at confidence 0.5', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 0.5,
        }),
      );
      // platformScore=90 × 0.5 + tierFallback=50 × 0.5 = 45 + 25 = 70
      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, lookup, 50),
      ).toBe(70);
    });

    it('blends correctly with high tier fallback and low platform score', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'bad term': 20 },
          confidence: 0.8,
        }),
      );
      // platformScore=20 × 0.8 + tierFallback=70 × 0.2 = 16 + 14 = 30
      expect(
        lookupPlatformTermQuality('bad term', 'leonardo', 1, lookup, 70),
      ).toBe(30);
    });

    it('handles term with different casing', () => {
      const lookup = buildPlatformTermQualityLookup(
        buildTestData({
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        }),
      );
      // Term normalised to lowercase internally
      expect(
        lookupPlatformTermQuality('Neon Glow', 'leonardo', 1, lookup, 50),
      ).toBe(90);
    });
  });

  describe('multi-platform scenarios', () => {
    it('returns different scores for different platforms', () => {
      const data = buildMultiPlatformData([
        {
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        },
        {
          tier: '1',
          platformId: 'nightcafe',
          terms: { 'neon glow': 30 },
          confidence: 1.0,
        },
      ]);
      const lookup = buildPlatformTermQualityLookup(data)!;

      expect(
        lookupPlatformTermQuality('neon glow', 'leonardo', 1, lookup, 50),
      ).toBe(90);
      expect(
        lookupPlatformTermQuality('neon glow', 'nightcafe', 1, lookup, 50),
      ).toBe(30);
    });

    it('returns tier fallback for platform not in data', () => {
      const data = buildMultiPlatformData([
        {
          tier: '1',
          platformId: 'leonardo',
          terms: { 'neon glow': 90 },
          confidence: 1.0,
        },
      ]);
      const lookup = buildPlatformTermQualityLookup(data)!;

      expect(
        lookupPlatformTermQuality('neon glow', 'craiyon', 1, lookup, 65),
      ).toBe(65);
    });
  });
});
