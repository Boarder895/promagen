// src/__tests__/upgrade-3-canonical-assembly.test.ts
// ============================================================================
// UPGRADE 3 — Single Canonical Assembly Tests
// ============================================================================
//
// Validates:
// 1. Assembly-level dedup: shorter substring values dropped within a category
// 2. Sanitiser fix: period-before-comma ("overhead., " → "overhead, ")
// 3. End-to-end: assemblePrompt uses dedup automatically (both paths identical)
//
// This is the core symmetry fix: both the generator and builder UI call
// assemblePrompt(), and dedup runs inside assembleTierAware() so both
// paths produce identical output.
// ============================================================================

import {
  sanitiseClipTokens,
  deduplicateWithinCategories,
  assemblePrompt,
} from '@/lib/prompt-builder';

// ============================================================================
// deduplicateWithinCategories() — direct tests
// ============================================================================

describe('deduplicateWithinCategories', () => {
  it('drops selection when customValue contains it (lighting dedup)', () => {
    const result = deduplicateWithinCategories({
      lighting: [
        'natural daylight',
        'Natural daylight, low rolling stratocumulus blanket overhead',
      ],
    });

    expect(result.lighting).toEqual([
      'Natural daylight, low rolling stratocumulus blanket overhead',
    ]);
  });

  it('keeps genuinely different terms (street photography vs street-level)', () => {
    const result = deduplicateWithinCategories({
      composition: ['street photography', 'street-level photography'],
    });

    // "street photography" is NOT a substring of "street-level photography"
    expect(result.composition).toEqual([
      'street photography',
      'street-level photography',
    ]);
  });

  it('drops shorter when it IS a substring (documentary dedup)', () => {
    const result = deduplicateWithinCategories({
      composition: ['street-level documentary', 'street-level documentary shot'],
    });

    expect(result.composition).toEqual(['street-level documentary shot']);
  });

  it('preserves single-value categories', () => {
    const result = deduplicateWithinCategories({
      atmosphere: ['mysterious'],
    });
    expect(result.atmosphere).toEqual(['mysterious']);
  });

  it('preserves empty categories', () => {
    const result = deduplicateWithinCategories({ negative: [] });
    expect(result.negative).toEqual([]);
  });

  it('handles multiple categories independently', () => {
    const result = deduplicateWithinCategories({
      lighting: ['moonlight', 'Cool white moonlight competing with accent lighting'],
      atmosphere: ['contemplative'],
      style: ['photorealistic'],
    });

    expect(result.lighting).toEqual([
      'Cool white moonlight competing with accent lighting',
    ]);
    expect(result.atmosphere).toEqual(['contemplative']);
    expect(result.style).toEqual(['photorealistic']);
  });

  it('case-insensitive matching (Natural vs natural)', () => {
    const result = deduplicateWithinCategories({
      lighting: ['Natural daylight', 'natural daylight in the morning'],
    });

    expect(result.lighting).toEqual(['natural daylight in the morning']);
  });
});

// ============================================================================
// sanitiseClipTokens — period-before-comma fix (Upgrade 2 patch)
// ============================================================================

describe('sanitiseClipTokens — period-before-comma', () => {
  it('strips period before comma (the overhead., bug)', () => {
    const result = sanitiseClipTokens(
      'Natural daylight, low rolling stratocumulus blanket overhead., Southerly breeze',
    );

    expect(result).toBe(
      'Natural daylight, low rolling stratocumulus blanket overhead, Southerly breeze',
    );
  });

  it('preserves decimals before comma (f/1.4,)', () => {
    expect(sanitiseClipTokens('50mm f/1.4, sharp focus')).toBe(
      '50mm f/1.4, sharp focus',
    );
  });

  it('handles period-before-comma AND mid-text period together', () => {
    const result = sanitiseClipTokens(
      'Natural daylight. Lumpy stratocumulus overhead., midground tack-sharp.',
    );

    expect(result).toBe(
      'Natural daylight, lumpy stratocumulus overhead, midground tack-sharp',
    );
  });
});

// ============================================================================
// End-to-end: assemblePrompt applies dedup automatically
// ============================================================================

describe('assemblePrompt applies dedup automatically', () => {
  it('deduplicates lighting in keyword-mode assembly (Tier 1)', () => {
    const result = assemblePrompt('leonardo', {
      subject: ['Washington DC cityscape'],
      lighting: [
        'natural daylight',
        'Natural daylight, low rolling stratocumulus blanket overhead',
      ],
    });

    // "natural daylight" should be deduped (substring of the customValue)
    expect(result.positive).not.toMatch(/natural daylight,\s*Natural daylight/i);
    // The rich phrase should survive
    expect(result.positive).toContain('stratocumulus');
  });

  it('deduplicates in natural-language assembly (Tier 3)', () => {
    const result = assemblePrompt('openai', {
      subject: ['city at dawn'],
      lighting: [
        'golden light',
        'Golden light filtering through morning haze',
      ],
    });

    // Only the richer phrase should appear
    const matches = result.positive.match(/golden light/gi) ?? [];
    expect(matches.length).toBe(1);
  });
});
