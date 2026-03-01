// src/types/feedback.ts
// ============================================================================
// USER FEEDBACK INVITATION — Types + Credibility Score
// ============================================================================
//
// Phase 7.10a — Data Layer.
//
// Defines the feedback rating system, the credibility scoring engine, and
// the data structures for the feedback_events table.
//
// The credibility score weights feedback signals by four factors:
// 1. User tier — paid users are financially invested → more deliberate
// 2. Account age — long-tenured users have developed taste
// 3. Usage frequency — power users test more prompts → better calibration
// 4. Response speed — faster rating = fresher signal (just tested it)
//
// Combined formula:
//   credibility = tierMult × ageMult × frequencyMult × speedMult
//   clamped to [CREDIBILITY_MIN, CREDIBILITY_MAX]
//
// Pure functions — no side effects, no database calls, no I/O.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10
//
// Version: 1.1.0 — Phase 7.10a+b: Fix undefined vs null tier handling
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ============================================================================
// RATING TYPES
// ============================================================================

/**
 * Three-point feedback rating scale.
 *
 * Design constraint: 👌 means "mediocre, not impressive" — NOT approval.
 * The UI must include explanatory text:
 *   👍 "Nailed it"  |  👌 "Just okay"  |  👎 "Missed"
 */
export type FeedbackRating = 'positive' | 'neutral' | 'negative';

/**
 * Numeric value mapping for each rating.
 * Used when computing weighted satisfaction scores in the cron.
 *
 * positive = 1.0 — AI output matched or exceeded expectations
 * neutral  = 0.5 — Usable but not impressive
 * negative = 0.0 — AI output didn't match the vision at all
 */
export const FEEDBACK_RATING_VALUES: Record<FeedbackRating, number> = {
  positive: 1.0,
  neutral: 0.5,
  negative: 0.0,
} as const;

/**
 * All valid rating strings. Used for Zod validation in the API route.
 */
export const FEEDBACK_RATINGS: readonly FeedbackRating[] = [
  'positive',
  'neutral',
  'negative',
] as const;

// ============================================================================
// CREDIBILITY INPUT / OUTPUT TYPES
// ============================================================================

/**
 * Input for credibility score computation.
 *
 * All fields are optional — missing data defaults to neutral (1.0×).
 * Ensures full backward compatibility if context is unavailable.
 */
export interface FeedbackCredibilityInput {
  /** User subscription tier: 'paid' | 'free' | null (anonymous) */
  userTier?: string | null;
  /** Days since account creation. null/0 = unknown or anonymous */
  accountAgeDays?: number | null;
  /** Number of prompt copies this week (rolling 7 days). null = unknown */
  weeklyUsageCount?: number | null;
  /** Milliseconds between copy action and feedback submission */
  responseTimeMs?: number | null;
}

/**
 * Detailed breakdown of credibility computation.
 * Useful for admin dashboard, debugging, and stored alongside feedback events.
 */
export interface FeedbackCredibilityBreakdown {
  /** Final clamped credibility score */
  credibility: number;
  /** Individual factor contributions (before clamping) */
  factors: {
    tier: number;
    age: number;
    frequency: number;
    speed: number;
  };
  /** Raw unclamped product */
  rawProduct: number;
}

// ============================================================================
// FEEDBACK EVENT (DB ROW SHAPE)
// ============================================================================

/**
 * A single feedback event stored in the feedback_events table.
 */
export interface FeedbackEvent {
  /** Unique event ID: `fb_${uuid}` */
  id: string;
  /** Links back to the prompt_events row this feedback is about */
  prompt_event_id: string;
  /** User's rating */
  rating: FeedbackRating;
  /** Computed credibility score (0.40–1.80) */
  credibility_score: number;
  /** Per-factor breakdown stored as JSONB for admin drill-down */
  credibility_factors: FeedbackCredibilityBreakdown['factors'];
  /** Milliseconds between copy and feedback submission */
  response_time_ms: number;
  /** User tier at time of feedback ('free' | 'paid' | null for anon) */
  user_tier: string | null;
  /** Account age in days at time of feedback */
  account_age_days: number | null;
  /** Platform the prompt was built for */
  platform: string;
  /** Platform tier (1–4) */
  tier: number;
  /** Timestamp */
  created_at: Date | string;
}

// ============================================================================
// CREDIBILITY COMPUTATION (PURE FUNCTIONS)
// ============================================================================

/**
 * Compute the feedback credibility score.
 *
 * Returns a value in [CREDIBILITY_MIN, CREDIBILITY_MAX] that represents
 * how much to trust this user's feedback. Higher = more trusted.
 *
 * All inputs are optional — missing data defaults to neutral (1.0×).
 *
 * @param input — User context (all fields optional)
 * @returns Credibility score, clamped to [0.40, 1.80]
 *
 * @example
 * computeFeedbackCredibility({})
 * // → 1.0 (no data = neutral)
 *
 * computeFeedbackCredibility({ userTier: 'paid', accountAgeDays: 120, weeklyUsageCount: 8, responseTimeMs: 30_000 })
 * // → 1.25 × 1.15 × 1.15 × 1.10 = 1.818 → clamped to 1.80
 *
 * computeFeedbackCredibility({ userTier: null, accountAgeDays: 2, weeklyUsageCount: 0, responseTimeMs: 90_000_000 })
 * // → 0.60 × 0.85 × 0.90 × 0.85 = 0.3904 → clamped to 0.40
 */
export function computeFeedbackCredibility(input: FeedbackCredibilityInput): number {
  const c = LEARNING_CONSTANTS;

  // ── Tier factor ──
  // undefined = no data available (backward compat → neutral 1.0×)
  // null = explicitly anonymous (no account → penalized 0.60×)
  // unknown string = not 'paid' or 'free' → treat as anonymous
  let tierMult: number;
  if (input.userTier === 'paid') {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_PAID;
  } else if (input.userTier === 'free') {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_FREE;
  } else if (input.userTier === undefined) {
    // No data provided — default to neutral (backward compat)
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_FREE;
  } else {
    // null or unknown string = anonymous / unrecognised tier
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_ANONYMOUS;
  }

  // ── Age factor ──
  let ageMult: number = c.FEEDBACK_CREDIBILITY_AGE_SETTLING; // default for unknown
  if (input.accountAgeDays != null && input.accountAgeDays >= 0) {
    if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_VETERAN) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_VETERAN;
    } else if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_EXPERIENCED) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_EXPERIENCED;
    } else if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_SETTLING) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_SETTLING;
    } else {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_NEW;
    }
  }

  // ── Frequency factor ──
  let frequencyMult: number = c.FEEDBACK_CREDIBILITY_FREQ_CASUAL; // default for unknown
  if (input.weeklyUsageCount != null && input.weeklyUsageCount >= 0) {
    if (input.weeklyUsageCount >= c.FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_DAILY) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_DAILY;
    } else if (input.weeklyUsageCount >= c.FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_WEEKLY) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_WEEKLY;
    } else if (input.weeklyUsageCount >= 1) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_CASUAL;
    } else {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_RARE;
    }
  }

  // ── Response speed factor ──
  let speedMult: number = c.FEEDBACK_CREDIBILITY_SPEED_QUICK; // default for unknown
  if (input.responseTimeMs != null && input.responseTimeMs >= 0) {
    if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_INSTANT) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_INSTANT;
    } else if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_QUICK) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_QUICK;
    } else if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_DELAYED) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_DELAYED;
    } else {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_LATE;
    }
  }

  // ── Combine + clamp ──
  const raw = round4(tierMult * ageMult * frequencyMult * speedMult);
  return Math.max(
    c.FEEDBACK_CREDIBILITY_MIN,
    Math.min(c.FEEDBACK_CREDIBILITY_MAX, raw),
  );
}

/**
 * Compute feedback credibility with detailed per-factor breakdown.
 *
 * Same logic as `computeFeedbackCredibility()` but returns factor-level
 * detail for the admin dashboard and feedback_events JSONB storage.
 */
export function computeFeedbackCredibilityDetailed(
  input: FeedbackCredibilityInput,
): FeedbackCredibilityBreakdown {
  const c = LEARNING_CONSTANTS;

  // ── Tier ──
  // undefined = no data available (backward compat → neutral 1.0×)
  // null = explicitly anonymous (no account → penalized 0.60×)
  // unknown string = not 'paid' or 'free' → treat as anonymous
  let tierMult: number;
  if (input.userTier === 'paid') {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_PAID;
  } else if (input.userTier === 'free') {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_FREE;
  } else if (input.userTier === undefined) {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_FREE;
  } else {
    tierMult = c.FEEDBACK_CREDIBILITY_TIER_ANONYMOUS;
  }

  // ── Age ──
  let ageMult: number = c.FEEDBACK_CREDIBILITY_AGE_SETTLING;
  if (input.accountAgeDays != null && input.accountAgeDays >= 0) {
    if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_VETERAN) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_VETERAN;
    } else if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_EXPERIENCED) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_EXPERIENCED;
    } else if (input.accountAgeDays >= c.FEEDBACK_CREDIBILITY_AGE_THRESHOLD_SETTLING) {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_SETTLING;
    } else {
      ageMult = c.FEEDBACK_CREDIBILITY_AGE_NEW;
    }
  }

  // ── Frequency ──
  let frequencyMult: number = c.FEEDBACK_CREDIBILITY_FREQ_CASUAL;
  if (input.weeklyUsageCount != null && input.weeklyUsageCount >= 0) {
    if (input.weeklyUsageCount >= c.FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_DAILY) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_DAILY;
    } else if (input.weeklyUsageCount >= c.FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_WEEKLY) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_WEEKLY;
    } else if (input.weeklyUsageCount >= 1) {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_CASUAL;
    } else {
      frequencyMult = c.FEEDBACK_CREDIBILITY_FREQ_RARE;
    }
  }

  // ── Speed ──
  let speedMult: number = c.FEEDBACK_CREDIBILITY_SPEED_QUICK;
  if (input.responseTimeMs != null && input.responseTimeMs >= 0) {
    if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_INSTANT) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_INSTANT;
    } else if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_QUICK) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_QUICK;
    } else if (input.responseTimeMs < c.FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_DELAYED) {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_DELAYED;
    } else {
      speedMult = c.FEEDBACK_CREDIBILITY_SPEED_LATE;
    }
  }

  const rawProduct = round4(tierMult * ageMult * frequencyMult * speedMult);
  const credibility = Math.max(
    c.FEEDBACK_CREDIBILITY_MIN,
    Math.min(c.FEEDBACK_CREDIBILITY_MAX, rawProduct),
  );

  return {
    credibility,
    factors: {
      tier: tierMult,
      age: ageMult,
      frequency: frequencyMult,
      speed: speedMult,
    },
    rawProduct,
  };
}

// ============================================================================
// MATH UTILITY (shared)
// ============================================================================

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
