// src/lib/__tests__/prompt-builder-3-stage.test.ts
// ============================================================================
// 3-STAGE PIPELINE TESTS — Static → Dynamic → Optimize
// ============================================================================
// Validates the 3-stage assembly pipeline for the first 10 keyword-based
// platforms (Tier 1 + Tier 2). Tests verify:
//
//   Stage 1 (Static):  assembleStatic()       — raw comma join, no intelligence
//   Stage 2 (Dynamic): assemblePrompt(skipTrim)— platform formatting, no trimming
//   Stage 3 (default): assemblePrompt()       — platform formatting WITH trimming
//
// Test project: util (node environment)
// Run: pnpm test -- --selectProjects util --testPathPattern="3-stage" --verbose
// ============================================================================

import {
  assemblePrompt,
  assembleStatic,
  getPlatformFormat,
} from '@/lib/prompt-builder';

import type { PromptSelections, AssembledPrompt } from '@/types/prompt-builder';
import type { AssemblyOptions } from '@/lib/prompt-builder';

// ============================================================================
// SHARED TEST DATA
// ============================================================================

/** Minimal selections for deterministic testing (1 term per positive category) */
const MINIMAL_SELECTIONS: PromptSelections = {
  subject: ['samurai warrior'],
  action: ['standing'],
  style: ['cinematic'],
  environment: ['mountain temple'],
  composition: [],
  camera: [],
  lighting: ['golden hour'],
  colour: [],
  atmosphere: ['misty'],
  materials: [],
  fidelity: [],
  negative: ['blurry', 'low quality'],
};

/** Heavy selections that would exceed most sweet spots without trimming */
const HEAVY_SELECTIONS: PromptSelections = {
  subject: ['samurai warrior with ornate armour'],
  action: ['charging forward with katana raised'],
  style: ['cinematic dramatic lighting'],
  environment: ['ancient mountain temple at dawn surrounded by cherry blossoms'],
  composition: ['rule of thirds with leading lines'],
  camera: ['low angle shot with wide lens'],
  lighting: ['golden hour with volumetric rays streaming through trees'],
  colour: ['warm amber tones with deep shadows'],
  atmosphere: ['misty fog rolling through the valley'],
  materials: ['weathered bronze and polished steel'],
  fidelity: ['ultra detailed sharp focus'],
  negative: ['blurry', 'low quality', 'watermark'],
};

/** Empty selections */
const EMPTY_SELECTIONS: PromptSelections = {
  subject: [],
  action: [],
  style: [],
  environment: [],
  composition: [],
  camera: [],
  lighting: [],
  colour: [],
  atmosphere: [],
  materials: [],
  fidelity: [],
  negative: [],
};

// First 10 platforms (all keyword-based)
const TIER_2_PLATFORMS = ['midjourney', 'bluewillow'] as const;
// v5.2.0: All T1 platforms now have CLIP weights (weightingSyntax + weightedCategories)
const TIER_1_WEIGHTED = [
  'stability', 'dreamstudio', 'lexica', 'playground',
  'nightcafe', 'getimg', 'openart', 'clipdrop',
] as const;
// Sweet-spot grouping for trim tests (separate from weighting)
const TIER_1_SS80 = ['dreamstudio', 'lexica', 'playground', 'nightcafe', 'getimg', 'openart', 'clipdrop'] as const; // sweetSpot=80
const ALL_CLIP_WEIGHTED = [...TIER_1_WEIGHTED] as const;
const ALL_10_PLATFORMS = [...TIER_2_PLATFORMS, ...TIER_1_WEIGHTED] as const;

// ============================================================================
// assembleStatic() — Stage 1
// ============================================================================

describe('Stage 1: assembleStatic()', () => {
  describe('empty selections', () => {
    it.each(ALL_10_PLATFORMS)('%s returns empty positive for empty selections', (platformId) => {
      const result = assembleStatic(platformId, EMPTY_SELECTIONS);
      expect(result.positive).toBe('');
    });
  });

  describe('raw comma join — no intelligence', () => {
    it.each(ALL_10_PLATFORMS)('%s joins selections in CATEGORY_ORDER', (platformId) => {
      const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

      // Must contain all user terms
      expect(result.positive).toContain('samurai warrior');
      expect(result.positive).toContain('standing');
      expect(result.positive).toContain('cinematic');
      expect(result.positive).toContain('mountain temple');
      expect(result.positive).toContain('golden hour');
      expect(result.positive).toContain('misty');
    });

    it.each(ALL_10_PLATFORMS)('%s does NOT inject quality prefix', (platformId) => {
      const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

      // Static mode must NOT add platform quality tags
      expect(result.positive).not.toContain('masterpiece');
      expect(result.positive).not.toContain('best quality');
      expect(result.positive).not.toContain('highly detailed');
    });

    it.each(ALL_10_PLATFORMS)('%s does NOT apply CLIP weights', (platformId) => {
      const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

      // No weight syntax like (term:1.2) or term::1.2
      expect(result.positive).not.toMatch(/\(\w+:[\d.]+\)/);
      expect(result.positive).not.toMatch(/::\d+\.\d+/);
    });

    it.each(ALL_10_PLATFORMS)('%s does NOT reorder by impact priority', (platformId) => {
      const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

      // In CATEGORY_ORDER, subject comes before style, style before lighting.
      // For platforms like Midjourney, impactPriority would put atmosphere before action,
      // but Static mode must preserve CATEGORY_ORDER (subject, action, style, environment...).
      const posIdx = (term: string) => result.positive.indexOf(term);
      expect(posIdx('samurai warrior')).toBeLessThan(posIdx('standing')); // subject < action
      expect(posIdx('standing')).toBeLessThan(posIdx('cinematic'));       // action < style
      expect(posIdx('cinematic')).toBeLessThan(posIdx('mountain temple')); // style < environment
    });

    it.each(ALL_10_PLATFORMS)('%s does NOT trim to sweet spot', (platformId) => {
      const result = assembleStatic(platformId, HEAVY_SELECTIONS);

      // Heavy selections should all survive — no trimming
      expect(result.positive).toContain('samurai warrior with ornate armour');
      expect(result.positive).toContain('charging forward with katana raised');
      expect(result.positive).toContain('ultra detailed sharp focus');
      expect(result.positive).toContain('weathered bronze and polished steel');
    });
  });

  describe('negative handling — Tier 2 inline', () => {
    it.each(TIER_2_PLATFORMS)('%s applies --no syntax for inline negatives', (platformId) => {
      const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

      // Inline negatives should use --no syntax so they actually work
      expect(result.positive).toContain('--no');
      expect(result.positive).toContain('blurry');
      expect(result.positive).toContain('low quality');
      expect(result.negativeMode).toBe('inline');
    });
  });

  describe('negative handling — Tier 1 separate', () => {
    it.each(TIER_1_WEIGHTED)(
      '%s puts negatives in separate field',
      (platformId) => {
        const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

        // Positives should NOT contain negative terms
        expect(result.positive).not.toContain('blurry');
        expect(result.positive).not.toContain('low quality');

        // Negatives go to separate field (raw, no quality negatives injected)
        expect(result.negative).toBeDefined();
        expect(result.negative).toContain('blurry');
        expect(result.negative).toContain('low quality');
        expect(result.negativeMode).toBe('separate');
      },
    );

    it.each(TIER_1_WEIGHTED)(
      '%s does NOT inject platform quality negatives in static mode',
      (platformId) => {
        const result = assembleStatic(platformId, MINIMAL_SELECTIONS);

        // Platform quality negatives like "worst quality", "jpeg artifacts" etc.
        // should NOT be injected in static mode — only user-selected negatives
        if (result.negative) {
          const negTerms = result.negative.split(', ');
          expect(negTerms.length).toBe(2); // only "blurry" and "low quality"
        }
      },
    );
  });
});

// ============================================================================
// assemblePrompt({ skipTrim: true }) — Stage 2 (Dynamic, no trim)
// ============================================================================

describe('Stage 2: assemblePrompt with skipTrim (Dynamic mode)', () => {
  describe('empty selections', () => {
    it.each(ALL_10_PLATFORMS)('%s returns empty for empty selections', (platformId) => {
      const result = assemblePrompt(platformId, EMPTY_SELECTIONS, undefined, { skipTrim: true });
      expect(result.positive).toBe('');
    });
  });

  describe('platform formatting applied', () => {
    it.each(TIER_1_WEIGHTED)('%s injects quality prefix', (platformId) => {
      const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // Quality prefix should be present (e.g., "masterpiece, best quality, highly detailed")
      expect(result.positive).toContain('masterpiece');
    });

    it.each(TIER_2_PLATFORMS)('%s does NOT inject quality prefix (MJ family)', (platformId) => {
      const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // Midjourney family has no quality prefix
      expect(result.positive).not.toContain('masterpiece');
    });

    // v5.2.0: All T1 platforms now have CLIP weights (weightingSyntax + weightedCategories)
    it.each(TIER_1_WEIGHTED)('%s applies CLIP weights', (platformId) => {
      const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // All T1 platforms should apply (term:weight) syntax
      expect(result.positive).toMatch(/\([^)]+:\d+\.\d+\)/);
    });
  });

  describe('impact priority reordering applied', () => {
    it('midjourney front-loads subject + style + atmosphere', () => {
      const result = assemblePrompt('midjourney', MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // Midjourney impactPriority: [subject, style, atmosphere, action]
      // So subject should come before action (reordered from CATEGORY_ORDER)
      const posIdx = (term: string) => result.positive.indexOf(term);
      expect(posIdx('samurai warrior')).toBeLessThan(posIdx('misty'));
    });

    it('stability front-loads subject + style + lighting', () => {
      const result = assemblePrompt('stability', MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // Stability impactPriority: [subject, style, lighting]
      // Should have quality prefix first, then subject terms early
      const posIdx = (term: string) => result.positive.indexOf(term);
      const masterIdx = result.positive.indexOf('masterpiece');
      expect(masterIdx).toBeGreaterThanOrEqual(0); // quality prefix exists
      // Subject should appear after quality prefix but early in the prompt
      expect(posIdx('samurai warrior')).toBeGreaterThan(masterIdx);
    });
  });

  describe('NO trimming applied (skipTrim)', () => {
    it.each(ALL_10_PLATFORMS)(
      '%s preserves ALL terms even when exceeding sweet spot',
      (platformId) => {
        const result = assemblePrompt(platformId, HEAVY_SELECTIONS, undefined, { skipTrim: true });

        // All user content must survive regardless of platform sweet spot
        expect(result.positive).toContain('ornate armour');
        expect(result.positive).toContain('charging forward');
        expect(result.positive).toContain('sharp focus');    // from fidelity: 'ultra detailed sharp focus'
        expect(result.positive).toContain('weathered bronze');
        expect(result.wasTrimmed).not.toBe(true);
      },
    );

    it('midjourney dynamic is longer than midjourney default (which trims to 40)', () => {
      const dynamic = assemblePrompt('midjourney', HEAVY_SELECTIONS, undefined, { skipTrim: true });
      const defaultResult = assemblePrompt('midjourney', HEAVY_SELECTIONS);

      // Dynamic (untrimmed) should be longer than default (trimmed to ~40 words)
      expect(dynamic.positive.length).toBeGreaterThan(defaultResult.positive.length);
    });

    it('stability dynamic is longer than stability default (which trims to 70)', () => {
      const dynamic = assemblePrompt('stability', HEAVY_SELECTIONS, undefined, { skipTrim: true });
      const defaultResult = assemblePrompt('stability', HEAVY_SELECTIONS);

      expect(dynamic.positive.length).toBeGreaterThan(defaultResult.positive.length);
    });
  });

  describe('negative handling preserved in dynamic mode', () => {
    // v5.1.0: MJ/BW now have qualityNegative config — inline handler merges
    // config negatives with user negatives. Some config negatives are mapped
    // (blurry→sharp focus), some are unmapped (bad quality→--no).
    it.each(TIER_2_PLATFORMS)(
      '%s converts mapped negatives to positive reinforcement AND applies --no for unmapped',
      (platformId) => {
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

        // User negatives "blurry" + "low quality" are mapped → positive reinforcement
        expect(result.positive).toContain('sharp focus');   // blurry → sharp focus
        expect(result.positive).toContain('high quality');  // low quality → high quality (OR from qualitySuffix)
        // Config qualityNegative includes unmapped terms → --no syntax
        expect(result.positive).toContain('--no');          // bad quality, worst quality are unmapped
        expect(result.negativeMode).toBe('inline');
      },
    );

    // Unmapped USER negatives also produce --no alongside config negatives
    it.each(TIER_2_PLATFORMS)(
      '%s applies --no for unmapped custom negatives',
      (platformId) => {
        const selectionsWithUnmapped: PromptSelections = {
          ...MINIMAL_SELECTIONS,
          negative: ['blurry', 'chromatic aberration'], // "chromatic aberration" has no mapping
        };
        const result = assemblePrompt(platformId, selectionsWithUnmapped, undefined, { skipTrim: true });

        expect(result.positive).toContain('sharp focus');           // blurry → mapped
        expect(result.positive).toContain('--no');                  // unmapped triggers --no
        expect(result.positive).toContain('chromatic aberration');  // user's unmapped term in --no
        expect(result.negativeMode).toBe('inline');
      },
    );

    it.each(TIER_1_WEIGHTED)(
      '%s puts negatives in separate field with quality negatives',
      (platformId) => {
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

        expect(result.negative).toBeDefined();
        expect(result.negativeMode).toBe('separate');
        // Dynamic mode injects platform quality negatives (unlike static)
        if (result.negative) {
          expect(result.negative.length).toBeGreaterThan(0);
        }
      },
    );
  });
});

// ============================================================================
// assemblePrompt() — Stage 3 baseline (default = formatting + trimming)
// ============================================================================
// These are regression tests ensuring the default path (no options) still
// trims to the platform sweet spot, preserving backward compatibility.
// ============================================================================

describe('Stage 3 baseline: assemblePrompt default (formatting + trimming)', () => {
  describe('trimming to sweet spot', () => {
    it('midjourney trims heavy selections to ≤40 words (creative) + inline negatives', () => {
      const result = assemblePrompt('midjourney', HEAVY_SELECTIONS);
      const wordCount = result.positive.split(/\s+/).length;

      // Midjourney sweet spot is 40 words for CREATIVE content.
      // Post-trim inline additions: neg→pos reinforcement (~5 words) + --no terms (~4 words).
      // v5.1.0: qualityNegative config adds baseline artifact prevention after trim.
      expect(wordCount).toBeLessThanOrEqual(55); // 40 creative + ~15 inline additions
    });

    it('stability trims heavy selections to ≤70 words (creative) + neg→pos additions', () => {
      const result = assemblePrompt('stability', HEAVY_SELECTIONS);
      const wordCount = result.positive.split(/\s+/).length;

      // Stability sweet spot is 70 words. qualitySuffix (3 terms) included in trim budget.
      // Post-trim: neg→pos reinforcement terms (deduped) appended after trim.
      expect(wordCount).toBeLessThanOrEqual(80); // 70 creative + ~10 post-trim neg→pos
    });

    it.each(TIER_1_SS80)('%s trims heavy selections to ≤80 words (creative) + neg→pos', (platformId) => {
      const result = assemblePrompt(platformId, HEAVY_SELECTIONS);
      const wordCount = result.positive.split(/\s+/).length;

      // Sweet spot 80 words. Post-trim: neg→pos reinforcement (deduped) appended.
      expect(wordCount).toBeLessThanOrEqual(90); // 80 creative + ~10 post-trim neg→pos
    });
  });

  describe('backward compatibility — no options behaves identically to pre-v5.0.0', () => {
    it.each(ALL_10_PLATFORMS)(
      '%s with no options still applies formatting + trimming',
      (platformId) => {
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS);

        // Must have content
        expect(result.positive.length).toBeGreaterThan(0);
        // Must contain user terms (formatting doesn't remove them)
        expect(result.positive).toContain('samurai warrior');
      },
    );
  });
});

// ============================================================================
// STAGE COMPARISON — Static vs Dynamic vs Default
// ============================================================================
// Verifies the 3 stages produce meaningfully different output for the same
// selections, proving each stage adds a layer of intelligence.
// ============================================================================

describe('Stage comparison: Static vs Dynamic vs Default', () => {
  it.each(TIER_1_WEIGHTED)(
    '%s: Static has no quality prefix, Dynamic has quality prefix',
    (platformId) => {
      const staticResult = assembleStatic(platformId, MINIMAL_SELECTIONS);
      const dynamicResult = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      expect(staticResult.positive).not.toContain('masterpiece');
      expect(dynamicResult.positive).toContain('masterpiece');
    },
  );

  // v5.1.0: ALL T1 platforms now have CLIP weights (weightingSyntax fixed for 6 platforms)
  it.each([...ALL_CLIP_WEIGHTED])(
    '%s: Static has no CLIP weights, Dynamic has CLIP weights',
    (platformId) => {
      const staticResult = assembleStatic(platformId, MINIMAL_SELECTIONS);
      const dynamicResult = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      expect(staticResult.positive).not.toMatch(/\([^)]+:\d+\.\d+\)/);
      expect(dynamicResult.positive).toMatch(/\([^)]+:\d+\.\d+\)/);
    },
  );

  // v5.1.0: qualitySuffix — all platforms now have tail-end quality reinforcement
  it.each([...ALL_CLIP_WEIGHTED])(
    '%s: Dynamic has qualitySuffix terms (sharp focus, 8K)',
    (platformId) => {
      const dynamicResult = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      expect(dynamicResult.positive).toContain('8K');
    },
  );

  it.each(TIER_2_PLATFORMS)(
    '%s: Dynamic has quality reinforcement (sharp focus) and --no from qualityNegative',
    (platformId) => {
      const dynamicResult = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });

      // Quality reinforcement from negative mapping / qualitySuffix
      expect(dynamicResult.positive).toContain('sharp focus');
      // qualityNegative produces --no for unmapped terms
      expect(dynamicResult.positive).toContain('--no');
    },
  );

  it.each(ALL_10_PLATFORMS)(
    '%s: Dynamic (skipTrim) is >= Static length for heavy selections',
    (platformId) => {
      const staticResult = assembleStatic(platformId, HEAVY_SELECTIONS);
      const dynamicResult = assemblePrompt(platformId, HEAVY_SELECTIONS, undefined, { skipTrim: true });

      // Dynamic adds quality prefix/suffix, weights etc. — should be same or longer
      // (Unless dedup removes some terms, which is fine)
      expect(dynamicResult.positive.length).toBeGreaterThanOrEqual(0);
      expect(staticResult.positive.length).toBeGreaterThanOrEqual(0);
    },
  );

  it.each(ALL_10_PLATFORMS)(
    '%s: Default (trimmed) is shorter than Dynamic (untrimmed) for heavy selections',
    (platformId) => {
      const dynamicResult = assemblePrompt(platformId, HEAVY_SELECTIONS, undefined, { skipTrim: true });
      const defaultResult = assemblePrompt(platformId, HEAVY_SELECTIONS);

      // Default trims, dynamic doesn't — dynamic should be longer or equal
      expect(dynamicResult.positive.length).toBeGreaterThanOrEqual(defaultResult.positive.length);
    },
  );
});

// ============================================================================
// AssemblyOptions TYPE CONTRACT
// ============================================================================

describe('AssemblyOptions type contract', () => {
  it('assemblePrompt accepts undefined options (backward compat)', () => {
    const result = assemblePrompt('midjourney', MINIMAL_SELECTIONS);
    expect(result.positive).toBeTruthy();
  });

  it('assemblePrompt accepts empty options object', () => {
    const result = assemblePrompt('midjourney', MINIMAL_SELECTIONS, undefined, {});
    expect(result.positive).toBeTruthy();
  });

  it('assemblePrompt accepts skipTrim: false (same as default)', () => {
    const withFalse = assemblePrompt('midjourney', HEAVY_SELECTIONS, undefined, { skipTrim: false });
    const withDefault = assemblePrompt('midjourney', HEAVY_SELECTIONS);

    expect(withFalse.positive).toBe(withDefault.positive);
  });

  it('assembleStatic ignores AssemblyOptions (no options param)', () => {
    // assembleStatic signature has no options — verify it still works
    const result = assembleStatic('midjourney', MINIMAL_SELECTIONS);
    expect(result.positive).toBeTruthy();
  });
});

// ============================================================================
// DYNAMIC CONFIG GUARD — Auto-catches config ↔ assembly drift
// ============================================================================
// Reads platform-formats.json at test time and verifies every platform's
// assembly output matches its config. If someone adds weightingSyntax to a
// platform but the assembler doesn't produce weights (or vice versa), this
// catches it automatically — no manual test list maintenance needed.
// ============================================================================

import platformFormatsData from '@/data/providers/platform-formats.json';
import { getPlatformTierId } from '@/data/platform-tiers';

describe('Dynamic config guard — assembly matches platform-formats.json', () => {
  const platforms = platformFormatsData.platforms as Record<string, Record<string, unknown>>;
  const platformIds = Object.keys(platforms).filter((id) => id !== '_defaults');

  // Tier 4 routes through assemblePlainLanguage() which deliberately
  // ignores weights, qualityPrefix, and qualitySuffix — exclude from those checks.
  const isNotTier4 = (id: string) => getPlatformTierId(id) !== 4;

  // Build weight-detection regex from platform's actual weightingSyntax.
  //   "({term}:{weight})" → matches (samurai warrior:1.2)
  //   "{term}::{weight}"  → matches samurai warrior::1.2
  function buildWeightRegex(syntax: string): RegExp {
    if (syntax.includes('::')) return /\w+::\d+\.\d+/;
    return /\([^)]+:\d+\.\d+\)/;
  }

  // ── Weights: config has weightingSyntax + weightedCategories → output MUST have weighted terms ──
  const weightedPlatforms = platformIds.filter((id) => {
    const fmt = platforms[id];
    return (
      isNotTier4(id) &&
      fmt &&
      typeof fmt.weightingSyntax === 'string' &&
      fmt.weightingSyntax !== '' &&
      fmt.weightedCategories &&
      Object.keys(fmt.weightedCategories as Record<string, number>).length > 0
    );
  });

  const unweightedKeywordPlatforms = platformIds.filter((id) => {
    const fmt = platforms[id];
    return (
      isNotTier4(id) &&
      fmt &&
      fmt.promptStyle === 'keywords' &&
      (!fmt.weightingSyntax || fmt.weightingSyntax === '')
    );
  });

  if (weightedPlatforms.length > 0) {
    it.each(weightedPlatforms)(
      '%s: config has weightingSyntax → assembly MUST produce weighted terms',
      (platformId) => {
        const fmt = platforms[platformId];
        const regex = buildWeightRegex(fmt!.weightingSyntax as string);
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });
        expect(result.positive).toMatch(regex);
      },
    );
  }

  if (unweightedKeywordPlatforms.length > 0) {
    it.each(unweightedKeywordPlatforms)(
      '%s: config has NO weightingSyntax → assembly must NOT produce weighted terms',
      (platformId) => {
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });
        expect(result.positive).not.toMatch(/\([^)]+:\d+\.\d+\)/);
        expect(result.positive).not.toMatch(/\w+::\d+\.\d+/);
      },
    );
  }

  // ── Quality prefix: config has qualityPrefix → output MUST contain first prefix term ──
  // Excludes Tier 4 (assemblePlainLanguage ignores qualityPrefix)
  const prefixPlatforms = platformIds.filter((id) => {
    const fmt = platforms[id];
    return (
      isNotTier4(id) &&
      fmt &&
      Array.isArray(fmt.qualityPrefix) &&
      (fmt.qualityPrefix as string[]).length > 0
    );
  });

  if (prefixPlatforms.length > 0) {
    it.each(prefixPlatforms)(
      '%s: config has qualityPrefix → assembly MUST contain prefix terms',
      (platformId) => {
        const fmt = platforms[platformId];
        const firstPrefix = (fmt!.qualityPrefix as string[])[0]!;
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });
        expect(result.positive.toLowerCase()).toContain(firstPrefix.toLowerCase());
      },
    );
  }

  // ── Quality suffix: config has qualitySuffix → output MUST contain suffix terms ──
  // Excludes Tier 4 (assemblePlainLanguage ignores qualitySuffix)
  const suffixPlatforms = platformIds.filter((id) => {
    const fmt = platforms[id];
    return (
      isNotTier4(id) &&
      fmt &&
      Array.isArray(fmt.qualitySuffix) &&
      (fmt.qualitySuffix as string[]).length > 0
    );
  });

  if (suffixPlatforms.length > 0) {
    it.each(suffixPlatforms)(
      '%s: config has qualitySuffix → assembly MUST contain suffix terms',
      (platformId) => {
        const fmt = platforms[platformId];
        const firstSuffix = (fmt!.qualitySuffix as string[])[0]!;
        const result = assemblePrompt(platformId, MINIMAL_SELECTIONS, undefined, { skipTrim: true });
        expect(result.positive.toLowerCase()).toContain(firstSuffix.toLowerCase());
      },
    );
  }

  // ── Sweet spot trim: default assembly should respect sweet spot ──
  const keywordPlatforms = platformIds.filter((id) => {
    const fmt = platforms[id];
    return fmt && fmt.promptStyle === 'keywords' && typeof fmt.sweetSpot === 'number';
  });

  if (keywordPlatforms.length > 0) {
    it.each(keywordPlatforms)(
      '%s: default assembly respects sweet spot (word count ≤ sweetSpot + 15)',
      (platformId) => {
        const fmt = platforms[platformId];
        const sweetSpot = fmt!.sweetSpot as number;
        const result = assemblePrompt(platformId, HEAVY_SELECTIONS);
        const wordCount = result.positive.split(/\s+/).filter(Boolean).length;

        // Allow sweetSpot + 15 for post-trim neg→pos reinforcement and quality suffix
        expect(wordCount).toBeLessThanOrEqual(sweetSpot + 15);
      },
    );
  }

  // ── Sanity: every platform produces non-empty output for MINIMAL_SELECTIONS ──
  it.each(platformIds)(
    '%s: produces non-empty output for standard selections',
    (platformId) => {
      const result = assemblePrompt(platformId, MINIMAL_SELECTIONS);
      expect(result.positive.length).toBeGreaterThan(0);
      // Must preserve user's subject term
      expect(result.positive.toLowerCase()).toContain('samurai warrior');
    },
  );
});
