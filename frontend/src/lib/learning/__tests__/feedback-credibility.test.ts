// src/lib/learning/__tests__/feedback-credibility.test.ts
// ============================================================================
// FEEDBACK CREDIBILITY — Unit Tests
// ============================================================================
//
// Phase 7.10a — Feedback Data Layer.
//
// Tests the pure credibility computation that weights feedback signals by
// user deliberateness. Four factors: tier, account age, usage frequency,
// response speed.
//
// Follows the pattern established by confidence-multiplier.test.ts.
//
// Existing features preserved: Yes.
// ============================================================================

import {
  computeFeedbackCredibility,
  computeFeedbackCredibilityDetailed,
  FEEDBACK_RATING_VALUES,
  FEEDBACK_RATINGS,
} from '@/types/feedback';

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

const C = LEARNING_CONSTANTS;

// ============================================================================
// computeFeedbackCredibility — Basic behaviour
// ============================================================================

describe('computeFeedbackCredibility', () => {
  // ── Defaults ─────────────────────────────────────────────────────────

  it('returns 1.0 for empty input (full backward compat)', () => {
    expect(computeFeedbackCredibility({})).toBe(1.0);
  });

  it('returns 0.6 for all-null input (null tier = anonymous)', () => {
    // null tier is explicitly anonymous (0.60); other null fields default
    // to neutral (1.0). Final: 0.60 × 1.0 × 1.0 × 1.0 = 0.60
    expect(
      computeFeedbackCredibility({
        userTier: null,
        accountAgeDays: null,
        weeklyUsageCount: null,
        responseTimeMs: null,
      }),
    ).toBe(0.6);
  });

  it('returns 1.0 for all-undefined input', () => {
    expect(
      computeFeedbackCredibility({
        userTier: undefined,
        accountAgeDays: undefined,
        weeklyUsageCount: undefined,
        responseTimeMs: undefined,
      }),
    ).toBe(1.0);
  });

  // ── Tier factor ──────────────────────────────────────────────────────

  it('paid user gets TIER_PAID multiplier (1.25)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'paid',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000, // 30 min — within QUICK window
    });
    // 1.25 × 1.0 × 1.0 × 1.0 = 1.25
    expect(result).toBe(1.25);
  });

  it('free user gets TIER_FREE multiplier (1.0)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.0);
  });

  it('anonymous (null tier) gets TIER_ANONYMOUS multiplier (0.60)', () => {
    const result = computeFeedbackCredibility({
      userTier: null,
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(0.6);
  });

  it('unknown tier string treated as anonymous', () => {
    const result = computeFeedbackCredibility({
      userTier: 'enterprise' as string,
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(0.6);
  });

  // ── Account age factor ───────────────────────────────────────────────

  it('brand new user (2 days) gets AGE_NEW (0.85)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 2,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    // 1.0 × 0.85 × 1.0 × 1.0 = 0.85
    expect(result).toBe(0.85);
  });

  it('settling user (15 days) gets AGE_SETTLING (1.0)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.0);
  });

  it('experienced user (60 days) gets AGE_EXPERIENCED (1.10)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 60,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.1);
  });

  it('veteran user (120 days) gets AGE_VETERAN (1.15)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 120,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.15);
  });

  it('exact threshold boundaries: 7 days = settling, 6 days = new', () => {
    const settling = computeFeedbackCredibility({ accountAgeDays: 7 });
    const newUser = computeFeedbackCredibility({ accountAgeDays: 6 });
    expect(settling).toBe(1.0); // settling default × other defaults
    expect(newUser).toBe(0.85); // new × other defaults
  });

  // ── Usage frequency factor ───────────────────────────────────────────

  it('daily power user (8 copies/week) gets FREQ_DAILY (1.15)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 8,
      responseTimeMs: 1_800_000,
    });
    // 1.0 × 1.0 × 1.15 × 1.0 = 1.15
    expect(result).toBe(1.15);
  });

  it('weekly user (3 copies) gets FREQ_WEEKLY (1.05)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 3,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.05);
  });

  it('casual user (1 copy) gets FREQ_CASUAL (1.0)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(1.0);
  });

  it('rare user (0 copies) gets FREQ_RARE (0.90)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 0,
      responseTimeMs: 1_800_000,
    });
    expect(result).toBe(0.9);
  });

  // ── Response speed factor ────────────────────────────────────────────

  it('instant response (30s) gets SPEED_INSTANT (1.10)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 30_000,
    });
    expect(result).toBe(1.1);
  });

  it('quick response (30 min) gets SPEED_QUICK (1.0)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 30 * 60 * 1_000,
    });
    expect(result).toBe(1.0);
  });

  it('delayed response (12 hours) gets SPEED_DELAYED (0.95)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 12 * 60 * 60 * 1_000,
    });
    expect(result).toBe(0.95);
  });

  it('late response (48 hours) gets SPEED_LATE (0.85)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 48 * 60 * 60 * 1_000,
    });
    expect(result).toBe(0.85);
  });

  // ── Build plan example scenarios ─────────────────────────────────────

  it('paid veteran daily user rating in 30s = clamped to 1.80', () => {
    const result = computeFeedbackCredibility({
      userTier: 'paid',
      accountAgeDays: 120,
      weeklyUsageCount: 8,
      responseTimeMs: 30_000,
    });
    // 1.25 × 1.15 × 1.15 × 1.10 = 1.8184... → clamped to 1.80
    expect(result).toBe(C.FEEDBACK_CREDIBILITY_MAX);
  });

  it('anonymous new rare user rating next day = clamped to 0.40', () => {
    const result = computeFeedbackCredibility({
      userTier: null,
      accountAgeDays: 2,
      weeklyUsageCount: 0,
      responseTimeMs: 90_000_000, // 25 hours
    });
    // 0.60 × 0.85 × 0.90 × 0.85 = 0.3901 → clamped to 0.40
    expect(result).toBe(C.FEEDBACK_CREDIBILITY_MIN);
  });

  // ── Clamping ─────────────────────────────────────────────────────────

  it('never exceeds CREDIBILITY_MAX (1.80)', () => {
    const result = computeFeedbackCredibility({
      userTier: 'paid',
      accountAgeDays: 365,
      weeklyUsageCount: 100,
      responseTimeMs: 1_000,
    });
    expect(result).toBeLessThanOrEqual(C.FEEDBACK_CREDIBILITY_MAX);
  });

  it('never falls below CREDIBILITY_MIN (0.40)', () => {
    const result = computeFeedbackCredibility({
      userTier: null,
      accountAgeDays: 0,
      weeklyUsageCount: 0,
      responseTimeMs: 999_999_999,
    });
    expect(result).toBeGreaterThanOrEqual(C.FEEDBACK_CREDIBILITY_MIN);
  });
});

// ============================================================================
// computeFeedbackCredibilityDetailed — Factor breakdown
// ============================================================================

describe('computeFeedbackCredibilityDetailed', () => {
  it('returns factor breakdown for paid veteran', () => {
    const result = computeFeedbackCredibilityDetailed({
      userTier: 'paid',
      accountAgeDays: 120,
      weeklyUsageCount: 8,
      responseTimeMs: 30_000,
    });

    expect(result.factors.tier).toBe(C.FEEDBACK_CREDIBILITY_TIER_PAID);
    expect(result.factors.age).toBe(C.FEEDBACK_CREDIBILITY_AGE_VETERAN);
    expect(result.factors.frequency).toBe(C.FEEDBACK_CREDIBILITY_FREQ_DAILY);
    expect(result.factors.speed).toBe(C.FEEDBACK_CREDIBILITY_SPEED_INSTANT);
    expect(result.credibility).toBe(C.FEEDBACK_CREDIBILITY_MAX);
    expect(result.rawProduct).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_MAX);
  });

  it('returns factor breakdown for anonymous new user', () => {
    const result = computeFeedbackCredibilityDetailed({
      userTier: null,
      accountAgeDays: 2,
      weeklyUsageCount: 0,
      responseTimeMs: 90_000_000,
    });

    expect(result.factors.tier).toBe(C.FEEDBACK_CREDIBILITY_TIER_ANONYMOUS);
    expect(result.factors.age).toBe(C.FEEDBACK_CREDIBILITY_AGE_NEW);
    expect(result.factors.frequency).toBe(C.FEEDBACK_CREDIBILITY_FREQ_RARE);
    expect(result.factors.speed).toBe(C.FEEDBACK_CREDIBILITY_SPEED_LATE);
    expect(result.credibility).toBe(C.FEEDBACK_CREDIBILITY_MIN);
    expect(result.rawProduct).toBeLessThan(C.FEEDBACK_CREDIBILITY_MIN);
  });

  it('credibility in detailed matches simple computation', () => {
    const input = {
      userTier: 'free' as const,
      accountAgeDays: 45,
      weeklyUsageCount: 3,
      responseTimeMs: 60_000,
    };
    const simple = computeFeedbackCredibility(input);
    const detailed = computeFeedbackCredibilityDetailed(input);
    expect(detailed.credibility).toBe(simple);
  });

  it('rawProduct is exact product of all 4 factors', () => {
    const result = computeFeedbackCredibilityDetailed({
      userTier: 'free',
      accountAgeDays: 15,
      weeklyUsageCount: 1,
      responseTimeMs: 1_800_000,
    });
    const expected =
      result.factors.tier *
      result.factors.age *
      result.factors.frequency *
      result.factors.speed;
    expect(result.rawProduct).toBeCloseTo(expected, 4);
  });
});

// ============================================================================
// FEEDBACK_RATING_VALUES — Static constants
// ============================================================================

describe('FEEDBACK_RATING_VALUES', () => {
  it('positive = 1.0', () => {
    expect(FEEDBACK_RATING_VALUES.positive).toBe(1.0);
  });

  it('neutral = 0.5', () => {
    expect(FEEDBACK_RATING_VALUES.neutral).toBe(0.5);
  });

  it('negative = 0.0', () => {
    expect(FEEDBACK_RATING_VALUES.negative).toBe(0.0);
  });
});

describe('FEEDBACK_RATINGS', () => {
  it('contains exactly three values', () => {
    expect(FEEDBACK_RATINGS).toHaveLength(3);
  });

  it('includes positive, neutral, negative', () => {
    expect(FEEDBACK_RATINGS).toContain('positive');
    expect(FEEDBACK_RATINGS).toContain('neutral');
    expect(FEEDBACK_RATINGS).toContain('negative');
  });
});

// ============================================================================
// Constants sanity checks
// ============================================================================

describe('FEEDBACK_CREDIBILITY constants', () => {
  it('MIN < MAX', () => {
    expect(C.FEEDBACK_CREDIBILITY_MIN).toBeLessThan(C.FEEDBACK_CREDIBILITY_MAX);
  });

  it('all tier multipliers are positive', () => {
    expect(C.FEEDBACK_CREDIBILITY_TIER_PAID).toBeGreaterThan(0);
    expect(C.FEEDBACK_CREDIBILITY_TIER_FREE).toBeGreaterThan(0);
    expect(C.FEEDBACK_CREDIBILITY_TIER_ANONYMOUS).toBeGreaterThan(0);
  });

  it('tier ordering: paid > free > anonymous', () => {
    expect(C.FEEDBACK_CREDIBILITY_TIER_PAID).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_TIER_FREE);
    expect(C.FEEDBACK_CREDIBILITY_TIER_FREE).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_TIER_ANONYMOUS);
  });

  it('age ordering: veteran > experienced > settling > new', () => {
    expect(C.FEEDBACK_CREDIBILITY_AGE_VETERAN).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_AGE_EXPERIENCED);
    expect(C.FEEDBACK_CREDIBILITY_AGE_EXPERIENCED).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_AGE_SETTLING);
    expect(C.FEEDBACK_CREDIBILITY_AGE_SETTLING).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_AGE_NEW);
  });

  it('frequency ordering: daily > weekly > casual > rare', () => {
    expect(C.FEEDBACK_CREDIBILITY_FREQ_DAILY).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_FREQ_WEEKLY);
    expect(C.FEEDBACK_CREDIBILITY_FREQ_WEEKLY).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_FREQ_CASUAL);
    expect(C.FEEDBACK_CREDIBILITY_FREQ_CASUAL).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_FREQ_RARE);
  });

  it('speed ordering: instant > quick > delayed > late', () => {
    expect(C.FEEDBACK_CREDIBILITY_SPEED_INSTANT).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_SPEED_QUICK);
    expect(C.FEEDBACK_CREDIBILITY_SPEED_QUICK).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_SPEED_DELAYED);
    expect(C.FEEDBACK_CREDIBILITY_SPEED_DELAYED).toBeGreaterThan(C.FEEDBACK_CREDIBILITY_SPEED_LATE);
  });

  it('speed thresholds are ascending', () => {
    expect(C.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_INSTANT)
      .toBeLessThan(C.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_QUICK);
    expect(C.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_QUICK)
      .toBeLessThan(C.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_DELAYED);
  });

  it('age thresholds are ascending', () => {
    expect(C.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_SETTLING)
      .toBeLessThan(C.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_EXPERIENCED);
    expect(C.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_EXPERIENCED)
      .toBeLessThan(C.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_VETERAN);
  });

  it('widget delay is 4 seconds', () => {
    expect(C.FEEDBACK_WIDGET_DELAY_MS).toBe(4_000);
  });

  it('rate limit is 5 per minute', () => {
    expect(C.FEEDBACK_RATE_LIMIT_PER_MINUTE).toBe(5);
  });
});
