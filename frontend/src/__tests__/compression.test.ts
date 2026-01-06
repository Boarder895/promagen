// src/__tests__/compression.test.ts
// ============================================================================
// COMPRESSION SYSTEM TESTS
// ============================================================================
// Comprehensive tests for the prompt compression feature.
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

  it('should have 120 redundancy patterns', () => {
    expect(compressionDictionary.redundancy.patterns.length).toBe(120);
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
    const stabConfig = platformSupport.platforms['stability'];
    expect(stabConfig).toBeDefined();
    if (stabConfig) {
      expect(stabConfig.tier).toBe(1);
    }
  });

  it('should have DALL-E (OpenAI) in tier 3', () => {
    const dalleConfig = platformSupport.platforms['openai'];
    expect(dalleConfig).toBeDefined();
    if (dalleConfig) {
      expect(dalleConfig.tier).toBe(3);
    }
  });

  it('should have Canva in tier 4', () => {
    const canvaConfig = platformSupport.platforms['canva'];
    expect(canvaConfig).toBeDefined();
    if (canvaConfig) {
      expect(canvaConfig.tier).toBe(4);
    }
  });
});

// ============================================================================
// PLATFORM DETECTION TESTS
// ============================================================================

describe('Platform Detection', () => {
  it('should return tier 1 for Stability', () => {
    expect(getPlatformTier('stability')).toBe(1);
    expect(getPlatformTier('Stability')).toBe(1);
    expect(getPlatformTier('STABILITY')).toBe(1);
  });

  it('should return tier 2 for Midjourney', () => {
    expect(getPlatformTier('midjourney')).toBe(2);
    expect(getPlatformTier('Midjourney')).toBe(2);
  });

  it('should return tier 3 for DALL-E', () => {
    expect(getPlatformTier('openai')).toBe(3);
  });

  it('should return tier 4 for Canva', () => {
    expect(getPlatformTier('canva')).toBe(4);
  });

  it('should return tier 4 for unknown platforms', () => {
    expect(getPlatformTier('unknown-platform')).toBe(4);
    expect(getPlatformTier('')).toBe(4);
  });

  it('should return correct supported categories for tier 1', () => {
    const categories = getSupportedCategories(1);
    expect(categories).toContain('sdWeighted');
    expect(categories).toContain('booruTags');
    expect(categories).toContain('photography');
  });

  it('should return correct supported categories for tier 2', () => {
    const categories = getSupportedCategories(2);
    expect(categories).toContain('midjourneySpecific');
    expect(categories).not.toContain('sdWeighted');
    expect(categories).not.toContain('booruTags');
  });

  it('should return correct supported categories for tier 3', () => {
    const categories = getSupportedCategories(3);
    expect(categories).toContain('negativeToPositive');
    expect(categories).toContain('universal');
    expect(categories).not.toContain('photography');
    expect(categories).not.toContain('sdWeighted');
  });

  it('should return correct supported categories for tier 4', () => {
    const categories = getSupportedCategories(4);
    expect(categories).toContain('negativeToPositive');
    expect(categories).not.toContain('universal');
    expect(categories).not.toContain('photography');
  });
});

// ============================================================================
// FILLER REMOVAL TESTS
// ============================================================================

describe('Filler Removal', () => {
  it('should remove "very" from prompts', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    expect(result.compressed).toBe('a beautiful woman');
  });

  it('should remove "extremely" from prompts', () => {
    const result = compressPrompt('extremely detailed artwork', 'stability');
    expect(result.compressed).toBe('detailed artwork');
  });

  it('should remove multiple fillers', () => {
    const result = compressPrompt('a very extremely really beautiful scene', 'stability');
    expect(result.compressed).toBe('a beautiful scene');
  });

  it('should handle fillers at start of prompt', () => {
    const result = compressPrompt('very detailed portrait', 'stability');
    expect(result.compressed).toBe('detailed portrait');
  });

  it('should handle fillers at end of prompt', () => {
    const result = compressPrompt('portrait, extremely', 'stability');
    expect(result.compressed).not.toContain('extremely');
  });

  it('should preserve semantic content', () => {
    const result = compressPrompt('a very beautiful woman in a very nice garden', 'stability');
    expect(result.compressed).toContain('beautiful');
    expect(result.compressed).toContain('woman');
    expect(result.compressed).toContain('garden');
  });
});

// ============================================================================
// REDUNDANCY REMOVAL TESTS
// ============================================================================

describe('Redundancy Removal', () => {
  it('should compress "red color" to "red"', () => {
    const result = compressPrompt('a red color dress', 'stability');
    expect(result.compressed).toBe('a red dress');
  });

  it('should compress "bright light" to "bright"', () => {
    const result = compressPrompt('bright light illumination', 'stability');
    expect(result.compressed).toBe('bright illumination');
  });

  it('should compress "round circle" to "circle"', () => {
    const result = compressPrompt('a round circle shape', 'stability');
    expect(result.compressed).toBe('a circle shape');
  });

  it('should handle multiple redundancies', () => {
    const result = compressPrompt('red color dress with blue color eyes', 'stability');
    expect(result.compressed).toBe('red dress with blue eyes');
  });
});

// ============================================================================
// PHRASE COMPRESSION TESTS
// ============================================================================

describe('Phrase Compression', () => {
  it('should compress "looking at the camera" to "facing camera"', () => {
    const result = compressPrompt('woman looking at the camera', 'stability');
    expect(result.compressed).toBe('woman facing camera');
  });

  it('should compress "standing in front of" to "before"', () => {
    const result = compressPrompt('man standing in front of building', 'stability');
    expect(result.compressed).toBe('man before building');
  });

  it('should compress "surrounded by" to "amid"', () => {
    const result = compressPrompt('girl surrounded by flowers', 'stability');
    expect(result.compressed).toBe('girl amid flowers');
  });

  it('should compress "in the style of" (remove entirely)', () => {
    const result = compressPrompt('portrait in the style of Rembrandt', 'stability');
    expect(result.compressed).toBe('portrait Rembrandt');
  });

  it('should compress "a photograph of" to "photo of"', () => {
    const result = compressPrompt('a photograph of a sunset', 'stability');
    expect(result.compressed).toBe('photo of a sunset');
  });
});

// ============================================================================
// UNIVERSAL SHORTHAND TESTS (TIER 1-3)
// ============================================================================

describe('Universal Shorthand', () => {
  it('should compress "black and white" to "B&W" for tier 1', () => {
    const result = compressPrompt('black and white portrait', 'stability');
    expect(result.compressed).toBe('B&W portrait');
  });

  it('should compress "high dynamic range" to "HDR" for tier 1', () => {
    const result = compressPrompt('high dynamic range photo', 'stability');
    expect(result.compressed).toBe('HDR photo');
  });

  it('should compress "8K resolution" to "8K" for tier 1', () => {
    const result = compressPrompt('8K resolution image', 'stability');
    expect(result.compressed).toBe('8K image');
  });

  it('should apply universal shorthand for tier 2 (Midjourney)', () => {
    const result = compressPrompt('black and white portrait', 'midjourney');
    expect(result.compressed).toBe('B&W portrait');
  });

  it('should apply universal shorthand for tier 3 (DALL-E)', () => {
    const result = compressPrompt('black and white portrait', 'openai');
    expect(result.compressed).toBe('B&W portrait');
  });

  it('should NOT apply universal shorthand for tier 4 (Canva)', () => {
    const result = compressPrompt('black and white portrait', 'canva');
    // Tier 4 doesn't support universal shorthand
    expect(result.compressed).toBe('black and white portrait');
  });
});

// ============================================================================
// PHOTOGRAPHY SHORTHAND TESTS (TIER 1-2)
// ============================================================================

describe('Photography Shorthand', () => {
  it('should compress "depth of field" to "DoF" for tier 1', () => {
    const result = compressPrompt('shallow depth of field', 'stability');
    expect(result.compressed).toBe('shallow DoF');
  });

  it('should compress "85 millimeter lens" to "85mm" for tier 1', () => {
    const result = compressPrompt('shot with 85 millimeter lens', 'stability');
    expect(result.compressed).toBe('shot with 85mm');
  });

  it('should compress "point of view" to "POV" for tier 1', () => {
    const result = compressPrompt('first person point of view', 'stability');
    expect(result.compressed).toBe('1st person POV');
  });

  it('should compress "over the shoulder" to "OTS" for tier 1', () => {
    const result = compressPrompt('over the shoulder shot', 'stability');
    expect(result.compressed).toBe('OTS');
  });

  it('should apply photography shorthand for tier 2', () => {
    const result = compressPrompt('depth of field blur', 'midjourney');
    expect(result.compressed).toBe('DoF blur');
  });

  it('should NOT apply photography shorthand for tier 3', () => {
    const result = compressPrompt('depth of field blur', 'openai');
    // Tier 3 doesn't support photography shorthand
    expect(result.compressed).toBe('depth of field blur');
  });
});

// ============================================================================
// NEGATIVE TO POSITIVE CONVERSION TESTS (TIER 3-4)
// ============================================================================

describe('Negative to Positive Conversion', () => {
  it('should convert "no blur" to "sharp" for tier 3', () => {
    const result = compressPrompt('portrait no blur', 'openai', { convertNegatives: true });
    expect(result.compressed).toBe('portrait sharp');
  });

  it('should convert "no watermark" to "clean" for tier 3', () => {
    const result = compressPrompt('image no watermark', 'openai', { convertNegatives: true });
    expect(result.compressed).toBe('image clean');
  });

  it('should convert "no noise" to "noiseless" for tier 4', () => {
    const result = compressPrompt('photo no noise', 'canva', { convertNegatives: true });
    expect(result.compressed).toBe('photo noiseless');
  });

  it('should NOT apply negative conversion for tier 1', () => {
    const result = compressPrompt('portrait no blur', 'stability', { convertNegatives: true });
    // Tier 1 doesn't use negative conversion (has proper negative prompts)
    expect(result.compressed).toBe('portrait no blur');
  });
});

// ============================================================================
// COMPRESSION METRICS TESTS
// ============================================================================

describe('Compression Metrics', () => {
  it('should calculate correct character savings', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    expect(result.charsSaved).toBe(5); // "very " = 5 chars
  });

  it('should calculate correct compression ratio', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    expect(result.compressionRatio).toBeLessThan(1);
    expect(result.compressionRatio).toBeGreaterThan(0);
  });

  it('should calculate correct percent saved', () => {
    const result = compressPrompt('a very beautiful woman', 'stability');
    expect(result.percentSaved).toBeGreaterThan(0);
    expect(result.percentSaved).toBeLessThan(100);
  });

  it('should track total replacements', () => {
    const result = compressPrompt('very extremely beautiful scene', 'stability');
    expect(result.totalReplacements).toBeGreaterThanOrEqual(2);
  });

  it('should include processing time', () => {
    const result = compressPrompt('a beautiful scene', 'stability');
    expect(result.processingTimeMs).toBeDefined();
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
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
    expect(result.compressed).toBe('');
  });

  it('should handle string with no compressible content', () => {
    const result = compressPrompt('cat', 'stability');
    expect(result.compressed).toBe('cat');
    expect(result.charsSaved).toBe(0);
  });

  it('should handle unknown platform gracefully', () => {
    const result = compressPrompt('very beautiful cat', 'unknown-platform');
    expect(result.tier).toBe(4);
    expect(result.compressed).toBe('beautiful cat');
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
    expect(result.compressed).toBe('beautiful, detailed, nice');
  });
});

// ============================================================================
// REAL-WORLD PROMPT TESTS
// ============================================================================

describe('Real-World Prompts', () => {
  it('should compress a typical portrait prompt', () => {
    const prompt =
      'a very beautiful young woman looking at the camera, extremely detailed face, soft diffused lighting, shallow depth of field, 8K resolution, black and white photograph';
    const result = compressPrompt(prompt, 'stability');

    expect(result.compressed).toContain('beautiful');
    expect(result.compressed).toContain('facing camera');
    expect(result.compressed).toContain('soft light');
    expect(result.compressed).toContain('DoF');
    expect(result.compressed).toContain('8K');
    expect(result.compressed).toContain('B&W');
    expect(result.charsSaved).toBeGreaterThan(30);
  });

  it('should compress a landscape prompt', () => {
    const prompt =
      'a breathtaking mountain landscape surrounded by dense forest, golden hour lighting, extremely detailed, high dynamic range, shot with 24 millimeter lens';
    const result = compressPrompt(prompt, 'stability');

    expect(result.compressed).toContain('HDR');
    expect(result.compressed).toContain('24mm');
    expect(result.charsSaved).toBeGreaterThan(20);
  });

  it('should compress an anime-style prompt for NovelAI', () => {
    const prompt =
      '1 girl, long hair, blue eyes, looking at the camera, school uniform, very detailed, extremely detailed face';
    const result = compressPrompt(prompt, 'novelai', { applyBooruTags: true });

    expect(result.compressed).toContain('1girl');
    expect(result.compressed).toContain('long_hair');
    expect(result.compressed).toContain('blue_eyes');
  });

  it('should compress a Midjourney prompt', () => {
    const prompt = 'beautiful landscape, extremely detailed, high dynamic range, black and white';
    const result = compressPrompt(prompt, 'midjourney');

    expect(result.compressed).toContain('HDR');
    expect(result.compressed).toContain('B&W');
    expect(result.tier).toBe(2);
  });

  it('should handle a DALL-E prompt (tier 3)', () => {
    const prompt = 'a very beautiful sunset over the ocean, 8K resolution, no watermark';
    const result = compressPrompt(prompt, 'openai', { convertNegatives: true });

    expect(result.compressed).toContain('beautiful');
    expect(result.compressed).toContain('8K');
    expect(result.compressed).toContain('clean'); // no watermark → clean
    expect(result.tier).toBe(3);
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('Utility Functions', () => {
  it('analyzeCompression should estimate savings', () => {
    const analysis = analyzeCompression('a very extremely beautiful scene', 'stability');
    expect(analysis.fillerCount).toBeGreaterThanOrEqual(2);
    expect(analysis.estimatedSavings).toBeGreaterThan(0);
  });

  it('supportsFullShorthand should return correct values', () => {
    expect(supportsFullShorthand('stability')).toBe(true);
    expect(supportsFullShorthand('leonardo')).toBe(true);
    expect(supportsFullShorthand('midjourney')).toBe(false);
    expect(supportsFullShorthand('openai')).toBe(false);
    expect(supportsFullShorthand('canva')).toBe(false);
  });

  it('supportsMidjourneySyntax should return correct values', () => {
    expect(supportsMidjourneySyntax('midjourney')).toBe(true);
    expect(supportsMidjourneySyntax('bluewillow')).toBe(true);
    expect(supportsMidjourneySyntax('stability')).toBe(false);
    expect(supportsMidjourneySyntax('openai')).toBe(false);
  });

  it('getSupportedPlatforms should return all platforms', () => {
    const platforms = getSupportedPlatforms();
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
    expect(stats.redundancyPatterns).toBe(120);
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
});
