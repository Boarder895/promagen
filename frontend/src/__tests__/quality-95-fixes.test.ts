// src/__tests__/quality-95-fixes.test.ts
// ============================================================================
// 95/100 QUALITY FIXES
// ============================================================================
//
// Fix A: Normalise Leonardo qualityPrefix to match SD family standard
// Fix B: Artguru + Stability/DreamStudio weight syntax & subject weight
// Fix C: Weight override pipeline verification (was already wired)
// Fix D: Negative dedup verification (was already wired)
// ============================================================================

import {
  assemblePrompt,
  getPlatformFormat,
  selectionsFromMap,
} from '@/lib/prompt-builder';
import type { PromptCategory, PromptSelections, WeatherCategoryMap, WeatherCategoryMeta } from '@/types/prompt-builder';

// ── Fixtures ────────────────────────────────────────────────────────────────

const baseMeta: WeatherCategoryMeta = {
  city: 'Amsterdam',
  venue: 'Museumplein',
  venueSetting: 'plaza',
  mood: 'mysterious',
  conditions: 'Partly Cloudy',
  emoji: '⛅',
  tempC: 15,
  localTime: '12:00',
  source: 'weather-intelligence',
};

// ============================================================================
// Fix A — Quality prefix consistency across SD family
// ============================================================================

describe('Fix A: SD family qualityPrefix consistency', () => {
  const sdPlatforms = [
    'stability', 'dreamstudio', 'lexica', 'playground', 'nightcafe',
    'getimg', 'openart', 'jasper-art', 'artguru', 'leonardo', 'dreamlike',
  ];

  const standardPrefix = ['masterpiece', 'best quality', 'highly detailed'];

  it.each(sdPlatforms)('%s has standard quality prefix', (platform) => {
    const format = getPlatformFormat(platform);
    expect(format.qualityPrefix).toEqual(standardPrefix);
  });

  it('Leonardo no longer uses "professional" in qualityPrefix', () => {
    const format = getPlatformFormat('leonardo');
    expect(format.qualityPrefix).not.toContain('professional');
  });

  it('homepage and builder produce identical quality terms for Amsterdam', () => {
    const selections: PromptSelections = {
      subject: ['Amsterdam'],
      lighting: ['dynamic light'],
    };

    const homepageResult = assemblePrompt('leonardo', selections);
    const builderResult = assemblePrompt('artguru', selections);

    // Both should start with "masterpiece, best quality, highly detailed"
    const homepageStart = homepageResult.positive.split(', ').slice(0, 3).join(', ');
    const builderStart = builderResult.positive.split(', ').slice(0, 3).join(', ');
    expect(homepageStart).toBe(builderStart);
  });
});

// ============================================================================
// Fix B — Artguru weight syntax support
// ============================================================================

describe('Fix B: Artguru weight syntax', () => {
  it('Artguru has weightingSyntax configured', () => {
    const format = getPlatformFormat('artguru');
    expect(format.weightingSyntax).toBeTruthy();
    expect(format.supportsWeighting).toBe(true);
  });

  it('Artguru renders subject weight in output', () => {
    const selections: PromptSelections = {
      subject: ['Amsterdam'],
    };

    const result = assemblePrompt('artguru', selections, { subject: 1.2 });
    // Should contain weighted Amsterdam like (Amsterdam:1.2)
    expect(result.positive).toContain('(Amsterdam:1.2)');
  });

  it('Artguru preserves lighting weight from platform config', () => {
    const format = getPlatformFormat('artguru');
    expect(format.weightedCategories?.lighting).toBe(1.1);
  });

  it('weight overrides merge — platform wins on conflict', () => {
    // Artguru has lighting: 1.1 in config. If weather says lighting: 1.3,
    // platform's 1.1 should win (platform config is authoritative).
    const selections: PromptSelections = {
      lighting: ['bright sun'],
    };

    const result = assemblePrompt('artguru', selections, { lighting: 1.3 });
    // Platform's 1.1 wins → (bright sun:1.1)
    expect(result.positive).toContain('(bright sun:1.1)');
    expect(result.positive).not.toContain('1.3');
  });

  it('Stability and DreamStudio also have subject weight', () => {
    const stabFormat = getPlatformFormat('stability');
    const dsFormat = getPlatformFormat('dreamstudio');
    expect(stabFormat.weightedCategories?.subject).toBe(1.2);
    expect(dsFormat.weightedCategories?.subject).toBe(1.2);
  });
});

// ============================================================================
// Fix C — Weight override pipeline (verify end-to-end)
// ============================================================================

describe('Fix C: Weight override pipeline end-to-end', () => {
  it('categoryMap weightOverrides flow through selectionsFromMap', () => {
    const categoryMap: WeatherCategoryMap = {
      selections: { subject: ['Amsterdam'], environment: ['Museumplein'] },
      customValues: { lighting: 'Dynamic light and shade as clouds drift past the sun' },
      negative: ['blurry', 'watermarks'],
      weightOverrides: { subject: 1.3, environment: 1.2, lighting: 1.3 },
      meta: baseMeta,
    };

    // selectionsFromMap extracts selections — weightOverrides travel separately
    const selections = selectionsFromMap(categoryMap);
    expect(selections.subject).toContain('Amsterdam');

    // Weight overrides are forwarded as 3rd arg to assemblePrompt
    const result = assemblePrompt('leonardo', selections, categoryMap.weightOverrides);
    // Leonardo uses :: syntax → Amsterdam::1.3 (from weather override, since platform has subject: 1.2 which wins? No — platform wins)
    // Actually: platform has subject: 1.2, weather says 1.3, platform wins → Amsterdam::1.2
    expect(result.positive).toMatch(/Amsterdam::\d/);
  });

  it('assemblePrompt works without weightOverrides (backward compat)', () => {
    const selections: PromptSelections = { subject: ['Test'] };
    const result = assemblePrompt('artguru', selections);
    expect(result.positive).toBeTruthy();
  });
});

// ============================================================================
// Fix D — Negative deduplication
// ============================================================================

describe('Fix D: Negative deduplication', () => {
  it('does not produce duplicate "blurry" in output', () => {
    // qualityNeg has "blurry", user negatives also have "blurry"
    const selections: PromptSelections = {
      subject: ['Amsterdam'],
      negative: ['blurry', 'watermarks', 'text', 'oversaturated'],
    };

    const result = assemblePrompt('artguru', selections);
    const negTerms = result.negative?.split(', ') ?? [];
    const blurryCount = negTerms.filter(t => t.toLowerCase() === 'blurry').length;
    expect(blurryCount).toBe(1); // exactly once, not twice
  });

  it('preserves all unique negative terms', () => {
    const selections: PromptSelections = {
      subject: ['Test'],
      negative: ['oversaturated', 'text'],
    };

    const result = assemblePrompt('artguru', selections);
    expect(result.negative).toContain('oversaturated');
    expect(result.negative).toContain('text');
    // qualityNeg terms should also be present
    expect(result.negative).toContain('worst quality');
    expect(result.negative).toContain('blurry');
  });
});

// ============================================================================
// Full Amsterdam simulation — the 95/100 test
// ============================================================================

describe('Amsterdam prompt: homepage vs builder parity', () => {
  const weatherSelections: PromptSelections = {
    subject: ['Amsterdam'],
    style: ['photorealistic'],
    lighting: ['Dynamic light and shade as clouds drift past the sun with soft intermittent shadows'],
    atmosphere: ['mysterious'],
    environment: ['Museumplein'],
    action: ['Southerly 12 km/h breeze, dust skittering across flagstones'],
    colour: ['vibrant colours'],
    camera: ['Shot on Sony A7 IV, 35mm f/1.4'],
    materials: ['Tight shadows on plaza stone'],
    composition: ['deep focus landscape', 'wide open-square scene, pavement-to-facade depth, moderate depth of field with background in sharp focus'],
    fidelity: ['noon'],
    negative: ['blurry', 'watermarks', 'text', 'oversaturated'],
  };

  const weatherWeights: Partial<Record<PromptCategory, number>> = {
    subject: 1.3,
    environment: 1.2,
    lighting: 1.3,
    composition: 1.05,
  };

  it('homepage and builder have same quality prefix', () => {
    const homepage = assemblePrompt('leonardo', weatherSelections, weatherWeights);
    const builder = assemblePrompt('artguru', weatherSelections, weatherWeights);

    // Extract first 3 terms
    const hpParts = homepage.positive.split(', ').slice(0, 3);
    const bdParts = builder.positive.split(', ').slice(0, 3);
    expect(hpParts).toEqual(bdParts);
  });

  it('builder preserves city emphasis weight', () => {
    const builder = assemblePrompt('artguru', weatherSelections, weatherWeights);
    // Artguru platform has subject: 1.2 (wins over weather's 1.3)
    expect(builder.positive).toContain('(Amsterdam:1.2)');
  });

  it('homepage and builder have same term ordering (impactPriority aligned)', () => {
    const homepage = assemblePrompt('leonardo', weatherSelections, weatherWeights);
    const builder = assemblePrompt('artguru', weatherSelections, weatherWeights);

    // Strip weight syntax to compare term ordering
    const stripWeights = (s: string) =>
      s.replace(/\(([^:]+):[0-9.]+\)/g, '$1')  // (term:1.2) → term
       .replace(/::[0-9.]+/g, '');              // term::1.2 → term

    const hpTerms = stripWeights(homepage.positive).split(', ');
    const bdTerms = stripWeights(builder.positive).split(', ');

    // After quality prefix, subject should be next, then style, then lighting
    expect(hpTerms.indexOf('Amsterdam')).toBe(bdTerms.indexOf('Amsterdam'));
    expect(hpTerms.indexOf('photorealistic')).toBe(bdTerms.indexOf('photorealistic'));
  });

  it('neither output has duplicate blurry in negatives', () => {
    const homepage = assemblePrompt('leonardo', weatherSelections, weatherWeights);
    const builder = assemblePrompt('artguru', weatherSelections, weatherWeights);

    for (const result of [homepage, builder]) {
      const negTerms = result.negative?.split(', ') ?? [];
      const blurryCount = negTerms.filter(t => t === 'blurry').length;
      expect(blurryCount).toBe(1); // exactly once, deduped
    }
  });

  it('both outputs contain all core scene terms', () => {
    const homepage = assemblePrompt('leonardo', weatherSelections, weatherWeights);
    const builder = assemblePrompt('artguru', weatherSelections, weatherWeights);

    for (const result of [homepage, builder]) {
      expect(result.positive).toContain('Amsterdam');
      expect(result.positive).toContain('Museumplein');
      expect(result.positive).toContain('photorealistic');
      expect(result.positive).toContain('mysterious');
    }
  });
});
