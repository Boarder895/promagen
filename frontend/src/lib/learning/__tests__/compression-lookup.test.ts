// src/lib/learning/__tests__/compression-lookup.test.ts
// ============================================================================
// COMPRESSION INTELLIGENCE — Lookup Unit Tests
// ============================================================================
//
// Phase 7.9, Part 7.9d — Tests for the compression lookup bridge.
//
// Verifies buildCompressionLookup, all lookup functions, confidence blending
// for platform length, expendability lookups, tier fallback, and edge cases.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.9
//
// Version: 1.0.0
// Created: 2026-02-28
// ============================================================================

import type {
  CompressionProfilesData,
  OptimalLengthProfile,
  ExpendableTerm,
  PlatformLengthProfile,
  TierPlatformLengthData,
} from '../compression-intelligence';

import {
  buildCompressionLookup,
  lookupOptimalLength,
  lookupPlatformOptimalLength,
  lookupBestOptimalChars,
  lookupExpendability,
  isExpendable,
  lookupExpendableEntry,
  listExpendableTerms,
  listPlatformProfiles,
  type CompressionLookup,
} from '../compression-lookup';

// ============================================================================
// HELPERS
// ============================================================================

function makeProfile(overrides: Partial<OptimalLengthProfile> = {}): OptimalLengthProfile {
  return {
    tier: 2,
    optimalChars: 200,
    diminishingReturnsAt: 350,
    optimalOutcome: 0.72,
    eventCount: 500,
    lengthHistogram: [
      { bucket: 100, avgOutcome: 0.55, count: 50 },
      { bucket: 200, avgOutcome: 0.72, count: 150 },
      { bucket: 300, avgOutcome: 0.65, count: 100 },
    ],
    ...overrides,
  };
}

function makeExpendable(overrides: Partial<ExpendableTerm> & { term: string }): ExpendableTerm {
  return {
    category: 'style',
    tier: 2,
    expendability: 0.55,
    signals: {
      replacementRate: 0.4,
      qualityPenalty: 0.3,
      hasRedundantAlternative: true,
      antiPatternCount: 1,
    },
    ...overrides,
  };
}

function makePlatformProfile(
  overrides: Partial<PlatformLengthProfile> = {},
): PlatformLengthProfile {
  return {
    platformId: 'midjourney',
    tier: 2,
    optimalChars: 180,
    diminishingReturnsAt: 300,
    optimalOutcome: 0.75,
    eventCount: 200,
    deltaFromTier: -20,
    lengthHistogram: [],
    ...overrides,
  };
}

function makeData(overrides: Partial<CompressionProfilesData> = {}): CompressionProfilesData {
  return {
    version: '1.1.0',
    generatedAt: new Date().toISOString(),
    totalEventsAnalysed: 1000,
    lengthProfiles: {
      '2': makeProfile({ tier: 2, optimalChars: 200 }),
    },
    expendableTerms: {
      '2': [
        makeExpendable({ term: 'bland-term', expendability: 0.65 }),
        makeExpendable({ term: 'filler-word', expendability: 0.45 }),
      ],
    },
    platformLengthProfiles: {
      '2': {
        qualifiedPlatforms: 2,
        totalPlatforms: 3,
        platforms: [
          makePlatformProfile({ platformId: 'midjourney', optimalChars: 180, eventCount: 200 }),
          makePlatformProfile({ platformId: 'leonardo', optimalChars: 250, eventCount: 100 }),
        ],
      } as TierPlatformLengthData,
    },
    ...overrides,
  };
}

// ============================================================================
// TESTS — buildCompressionLookup
// ============================================================================

describe('buildCompressionLookup', () => {
  it('returns null for null input', () => {
    expect(buildCompressionLookup(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(buildCompressionLookup(undefined)).toBeNull();
  });

  it('builds lookup from valid data', () => {
    const lookup = buildCompressionLookup(makeData());
    expect(lookup).not.toBeNull();
    expect(lookup!.lengthByTier.size).toBe(1);
    expect(lookup!.expendableByTier.size).toBe(1);
    expect(lookup!.expendableByKey.size).toBe(2);
    expect(lookup!.platformLengthByTierPlatform.size).toBe(1);
  });

  it('preserves totalEventsAnalysed', () => {
    const lookup = buildCompressionLookup(makeData({ totalEventsAnalysed: 5000 }));
    expect(lookup!.totalEventsAnalysed).toBe(5000);
  });

  it('preserves generatedAt', () => {
    const ts = '2026-02-28T12:00:00.000Z';
    const lookup = buildCompressionLookup(makeData({ generatedAt: ts }));
    expect(lookup!.generatedAt).toBe(ts);
  });

  it('handles empty profiles gracefully', () => {
    const lookup = buildCompressionLookup(makeData({
      lengthProfiles: {},
      expendableTerms: {},
      platformLengthProfiles: {},
    }));
    expect(lookup).not.toBeNull();
    expect(lookup!.lengthByTier.size).toBe(0);
    expect(lookup!.expendableByTier.size).toBe(0);
    expect(lookup!.platformLengthByTierPlatform.size).toBe(0);
  });

  it('indexes multiple tiers', () => {
    const lookup = buildCompressionLookup(makeData({
      lengthProfiles: {
        '1': makeProfile({ tier: 1, optimalChars: 150 }),
        '2': makeProfile({ tier: 2, optimalChars: 200 }),
        '3': makeProfile({ tier: 3, optimalChars: 300 }),
      },
    }));
    expect(lookup!.lengthByTier.size).toBe(3);
    expect(lookup!.lengthByTier.get(1)!.optimalChars).toBe(150);
    expect(lookup!.lengthByTier.get(3)!.optimalChars).toBe(300);
  });
});

// ============================================================================
// TESTS — lookupOptimalLength
// ============================================================================

describe('lookupOptimalLength', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns null for null lookup', () => {
    expect(lookupOptimalLength(null, 2)).toBeNull();
  });

  it('returns profile for existing tier', () => {
    const profile = lookupOptimalLength(lookup, 2);
    expect(profile).not.toBeNull();
    expect(profile!.optimalChars).toBe(200);
    expect(profile!.tier).toBe(2);
  });

  it('returns null for missing tier', () => {
    expect(lookupOptimalLength(lookup, 4)).toBeNull();
  });
});

// ============================================================================
// TESTS — lookupPlatformOptimalLength
// ============================================================================

describe('lookupPlatformOptimalLength', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns null for null lookup', () => {
    expect(lookupPlatformOptimalLength(null, 2, 'midjourney')).toBeNull();
  });

  it('returns platform profile for existing platform', () => {
    const profile = lookupPlatformOptimalLength(lookup, 2, 'midjourney');
    expect(profile).not.toBeNull();
    expect(profile!.optimalChars).toBe(180);
  });

  it('returns null for missing platform', () => {
    expect(lookupPlatformOptimalLength(lookup, 2, 'dall-e-3')).toBeNull();
  });

  it('returns null for missing tier', () => {
    expect(lookupPlatformOptimalLength(lookup, 4, 'midjourney')).toBeNull();
  });
});

// ============================================================================
// TESTS — lookupBestOptimalChars (confidence blending)
// ============================================================================

describe('lookupBestOptimalChars', () => {
  it('returns null for null lookup', () => {
    expect(lookupBestOptimalChars(null, 2, null)).toBeNull();
  });

  it('returns tier-level optimal when no platform specified', () => {
    const lookup = buildCompressionLookup(makeData())!;
    expect(lookupBestOptimalChars(lookup, 2, null)).toBe(200);
  });

  it('returns null for missing tier and no platform', () => {
    const lookup = buildCompressionLookup(makeData())!;
    expect(lookupBestOptimalChars(lookup, 4, null)).toBeNull();
  });

  describe('confidence blending', () => {
    function blendData(
      tierOptimal: number,
      platformOptimal: number,
      platformEvents: number,
    ): CompressionProfilesData {
      return makeData({
        lengthProfiles: { '2': makeProfile({ tier: 2, optimalChars: tierOptimal }) },
        platformLengthProfiles: {
          '2': {
            qualifiedPlatforms: 1,
            totalPlatforms: 1,
            platforms: [
              makePlatformProfile({
                platformId: 'test-plat',
                optimalChars: platformOptimal,
                eventCount: platformEvents,
              }),
            ],
          } as TierPlatformLengthData,
        },
      });
    }

    it('blends heavily toward tier at low event counts', () => {
      // 50 events → confidence = 50/500 = 0.10
      // blend = 200 + (100 - 200) × 0.10 = 190
      const lookup = buildCompressionLookup(blendData(200, 100, 50))!;
      expect(lookupBestOptimalChars(lookup, 2, 'test-plat')).toBe(190);
    });

    it('blends equally at mid event counts', () => {
      // 250 events → confidence = 250/500 = 0.50
      // blend = 200 + (300 - 200) × 0.50 = 250
      const lookup = buildCompressionLookup(blendData(200, 300, 250))!;
      expect(lookupBestOptimalChars(lookup, 2, 'test-plat')).toBe(250);
    });

    it('returns pure platform at 500+ events', () => {
      // 600 events → confidence = min(1.0, 600/500) = 1.0
      // blend = 200 + (160 - 200) × 1.0 = 160
      const lookup = buildCompressionLookup(blendData(200, 160, 600))!;
      expect(lookupBestOptimalChars(lookup, 2, 'test-plat')).toBe(160);
    });

    it('caps confidence at 1.0 for very high event counts', () => {
      // 10000 events → confidence = 1.0 (capped), pure platform
      const lookup = buildCompressionLookup(blendData(200, 150, 10000))!;
      expect(lookupBestOptimalChars(lookup, 2, 'test-plat')).toBe(150);
    });

    it('falls back to tier when platform not found', () => {
      const lookup = buildCompressionLookup(makeData())!;
      expect(lookupBestOptimalChars(lookup, 2, 'nonexistent')).toBe(200);
    });
  });
});

// ============================================================================
// TESTS — lookupExpendability
// ============================================================================

describe('lookupExpendability', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns 0 for null lookup', () => {
    expect(lookupExpendability(null, 'bland-term', 2)).toBe(0);
  });

  it('returns expendability for existing term', () => {
    expect(lookupExpendability(lookup, 'bland-term', 2)).toBe(0.65);
  });

  it('returns 0 for unknown term', () => {
    expect(lookupExpendability(lookup, 'unknown-term', 2)).toBe(0);
  });

  it('returns 0 for wrong tier', () => {
    expect(lookupExpendability(lookup, 'bland-term', 1)).toBe(0);
  });
});

// ============================================================================
// TESTS — isExpendable
// ============================================================================

describe('isExpendable', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns false for null lookup', () => {
    expect(isExpendable(null, 'bland-term', 2)).toBe(false);
  });

  it('returns true for term above threshold (0.65 >= 0.40)', () => {
    expect(isExpendable(lookup, 'bland-term', 2)).toBe(true);
  });

  it('returns true for term at threshold (0.45 >= 0.40)', () => {
    expect(isExpendable(lookup, 'filler-word', 2)).toBe(true);
  });

  it('returns false for unknown term (0 < 0.40)', () => {
    expect(isExpendable(lookup, 'unknown', 2)).toBe(false);
  });
});

// ============================================================================
// TESTS — lookupExpendableEntry
// ============================================================================

describe('lookupExpendableEntry', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns null for null lookup', () => {
    expect(lookupExpendableEntry(null, 'bland-term', 2)).toBeNull();
  });

  it('returns full entry with signal breakdown', () => {
    const entry = lookupExpendableEntry(lookup, 'bland-term', 2);
    expect(entry).not.toBeNull();
    expect(entry!.term).toBe('bland-term');
    expect(entry!.expendability).toBe(0.65);
    expect(entry!.signals.replacementRate).toBe(0.4);
    expect(entry!.signals.hasRedundantAlternative).toBe(true);
  });

  it('returns null for unknown term', () => {
    expect(lookupExpendableEntry(lookup, 'unknown', 2)).toBeNull();
  });
});

// ============================================================================
// TESTS — listExpendableTerms
// ============================================================================

describe('listExpendableTerms', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns empty array for null lookup', () => {
    expect(listExpendableTerms(null, 2)).toEqual([]);
  });

  it('returns all expendable terms for tier', () => {
    const terms = listExpendableTerms(lookup, 2);
    expect(terms.length).toBe(2);
  });

  it('returns empty for tier with no data', () => {
    expect(listExpendableTerms(lookup, 4)).toEqual([]);
  });
});

// ============================================================================
// TESTS — listPlatformProfiles
// ============================================================================

describe('listPlatformProfiles', () => {
  let lookup: CompressionLookup;
  beforeEach(() => { lookup = buildCompressionLookup(makeData())!; });

  it('returns empty for null lookup', () => {
    expect(listPlatformProfiles(null, 2)).toEqual([]);
  });

  it('returns platform profiles sorted by eventCount desc', () => {
    const profiles = listPlatformProfiles(lookup, 2);
    expect(profiles.length).toBe(2);
    expect(profiles[0]!.platformId).toBe('midjourney');
    expect(profiles[1]!.platformId).toBe('leonardo');
  });

  it('returns empty for tier with no platform data', () => {
    expect(listPlatformProfiles(lookup, 4)).toEqual([]);
  });
});
