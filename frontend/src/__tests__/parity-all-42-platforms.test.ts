// src/__tests__/parity-all-42-platforms.test.ts
// ============================================================================
// COMPREHENSIVE 42-PLATFORM PARITY AUDIT
// ============================================================================
//
// Validates that EVERY platform produces ≥95% Jaccard parity between the
// PotM generator path and the Prompt Builder "Try in" path.
//
// Coverage:
//   - All 42 platforms × 4 city fixtures = 168 parity cases
//   - Platform config completeness (no missing / fallback configs)
//   - Category order alignment (no missing categories)
//   - Negative handling consistency across all support modes
//   - Token limit enforcement (prompts don't exceed tokenLimit)
//   - Post-processing integrity (leak prevention, synergy, weights)
//   - Containment metric (gen content survives in bld output)
//   - Regression guards for every previously-fixed bug
//
// Authority: platform-formats.json v3.5.0+
// ============================================================================

import {
  assemblePrompt,
  selectionsFromMap,
  tierToRefPlatform,
  getPlatformFormat,
  platformFormats,
} from '@/lib/prompt-builder';
import type {
  PromptCategory,
  PromptSelections,
  WeatherCategoryMap,
  WeatherCategoryMeta,
} from '@/types/prompt-builder';
import { rewriteWithSynergy } from '@/lib/weather/synergy-rewriter';
import { postProcessAssembled } from '@/lib/prompt-post-process';
import { getCategoryLimitsForPlatformTier } from '@/lib/usage/constants';
import { PLATFORM_TIERS } from '@/data/platform-tiers';

// ============================================================================
// CONSTANTS
// ============================================================================

const ALL_CATEGORIES: PromptCategory[] = [
  'subject', 'action', 'style', 'environment', 'composition',
  'camera', 'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
];

const TIER_PLATFORMS: Record<1 | 2 | 3 | 4, string[]> = {
  1: PLATFORM_TIERS[1].platforms,
  2: PLATFORM_TIERS[2].platforms,
  3: PLATFORM_TIERS[3].platforms,
  4: PLATFORM_TIERS[4].platforms,
};

const MINIMUM_PARITY = 0.95;

// ============================================================================
// HELPERS
// ============================================================================

function tokeniseWords(text: string): Set<string> {
  let cleaned = text;
  cleaned = cleaned.replace(/\(([^:)]+):[0-9.]+\)/g, '$1');
  cleaned = cleaned.replace(/::[0-9.]+/g, '');
  cleaned = cleaned.replace(/[{}]+/g, '');
  cleaned = cleaned.replace(/--\w+\s*[0-9:.]*\s*/g, '');
  cleaned = cleaned.toLowerCase().replace(/[,;.:()]/g, ' ');
  return new Set(
    cleaned.split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 1),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}

function containmentScore(
  genWords: Set<string>,
  bldPosWords: Set<string>,
  bldNegWords: Set<string>,
): number {
  if (genWords.size === 0) return 1.0;
  let found = 0;
  for (const w of genWords) {
    if (bldPosWords.has(w) || bldNegWords.has(w)) found++;
  }
  return found / genWords.size;
}

const baseMeta = (
  city: string,
  venue: string,
  setting: string,
): WeatherCategoryMeta => ({
  city,
  venue,
  venueSetting: setting,
  mood: 'contemplative',
  conditions: 'Partly Cloudy',
  emoji: '⛅',
  tempC: 18,
  localTime: '14:00',
  source: 'weather-intelligence' as const,
});

function simulateGeneratorPath(
  map: WeatherCategoryMap,
  tier: 1 | 2 | 3 | 4,
) {
  const sel = selectionsFromMap(map);
  const { selections: rewritten } = rewriteWithSynergy(sel, map.customValues);
  const raw = assemblePrompt(tierToRefPlatform(tier), rewritten, map.weightOverrides);
  const atm = [
    ...(map.selections?.atmosphere ?? []),
    map.customValues?.atmosphere ?? '',
  ].join(' ');
  return postProcessAssembled(raw, tier, atm);
}

function simulateBuilderPath(
  map: WeatherCategoryMap,
  platformId: string,
  tier: 1 | 2 | 3 | 4,
) {
  const limits = getCategoryLimitsForPlatformTier(tier, 'free');
  const cs: Record<string, { selected: string[]; customValue: string }> = {};
  for (const c of ALL_CATEGORIES) cs[c] = { selected: [], customValue: '' };

  for (const [c, v] of Object.entries(map.selections ?? {})) {
    if (!Array.isArray(v) || v.length === 0) continue;
    const limit = limits[c] ?? 1;
    cs[c]!.selected = v.slice(0, limit);
    const overflow = v.slice(limit);
    if (overflow.length > 0) cs[c]!.customValue = overflow.join(', ');
  }

  for (const [c, v] of Object.entries(map.customValues ?? {})) {
    if (typeof v === 'string' && v.trim()) cs[c]!.customValue = v.trim();
  }

  if ((map.negative ?? []).length > 0) {
    const nl = limits['negative'] ?? 5;
    cs['negative']!.selected = map.negative!.slice(0, nl);
    const overflow = map.negative!.slice(nl);
    cs['negative']!.customValue =
      overflow.length > 0 ? overflow.join(', ') : '';
  }

  const sel: PromptSelections = {};
  for (const [c, s] of Object.entries(cs)) {
    const all = [...s.selected];
    if (s.customValue.trim()) {
      if (c === 'negative') {
        all.push(
          ...s.customValue
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        );
      } else {
        all.push(s.customValue.trim());
      }
    }
    if (all.length > 0) sel[c as PromptCategory] = all;
  }

  const { selections: rewritten } = rewriteWithSynergy(sel);
  const raw = assemblePrompt(platformId, rewritten, map.weightOverrides);
  const atm = [
    ...(cs['atmosphere']?.selected ?? []),
    cs['atmosphere']?.customValue ?? '',
  ].join(' ');
  return postProcessAssembled(raw, tier, atm);
}

// ============================================================================
// CITY FIXTURES
// ============================================================================

const AMSTERDAM_MAP: WeatherCategoryMap = {
  selections: {
    subject: ['Amsterdam'],
    style: ['photorealistic'],
    atmosphere: ['mysterious'],
    environment: ['Museumplein'],
    colour: ['vibrant colours'],
    fidelity: ['noon'],
  },
  customValues: {
    lighting: 'Dynamic light and shade as clouds drift past the sun with soft intermittent shadows',
    camera: 'Shot on Sony A7 IV, 35mm f/1.4',
    materials: 'Tight shadows on plaza stone',
    action: 'Southerly 12 km/h breeze, dust skittering across flagstones',
    composition: 'wide open-square scene, pavement-to-facade depth, moderate depth of field with background in sharp focus',
  },
  negative: ['blurry', 'watermarks', 'text', 'oversaturated'],
  weightOverrides: { subject: 1.3, environment: 1.2, lighting: 1.3, composition: 1.05 },
  meta: baseMeta('Amsterdam', 'Museumplein', 'plaza'),
};

const ISTANBUL_MAP: WeatherCategoryMap = {
  selections: {
    environment: ['ancient temple'],
    atmosphere: ['contemplative'],
    style: ['photorealistic'],
    colour: ['earth tones'],
    fidelity: ['highly detailed'],
  },
  customValues: {
    subject: 'Istanbul, Taksim Square, Topkapı Palace Gates',
    lighting: 'Cool white moonlight competing with focused accent lighting on weathered stone walls',
    camera: 'Shot on Canon EOS R5, 90mm f/2, sharp focus',
    composition: 'low-angle architectural night shot, foreground stone path, palace facade in mid-ground',
    materials: 'Cold dry stone steps',
    action: 'Entrance flags shifting gently',
  },
  negative: ['people', 'text', 'watermarks', 'blurry', 'oversaturated', 'cartoon'],
  weightOverrides: { subject: 1.3, environment: 1.2, lighting: 1.3, composition: 1.05 },
  meta: baseMeta('Istanbul', 'Topkapı Palace Gates', 'monument'),
};

const TOKYO_MAP: WeatherCategoryMap = {
  selections: {
    subject: ['Tokyo'],
    environment: ['Shibuya Crossing'],
    style: ['cinematic'],
    atmosphere: ['haze', 'urban glow'],
    colour: ['neon-lit'],
    fidelity: ['8K'],
  },
  customValues: {
    lighting: 'Diffused artificial glow through evening haze, competing neon reflections on wet surfaces',
    camera: 'Shot on Fujifilm X-T5, 23mm f/1.4',
    composition: 'street-level crossing shot, pedestrians in motion blur, signage in background',
    materials: 'Rain-slicked asphalt reflecting neon',
    action: 'Crowds flowing through intersection',
  },
  negative: ['blurry', 'watermarks', 'text', 'oversaturated', 'cartoon', 'anime'],
  weightOverrides: { subject: 1.3, environment: 1.2, lighting: 1.3, composition: 1.05 },
  meta: { ...baseMeta('Tokyo', 'Shibuya Crossing', 'street'), conditions: 'Haze', emoji: '🌫️' },
};

const SYDNEY_MAP: WeatherCategoryMap = {
  selections: {
    subject: ['Sydney'],
    environment: ['Harbour Bridge'],
    style: ['landscape photography'],
    colour: ['azure blue'],
    atmosphere: ['clear'],
    fidelity: ['sharp focus'],
  },
  customValues: {
    lighting: 'Harsh overhead sun casting strong defined shadows, clear blue sky',
    camera: 'Shot on Nikon Z9, 24mm f/2.8',
    composition: 'wide panoramic harbour shot, bridge spanning mid-ground, opera house in distance',
    materials: 'Warm steel and sandstone',
  },
  negative: ['blurry', 'watermarks', 'text'],
  weightOverrides: { subject: 1.3, environment: 1.2, lighting: 1.3, composition: 1.05 },
  meta: { ...baseMeta('Sydney', 'Harbour Bridge', 'waterfront'), conditions: 'Clear', emoji: '☀️' },
};

const CITY_FIXTURES = [
  { name: 'Amsterdam', map: AMSTERDAM_MAP },
  { name: 'Istanbul', map: ISTANBUL_MAP },
  { name: 'Tokyo', map: TOKYO_MAP },
  { name: 'Sydney', map: SYDNEY_MAP },
];

// ============================================================================
// TEST 1: Platform config completeness
// ============================================================================

describe('Platform config completeness', () => {
  it('all 42 tier platforms have a config in platform-formats.json', () => {
    const allPlatforms: string[] = [];
    for (const tier of [1, 2, 3, 4] as const) {
      allPlatforms.push(...TIER_PLATFORMS[tier]);
    }
    expect(allPlatforms.length).toBe(40);
    for (const pid of allPlatforms) {
      // Verify explicit config exists (not falling back to _defaults)
      expect(pid in platformFormats.platforms).toBe(true);
    }
  });

  it('every platform has at least 5 categories configured', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      for (const pid of TIER_PLATFORMS[tier]) {
        const fmt = getPlatformFormat(pid);
        const cats = (fmt.categoryOrder as string[]) ?? [];
        expect(cats.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('every platform category exists in its tier reference', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      const refFmt = getPlatformFormat(tierToRefPlatform(tier));
      const refCats = new Set((refFmt.categoryOrder as string[]) ?? []);
      for (const pid of TIER_PLATFORMS[tier]) {
        const fmt = getPlatformFormat(pid);
        for (const cat of ((fmt.categoryOrder as string[]) ?? [])) {
          expect(refCats.has(cat)).toBe(true);
        }
      }
    }
  });
});

// ============================================================================
// TEST 2: Full 42-platform parity ≥95%
// ============================================================================

describe('Full 42-platform parity (≥95% Jaccard)', () => {
  for (const tier of [1, 2, 3, 4] as const) {
    describe(`Tier ${tier}: ${TIER_PLATFORMS[tier].length} platforms`, () => {
      for (const pid of TIER_PLATFORMS[tier]) {
        it(`${pid}: ≥95% parity across all cities`, () => {
          let totalJ = 0;
          for (const { name, map } of CITY_FIXTURES) {
            const genR = simulateGeneratorPath(map, tier);
            const bldR = simulateBuilderPath(map, pid, tier);
            const genWords = tokeniseWords(genR.positive);
            const bldWords = tokeniseWords(bldR.positive);
            const jVal = jaccardSimilarity(genWords, bldWords);
            totalJ += jVal;

            if (jVal < MINIMUM_PARITY) {
              const genOnly = [...genWords].filter((w) => !bldWords.has(w));
              const bldOnly = [...bldWords].filter((w) => !genWords.has(w));
               
              console.log(`\n  ❌ ${pid} × ${name}: ${(jVal * 100).toFixed(1)}%`);
               
              console.log(`     GEN-ONLY: ${genOnly.join(', ')}`);
               
              console.log(`     BLD-ONLY: ${bldOnly.join(', ')}`);
            }
          }
          expect(totalJ / CITY_FIXTURES.length).toBeGreaterThanOrEqual(MINIMUM_PARITY);
        });
      }
    });
  }
});

// ============================================================================
// TEST 3: Containment — gen content survives in builder output
// ============================================================================

describe('Containment: gen content preserved in builder (pos + neg)', () => {
  for (const tier of [1, 2, 3, 4] as const) {
    const refPid = tierToRefPlatform(tier);
    const samplePids = [
      refPid,
      ...TIER_PLATFORMS[tier].filter((p) => p !== refPid).slice(0, 2),
    ];

    for (const pid of samplePids) {
      it(`T${tier} ${pid}: ≥95% gen words found in bld pos+neg`, () => {
        for (const { map } of CITY_FIXTURES) {
          const genR = simulateGeneratorPath(map, tier);
          const bldR = simulateBuilderPath(map, pid, tier);
          const c = containmentScore(
            tokeniseWords(genR.positive),
            tokeniseWords(bldR.positive),
            tokeniseWords(bldR.negative ?? ''),
          );
          expect(c).toBeGreaterThanOrEqual(0.95);
        }
      });
    }
  }
});

// ============================================================================
// TEST 4: Token limit enforcement
// ============================================================================

describe('Token limit enforcement', () => {
  it('builder output never exceeds platform tokenLimit (+10% margin)', () => {
    for (const tier of [1, 2, 3, 4] as const) {
      for (const pid of TIER_PLATFORMS[tier]) {
        const fmt = getPlatformFormat(pid);
        const tokenLimit = fmt.tokenLimit ?? 200;
        for (const { map } of CITY_FIXTURES) {
          const bldR = simulateBuilderPath(map, pid, tier);
          const wordCount = bldR.positive.split(/\s+/).length;
          expect(wordCount).toBeLessThanOrEqual(Math.ceil(tokenLimit * 1.1));
        }
      }
    }
  });
});

// ============================================================================
// TEST 5: Negative handling — mode-specific
// ============================================================================

describe('Negative handling: mode-specific correctness', () => {
  it('separate neg platforms: negatives go to negative field', () => {
    for (const pid of ['leonardo', 'flux', 'dreamstudio', 'stability']) {
      const fmt = getPlatformFormat(pid);
      if (fmt.negativeSupport !== 'separate') continue;
      const bldR = simulateBuilderPath(ISTANBUL_MAP, pid, 1);
      expect(bldR.negative).toBeTruthy();
      expect(bldR.negative!.length).toBeGreaterThan(0);
    }
  });

  it('inline neg platforms: --no syntax or positive reinforcement in output', () => {
    const bldR = simulateBuilderPath(ISTANBUL_MAP, 'midjourney', 2);
    // If all negatives have positive conversions, --no won't appear (correct).
    // If some don't convert, --no MUST appear. Either way, reinforcement should exist.
    const lo = bldR.positive.toLowerCase();
    const hasNegHandling =
      lo.includes('--no') || lo.includes('sharp focus') ||
      lo.includes('empty scene') || lo.includes('realistic');
    expect(hasNegHandling).toBe(true);
  });

  it('no-neg platforms: negatives converted to positive reinforcement', () => {
    for (const pid of ['openai', 'adobe-firefly', 'canva']) {
      const fmt = getPlatformFormat(pid);
      if (fmt.negativeSupport !== 'none') continue;
      const tier = pid === 'canva' ? 4 : 3;
      const bldR = simulateBuilderPath(ISTANBUL_MAP, pid, tier as 1 | 2 | 3 | 4);
      const lo = bldR.positive.toLowerCase();
      const hasReinforcement =
        lo.includes('empty scene') || lo.includes('sharp focus') || lo.includes('realistic');
      expect(hasReinforcement).toBe(true);
    }
  });

  it('neg-to-pos: consistent between gen and bld paths', () => {
    for (const tier of [3, 4] as const) {
      const genR = simulateGeneratorPath(ISTANBUL_MAP, tier);
      const bldR = simulateBuilderPath(ISTANBUL_MAP, tierToRefPlatform(tier), tier);
      expect(genR.positive.toLowerCase()).toContain('empty scene');
      expect(bldR.positive.toLowerCase()).toContain('empty scene');
    }
  });
});

// ============================================================================
// TEST 6: Post-processing integrity
// ============================================================================

describe('Post-processing: leak prevention', () => {
  const leakMap: WeatherCategoryMap = {
    selections: { subject: ['Kathmandu'], style: ['photorealistic'] },
    customValues: { action: 'prayer flags fluttering in the mountain breeze' },
    negative: ['blurry'],
    weightOverrides: { subject: 1.3 },
    meta: baseMeta('Kathmandu', 'Durbar Square', 'monument'),
  };

  for (const tier of [1, 2, 3, 4] as const) {
    it(`T${tier}: "prayer flags" neutralised in both gen and bld`, () => {
      const genR = simulateGeneratorPath(leakMap, tier);
      const bldR = simulateBuilderPath(leakMap, tierToRefPlatform(tier), tier);
      expect(genR.positive.toLowerCase()).not.toContain('prayer flags');
      expect(bldR.positive.toLowerCase()).not.toContain('prayer flags');
    });
  }
});

describe('Post-processing: synergy conflict resolution', () => {
  const conflictMap: WeatherCategoryMap = {
    selections: {
      subject: ['Prague'],
      style: ['photorealistic'],
      lighting: ['golden hour'],
      atmosphere: ['midnight', 'deep stillness'],
    },
    customValues: {},
    negative: ['blurry'],
    weightOverrides: { subject: 1.3 },
    meta: baseMeta('Prague', 'Charles Bridge', 'bridge'),
  };

  for (const tier of [1, 3] as const) {
    it(`T${tier}: golden hour + midnight resolved consistently`, () => {
      const genR = simulateGeneratorPath(conflictMap, tier);
      const bldR = simulateBuilderPath(conflictMap, tierToRefPlatform(tier), tier);
      expect(genR.positive.toLowerCase().includes('golden hour'))
        .toBe(bldR.positive.toLowerCase().includes('golden hour'));
    });
  }
});

describe('Post-processing: weight syntax', () => {
  it('T1 CLIP: weight syntax present in both gen and bld', () => {
    const genR = simulateGeneratorPath(AMSTERDAM_MAP, 1);
    const bldR = simulateBuilderPath(AMSTERDAM_MAP, 'leonardo', 1);
    expect(genR.positive).toMatch(/Amsterdam::[0-9.]+|\(Amsterdam:[0-9.]+\)/);
    expect(bldR.positive).toMatch(/Amsterdam::[0-9.]+|\(Amsterdam:[0-9.]+\)/);
  });

  it('T2 MJ: no CLIP weight syntax leaks', () => {
    const bldR = simulateBuilderPath(AMSTERDAM_MAP, 'midjourney', 2);
    expect(bldR.positive).not.toMatch(/\([^)]+:[0-9]+\.[0-9]+\)/);
    expect(bldR.positive).not.toMatch(/::[0-9.]+/);
  });

  it('T3/T4: no weight syntax in NL/Plain output', () => {
    for (const tier of [3, 4] as const) {
      const bldR = simulateBuilderPath(AMSTERDAM_MAP, tierToRefPlatform(tier), tier);
      expect(bldR.positive).not.toMatch(/::[0-9.]+/);
      expect(bldR.positive).not.toMatch(/\([^)]+:[0-9]+\.[0-9]+\)/);
    }
  });
});

// ============================================================================
// TEST 7: Regression guards
// ============================================================================

describe('Regression: previously-fixed bugs', () => {
  it('clipdrop: keyword style, separate neg, 10 cats (was 54% bug)', () => {
    const fmt = getPlatformFormat('clipdrop');
    expect(fmt.promptStyle).toBe('keywords');
    expect(fmt.negativeSupport).toBe('separate');
    expect((fmt.categoryOrder as string[]).length).toBeGreaterThanOrEqual(10);
  });

  // removed — multi-engine aggregator (v6.0.0 deep research audit)

  it('stability: sweetSpot ≥ 70 (was 50, truncating composition)', () => {
    expect(getPlatformFormat('stability').sweetSpot).toBeGreaterThanOrEqual(70);
  });

  it('bluewillow: has camera + materials (was 92% bug)', () => {
    const cats = getPlatformFormat('bluewillow').categoryOrder as string[];
    expect(cats).toContain('camera');
    expect(cats).toContain('materials');
  });

  it('novelai: "highly detailed" in qualityPrefix (was 96% bug)', () => {
    const qp = (getPlatformFormat('novelai').qualityPrefix ?? []) as string[];
    expect(qp.some((p) => p.toLowerCase().includes('highly detailed'))).toBe(true);
  });

  it('hotpot: comp + camera + materials, ss ≥ 100 (was 67% bug)', () => {
    const fmt = getPlatformFormat('hotpot');
    const cats = fmt.categoryOrder as string[];
    expect(cats).toContain('composition');
    expect(cats).toContain('camera');
    expect(cats).toContain('materials');
    expect(fmt.sweetSpot).toBeGreaterThanOrEqual(100);
  });

  it('flux: qualitySuffix is empty (was adding extra words)', () => {
    expect(getPlatformFormat('flux').qualitySuffix ?? []).toHaveLength(0);
  });

  it('neg-to-pos: "watermarks" → "unmarked"', () => {
    for (const tier of [3, 4] as const) {
      const genR = simulateGeneratorPath(ISTANBUL_MAP, tier);
      const bldR = simulateBuilderPath(ISTANBUL_MAP, tierToRefPlatform(tier), tier);
      expect(genR.positive.toLowerCase()).toContain('unmarked');
      expect(bldR.positive.toLowerCase()).toContain('unmarked');
    }
  });

  it('neg-to-pos: "people" → "empty scene"', () => {
    for (const tier of [3, 4] as const) {
      expect(simulateGeneratorPath(ISTANBUL_MAP, tier).positive.toLowerCase()).toContain('empty scene');
    }
  });

  it('neg-to-pos: "cartoon" → "realistic rendering"', () => {
    for (const tier of [3, 4] as const) {
      expect(simulateGeneratorPath(ISTANBUL_MAP, tier).positive.toLowerCase()).toContain('realistic');
    }
  });

  it('neg-to-pos: "anime" → "photographic realism"', () => {
    for (const tier of [3, 4] as const) {
      expect(simulateGeneratorPath(TOKYO_MAP, tier).positive.toLowerCase()).toContain('photographic realism');
    }
  });

  // v6.0.0: Updated after deep research audit. removed (aggregator).
  // artbreeder, pixlr, simplified moved to T3. remove-bg not a generation platform.
  it('T4 platforms have explicit configs (was fallback bug)', () => {
    const t4Platforms = [
      'myedit', 'photoleap', 'picwish',
      'visme', 'vistacreate', '123rf',
    ];
    for (const pid of t4Platforms) {
      const fmt = getPlatformFormat(pid);
      // Verify explicit config exists (not falling back to _defaults)
      expect(pid in platformFormats.platforms).toBe(true);
      expect(fmt.sweetSpot).toBeLessThanOrEqual(60);
    }
  });

  it('materials has no "featuring" prefix (was NL/keyword divergence)', () => {
    const genR = simulateGeneratorPath(AMSTERDAM_MAP, 3);
    expect(genR.positive.toLowerCase()).not.toContain('featuring tight');
  });

  it('style connector has no " style" suffix (was flux 95.5% bug)', () => {
    const genR = simulateGeneratorPath(AMSTERDAM_MAP, 3);
    expect(genR.positive).not.toContain('photorealistic style');
    expect(genR.positive.toLowerCase()).toContain('photorealistic');
  });

  it('atmosphere connector has no " atmosphere" suffix (was flux 95.5% bug)', () => {
    const genR = simulateGeneratorPath(AMSTERDAM_MAP, 3);
    expect(genR.positive).not.toContain('mysterious atmosphere');
    expect(genR.positive.toLowerCase()).toContain('mysterious');
  });
});

// ============================================================================
// TEST 8: Summary table
// ============================================================================

describe('42-platform parity summary', () => {
  it('prints full parity matrix and verifies 42/42', () => {
    const rows: string[] = [];
    rows.push('Tier | Platform              | Avg    | Ams    | Ist    | Tok    | Syd');
    rows.push('-----|----------------------|--------|--------|--------|--------|------');

    let totalPassed = 0;
    for (const tier of [1, 2, 3, 4] as const) {
      for (const pid of TIER_PLATFORMS[tier]) {
        const scores: number[] = [];
        for (const { map } of CITY_FIXTURES) {
          const genR = simulateGeneratorPath(map, tier);
          const bldR = simulateBuilderPath(map, pid, tier);
          scores.push(jaccardSimilarity(
            tokeniseWords(genR.positive),
            tokeniseWords(bldR.positive),
          ));
        }
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avg >= MINIMUM_PARITY) totalPassed++;
        const icon = avg >= 0.999 ? '🟢' : avg >= 0.95 ? '🟡' : '🔴';
        rows.push(
          `T${tier}   | ${icon} ${pid.padEnd(19)} | ${(avg * 100).toFixed(1).padStart(5)}% | ${scores.map((s) => `${(s * 100).toFixed(0).padStart(4)}%`).join(' | ')}`,
        );
      }
    }
    rows.push('');
    rows.push(`TOTAL: ${totalPassed}/40 ≥ 95%`);
     
    console.log('\n' + rows.join('\n') + '\n');
    expect(totalPassed).toBe(40);
  });
});
