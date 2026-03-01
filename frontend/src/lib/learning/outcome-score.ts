// src/lib/learning/outcome-score.ts
// ============================================================================
// SELF-IMPROVING SCORER — Outcome Score Computation
// ============================================================================
//
// Phase 6, Part 6.1 — Data Layer.
//
// Converts raw outcome signals (copied, saved, returnedWithin60s, reused,
// feedback) into a single numeric "outcome score" (0–1). This is the Y-axis for all
// Phase 6 correlation analysis: weight recalibration, category value
// discovery, term quality scoring, and threshold discovery.
//
// Phase 7.1 extension: User Confidence Multiplier.
// Weights outcome signals by user deliberateness — paid users, long-tenured
// users, and users with deep session engagement produce higher-confidence
// signals. This is NOT bias; it's trust calibration.
//
// Phase 7.2 extension: Final-Attempt Factor.
// The last attempt in a multi-attempt session is the highest-confidence
// signal — the user stopped iterating, meaning they were satisfied.
// Mid-session attempts are downweighted (user kept changing things).
//
// Phase 7.10e extension: Direct User Feedback (5th signal family).
// Adds credibility-weighted feedback contribution from the 👍👌👎
// rating widget. feedbackContribution = signalWeight × credibilityScore.
// Missing feedback defaults to no-op (fully backward compatible).
//
// Pure function — no side effects, no database calls, no I/O.
// Called by every Phase 6 cron computation layer.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.2
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.1
// Build plan: docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
// Build plan: docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
//
// Version: 4.0.0 — Feedback as 5th outcome signal (Phase 7.10e)
// Created: 25 February 2026
//
// TODO (deferred): If scorer health report shows confidence multiplier
// improves correlation, have Phase 5/6 layers adopt it too — one-line
// change per module. Only when the data proves it helps.
//
// Existing features preserved: Yes.
// ============================================================================

// ============================================================================
// SIGNAL WEIGHTS
// ============================================================================
//
// From evolution plan § 10.2 — Seven Outcome Signals.
// We have 4 boolean signals. Some are composite (e.g. "copied + no return"
// combines two booleans). Weights reflect signal strength and confidence.
//
// The scoring is CUMULATIVE: a prompt that was copied AND saved earns both
// individual signal weights. This rewards prompts that generate multiple
// positive signals rather than treating them as mutually exclusive.
//
// returnedWithin60s is a NEGATIVE signal — it implies the user was
// dissatisfied and came back to modify the prompt.

/**
 * Individual signal weight constants.
 *
 * Exposed for testing and for the scorer health report to reference.
 * If you change these, the nightly cron will recalibrate all downstream
 * weights on the next run — no code changes needed elsewhere.
 */
export const OUTCOME_SIGNAL_WEIGHTS = {
  /**
   * Signal 1: User clicked copy.
   * Weakest positive signal — everyone copies, even bad prompts.
   */
  copied: 0.1,

  /**
   * Signal 2: Copied AND did NOT return within 60s.
   * Moderate signal — they used it and didn't come back to fix it.
   * This is a BONUS on top of the base `copied` weight.
   */
  copiedNoReturn: 0.15,

  /**
   * Signal 3: User saved to their library (Pro Promagen feature).
   * Strong signal — they valued it enough to keep it.
   */
  saved: 0.35,

  /**
   * Signal 4: User loaded a previously saved prompt and reused it.
   * Highest signal — they came back for it.
   */
  reusedFromLibrary: 0.5,

  /**
   * Negative signal: User returned within 60s to modify.
   * Implies dissatisfaction — penalises the outcome score.
   */
  returnedPenalty: -0.2,

  // ── Phase 7.10e: Direct User Feedback ──────────────────────────────
  //
  // The 5th outcome signal family: user explicitly rated the prompt.
  // Credibility-weighted: feedbackContribution = signalWeight × credibilityScore
  //
  // A 👍 from a paid veteran (cred 1.80):  +0.40 × 1.80 = +0.72
  // A 👍 from an anon new user (cred 0.40): +0.40 × 0.40 = +0.16
  // A 👎 from a paid veteran (cred 1.80):  -0.30 × 1.80 = -0.54

  /**
   * Signal 5a: User rated 👍 "Nailed it".
   * Strongest positive signal after reuse — explicit human approval.
   * Multiplied by credibility score before adding to outcome.
   */
  feedbackPositive: 0.40,

  /**
   * Signal 5b: User rated 👌 "Just okay".
   * Neutral — no contribution to outcome score.
   * Retained as a constant for admin dashboard reference.
   */
  feedbackNeutral: 0.0,

  /**
   * Signal 5c: User rated 👎 "Missed".
   * Strong negative signal — explicit human disapproval.
   * Multiplied by credibility score before adding to outcome.
   */
  feedbackNegative: -0.30,
} as const;

/**
 * Maximum composite outcome score. Scores are capped at this value.
 * Set to 1.0 so outcome scores live in a clean 0–1 range.
 */
export const OUTCOME_SCORE_MAX = 1.0;

/**
 * Minimum composite outcome score. Scores are floored at this value.
 * Set to 0.0 — a prompt with no positive signals and a return penalty
 * still gets zero, not a negative number.
 */
export const OUTCOME_SCORE_MIN = 0.0;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Outcome signal inputs.
 *
 * Accepts both the typed `PromptOutcome` interface from prompt-telemetry.ts
 * and the raw `Record<string, boolean>` from PromptEventRow.outcome.
 * Boolean fields default to `false` if missing (defensive coding for DB rows
 * where JSONB might have been inserted with a subset of fields).
 */
export interface OutcomeSignals {
  copied?: boolean;
  saved?: boolean;
  returnedWithin60s?: boolean;
  reusedFromLibrary?: boolean;
  /** Phase 7.10e: Direct user feedback rating (optional — most prompts won't have one) */
  feedbackRating?: 'positive' | 'neutral' | 'negative';
  /** Phase 7.10e: Credibility score of the feedback (0.40–1.80). Defaults to 1.0 if missing. */
  feedbackCredibility?: number;
}

/**
 * Detailed breakdown of how the outcome score was computed.
 * Useful for debugging, the scorer health report, and admin dashboard.
 */
export interface OutcomeScoreBreakdown {
  /** Final composite score (0–1) */
  score: number;

  /** Individual signal contributions */
  signals: {
    copied: number;
    copiedNoReturn: number;
    saved: number;
    reusedFromLibrary: number;
    returnedPenalty: number;
    /** Phase 7.10e: Credibility-weighted feedback contribution */
    feedback: number;
  };

  /** Raw signal values (what was true/false) */
  raw: {
    copied: boolean;
    saved: boolean;
    returnedWithin60s: boolean;
    reusedFromLibrary: boolean;
    /** Phase 7.10e: The rating that was provided, or null if none */
    feedbackRating: 'positive' | 'neutral' | 'negative' | null;
    /** Phase 7.10e: Credibility used in computation (1.0 if missing) */
    feedbackCredibility: number;
  };
}

// ============================================================================
// COMPUTATION
// ============================================================================

/**
 * Compute a composite outcome score from raw outcome signals.
 *
 * The score represents "how useful was this prompt to the user?" on a 0–1
 * scale. Used as the Y-axis for all Phase 6 correlation analysis.
 *
 * Scoring is cumulative: multiple positive signals stack. A prompt that was
 * copied, not returned to, AND saved earns all three weights.
 *
 * @param outcome — Raw outcome signals (booleans, defaults to false if missing)
 * @returns Composite score clamped to [0, 1]
 *
 * @example
 * computeOutcomeScore({})
 * // → 0.0 (no signals)
 *
 * computeOutcomeScore({ copied: true })
 * // → 0.10 (weakest signal)
 *
 * computeOutcomeScore({ copied: true, returnedWithin60s: false })
 * // → 0.25 (copied + no-return bonus)
 *
 * computeOutcomeScore({ copied: true, saved: true, returnedWithin60s: false })
 * // → 0.60 (copied + no-return + saved)
 *
 * computeOutcomeScore({ copied: true, saved: true, reusedFromLibrary: true })
 * // → 0.95 → capped at 1.0? No: 0.10 + 0.15 + 0.35 + 0.50 = 1.10 → 1.0
 *
 * computeOutcomeScore({ copied: true, feedbackRating: 'positive', feedbackCredibility: 1.25 })
 * // → 0.25 + (0.40 × 1.25) = 0.25 + 0.50 = 0.75
 *
 * computeOutcomeScore({ copied: true, feedbackRating: 'negative', feedbackCredibility: 1.80 })
 * // → 0.25 + (-0.30 × 1.80) = 0.25 - 0.54 = 0 (floored)
 */
export function computeOutcomeScore(outcome: OutcomeSignals): number {
  const w = OUTCOME_SIGNAL_WEIGHTS;

  // Defensive: treat missing fields as false
  const copied = outcome.copied === true;
  const saved = outcome.saved === true;
  const returnedWithin60s = outcome.returnedWithin60s === true;
  const reusedFromLibrary = outcome.reusedFromLibrary === true;

  let score = 0;

  // Signal 1: Copied (base)
  if (copied) {
    score += w.copied;
  }

  // Signal 2: Copied + did NOT return within 60s (bonus on top of copied)
  if (copied && !returnedWithin60s) {
    score += w.copiedNoReturn;
  }

  // Signal 3: Saved to library
  if (saved) {
    score += w.saved;
  }

  // Signal 4: Reused from library
  if (reusedFromLibrary) {
    score += w.reusedFromLibrary;
  }

  // Negative signal: Returned within 60s (penalty)
  if (returnedWithin60s) {
    score += w.returnedPenalty;
  }

  // Signal 5: Direct user feedback (Phase 7.10e)
  // Credibility-weighted: contribution = signalWeight × credibilityScore
  // Missing feedback = no-op (backward compatible).
  // Missing credibility defaults to 1.0 (neutral).
  if (outcome.feedbackRating) {
    const cred = outcome.feedbackCredibility ?? 1.0;
    if (outcome.feedbackRating === 'positive') {
      score += w.feedbackPositive * cred;
    } else if (outcome.feedbackRating === 'negative') {
      score += w.feedbackNegative * cred;
    }
    // 'neutral' adds 0.0 × cred = 0 — no-op by design
  }

  // Clamp to [0, 1]
  return Math.max(OUTCOME_SCORE_MIN, Math.min(OUTCOME_SCORE_MAX, score));
}

/**
 * Compute outcome score with a full breakdown of signal contributions.
 *
 * Same logic as `computeOutcomeScore()` but returns the detailed breakdown
 * for debugging, the scorer health report, and the admin dashboard.
 *
 * @param outcome — Raw outcome signals
 * @returns Score + per-signal breakdown
 */
export function computeOutcomeScoreDetailed(outcome: OutcomeSignals): OutcomeScoreBreakdown {
  const w = OUTCOME_SIGNAL_WEIGHTS;

  const copied = outcome.copied === true;
  const saved = outcome.saved === true;
  const returnedWithin60s = outcome.returnedWithin60s === true;
  const reusedFromLibrary = outcome.reusedFromLibrary === true;

  // Phase 7.10e: Feedback contribution (credibility-weighted)
  const feedbackRating = outcome.feedbackRating ?? null;
  const feedbackCredibility = outcome.feedbackCredibility ?? 1.0;
  let feedbackContribution = 0;
  if (feedbackRating === 'positive') {
    feedbackContribution = round4(w.feedbackPositive * feedbackCredibility);
  } else if (feedbackRating === 'negative') {
    feedbackContribution = round4(w.feedbackNegative * feedbackCredibility);
  }

  const signals = {
    copied: copied ? w.copied : 0,
    copiedNoReturn: copied && !returnedWithin60s ? w.copiedNoReturn : 0,
    saved: saved ? w.saved : 0,
    reusedFromLibrary: reusedFromLibrary ? w.reusedFromLibrary : 0,
    returnedPenalty: returnedWithin60s ? w.returnedPenalty : 0,
    feedback: feedbackContribution,
  };

  const rawSum =
    signals.copied +
    signals.copiedNoReturn +
    signals.saved +
    signals.reusedFromLibrary +
    signals.returnedPenalty +
    signals.feedback;

  const score = Math.max(OUTCOME_SCORE_MIN, Math.min(OUTCOME_SCORE_MAX, rawSum));

  return {
    score,
    signals,
    raw: {
      copied,
      saved,
      returnedWithin60s,
      reusedFromLibrary,
      feedbackRating,
      feedbackCredibility,
    },
  };
}

// ============================================================================
// USER CONFIDENCE MULTIPLIER (Phase 7.1a)
// ============================================================================
//
// Not every user's signal is equally trustworthy. A 6-month paid subscriber
// who fills 7 categories and saves to library is making a deliberate choice.
// A day-one free user who clicks copy on 2 categories is exploring.
//
// Same action, different confidence level. The multiplier adjusts the
// outcome score to reflect this — it's trust calibration, not bias.
//
// Three factors:
// 1. User tier: paid users are financially invested → more deliberate
// 2. Account age: long-term users have developed taste
// 3. Session depth: filters random clicking (uses categoryCount)
//
// Phase 7.2 adds a fourth factor:
// 4. Final attempt: last attempt in a multi-attempt session → user was satisfied
//
// Combined formula:
//   confidence = tierMult × ageMult × depthMult × finalAttemptMult
//   clamped to [CONFIDENCE_MIN, CONFIDENCE_MAX]
//
// Deliberately tight range (0.50–1.50) so no single user dominates
// the learning data, and no user's signal is crushed.

/**
 * Confidence multiplier constants.
 *
 * Exposed for testing and admin dashboard reference.
 * Adjust these to tune how much user context affects signal weight.
 */
export const CONFIDENCE_MULTIPLIERS = {
  // ── Tier Multipliers ─────────────────────────────────────────────────
  /** Free tier: baseline trust */
  TIER_FREE: 1.0,
  /** Paid tier: financially invested → more deliberate actions */
  TIER_PAID: 1.15,

  // ── Account Age Multipliers ──────────────────────────────────────────
  /** 0–7 days: brand new, likely exploring */
  AGE_NEW: 0.85,
  /** 7–30 days: settling in */
  AGE_SETTLING: 1.0,
  /** 30–90 days: experienced */
  AGE_EXPERIENCED: 1.05,
  /** 90+ days: veteran — knows what works */
  AGE_VETERAN: 1.1,

  // ── Account Age Thresholds (days) ────────────────────────────────────
  AGE_THRESHOLD_SETTLING: 7,
  AGE_THRESHOLD_EXPERIENCED: 30,
  AGE_THRESHOLD_VETERAN: 90,

  // ── Session Depth Multipliers ────────────────────────────────────────
  /** 1–2 categories: shallow engagement, might be random clicking */
  DEPTH_SHALLOW: 0.8,
  /** 3–4 categories: normal engagement */
  DEPTH_NORMAL: 1.0,
  /** 5+ categories: deep engagement — deliberate prompt building */
  DEPTH_DEEP: 1.1,

  // ── Session Depth Thresholds ─────────────────────────────────────────
  DEPTH_THRESHOLD_NORMAL: 3,
  DEPTH_THRESHOLD_DEEP: 5,

  // ── Final-Attempt Multipliers (Phase 7.2) ──────────────────────────
  /** Final attempt in a multi-attempt session: user stopped iterating → satisfied */
  FINAL_ATTEMPT_BOOST: 1.3,
  /** Mid-session attempt: user kept changing → less confident signal */
  MID_ATTEMPT_DISCOUNT: 0.85,
  /** Single-attempt session or unknown: no change */
  SINGLE_ATTEMPT_NEUTRAL: 1.0,

  // ── Clamp Range ──────────────────────────────────────────────────────
  /** Minimum confidence multiplier (prevent crushing any user's signal) */
  CONFIDENCE_MIN: 0.5,
  /** Maximum confidence multiplier (prevent any user from dominating) */
  CONFIDENCE_MAX: 1.5,
} as const;

/**
 * Input for confidence multiplier computation.
 *
 * All fields are optional and nullable — old events without this data
 * get a multiplier of 1.0 (no change). Fully backward compatible.
 */
export interface ConfidenceInput {
  /** User's subscription tier ('free' or 'paid'), null = unknown → treated as free */
  userTier?: string | null;
  /** Days since account creation, null = unknown → treated as settling (1.0×) */
  accountAgeDays?: number | null;
  /** Number of non-empty categories in the prompt */
  categoryCount?: number | null;
  /** Whether this event is the last attempt in a multi-attempt session (Phase 7.2) */
  isFinalAttempt?: boolean | null;
  /** Whether this event is part of a session with 2+ attempts (Phase 7.2) */
  isMultiAttemptSession?: boolean | null;
}

/**
 * Detailed breakdown of confidence multiplier computation.
 * Useful for debugging and admin dashboard.
 */
export interface ConfidenceBreakdown {
  /** Final clamped multiplier */
  multiplier: number;
  /** Individual factor contributions (before clamping) */
  factors: {
    tier: number;
    age: number;
    depth: number;
    /** Final-attempt factor (Phase 7.2): 1.30 final, 0.85 mid, 1.0 single/unknown */
    finalAttempt: number;
  };
  /** Raw unclamped product */
  rawProduct: number;
}

/**
 * Compute the user confidence multiplier.
 *
 * Returns a value in [CONFIDENCE_MIN, CONFIDENCE_MAX] that represents
 * how much to trust this user's outcome signal. Higher = more trusted.
 *
 * All inputs are optional — missing data defaults to neutral (1.0×).
 * This ensures full backward compatibility with events that don't
 * have user tier or account age data.
 *
 * @param input — User context (all fields optional)
 * @returns Confidence multiplier, clamped to [0.50, 1.50]
 *
 * @example
 * computeConfidenceMultiplier({})
 * // → 1.0 (no data = neutral)
 *
 * computeConfidenceMultiplier({ userTier: 'paid', accountAgeDays: 120, categoryCount: 7 })
 * // → 1.15 × 1.10 × 1.10 × 1.0 = 1.3915 → clamped to 1.39
 *
 * computeConfidenceMultiplier({ userTier: 'free', accountAgeDays: 2, categoryCount: 1 })
 * // → 1.0 × 0.85 × 0.80 × 1.0 = 0.68
 *
 * computeConfidenceMultiplier({ isFinalAttempt: true, isMultiAttemptSession: true })
 * // → 1.0 × 1.0 × 1.0 × 1.30 = 1.30
 */
export function computeConfidenceMultiplier(input: ConfidenceInput): number {
  const c = CONFIDENCE_MULTIPLIERS;

  // ── Tier factor ──
  const tierMult = input.userTier === 'paid' ? c.TIER_PAID : c.TIER_FREE;

  // ── Age factor ──
  let ageMult: number = c.AGE_SETTLING; // default for unknown
  if (input.accountAgeDays != null && input.accountAgeDays >= 0) {
    if (input.accountAgeDays >= c.AGE_THRESHOLD_VETERAN) {
      ageMult = c.AGE_VETERAN;
    } else if (input.accountAgeDays >= c.AGE_THRESHOLD_EXPERIENCED) {
      ageMult = c.AGE_EXPERIENCED;
    } else if (input.accountAgeDays >= c.AGE_THRESHOLD_SETTLING) {
      ageMult = c.AGE_SETTLING;
    } else {
      ageMult = c.AGE_NEW;
    }
  }

  // ── Depth factor ──
  let depthMult: number = c.DEPTH_NORMAL; // default for unknown
  if (input.categoryCount != null && input.categoryCount >= 0) {
    if (input.categoryCount >= c.DEPTH_THRESHOLD_DEEP) {
      depthMult = c.DEPTH_DEEP;
    } else if (input.categoryCount >= c.DEPTH_THRESHOLD_NORMAL) {
      depthMult = c.DEPTH_NORMAL;
    } else {
      depthMult = c.DEPTH_SHALLOW;
    }
  }

  // ── Final-attempt factor (Phase 7.2) ──
  // Only applies to events in multi-attempt sessions.
  // Single-attempt sessions and unknown → neutral (1.0).
  let finalAttemptMult: number = c.SINGLE_ATTEMPT_NEUTRAL;
  if (input.isMultiAttemptSession === true) {
    finalAttemptMult = input.isFinalAttempt === true
      ? c.FINAL_ATTEMPT_BOOST     // 1.30 — user stopped iterating
      : c.MID_ATTEMPT_DISCOUNT;   // 0.85 — user kept changing
  }

  // ── Combine + clamp ──
  const raw = tierMult * ageMult * depthMult * finalAttemptMult;
  return Math.max(c.CONFIDENCE_MIN, Math.min(c.CONFIDENCE_MAX, round4(raw)));
}

/**
 * Compute confidence multiplier with detailed breakdown.
 *
 * Same logic as `computeConfidenceMultiplier()` but returns factor-level
 * detail for debugging and the admin dashboard.
 */
export function computeConfidenceMultiplierDetailed(input: ConfidenceInput): ConfidenceBreakdown {
  const c = CONFIDENCE_MULTIPLIERS;

  const tierMult = input.userTier === 'paid' ? c.TIER_PAID : c.TIER_FREE;

  let ageMult: number = c.AGE_SETTLING;
  if (input.accountAgeDays != null && input.accountAgeDays >= 0) {
    if (input.accountAgeDays >= c.AGE_THRESHOLD_VETERAN) {
      ageMult = c.AGE_VETERAN;
    } else if (input.accountAgeDays >= c.AGE_THRESHOLD_EXPERIENCED) {
      ageMult = c.AGE_EXPERIENCED;
    } else if (input.accountAgeDays >= c.AGE_THRESHOLD_SETTLING) {
      ageMult = c.AGE_SETTLING;
    } else {
      ageMult = c.AGE_NEW;
    }
  }

  let depthMult: number = c.DEPTH_NORMAL;
  if (input.categoryCount != null && input.categoryCount >= 0) {
    if (input.categoryCount >= c.DEPTH_THRESHOLD_DEEP) {
      depthMult = c.DEPTH_DEEP;
    } else if (input.categoryCount >= c.DEPTH_THRESHOLD_NORMAL) {
      depthMult = c.DEPTH_NORMAL;
    } else {
      depthMult = c.DEPTH_SHALLOW;
    }
  }

  // ── Final-attempt factor (Phase 7.2) ──
  let finalAttemptMult: number = c.SINGLE_ATTEMPT_NEUTRAL;
  if (input.isMultiAttemptSession === true) {
    finalAttemptMult = input.isFinalAttempt === true
      ? c.FINAL_ATTEMPT_BOOST
      : c.MID_ATTEMPT_DISCOUNT;
  }

  const rawProduct = round4(tierMult * ageMult * depthMult * finalAttemptMult);
  const multiplier = Math.max(c.CONFIDENCE_MIN, Math.min(c.CONFIDENCE_MAX, rawProduct));

  return {
    multiplier,
    factors: {
      tier: tierMult,
      age: ageMult,
      depth: depthMult,
      finalAttempt: finalAttemptMult,
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
