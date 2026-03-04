// src/__tests__/phase-c-unified-brain.test.ts
// ============================================================================
// PHASE C/E — Unified Brain Utility Tests
// ============================================================================
//
// Validates:
// 1. selectionsFromMap() correctly merges selections + customValues
// 2. tierToRefPlatform() returns valid platform IDs
//
// v11.0.0 (Phase E): Removed A/B comparison logger tests (file deleted).
// Authority: docs/authority/unified-prompt-brain.md
// ============================================================================

import { selectionsFromMap, tierToRefPlatform } from '@/lib/prompt-builder';
import type { WeatherCategoryMap } from '@/types/prompt-builder';

// ============================================================================
// selectionsFromMap() tests
// ============================================================================

describe('selectionsFromMap', () => {
  const baseMeta = {
    city: 'Istanbul',
    venue: 'Topkapı Palace Gates',
    venueSetting: 'monument',
    mood: 'contemplative',
    conditions: 'Partly Cloudy',
    emoji: '⛅',
    tempC: 8,
    localTime: '03:00',
    source: 'weather-intelligence' as const,
  };

  it('merges selections and customValues into a single PromptSelections', () => {
    const map: WeatherCategoryMap = {
      selections: {
        environment: ['ancient temple'],
        atmosphere: ['contemplative'],
        style: ['photorealistic'],
        colour: ['earth tones'],
        fidelity: ['highly detailed'],
      },
      customValues: {
        subject: 'Istanbul, Taksim Square, Topkapı Palace Gates',
        lighting: 'Cool white moonlight competing with focused accent lighting',
        camera: 'Shot on Canon EOS R5, 90mm f/2, sharp focus',
        composition: 'low-angle architectural night shot',
        materials: 'Cold dry stone steps',
        action: 'entrance flags shifting gently',
      },
      negative: ['people', 'text', 'watermarks', 'blurry'],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);

    // Selections-only categories: array of selections
    expect(result.environment).toEqual(['ancient temple']);
    expect(result.atmosphere).toEqual(['contemplative']);
    expect(result.style).toEqual(['photorealistic']);

    // CustomValues-only categories: array with single rich phrase
    expect(result.subject).toEqual(['Istanbul, Taksim Square, Topkapı Palace Gates']);
    expect(result.lighting).toEqual(['Cool white moonlight competing with focused accent lighting']);
    expect(result.camera).toEqual(['Shot on Canon EOS R5, 90mm f/2, sharp focus']);

    // Negative terms mapped to 'negative' key
    expect(result.negative).toEqual(['people', 'text', 'watermarks', 'blurry']);
  });

  it('drops selection when customValue contains it (Upgrade 1 dedup)', () => {
    const map: WeatherCategoryMap = {
      selections: {
        lighting: ['moonlight'],
      },
      customValues: {
        lighting: 'Cool white moonlight competing with focused accent lighting',
      },
      negative: [],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);

    // "moonlight" is contained in the customValue → dropped, only rich phrase kept
    expect(result.lighting).toEqual([
      'Cool white moonlight competing with focused accent lighting',
    ]);
  });

  it('keeps selection when customValue does NOT contain it', () => {
    const map: WeatherCategoryMap = {
      selections: {
        atmosphere: ['contemplative'],
      },
      customValues: {
        atmosphere: 'Quiet reverence at dawn',
      },
      negative: [],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);

    // "contemplative" is NOT in "Quiet reverence at dawn" → both kept
    expect(result.atmosphere).toEqual([
      'contemplative',
      'Quiet reverence at dawn',
    ]);
  });

  it('handles empty map gracefully', () => {
    const map: WeatherCategoryMap = {
      selections: {},
      customValues: {},
      negative: [],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);

    // Should have no keys (or only empty negative if present)
    const keys = Object.keys(result);
    expect(keys.length).toBe(0);
  });

  it('skips whitespace-only customValues', () => {
    const map: WeatherCategoryMap = {
      selections: { subject: ['cityscape'] },
      customValues: { subject: '   ' },
      negative: [],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);
    expect(result.subject).toEqual(['cityscape']); // No whitespace entry appended
  });

  it('preserves negative terms even when selections is empty', () => {
    const map: WeatherCategoryMap = {
      selections: {},
      customValues: {},
      negative: ['text', 'watermark', 'logo'],
      meta: baseMeta,
    };

    const result = selectionsFromMap(map);
    expect(result.negative).toEqual(['text', 'watermark', 'logo']);
  });
});

// ============================================================================
// tierToRefPlatform() tests
// ============================================================================

describe('tierToRefPlatform', () => {
  it('returns leonardo for Tier 1 (CLIP)', () => {
    expect(tierToRefPlatform(1)).toBe('leonardo');
  });

  it('returns midjourney for Tier 2 (MJ)', () => {
    expect(tierToRefPlatform(2)).toBe('midjourney');
  });

  it('returns openai for Tier 3 (Natural Language)', () => {
    expect(tierToRefPlatform(3)).toBe('openai');
  });

  it('returns canva for Tier 4 (Plain)', () => {
    expect(tierToRefPlatform(4)).toBe('canva');
  });
});

