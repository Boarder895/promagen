/**
 * @file src/lib/feedback/__tests__/feedback-scene-enhancer.test.ts
 *
 * Phase 7.10 — Feedback-Aware Scene Starters + Confidence Halos tests.
 * 33 tests across 6 groups.
 *
 * Authority: prompt-builder-evolution-plan-v2.md § 7.10
 * Version: 1.0.0
 * Created: 2026-03-01
 */

import {
  enhanceScenePrefills,
  hasEnoughFeedbackForEnhancement,
  computeSceneConfidence,
  computeSceneConfidenceMap,
  MIN_HINT_COUNT,
  MAX_ADDITIONS_PER_CATEGORY,
  PROVEN_THRESHOLD,
  WARM_THRESHOLD,
  RISKY_THRESHOLD,
} from '@/lib/feedback/feedback-scene-enhancer';
import type { TermHint } from '@/hooks/use-feedback-memory';

// ============================================================================
// MOCK VOCABULARY
// ============================================================================

const mockVocab: Record<string, string[]> = {
  lighting: ['dramatic lighting', 'cinematic lighting', 'volumetric fog', 'rim light', 'soft light', 'neon glow'],
  atmosphere: ['mysterious', 'ethereal', 'moody', 'dreamy', 'foggy', 'haunting'],
  style: ['cinematic style', 'watercolor', 'oil painting', 'hyperrealistic', 'anime', 'photorealistic'],
  camera: ['close-up', 'wide angle', 'macro', 'telephoto', 'bird eye view'],
};

const vocabLookup = (category: string): string[] => {
  return mockVocab[category] ?? [];
};

// ============================================================================
// HELPERS
// ============================================================================

function hint(term: string, type: 'positive' | 'negative', count: number): TermHint {
  return { term, type, count };
}

// ============================================================================
// enhanceScenePrefills — core function
// ============================================================================

describe('enhanceScenePrefills', () => {
  it('returns unmodified prefills when no hints', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const result = enhanceScenePrefills(prefills, [], vocabLookup);
    expect(result.prefills).toEqual(prefills);
    expect(result.modifiedCategories).toEqual([]);
    expect(result.addedTerms).toEqual([]);
  });

  it('adds positive-hinted terms to matching category', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 3),
      hint('volumetric fog', 'positive', 2),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toContain('dramatic lighting');
    expect(result.prefills.lighting).toContain('cinematic lighting');
    expect(result.prefills.lighting).toContain('volumetric fog');
    expect(result.modifiedCategories).toEqual(['lighting']);
    expect(result.addedTerms).toHaveLength(2);
  });

  it('does NOT add terms with count below MIN_HINT_COUNT', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 1),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toEqual(['dramatic lighting']);
    expect(result.modifiedCategories).toEqual([]);
  });

  it('limits additions per category to MAX_ADDITIONS_PER_CATEGORY', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 5),
      hint('volumetric fog', 'positive', 4),
      hint('rim light', 'positive', 3),
      hint('soft light', 'positive', 2),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting!.length).toBe(1 + MAX_ADDITIONS_PER_CATEGORY);
    expect(result.addedTerms).toHaveLength(MAX_ADDITIONS_PER_CATEGORY);
  });

  it('sorts additions by strongest signal first', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('soft light', 'positive', 2),
      hint('cinematic lighting', 'positive', 5),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.addedTerms[0]!.term).toBe('cinematic lighting');
  });

  it('does NOT add terms already in scene prefills', () => {
    const prefills = { lighting: ['cinematic lighting'] };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 5),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toEqual(['cinematic lighting']);
    expect(result.modifiedCategories).toEqual([]);
  });

  it('only adds terms that exist in the category vocabulary', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('mysterious', 'positive', 3), // atmosphere vocab, not lighting
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toEqual(['dramatic lighting']);
  });

  it('handles multiple categories independently', () => {
    const prefills = {
      lighting: ['dramatic lighting'],
      atmosphere: ['mysterious'],
    };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 3),
      hint('ethereal', 'positive', 2),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toContain('cinematic lighting');
    expect(result.prefills.atmosphere).toContain('ethereal');
    expect(result.modifiedCategories).toEqual(['lighting', 'atmosphere']);
  });

  it('flags negative-hinted scene terms in warningTerms', () => {
    const prefills = { style: ['watercolor', 'cinematic style'] };
    const hints: TermHint[] = [
      hint('watercolor', 'negative', 3),
    ];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.warningTerms).toEqual([{ category: 'style', term: 'watercolor' }]);
    expect(result.prefills.style).toContain('watercolor');
  });

  it('handles empty prefills gracefully', () => {
    const result = enhanceScenePrefills({}, [hint('cinematic lighting', 'positive', 5)], vocabLookup);
    expect(result.prefills).toEqual({});
    expect(result.addedTerms).toEqual([]);
  });

  it('handles category not in vocabulary (custom categories)', () => {
    const prefills = { custom_category: ['some term'] };
    const hints: TermHint[] = [hint('other term', 'positive', 3)];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.custom_category).toEqual(['some term']);
  });

  it('preserves categories with empty values', () => {
    const prefills = { lighting: [] as string[] };
    const hints: TermHint[] = [hint('cinematic lighting', 'positive', 3)];
    const result = enhanceScenePrefills(prefills, hints, vocabLookup);
    expect(result.prefills.lighting).toEqual([]);
  });
});

// ============================================================================
// hasEnoughFeedbackForEnhancement
// ============================================================================

describe('hasEnoughFeedbackForEnhancement', () => {
  it('returns false with no hints', () => {
    expect(hasEnoughFeedbackForEnhancement([])).toBe(false);
  });

  it('returns false when hints below threshold', () => {
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 1),
      hint('bokeh', 'positive', 1),
    ];
    expect(hasEnoughFeedbackForEnhancement(hints)).toBe(false);
  });

  it('returns true with enough strong positive hints', () => {
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 3),
      hint('volumetric fog', 'positive', 2),
      hint('ethereal', 'positive', 4),
    ];
    expect(hasEnoughFeedbackForEnhancement(hints)).toBe(true);
  });

  it('ignores negative hints in count', () => {
    const hints: TermHint[] = [
      hint('watercolor', 'negative', 5),
      hint('hyperrealistic', 'negative', 3),
      hint('cinematic lighting', 'positive', 2),
    ];
    expect(hasEnoughFeedbackForEnhancement(hints)).toBe(false);
  });

  it('respects custom threshold', () => {
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 2),
    ];
    expect(hasEnoughFeedbackForEnhancement(hints, 1)).toBe(true);
    expect(hasEnoughFeedbackForEnhancement(hints, 2)).toBe(false);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('Constants', () => {
  it('MIN_HINT_COUNT is a positive integer', () => {
    expect(MIN_HINT_COUNT).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(MIN_HINT_COUNT)).toBe(true);
  });

  it('MAX_ADDITIONS_PER_CATEGORY is a positive integer', () => {
    expect(MAX_ADDITIONS_PER_CATEGORY).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(MAX_ADDITIONS_PER_CATEGORY)).toBe(true);
  });
});

// ============================================================================
// computeSceneConfidence — single scene confidence
// ============================================================================

describe('computeSceneConfidence', () => {
  it('returns null with no hints', () => {
    expect(computeSceneConfidence({ lighting: ['dramatic lighting'] }, [])).toBeNull();
  });

  it('returns null with empty prefills', () => {
    expect(computeSceneConfidence({}, [hint('cinematic lighting', 'positive', 3)])).toBeNull();
  });

  it('returns "proven" when 3+ positive hints overlap', () => {
    const prefills = {
      lighting: ['dramatic lighting', 'cinematic lighting'],
      atmosphere: ['mysterious', 'ethereal'],
    };
    const hints: TermHint[] = [
      hint('dramatic lighting', 'positive', 3),
      hint('cinematic lighting', 'positive', 2),
      hint('mysterious', 'positive', 4),
    ];
    expect(computeSceneConfidence(prefills, hints)).toBe('proven');
  });

  it('returns "warm" when 1–2 positive hints overlap and no negatives', () => {
    const prefills = { lighting: ['cinematic lighting'] };
    expect(computeSceneConfidence(prefills, [hint('cinematic lighting', 'positive', 2)])).toBe('warm');
  });

  it('returns "risky" when 2+ negative hints overlap', () => {
    const prefills = { style: ['watercolor', 'oil painting'] };
    const hints: TermHint[] = [
      hint('watercolor', 'negative', 3),
      hint('oil painting', 'negative', 2),
    ];
    expect(computeSceneConfidence(prefills, hints)).toBe('risky');
  });

  it('risky takes priority over proven (safety-first)', () => {
    const prefills = {
      lighting: ['dramatic lighting', 'cinematic lighting', 'rim light'],
      style: ['watercolor', 'oil painting'],
    };
    const hints: TermHint[] = [
      hint('dramatic lighting', 'positive', 3),
      hint('cinematic lighting', 'positive', 2),
      hint('rim light', 'positive', 2),
      hint('watercolor', 'negative', 2),
      hint('oil painting', 'negative', 3),
    ];
    expect(computeSceneConfidence(prefills, hints)).toBe('risky');
  });

  it('ignores positive hints with count below MIN_HINT_COUNT', () => {
    expect(
      computeSceneConfidence({ lighting: ['dramatic lighting'] }, [hint('dramatic lighting', 'positive', 1)]),
    ).toBeNull();
  });

  it('returns null for mixed weak signal (positive + 1 negative)', () => {
    const prefills = { lighting: ['dramatic lighting'], style: ['watercolor'] };
    const hints: TermHint[] = [
      hint('dramatic lighting', 'positive', 2),
      hint('watercolor', 'negative', 1),
    ];
    // 1 positive + 1 negative → not warm (negative exists), not risky (below threshold)
    expect(computeSceneConfidence(prefills, hints)).toBeNull();
  });

  it('does not count non-overlapping hints', () => {
    const prefills = { lighting: ['dramatic lighting'] };
    const hints: TermHint[] = [
      hint('cinematic lighting', 'positive', 5),
      hint('volumetric fog', 'positive', 3),
      hint('rim light', 'positive', 2),
    ];
    expect(computeSceneConfidence(prefills, hints)).toBeNull();
  });
});

// ============================================================================
// computeSceneConfidenceMap — batch scoring
// ============================================================================

describe('computeSceneConfidenceMap', () => {
  it('returns empty map with no hints', () => {
    const scenes = [{ id: 'sc1', prefills: { lighting: ['dramatic lighting'] } }];
    expect(computeSceneConfidenceMap(scenes, []).size).toBe(0);
  });

  it('maps multiple scenes to their confidence levels', () => {
    const scenes = [
      { id: 'proven-scene', prefills: { lighting: ['dramatic lighting', 'cinematic lighting', 'rim light'] } },
      { id: 'risky-scene', prefills: { style: ['watercolor', 'oil painting'] } },
      { id: 'neutral-scene', prefills: { camera: ['macro'] } },
    ];
    const hints: TermHint[] = [
      hint('dramatic lighting', 'positive', 3),
      hint('cinematic lighting', 'positive', 2),
      hint('rim light', 'positive', 4),
      hint('watercolor', 'negative', 2),
      hint('oil painting', 'negative', 3),
    ];
    const map = computeSceneConfidenceMap(scenes, hints);
    expect(map.get('proven-scene')).toBe('proven');
    expect(map.get('risky-scene')).toBe('risky');
    expect(map.has('neutral-scene')).toBe(false);
  });

  it('omits null-confidence scenes from map', () => {
    const scenes = [{ id: 'sc1', prefills: { camera: ['macro'] } }];
    expect(computeSceneConfidenceMap(scenes, [hint('cinematic lighting', 'positive', 3)]).size).toBe(0);
  });
});

// ============================================================================
// Confidence Constants
// ============================================================================

describe('Confidence Constants', () => {
  it('PROVEN_THRESHOLD >= WARM_THRESHOLD', () => {
    expect(PROVEN_THRESHOLD).toBeGreaterThanOrEqual(WARM_THRESHOLD);
  });

  it('RISKY_THRESHOLD is a positive integer', () => {
    expect(RISKY_THRESHOLD).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(RISKY_THRESHOLD)).toBe(true);
  });
});
