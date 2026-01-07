// src/__tests__/compression.test.ts
// ============================================================================
// COMPRESSION SYSTEM TESTS
// ============================================================================
// Tests for the prompt compression feature.
// Tests API contracts and structure rather than exact string output.
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import {
  compressPrompt,
  getPlatformTier,
  getPlatformConfig,
  getSupportedCategories,
  analyzeCompression,
  supportsFullShorthand,
  supportsMidjourneySyntax,
  getSupportedPlatforms,
} from '@/lib/compress';

import {
  compressionDictionary,
  platformSupport,
  getTotalMappings,
  getAllPlatformIds,
  getPlatformsByTier,
  getCompressionStats,
} from '@/data/compression';

import type { CompressionTier } from '@/types/compression';

// ============================================================================
// DATA INTEGRITY TESTS
// ============================================================================

describe('Compression Dictionary Integrity', () => {
  it('should have valid version string', () => {
    expect(compressionDictionary.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have valid lastUpdated date', () => {
    const date = new Date(compressionDictionary.lastUpdated);
    expect(date.getTime()).not.toBeNaN();
  });

  it('should have totalMappings count > 4000', () => {
    expect(compressionDictionary.totalMappings).toBeGreaterThan(4000);
  });

  it('should have all required categories', () => {
    const requiredCategories = [
      'fillers',
      'redundancy',
      'universal',
      'photography',
      'art',
      'phrases',
      'lighting',
      'style',
      'quality',
      'camera',
      'atmosphere',
      'environment',
      'materials',
      'subject',
      'action',
      'colour',
      'negativeToPositive',
      'sdWeighted',
      'midjourneySpecific',
      'booruTags',
    ];

    for (const category of requiredCategories) {
      expect(compressionDictionary).toHaveProperty(category);
    }
  });

  it('should have 150 filler terms', () => {
    expect(compressionDictionary.fillers.terms.length).toBe(150);
  });

  it('should have at least 100 redundancy patterns', () => {
    expect(compressionDictionary.redundancy.patterns.length).toBeGreaterThanOrEqual(100);
  });

  it('should have no empty filler terms', () => {
    for (const term of compressionDictionary.fillers.terms) {
      expect(term.trim().length).toBeGreaterThan(0);
    }
  });

  it('should have valid redundancy patterns (replacement shorter than match)', () => {
    for (const pattern of compressionDictionary.redundancy.patterns) {
      expect(pattern.replace.length).toBeLessThanOrEqual(pattern.match.length);
    }
  });
});

describe('Platform Support Matrix Integrity', () => {
  it('should have valid version string', () => {
    expect(platformSupport.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have 42 platforms', () => {
    const platformCount = Object.keys(platformSupport.platforms).length;
    expect(platformCount).toBe(42);
  });

  it('should have all 4 tiers defined', () => {
    expect(platformSupport.tiers).toHaveProperty('1');
    expect(platformSupport.tiers).toHaveProperty('2');
    expect(platformSupport.tiers).toHaveProperty('3');
    expect(platformSupport.tiers).toHaveProperty('4');
  });

  it('should have valid tier for each platform', () => {
    const validTiers: CompressionTier[] = [1, 2, 3, 4];
    for (const [, config] of Object.entries(platformSupport.platforms)) {
      expect(validTiers).toContain(config.tier);
    }
  });

  it('should have Midjourney in tier 2', () => {
    const mjConfig = platformSupport.platforms['midjourney'];
    expect(mjConfig).toBeDefined();
    if (mjConfig) {
      expect(mjConfig.tier).toBe(2);
    }
  });

  it('should have Stability in tier 1', () => {
    const config = platformSupport.platforms['stability'];
    expect(config).toBeDefined();
    if (config) {
      expect(config.tier).toBe(1);
    }
  });

  it('should have DALL-E/OpenAI in tier 3', () => {
    const config = platformSupport.platforms['openai'];
    expect(config).toBeDefined();
    if (config) {
      expect(config.tier).toBe(3);
    }
  });

  it('should have Canva in tier 4', () => {
    const config = platformSupport.platforms['canva'];
    expect(config).toBeDefined();
    if (config) {
      expect(config.tier).toBe(4);
    }
  });

  it('should have valid shorthandLevel for each platform', () => {
    const validLevels = ['FULL', 'HIGH', 'UNIVERSAL', 'MINIMAL'];
    for (const [, config] of Object.entries(platformSupport.platforms)) {
      expect(validLevels).toContain(config.shorthandLevel);
    }
  });
});

// ============================================================================
// COMPRESSION FUNCTION TESTS
// ============================================================================

describe('compressPrompt Function', () => {
  it('should return valid CompressionResult structure', () => {
    const result = compressPrompt('a beautiful scene', 'stability');

    expect(result).toHaveProperty('original');
    expect(result).toHaveProperty('compressed');
    expect(result).toHaveProperty('originalLength');
    expect(result).toHaveProperty('compressedLength');
    expect(result).toHaveProperty('charsSaved');
    expect(result).toHaveProperty('compressionRatio');
    expect(result).toHaveProperty('percentSaved');
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('platformId');
    expect(result).toHaveProperty('targetAchieved');
    expect(result).toHaveProperty('targetLength');
    expect(result).toHaveProperty('passes');
    expect(result).toHaveProperty('totalReplacements');
    expect(result).toHaveProperty('processingTimeMs');
  });

  it('should preserve original in result', () => {
    const input = 'a beautiful sunset';
    const result = compressPrompt(input, 'stability');
    expect(result.original).toBe(input);
  });

  it('should return correct platformId', () => {
    const result = compressPrompt('test', 'midjourney');
    expect(result.platformId).toBe('midjourney');
  });

  it('should return valid tier for known platforms', () => {
    expect(compressPrompt('test', 'stability').tier).toBe(1);
    expect(compressPrompt('test', 'midjourney').tier).toBe(2);
    expect(compressPrompt('test', 'openai').tier).toBe(3);
    expect(compressPrompt('test', 'canva').tier).toBe(4);
  });

  it('should default to tier 4 for unknown platforms', () => {
    const result = compressPrompt('test', 'unknown-platform-xyz');
    expect(result.tier).toBe(4);
  });

  it('should not increase string length', () => {
    const inputs = [
      'a very beautiful landscape',
      'extremely detailed portrait',
      'high quality 8K resolution image',
    ];

    for (const input of inputs) {
      const result = compressPrompt(input, 'stability');
      expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
    }
  });

  it('should have valid compression ratio between 0 and 1', () => {
    const result = compressPrompt('a very beautiful scene', 'stability');
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.compressionRatio).toBeLessThanOrEqual(1);
  });

  it('should have valid percentSaved between 0 and 100', () => {
    const result = compressPrompt('a very beautiful scene', 'stability');
    expect(result.percentSaved).toBeGreaterThanOrEqual(0);
    expect(result.percentSaved).toBeLessThanOrEqual(100);
  });

  it('should track processing time', () => {
    const result = compressPrompt('a beautiful scene', 'stability');
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// FILLER REMOVAL TESTS
// ============================================================================

describe('Filler Removal', () => {
  it('should remove "very" from prompts', () => {
    const result = compressPrompt('a very beautiful cat', 'stability');
    expect(result.compressed).not.toMatch(/\bvery\b/i);
  });

  it('should remove "extremely" from prompts', () => {
    const result = compressPrompt('extremely detailed face', 'stability');
    expect(result.compressed).not.toMatch(/\bextremely\b/i);
  });

  it('should remove "really" from prompts', () => {
    const result = compressPrompt('really nice garden', 'stability');
    expect(result.compressed).not.toMatch(/\breally\b/i);
  });

  it('should preserve semantic content after filler removal', () => {
    const result = compressPrompt('a very beautiful garden', 'stability');
    expect(result.compressed).toContain('beautiful');
    expect(result.compressed).toContain('garden');
  });
});

// ============================================================================
// REDUNDANCY REMOVAL TESTS
// ============================================================================

describe('Redundancy Removal', () => {
  it('should return valid compression result for redundant patterns', () => {
    const result = compressPrompt('a red color dress', 'stability');
    expect(result).toHaveProperty('compressed');
    expect(result).toHaveProperty('charsSaved');
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should handle multiple patterns without error', () => {
    const result = compressPrompt('red color dress with blue color eyes', 'stability');
    expect(result).toHaveProperty('compressed');
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should preserve core terms', () => {
    const result = compressPrompt('a red color dress', 'stability');
    expect(result.compressed).toContain('red');
    expect(result.compressed).toContain('dress');
  });
});

// ============================================================================
// PHRASE COMPRESSION TESTS
// ============================================================================

describe('Phrase Compression', () => {
  it('should return valid result for common phrases', () => {
    const phrases = [
      'woman looking at the camera',
      'man standing in front of building',
      'girl surrounded by flowers',
      'portrait in the style of Rembrandt',
      'a photograph of a sunset',
    ];

    for (const phrase of phrases) {
      const result = compressPrompt(phrase, 'stability');
      expect(result).toHaveProperty('compressed');
      expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
    }
  });

  it('should preserve key nouns', () => {
    const result = compressPrompt('woman looking at the camera', 'stability');
    expect(result.compressed).toContain('woman');
  });
});

// ============================================================================
// TIER-SPECIFIC BEHAVIOR TESTS
// ============================================================================

describe('Tier-Specific Behavior', () => {
  it('should return tier 1 for Stability AI platforms', () => {
    const result = compressPrompt('test prompt', 'stability');
    expect(result.tier).toBe(1);
  });

  it('should return tier 2 for Midjourney', () => {
    const result = compressPrompt('test prompt', 'midjourney');
    expect(result.tier).toBe(2);
  });

  it('should return tier 3 for DALL-E/OpenAI', () => {
    const result = compressPrompt('test prompt', 'openai');
    expect(result.tier).toBe(3);
  });

  it('should return tier 4 for consumer platforms', () => {
    const result = compressPrompt('test prompt', 'canva');
    expect(result.tier).toBe(4);
  });

  it('should not modify tier 4 prompts excessively', () => {
    const input = 'black and white portrait';
    const result = compressPrompt(input, 'canva');
    expect(result.compressed).toBe(input);
  });
});

// ============================================================================
// COMPRESSION METRICS TESTS
// ============================================================================

describe('Compression Metrics', () => {
  it('should calculate charsSaved correctly', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    expect(result.charsSaved).toBe(result.originalLength - result.compressedLength);
  });

  it('should have valid compression ratio', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    const expectedRatio = result.compressedLength / result.originalLength;
    expect(result.compressionRatio).toBeCloseTo(expectedRatio, 5);
  });

  it('should track passes array', () => {
    const result = compressPrompt('very extremely beautiful scene', 'stability');
    expect(Array.isArray(result.passes)).toBe(true);
  });

  it('should return correct tier', () => {
    const result = compressPrompt('a scene', 'stability');
    expect(result.tier).toBe(1);

    const result2 = compressPrompt('a scene', 'midjourney');
    expect(result2.tier).toBe(2);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty string', () => {
    const result = compressPrompt('', 'stability');
    expect(result.compressed).toBe('');
    expect(result.charsSaved).toBe(0);
    expect(result.compressionRatio).toBe(1);
  });

  it('should handle whitespace-only string', () => {
    const result = compressPrompt('   ', 'stability');
    expect(result).toHaveProperty('compressed');
    expect(result.compressed.trim()).toBe('');
  });

  it('should handle string with no compressible content', () => {
    const result = compressPrompt('cat', 'stability');
    expect(result.compressed).toBe('cat');
    expect(result.charsSaved).toBe(0);
  });

  it('should handle unknown platform gracefully', () => {
    const result = compressPrompt('very beautiful cat', 'unknown-platform');
    expect(result.tier).toBe(4);
    expect(result).toHaveProperty('compressed');
  });

  it('should preserve case when possible', () => {
    const result = compressPrompt('A Beautiful Scene', 'stability');
    expect(result.compressed).toBe('A Beautiful Scene');
  });

  it('should handle multiple spaces', () => {
    const result = compressPrompt('a  very   beautiful    scene', 'stability');
    expect(result.compressed).not.toContain('  ');
  });

  it('should handle comma-separated terms', () => {
    const result = compressPrompt('very beautiful, extremely detailed, really nice', 'stability');
    expect(result).toHaveProperty('compressed');
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });
});

// ============================================================================
// REAL-WORLD PROMPT TESTS
// ============================================================================

describe('Real-World Prompts', () => {
  it('should return valid result for a typical portrait prompt', () => {
    const prompt =
      'a very beautiful young woman looking at the camera, extremely detailed face, soft diffused lighting, shallow depth of field, 8K resolution, black and white photograph';
    const result = compressPrompt(prompt, 'stability');

    expect(result).toHaveProperty('compressed');
    expect(result.compressed).toContain('beautiful');
    expect(result.tier).toBe(1);
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should return valid result for a landscape prompt', () => {
    const prompt =
      'a breathtaking mountain landscape surrounded by dense forest, golden hour lighting, extremely detailed, high dynamic range, shot with 24 millimeter lens';
    const result = compressPrompt(prompt, 'stability');

    expect(result).toHaveProperty('compressed');
    expect(result.tier).toBe(1);
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should return valid result for an anime-style prompt', () => {
    const prompt =
      '1 girl, long hair, blue eyes, looking at the camera, school uniform, very detailed, extremely detailed face';
    const result = compressPrompt(prompt, 'novelai', { applyBooruTags: true });

    expect(result).toHaveProperty('compressed');
    expect(result.tier).toBe(1);
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should return valid result for a Midjourney prompt', () => {
    const prompt = 'beautiful landscape, extremely detailed, high dynamic range, black and white';
    const result = compressPrompt(prompt, 'midjourney');

    expect(result).toHaveProperty('compressed');
    expect(result.tier).toBe(2);
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });

  it('should return valid result for a DALL-E prompt', () => {
    const prompt = 'a very beautiful sunset over the ocean, 8K resolution, no watermark';
    const result = compressPrompt(prompt, 'openai', { convertNegatives: true });

    expect(result).toHaveProperty('compressed');
    expect(result.compressed).toContain('beautiful');
    expect(result.tier).toBe(3);
    expect(result.compressedLength).toBeLessThanOrEqual(result.originalLength);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  it('getPlatformTier should return correct tiers', () => {
    expect(getPlatformTier('stability')).toBe(1);
    expect(getPlatformTier('midjourney')).toBe(2);
    expect(getPlatformTier('openai')).toBe(3);
    expect(getPlatformTier('canva')).toBe(4);
  });

  it('getPlatformTier should return 4 for unknown platforms', () => {
    expect(getPlatformTier('unknown-platform')).toBe(4);
  });

  it('getSupportedCategories should return array for each tier', () => {
    for (const tier of [1, 2, 3, 4] as CompressionTier[]) {
      const categories = getSupportedCategories(tier);
      expect(Array.isArray(categories)).toBe(true);
    }
  });

  it('supportsFullShorthand should return true for tier 1', () => {
    expect(supportsFullShorthand('stability')).toBe(true);
    expect(supportsFullShorthand('midjourney')).toBe(false);
  });

  it('supportsMidjourneySyntax should return true for tier 2', () => {
    expect(supportsMidjourneySyntax('midjourney')).toBe(true);
    expect(supportsMidjourneySyntax('stability')).toBe(false);
  });

  it('getSupportedPlatforms should return array of platforms', () => {
    const platforms = getSupportedPlatforms();
    expect(Array.isArray(platforms)).toBe(true);
    expect(platforms.length).toBe(42);
    expect(platforms.some((p) => p.id === 'stability')).toBe(true);
    expect(platforms.some((p) => p.id === 'midjourney')).toBe(true);
  });

  it('getCompressionStats should return valid stats', () => {
    const stats = getCompressionStats();
    expect(stats.totalMappings).toBeGreaterThan(4000);
    expect(stats.platforms).toBe(42);
    expect(stats.tiers).toBe(4);
    expect(stats.fillerTerms).toBe(150);
    expect(stats.redundancyPatterns).toBeGreaterThanOrEqual(100);
  });

  it('getAllPlatformIds should return 42 IDs', () => {
    const ids = getAllPlatformIds();
    expect(ids.length).toBe(42);
  });

  it('getPlatformsByTier should return correct platforms', () => {
    const tier1 = getPlatformsByTier(1);
    expect(tier1).toContain('stability');
    expect(tier1).toContain('leonardo');
    expect(tier1.length).toBeGreaterThanOrEqual(13);

    const tier2 = getPlatformsByTier(2);
    expect(tier2).toContain('midjourney');
    expect(tier2).toContain('bluewillow');

    const tier3 = getPlatformsByTier(3);
    expect(tier3).toContain('openai');
    expect(tier3).toContain('flux');

    const tier4 = getPlatformsByTier(4);
    expect(tier4).toContain('canva');
    expect(tier4.length).toBeGreaterThanOrEqual(15);
  });

  it('getPlatformConfig should return valid config', () => {
    const config = getPlatformConfig('stability');
    expect(config).not.toBeNull();
    if (config) {
      expect(config.tier).toBe(1);
      expect(config.shorthandLevel).toBe('FULL');
    }
  });

  it('getPlatformConfig should return null for unknown', () => {
    const config = getPlatformConfig('unknown-platform-xyz');
    expect(config).toBeNull();
  });

  it('getTotalMappings should return count > 4000', () => {
    const count = getTotalMappings();
    expect(count).toBeGreaterThan(4000);
  });
});

// ============================================================================
// ANALYZE COMPRESSION TESTS
// ============================================================================

describe('analyzeCompression', () => {
  it('should return valid analysis structure', () => {
    const analysis = analyzeCompression('a very beautiful scene', 'stability');

    expect(analysis).toHaveProperty('estimatedSavings');
    expect(analysis).toHaveProperty('fillerCount');
    expect(analysis).toHaveProperty('redundancyCount');
    expect(analysis).toHaveProperty('phraseCount');
    expect(analysis).toHaveProperty('tier');
  });

  it('should detect fillers', () => {
    const analysis = analyzeCompression('a very extremely beautiful scene', 'stability');
    expect(analysis.fillerCount).toBeGreaterThanOrEqual(2);
  });

  it('should return correct tier', () => {
    expect(analyzeCompression('test', 'stability').tier).toBe(1);
    expect(analyzeCompression('test', 'midjourney').tier).toBe(2);
    expect(analyzeCompression('test', 'openai').tier).toBe(3);
    expect(analyzeCompression('test', 'canva').tier).toBe(4);
  });

  it('should handle empty input', () => {
    const analysis = analyzeCompression('', 'stability');
    expect(analysis.estimatedSavings).toBe(0);
    expect(analysis.fillerCount).toBe(0);
    expect(analysis.tier).toBe(4);
  });
});

// ============================================================================
// COMPRESSION OPTIONS TESTS
// ============================================================================

describe('Compression Options', () => {
  it('should accept skipCategories option', () => {
    const result = compressPrompt('very beautiful', 'stability', {
      skipCategories: ['fillers'],
    });
    expect(result.compressed).toContain('very');
  });

  it('should accept targetLength option', () => {
    const result = compressPrompt('a very beautiful landscape scene', 'stability', {
      targetLength: 100,
    });
    expect(result.targetLength).toBe(100);
  });

  it('should handle applyWeights option', () => {
    const result = compressPrompt('beautiful scene', 'stability', {
      applyWeights: true,
    });
    expect(result).toHaveProperty('compressed');
  });

  it('should handle applyBooruTags option', () => {
    const result = compressPrompt('1 girl, blue eyes', 'novelai', {
      applyBooruTags: true,
    });
    expect(result).toHaveProperty('compressed');
  });

  it('should handle convertNegatives option', () => {
    const result = compressPrompt('portrait no blur', 'openai', {
      convertNegatives: true,
    });
    expect(result).toHaveProperty('compressed');
  });
});
