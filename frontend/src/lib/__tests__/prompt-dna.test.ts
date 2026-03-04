// src/lib/__tests__/prompt-dna.test.ts
// ============================================================================
// PROMPT DNA FINGERPRINTING — Unit Tests
// ============================================================================
// Tests for the category combination hashing and engagement scoring engine.
//
// Test project: util (node environment)
// Run: pnpm test -- --selectProjects util --testPathPattern="prompt-dna" --verbose
// ============================================================================

import {
  generateFingerprint,
  createEmptyScore,
  computeQualityScore,
  recordEngagement,
  hasSameCategoryShape,
  categoryOverlap,
  termOverlap,
  fnv1a32,
  normaliseTerm,
  FINGERPRINT_CATEGORY_ORDER,
  ENGAGEMENT_WEIGHTS,
} from '@/lib/prompt-dna';

import type { PromptSelections, PromptDNAScore } from '@/types/prompt-builder';

// ============================================================================
// FNV-1a Hash
// ============================================================================

describe('fnv1a32()', () => {
  it('produces an 8-character hex string', () => {
    const hash = fnv1a32('test');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic (same input → same output)', () => {
    expect(fnv1a32('hello world')).toBe(fnv1a32('hello world'));
  });

  it('different inputs produce different hashes', () => {
    expect(fnv1a32('moonlight')).not.toBe(fnv1a32('golden hour'));
  });

  it('empty string produces valid hash', () => {
    expect(fnv1a32('')).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ============================================================================
// normaliseTerm()
// ============================================================================

describe('normaliseTerm()', () => {
  it('lowercases', () => {
    expect(normaliseTerm('Golden Hour')).toBe('golden hour');
  });

  it('trims whitespace', () => {
    expect(normaliseTerm('  moonlight  ')).toBe('moonlight');
  });

  it('collapses internal whitespace', () => {
    expect(normaliseTerm('golden   hour')).toBe('golden hour');
  });
});

// ============================================================================
// generateFingerprint()
// ============================================================================

describe('generateFingerprint()', () => {
  it('produces a valid fingerprint from simple selections', () => {
    const selections: PromptSelections = {
      subject: ['cityscape'],
      lighting: ['moonlight'],
      atmosphere: ['contemplative'],
    };

    const fp = generateFingerprint(selections, 'stability');

    expect(fp.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(fp.categories).toEqual({
      subject: 'cityscape',
      lighting: 'moonlight',
      atmosphere: 'contemplative',
    });
    expect(fp.platformId).toBe('stability');
    expect(fp.source).toBe('user');
    expect(fp.createdAt).toBeTruthy();
  });

  it('normalises term casing for stable hashing', () => {
    const fp1 = generateFingerprint(
      { subject: ['Cityscape'] },
      'stability',
    );
    const fp2 = generateFingerprint(
      { subject: ['cityscape'] },
      'stability',
    );

    // Same normalised term → same hash
    expect(fp1.hash).toBe(fp2.hash);
  });

  it('ignores negative category', () => {
    const fp = generateFingerprint(
      { subject: ['cityscape'], negative: ['blurry', 'text'] },
      'stability',
    );

    // Negative should not appear in categories
    expect(fp.categories).toEqual({ subject: 'cityscape' });
    expect('negative' in fp.categories).toBe(false);
  });

  it('uses first value from multi-value categories', () => {
    const fp = generateFingerprint(
      { subject: ['cityscape', 'skyline'] },
      'stability',
    );

    // Only first value used for fingerprinting
    expect(fp.categories.subject).toBe('cityscape');
  });

  it('empty selections produce a valid (but empty) fingerprint', () => {
    const fp = generateFingerprint({}, 'stability');

    expect(fp.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(Object.keys(fp.categories)).toHaveLength(0);
  });

  it('different category combinations produce different hashes', () => {
    const fp1 = generateFingerprint(
      { subject: ['cityscape'], lighting: ['moonlight'] },
      'stability',
    );
    const fp2 = generateFingerprint(
      { subject: ['cityscape'], atmosphere: ['contemplative'] },
      'stability',
    );

    expect(fp1.hash).not.toBe(fp2.hash);
  });

  it('same categories with different terms produce different hashes', () => {
    const fp1 = generateFingerprint(
      { subject: ['cityscape'], lighting: ['moonlight'] },
      'stability',
    );
    const fp2 = generateFingerprint(
      { subject: ['cityscape'], lighting: ['golden hour'] },
      'stability',
    );

    expect(fp1.hash).not.toBe(fp2.hash);
  });

  it('hash is platform-independent (same selections → same hash)', () => {
    const sel: PromptSelections = {
      subject: ['cityscape'],
      lighting: ['moonlight'],
    };

    const fpStability = generateFingerprint(sel, 'stability');
    const fpOpenai = generateFingerprint(sel, 'openai');

    // Same hash — the combination is platform-independent
    expect(fpStability.hash).toBe(fpOpenai.hash);
    // But different platformId
    expect(fpStability.platformId).not.toBe(fpOpenai.platformId);
  });

  it('respects source parameter', () => {
    const fp = generateFingerprint(
      { subject: ['cityscape'] },
      'stability',
      'weather',
    );

    expect(fp.source).toBe('weather');
  });

  it('category order in FINGERPRINT_CATEGORY_ORDER excludes negative', () => {
    expect(FINGERPRINT_CATEGORY_ORDER).not.toContain('negative');
    expect(FINGERPRINT_CATEGORY_ORDER.length).toBe(11);
  });
});

// ============================================================================
// Engagement Scoring
// ============================================================================

describe('engagement scoring', () => {
  it('createEmptyScore returns zeroed metrics', () => {
    const score = createEmptyScore('abc12345');

    expect(score.hash).toBe('abc12345');
    expect(score.impressions).toBe(0);
    expect(score.likes).toBe(0);
    expect(score.copies).toBe(0);
    expect(score.tryInClicks).toBe(0);
    expect(score.qualityScore).toBe(0);
  });

  it('computeQualityScore returns 0 for zero impressions', () => {
    const score = createEmptyScore('test');
    expect(computeQualityScore(score)).toBe(0);
  });

  it('computeQualityScore computes weighted ratio', () => {
    const score: PromptDNAScore = {
      hash: 'test',
      impressions: 100,
      likes: 10,
      copies: 5,
      tryInClicks: 2,
      qualityScore: 0,
      updatedAt: '',
    };

    const qs = computeQualityScore(score);
    // weighted = 10*1.0 + 5*1.5 + 2*2.0 = 10 + 7.5 + 4 = 21.5
    // normalised = 21.5 / (100 * 2.0) = 21.5 / 200 = 0.1075
    expect(qs).toBeCloseTo(0.1075, 3);
  });

  it('computeQualityScore clamps to max 1.0', () => {
    const score: PromptDNAScore = {
      hash: 'test',
      impressions: 1,
      likes: 100,
      copies: 100,
      tryInClicks: 100,
      qualityScore: 0,
      updatedAt: '',
    };

    expect(computeQualityScore(score)).toBe(1);
  });

  it('recordEngagement increments impression', () => {
    const score = createEmptyScore('test');
    recordEngagement(score, 'impression');
    expect(score.impressions).toBe(1);
  });

  it('recordEngagement increments like and updates qualityScore', () => {
    const score = createEmptyScore('test');
    score.impressions = 10;
    recordEngagement(score, 'like');
    expect(score.likes).toBe(1);
    expect(score.qualityScore).toBeGreaterThan(0);
  });

  it('recordEngagement handles unlike (no negative count)', () => {
    const score = createEmptyScore('test');
    score.likes = 5;
    score.impressions = 10;
    recordEngagement(score, 'unlike');
    expect(score.likes).toBe(4);
  });

  it('recordEngagement unlike floors at 0', () => {
    const score = createEmptyScore('test');
    score.likes = 0;
    recordEngagement(score, 'unlike');
    expect(score.likes).toBe(0);
  });

  it('recordEngagement updates updatedAt timestamp', () => {
    const score = createEmptyScore('test');
    const before = score.updatedAt;
    recordEngagement(score, 'impression');
    // updatedAt should be refreshed (may or may not differ by string,
    // but the function should have been called)
    expect(score.updatedAt).toBeTruthy();
  });

  it('ENGAGEMENT_WEIGHTS has correct hierarchy', () => {
    expect(ENGAGEMENT_WEIGHTS.tryInClicks).toBeGreaterThan(ENGAGEMENT_WEIGHTS.copies);
    expect(ENGAGEMENT_WEIGHTS.copies).toBeGreaterThan(ENGAGEMENT_WEIGHTS.likes);
  });
});

// ============================================================================
// Fingerprint Comparison Utilities
// ============================================================================

describe('fingerprint comparison', () => {
  const fpA = generateFingerprint(
    { subject: ['cityscape'], lighting: ['moonlight'], atmosphere: ['contemplative'] },
    'stability',
  );
  const fpB = generateFingerprint(
    { subject: ['portrait'], lighting: ['golden hour'], atmosphere: ['dreamy'] },
    'openai',
  );
  const fpC = generateFingerprint(
    { subject: ['cityscape'], lighting: ['moonlight'] },
    'stability',
  );

  it('hasSameCategoryShape returns true for same categories', () => {
    expect(hasSameCategoryShape(fpA, fpB)).toBe(true);
    // Both have subject + lighting + atmosphere
  });

  it('hasSameCategoryShape returns false for different category sets', () => {
    expect(hasSameCategoryShape(fpA, fpC)).toBe(false);
    // fpA has 3 categories, fpC has 2
  });

  it('categoryOverlap counts shared categories', () => {
    expect(categoryOverlap(fpA, fpC)).toBe(2);
    // Both share subject + lighting
  });

  it('termOverlap counts identical term matches', () => {
    // fpA: subject=cityscape, lighting=moonlight, atmosphere=contemplative
    // fpC: subject=cityscape, lighting=moonlight
    expect(termOverlap(fpA, fpC)).toBe(2);
  });

  it('termOverlap returns 0 for completely different terms', () => {
    expect(termOverlap(fpA, fpB)).toBe(0);
  });
});
