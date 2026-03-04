// src/__tests__/improvements-1-5.test.ts
// ============================================================================
// IMPROVEMENTS 1–5 — World-Class Prompt Quality
// ============================================================================
//
// 1. Cross-category word deduplication
// 2. Weight override forwarding (assemblePrompt accepts weightOverrides)
// 3. Negative overflow (builder carries ALL negatives)
// 4. DoF + focal plane merge (single flowing phrase)
// 5. Token counter (estimateClipTokens + token limit)
// ============================================================================

import {
  assemblePrompt,
  deduplicateAcrossCategories,
  estimateClipTokens,
} from '@/lib/prompt-builder';
import { computeCompositionBlueprint, type CompositionInput } from '@/lib/weather/composition-blueprint';
import type { PromptCategory, PromptSelections, WeatherCategoryMeta } from '@/types/prompt-builder';

// ── Shared fixtures ─────────────────────────────────────────────────────────

const baseMeta: WeatherCategoryMeta = {
  city: 'Test',
  venue: 'Test Venue',
  venueSetting: 'street',
  mood: 'mysterious',
  conditions: 'Clear',
  emoji: '☀️',
  tempC: 25,
  localTime: '12:00',
  source: 'weather-intelligence',
};

const baseCompInput: CompositionInput = {
  categoryMap: {
    selections: { subject: ['Test City'], environment: ['Test Venue'] },
    customValues: {},
    negative: [],
    meta: baseMeta,
  },
  venueSetting: 'street',
  camera: { full: 'Sony A7 IV, 35mm f/1.4', body: 'Sony A7 IV', lensSpec: '35mm f/1.4', lensDescriptor: '35mm standard' },
  isNight: false,
};

// ============================================================================
// Improvement 1 — Cross-category deduplication
// ============================================================================

describe('Improvement 1: deduplicateAcrossCategories', () => {
  const effectiveOrder: PromptCategory[] = [
    'subject', 'style', 'atmosphere', 'lighting', 'environment',
    'composition', 'camera', 'colour', 'materials', 'fidelity', 'action',
  ];

  it('removes exact duplicate terms across categories', () => {
    const selections: PromptSelections = {
      atmosphere: ['mysterious'],
      style: ['mysterious'], // exact duplicate in different category
      lighting: ['bright daylight'],
    };

    const result = deduplicateAcrossCategories(selections, effectiveOrder);
    // 'atmosphere' comes before 'style' in effectiveOrder → keeps in atmosphere
    expect(result.atmosphere).toContain('mysterious');
    expect(result.style ?? []).not.toContain('mysterious');
  });

  it('preserves different terms across categories', () => {
    const selections: PromptSelections = {
      atmosphere: ['mysterious'],
      style: ['photorealistic'],
      lighting: ['bright daylight'],
    };

    const result = deduplicateAcrossCategories(selections, effectiveOrder);
    expect(result.atmosphere).toContain('mysterious');
    expect(result.style).toContain('photorealistic');
    expect(result.lighting).toContain('bright daylight');
  });

  it('is case-insensitive', () => {
    const selections: PromptSelections = {
      subject: ['Almaty'],
      environment: ['almaty'], // same term, different case
    };

    const result = deduplicateAcrossCategories(selections, effectiveOrder);
    expect(result.subject).toContain('Almaty');
    expect(result.environment ?? []).not.toContain('almaty');
  });

  it('preserves negative terms unchanged', () => {
    const selections: PromptSelections = {
      subject: ['cityscape'],
      negative: ['blurry', 'low quality'],
    };

    const result = deduplicateAcrossCategories(selections, effectiveOrder);
    expect(result.negative).toEqual(['blurry', 'low quality']);
  });

  it('first category in effective order wins', () => {
    const selections: PromptSelections = {
      lighting: ['golden hour'],
      colour: ['golden hour'], // later in order
    };

    const result = deduplicateAcrossCategories(selections, effectiveOrder);
    expect(result.lighting).toContain('golden hour');
    expect(result.colour ?? []).not.toContain('golden hour');
  });
});

// ============================================================================
// Improvement 2 — Weight override forwarding
// ============================================================================

describe('Improvement 2: assemblePrompt weight overrides', () => {
  it('accepts optional weightOverrides parameter', () => {
    const selections: PromptSelections = {
      subject: ['Almaty'],
      lighting: ['bright daylight'],
    };

    // Should not throw
    const result = assemblePrompt('artguru', selections, { subject: 1.3 });
    expect(result.positive).toBeTruthy();
  });

  it('still works without weightOverrides (backward compat)', () => {
    const selections: PromptSelections = {
      subject: ['Almaty'],
    };

    const result = assemblePrompt('artguru', selections);
    expect(result.positive).toContain('Almaty');
  });
});

// ============================================================================
// Improvement 4 — DoF + focal plane merge
// ============================================================================

describe('Improvement 4: DoF + focal plane merged phrase', () => {
  it('moderate DoF uses "with X in sharp focus" phrasing', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'plaza',
    });

    // Should be merged: "moderate depth of field with midground in sharp focus"
    expect(result.compositionText).toContain('moderate depth of field with');
    expect(result.compositionText).toContain('in sharp focus');
    // Old format would have "tack-sharp" — should NOT appear
    expect(result.compositionText).not.toContain('tack-sharp');
  });

  it('shallow DoF uses "with X in sharp focus" phrasing', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'park',
      camera: { full: 'Canon EOS R5, 85mm f/1.2', body: 'Canon EOS R5', lensSpec: '85mm f/1.2', lensDescriptor: '85mm portrait telephoto' },
    });

    expect(result.compositionText).toContain('shallow depth of field with');
    expect(result.compositionText).toContain('in sharp focus');
    expect(result.compositionText).toContain('soft bokeh');
  });

  it('deep DoF uses "from X through background" phrasing', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'elevated',
    });

    expect(result.compositionText).toContain('deep focus from');
    expect(result.compositionText).toContain('through background');
  });
});

// ============================================================================
// Improvement 5 — Token estimation
// ============================================================================

describe('Improvement 5: estimateClipTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateClipTokens('')).toBe(0);
  });

  it('counts words as approximate tokens', () => {
    const tokens = estimateClipTokens('masterpiece, best quality, highly detailed');
    // 3 words + 2 commas ≈ 5 tokens (commas are individual tokens in CLIP)
    expect(tokens).toBeGreaterThan(3);
    expect(tokens).toBeLessThan(10);
  });

  it('strips CLIP weight syntax before counting', () => {
    const withWeights = estimateClipTokens('(Almaty:1.2), photorealistic');
    const withoutWeights = estimateClipTokens('Almaty, photorealistic');
    // Both should produce similar token counts
    expect(Math.abs(withWeights - withoutWeights)).toBeLessThanOrEqual(2);
  });

  it('strips NovelAI brace syntax before counting', () => {
    const withBraces = estimateClipTokens('{{{masterpiece}}}, {{best quality}}');
    const withoutBraces = estimateClipTokens('masterpiece, best quality');
    expect(Math.abs(withBraces - withoutBraces)).toBeLessThanOrEqual(1);
  });

  it('strips A1111 weight syntax before counting', () => {
    const withWeights = estimateClipTokens('Almaty::1.2, photorealistic');
    const withoutWeights = estimateClipTokens('Almaty, photorealistic');
    expect(Math.abs(withWeights - withoutWeights)).toBeLessThanOrEqual(1);
  });

  it('preserves decimal numbers like f/1.4', () => {
    const tokens = estimateClipTokens('Shot on Canon EOS R5, 35mm f/1.4');
    // Should count each word and number
    expect(tokens).toBeGreaterThan(5);
  });
});

describe('Improvement 5: assemblePrompt includes token fields', () => {
  it('returns estimatedTokens', () => {
    const selections: PromptSelections = {
      subject: ['Almaty'],
      lighting: ['bright daylight'],
    };
    const result = assemblePrompt('artguru', selections);
    expect(result.estimatedTokens).toBeDefined();
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it('returns tokenLimit from platform config', () => {
    const selections: PromptSelections = {
      subject: ['test'],
    };
    const result = assemblePrompt('artguru', selections);
    expect(result.tokenLimit).toBeDefined();
    // Artguru has tokenLimit: 150
    expect(result.tokenLimit).toBe(150);
  });

  it('midjourney has lower token limit', () => {
    const selections: PromptSelections = {
      subject: ['test'],
    };
    const result = assemblePrompt('midjourney', selections);
    // MJ has tokenLimit: 60
    expect(result.tokenLimit).toBe(60);
  });
});
