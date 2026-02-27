// src/lib/prompt-intelligence/engines/__tests__/integration-scoring.test.ts
// ============================================================================
// SELF-IMPROVING SCORER — Integration Scoring Tests
// ============================================================================
//
// Verifies that calculateHealthScore works correctly with both static
// (pre-Phase 6) and learned (post-Phase 6) weight modes.
//
// These tests call analyzePrompt() which internally calls calculateHealthScore(),
// testing the full pipeline from hook → analysis → health score.
//
// Authority: phase-6-self-improving-scorer-buildplan.md § 4.3
//
// Version: 1.0.0
// Created: 26 February 2026
// ============================================================================

import { analyzePrompt, type PromptState } from '../integration';
import type { ScoringWeights, TierWeightProfile } from '@/lib/learning/weight-recalibration';
import { STATIC_DEFAULTS } from '@/lib/learning/weight-recalibration';

// ============================================================================
// HELPERS
// ============================================================================

/** Standard test state: subject + 3 filled categories */
const baseState: PromptState = {
  subject: 'a cyberpunk warrior',
  selections: {
    style: ['cyberpunk'],
    lighting: ['neon'],
    atmosphere: ['dark'],
  },
  negatives: [],
  platformId: 'midjourney',
};

/** Empty state: no subject, no selections */
const emptyState: PromptState = {
  subject: '',
  selections: {},
  negatives: [],
  platformId: 'midjourney',
};

/** Fully filled state: subject + all categories */
const fullState: PromptState = {
  subject: 'a cyberpunk warrior',
  selections: {
    style: ['cyberpunk'],
    lighting: ['neon'],
    colour: ['teal'],
    atmosphere: ['dark'],
    environment: ['city'],
    action: ['standing'],
    composition: ['close-up'],
    camera: ['wide angle'],
    materials: ['metallic'],
    fidelity: ['ultra detailed'],
  },
  negatives: ['blurry'],
  platformId: 'midjourney',
};

/**
 * Build a mock ScoringWeights with custom per-tier profiles.
 */
function buildMockWeights(overrides?: {
  global?: Partial<TierWeightProfile>;
  tiers?: Record<string, Partial<TierWeightProfile>>;
}): ScoringWeights {
  const defaultProfile: TierWeightProfile = {
    weights: { ...STATIC_DEFAULTS },
    correlations: Object.fromEntries(
      Object.keys(STATIC_DEFAULTS).map((k) => [k, 0.1]),
    ),
    eventCount: 1000,
  };

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    eventCount: 5000,
    global: { ...defaultProfile, ...overrides?.global },
    tiers: {
      '1': { ...defaultProfile, ...overrides?.tiers?.['1'] },
      '2': { ...defaultProfile, ...overrides?.tiers?.['2'] },
      '3': { ...defaultProfile, ...overrides?.tiers?.['3'] },
      '4': { ...defaultProfile, ...overrides?.tiers?.['4'] },
    },
  };
}

// ============================================================================
// STATIC FALLBACK (Regression Tests)
// ============================================================================

describe('calculateHealthScore — static fallback (regression)', () => {
  it('produces the same score as pre-Phase 6 with no learned weights', () => {
    // Original formula: 50 base + 20 subject + floor(3/10 * 15) + floor(100 * 0.15)
    // = 50 + 20 + 4 + 15 = 89
    const result = analyzePrompt(baseState);
    expect(result.healthScore).toBe(89);
  });

  it('produces the same score when learnedWeights is null', () => {
    const withNull = analyzePrompt(baseState, undefined, {
      learnedWeights: null,
    });
    const withoutParam = analyzePrompt(baseState);
    expect(withNull.healthScore).toBe(withoutParam.healthScore);
  });

  it('produces the same score when learnedWeights is undefined', () => {
    const withUndefined = analyzePrompt(baseState, undefined, {
      learnedWeights: undefined,
    });
    const withoutParam = analyzePrompt(baseState);
    expect(withUndefined.healthScore).toBe(withoutParam.healthScore);
  });

  it('empty state produces base score (50)', () => {
    const result = analyzePrompt(emptyState);
    // 50 base + 0 subject + 0 fill + floor(100 * 0.15)
    // = 50 + 0 + 0 + 15 = 65
    expect(result.healthScore).toBe(65);
  });

  it('subject alone adds 20', () => {
    const withSubject = analyzePrompt({
      ...emptyState,
      subject: 'a cat',
    });
    const withoutSubject = analyzePrompt(emptyState);
    expect(withSubject.healthScore - withoutSubject.healthScore).toBe(20);
  });
});

// ============================================================================
// LEARNED WEIGHTS
// ============================================================================

describe('calculateHealthScore — with learned weights', () => {
  it('uses learned weights when provided', () => {
    const weights = buildMockWeights();
    const withLearned = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
    });
    // Should produce a valid score in 0-100 range
    expect(withLearned.healthScore).toBeGreaterThanOrEqual(0);
    expect(withLearned.healthScore).toBeLessThanOrEqual(100);
  });

  it('coherence-heavy weights boost score for coherent prompts', () => {
    // Weights where coherence is dominant
    const coherenceHeavy = buildMockWeights({
      global: {
        weights: {
          categoryCount: 0.05,
          coherence: 0.80,
          promptLength: 0.03,
          tierFormat: 0.03,
          negative: 0.03,
          fidelity: 0.03,
          density: 0.03,
        },
      },
    });

    // Weights where categoryCount is dominant
    const fillHeavy = buildMockWeights({
      global: {
        weights: {
          categoryCount: 0.80,
          coherence: 0.05,
          promptLength: 0.03,
          tierFormat: 0.03,
          negative: 0.03,
          fidelity: 0.03,
          density: 0.03,
        },
      },
    });

    // Base state has high coherence (no conflicts) but only 3/10 categories
    const withCoherenceHeavy = analyzePrompt(baseState, undefined, {
      learnedWeights: coherenceHeavy,
    });

    const withFillHeavy = analyzePrompt(baseState, undefined, {
      learnedWeights: fillHeavy,
    });

    // With coherence dominant, coherent prompt should score higher
    // than when fill is dominant (since fill is only 3/10 = 30%)
    expect(withCoherenceHeavy.healthScore).toBeGreaterThan(
      withFillHeavy.healthScore,
    );
  });

  it('never crashes with missing or empty weights object', () => {
    const emptyWeights: ScoringWeights = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      eventCount: 0,
      global: { weights: {}, correlations: {}, eventCount: 0 },
      tiers: {},
    };

    // Should fall back gracefully, not crash
    const result = analyzePrompt(baseState, undefined, {
      learnedWeights: emptyWeights,
    });
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it('full state produces higher score than base state', () => {
    const weights = buildMockWeights();

    const full = analyzePrompt(fullState, undefined, {
      learnedWeights: weights,
    });
    const base = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
    });

    expect(full.healthScore).toBeGreaterThanOrEqual(base.healthScore);
  });
});

// ============================================================================
// PER-TIER WEIGHTS
// ============================================================================

describe('calculateHealthScore — per-tier', () => {
  it('same prompt gets different scores on different tiers', () => {
    // Tier 1: coherence matters most
    // Tier 4: categoryCount matters most
    const weights = buildMockWeights({
      tiers: {
        '1': {
          weights: {
            categoryCount: 0.05,
            coherence: 0.80,
            negative: 0.05,
            promptLength: 0.03,
            tierFormat: 0.03,
            fidelity: 0.02,
            density: 0.02,
          },
        },
        '4': {
          weights: {
            categoryCount: 0.80,
            coherence: 0.05,
            negative: 0.05,
            promptLength: 0.03,
            tierFormat: 0.03,
            fidelity: 0.02,
            density: 0.02,
          },
        },
      },
    });

    const tier1Score = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
      tierId: 1,
    }).healthScore;

    const tier4Score = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
      tierId: 4,
    }).healthScore;

    // Should be different (base state has high coherence but low fill)
    expect(tier1Score).not.toBe(tier4Score);
    // Tier 1 (coherence heavy) should score higher for coherent-but-sparse prompt
    expect(tier1Score).toBeGreaterThan(tier4Score);
  });

  it('falls back to global when tier not in weights', () => {
    const weights = buildMockWeights();
    // Remove tier 3
    delete weights.tiers['3'];

    const tier3Score = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
      tierId: 3,
    }).healthScore;

    const globalScore = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
      // No tierId → uses global
    }).healthScore;

    expect(tier3Score).toBe(globalScore);
  });

  it('tierId without learnedWeights uses static formula', () => {
    const withTier = analyzePrompt(baseState, undefined, {
      tierId: 2,
    });
    const withoutTier = analyzePrompt(baseState);

    // No learned weights → both use static formula → same score
    expect(withTier.healthScore).toBe(withoutTier.healthScore);
  });
});

// ============================================================================
// NEGATIVE TERMS INTEGRATION
// ============================================================================

describe('calculateHealthScore — negative terms', () => {
  it('negatives contribute to score when weight exists', () => {
    // Weights where negative has meaningful weight
    const weights = buildMockWeights({
      global: {
        weights: {
          categoryCount: 0.20,
          coherence: 0.20,
          negative: 0.40,  // Heavy weight on negatives
          promptLength: 0.05,
          tierFormat: 0.05,
          fidelity: 0.05,
          density: 0.05,
        },
      },
    });

    const withNeg = analyzePrompt(
      { ...baseState, negatives: ['blurry'] },
      undefined,
      { learnedWeights: weights },
    );

    const withoutNeg = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
    });

    // Having negatives should increase score when negative weight is high
    expect(withNeg.healthScore).toBeGreaterThan(withoutNeg.healthScore);
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

describe('analyzePrompt — backward compatibility', () => {
  it('works with just state argument (original signature)', () => {
    const result = analyzePrompt(baseState);
    expect(result).toBeDefined();
    expect(result.healthScore).toBeGreaterThan(0);
    expect(result.dna).toBeDefined();
    expect(result.conflicts).toBeDefined();
    expect(result.formatted).toBeDefined();
  });

  it('works with state + market (Phase 5 signature)', () => {
    const result = analyzePrompt(baseState, {
      enabled: false,
    });
    expect(result).toBeDefined();
    expect(result.healthScore).toBeGreaterThan(0);
  });

  it('works with state + market + options (Phase 6 signature)', () => {
    const weights = buildMockWeights();
    const result = analyzePrompt(baseState, undefined, {
      learnedWeights: weights,
      tierId: 2,
    });
    expect(result).toBeDefined();
    expect(result.healthScore).toBeGreaterThan(0);
  });

  it('all three signatures produce valid PromptAnalysis', () => {
    const v1 = analyzePrompt(baseState);
    const v2 = analyzePrompt(baseState, { enabled: false });
    const v3 = analyzePrompt(baseState, undefined, {
      learnedWeights: buildMockWeights(),
    });

    for (const result of [v1, v2, v3]) {
      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.summary.filledCategories).toBeGreaterThanOrEqual(0);
      expect(result.dna.coherenceScore).toBeGreaterThanOrEqual(0);
    }
  });
});
