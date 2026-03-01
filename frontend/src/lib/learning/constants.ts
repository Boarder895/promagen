// src/lib/learning/constants.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Tuning Constants (SSOT)
// ============================================================================
//
// All magic numbers for the learning pipeline live here.
// Code reads these; code never changes. Adjust values to tune behaviour.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9, § 11, § 7.3, § 7.6, § 7.8, § 7.9, § 7.10
//
// Version: 9.3.0 — Phase 7.10a Feedback credibility constants
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

/**
 * Every tunable constant for the Collective Intelligence Engine.
 *
 * Grouped by subsystem so it's easy to find what you need.
 */
export const LEARNING_CONSTANTS = {
  // ── Quality Gates ──────────────────────────────────────────────────────

  /** Minimum optimizer score for an event to enter the learning pipeline */
  SCORE_THRESHOLD: 90,

  /** Minimum non-empty categories for an event to qualify */
  MIN_CATEGORIES: 4,

  // ── Time Decay ─────────────────────────────────────────────────────────

  /** Half-life for exponential time decay (days) */
  DECAY_HALF_LIFE_DAYS: 90,

  // ── Diversity ──────────────────────────────────────────────────────────

  /** Max share of total events for any single pair before capping */
  DIVERSITY_CAP_THRESHOLD: 0.3,

  // ── Co-occurrence Matrix ───────────────────────────────────────────────

  /** Maximum co-occurrence pairs stored per tier (keeps file under 100KB) */
  MAX_PAIRS_PER_TIER: 2_000,

  // ── Scene Candidates ───────────────────────────────────────────────────

  /** Minimum events in a cluster to propose a scene candidate */
  SCENE_CANDIDATE_THRESHOLD: 237,

  /** Jaccard similarity threshold for clustering selections */
  SCENE_JACCARD_THRESHOLD: 0.6,

  /** Max overlap with existing scenes before skipping candidate */
  SCENE_OVERLAP_MAX: 0.7,

  // ── Blending Ratios ────────────────────────────────────────────────────
  //
  // [eventCount threshold, curatedWeight, learnedWeight]
  // System auto-selects the highest-threshold row where eventCount >= threshold.
  //
  // Cold start   → 100% curated
  // Early        → 70/30 curated/learned
  // Growing      → 50/50
  // Established  → 20/80

  BLEND_RATIOS: [
    [0, 1.0, 0.0],
    [1_000, 0.7, 0.3],
    [10_000, 0.5, 0.5],
    [80_000, 0.2, 0.8],
  ] as const,

  // ── Storage Keys ─────────────────────────────────────────────────────

  /** learned_weights table key for co-occurrence data (Phase 5) */
  CO_OCCURRENCE_KEY: 'co-occurrence',

  /** learned_weights table key for scoring weights (Phase 6) */
  SCORING_WEIGHTS_KEY: 'scoring-weights',

  /** learned_weights table key for term quality scores (Phase 6) */
  TERM_QUALITY_KEY: 'term-quality-scores',

  /** learned_weights table key for scorer health report (Phase 6) */
  SCORER_HEALTH_KEY: 'scorer-health-report',

  /** learned_weights table key for threshold discovery results (Phase 6) */
  THRESHOLD_DISCOVERY_KEY: 'threshold-discovery',

  /** learned_weights table key for category value discovery results (Phase 6) */
  CATEGORY_VALUES_KEY: 'category-values',

  /** learned_weights table key for anti-pattern data (Phase 7.1) */
  ANTI_PATTERNS_KEY: 'anti-patterns',

  /** learned_weights table key for collision matrix data (Phase 7.1) */
  COLLISION_MATRIX_KEY: 'collision-matrix',

  /** learned_weights table key for iteration insights data (Phase 7.2) */
  ITERATION_INSIGHTS_KEY: 'iteration-insights',

  /** learned_weights table key for redundancy groups data (Phase 7.3) */
  REDUNDANCY_GROUPS_KEY: 'redundancy-groups',

  // ── Anti-pattern Detection (Phase 7.1) ─────────────────────────────────
  //
  // Anti-patterns = term pairs that HURT prompt quality when combined.
  // Collisions = term pairs that COMPETE for the same role (redundant).
  // Both detected from telemetry by comparing outcome scores.

  /** Outcome score below which an event is "low-outcome" (bad prompt) */
  ANTI_PATTERN_LOW_THRESHOLD: 0.15,

  /** Outcome score above which an event is "high-outcome" (good prompt) */
  ANTI_PATTERN_HIGH_THRESHOLD: 0.5,

  /** Minimum events containing a pair before it's evaluated for anti-patterns */
  ANTI_PATTERN_MIN_PAIR_EVENTS: 5,

  /** Minimum Fisher enrichment ratio to flag an anti-pattern (2× = twice as common in bad) */
  ANTI_PATTERN_MIN_ENRICHMENT: 2.0,

  /** Maximum anti-pattern pairs stored per tier */
  ANTI_PATTERN_MAX_PAIRS_PER_TIER: 500,

  /** Minimum quality delta (solo vs together outcome) to flag a collision */
  COLLISION_MIN_DELTA: 0.1,

  /** Maximum collision pairs stored per tier */
  COLLISION_MAX_PAIRS_PER_TIER: 300,

  /** Minimum events per term for solo quality measurement in collisions */
  COLLISION_MIN_SOLO_EVENTS: 5,

  /** Minimum category count for events entering anti-pattern analysis */
  ANTI_PATTERN_MIN_CATEGORIES: 2,

  // ── Iteration Tracking (Phase 7.2) ─────────────────────────────────
  //
  // Tracks how users fix prompts across sequential attempts in a session.
  // Detects weak terms (frequently replaced), category fix order, and
  // marks final attempts as high-confidence quality signals.

  /** Minimum multi-attempt sessions before iteration analysis is meaningful */
  ITERATION_MIN_MULTI_SESSIONS: 20,

  /** Minimum times a term must be replaced before flagging as weak */
  ITERATION_MIN_REPLACED_COUNT: 5,

  /** Replacement rate threshold for "weak term" (0.30 = replaced 30%+ of the time) */
  ITERATION_WEAK_TERM_THRESHOLD: 0.3,

  /** Maximum weak terms stored per tier */
  ITERATION_MAX_WEAK_TERMS_PER_TIER: 200,

  /** Maximum time gap (minutes) between consecutive attempts to treat as same session */
  ITERATION_SESSION_GAP_MINUTES: 30,

  /** Confidence multiplier for final attempt in a multi-attempt session */
  ITERATION_FINAL_ATTEMPT_FACTOR: 1.3,

  /** Confidence multiplier for non-final attempt (user continued iterating) */
  ITERATION_MID_ATTEMPT_FACTOR: 0.85,

  // ── Semantic Redundancy Detection (Phase 7.3) ─────────────────────────
  //
  // Detects terms in the SAME category that users pick interchangeably:
  // almost never selected together, yet producing similar outcome scores.
  // These are functional synonyms — not harmful like anti-patterns, just
  // wasteful (one is usually enough).

  /** Min solo events per term to be considered for redundancy analysis */
  REDUNDANCY_MIN_SOLO_EVENTS: 8,

  /** Min mutual exclusivity rate (0–1). 0.85 = ≤15% co-occurrence */
  REDUNDANCY_MIN_MUTUAL_EXCLUSIVITY: 0.85,

  /** Min outcome similarity (0–1). 0.80 = within 0.20 of each other */
  REDUNDANCY_MIN_OUTCOME_SIMILARITY: 0.8,

  /** Min combined redundancy score (exclusivity × similarity) to flag a pair */
  REDUNDANCY_MIN_SCORE: 0.7,

  /** Max redundancy groups stored per tier (storage cap) */
  REDUNDANCY_MAX_GROUPS_PER_TIER: 150,

  /** Max members per redundancy group (prevents runaway union-find) */
  REDUNDANCY_MAX_GROUP_SIZE: 8,

  // ── Phase 7.4: Higher-Order Combinations (Magic Combos) ───────────────

  /** Storage key for magic combos in learned_weights table */
  MAGIC_COMBOS_KEY: 'magic-combos',

  /** Min events a single term must appear in to be considered (Level 1 pruning) */
  MAGIC_COMBO_MIN_TERM_FREQUENCY: 10,

  /** Min events a pair must appear in to be considered (Level 2 pruning) */
  MAGIC_COMBO_MIN_PAIR_SUPPORT: 8,

  /** Min events the full combo (trio/quad) must appear in */
  MAGIC_COMBO_MIN_SUPPORT: 5,

  /** Min synergy score (comboOutcome − bestSubsetOutcome) to flag as magic */
  MAGIC_COMBO_MIN_SYNERGY: 0.05,

  /** Max combo size: 3 = trios only, 4 = trios + quads */
  MAGIC_COMBO_MAX_SIZE: 4,

  /** Max combos stored per tier (storage cap) */
  MAGIC_COMBO_MAX_PER_TIER: 500,

  // ── Phase 7.5: Per-Platform Learning ────────────────────────────────

  /** Storage key for per-platform term quality in learned_weights table */
  PLATFORM_TERM_QUALITY_KEY: 'platform-term-quality',

  /** Storage key for per-platform co-occurrence in learned_weights table */
  PLATFORM_CO_OCCURRENCE_KEY: 'platform-co-occurrence',

  /** Min events a platform needs within a tier before scoring begins */
  PLATFORM_MIN_EVENTS: 50,

  /** Events needed for full platform confidence (0→1 scale).
   *  confidence = min(1.0, eventCount / PLATFORM_CONFIDENCE_THRESHOLD).
   *  At 0 → pure tier fallback. At 500+ → pure platform data. */
  PLATFORM_CONFIDENCE_THRESHOLD: 500,

  /** Max terms stored per platform per tier (payload cap).
   *  42 platforms × 4 tiers × 500 terms = 84K worst case.
   *  In practice ~8–12 platforms qualify → ~20K terms. */
  PLATFORM_MAX_TERMS: 500,

  /** Max co-occurrence pairs stored per platform per tier */
  PLATFORM_MAX_PAIRS: 300,

  /** Events at which a platform is considered "graduated" from cold-start.
   *  Below this: cold-start badge in Admin. Above: "reliable" badge.
   *  Distinct from CONFIDENCE_THRESHOLD (smooth 0→1 ramp for blending). */
  PLATFORM_GRADUATION_THRESHOLD: 100,

  /** Events needed for full platform blend ratio in the suggestion engine.
   *  platformBlendRatio = min(1.0, eventCount / PLATFORM_BLEND_RAMP_THRESHOLD).
   *  Ramps faster than CONFIDENCE_THRESHOLD (500) so platform signals
   *  contribute sooner for popular platforms like Leonardo/Midjourney
   *  while staying conservative for low-traffic ones. */
  PLATFORM_BLEND_RAMP_THRESHOLD: 50,

  /** Days after which a platform's learned data is considered stale.
   *  If a platform's most recent event is older than this, confidence
   *  decays toward 0 — gracefully reverting scoring to tier fallback
   *  for abandoned platforms. Prevents ghost models from lingering. */
  PLATFORM_STALE_DAYS: 90,

  // ── Phase 7.6: A/B Testing Pipeline ────────────────────────────────────
  //
  // Split-tests scoring model changes before committing them.
  // Serves 50% of users the current model (control) and 50% a new model
  // (variant). Measures which group produces higher copy/save rates.

  /** Storage key for active A/B test state in learned_weights table */
  AB_ACTIVE_TEST_KEY: 'ab-active-test',

  /** Minimum weight delta (sum of absolute differences) to trigger a new A/B test.
   *  Below this threshold, weight changes are applied directly (too small to test). */
  AB_CHANGE_THRESHOLD: 0.05,

  /** Default split: 50% control, 50% variant */
  AB_DEFAULT_SPLIT_PCT: 50,

  /** Minimum events per variant before evaluation begins */
  AB_MIN_EVENTS_PER_VARIANT: 200,

  /** Default test duration in days */
  AB_DEFAULT_DURATION_DAYS: 7,

  /** Maximum test duration — auto-rollback if inconclusive after this */
  AB_MAX_DURATION_DAYS: 14,

  /** p-value threshold for statistical significance (two-tailed Z-test) */
  AB_SIGNIFICANCE_THRESHOLD: 0.05,

  // ── Phase 7.8: Temporal Intelligence ──────────────────────────────────
  //
  // Adds time-awareness to the learning pipeline:
  // - Seasonal patterns: "snow" 340% more popular Nov–Feb
  // - Weekly patterns: Weekend prompts 40% more experimental
  // - Trending velocity: Terms rising/falling in last 7 days vs 30-day baseline

  /** Storage key for temporal boosts in learned_weights table */
  TEMPORAL_BOOSTS_KEY: 'temporal-boosts',

  /** Storage key for trending terms in learned_weights table */
  TRENDING_TERMS_KEY: 'trending-terms',

  /** Minimum total events for a term to be included in seasonal/weekly analysis.
   *  Below this, the sample is too small for meaningful monthly distribution. */
  TEMPORAL_MIN_TOTAL_EVENTS: 20,

  /** Seasonal boost significance threshold.
   *  Only store month entries where |boost - 1.0| > this value.
   *  0.3 means a term must be 30%+ above or below average to be stored. */
  TEMPORAL_SEASONAL_SIGNIFICANCE: 0.3,

  /** Weekly pattern significance threshold (same principle as seasonal).
   *  0.2 = 20% above/below average for a given day to qualify. */
  TEMPORAL_WEEKLY_SIGNIFICANCE: 0.2,

  /** Recent window for trending analysis (days) */
  TEMPORAL_TRENDING_RECENT_DAYS: 7,

  /** Baseline window for trending analysis (days) — starts after recent window.
   *  Trending = comparing last 7 days against the prior 30 days. */
  TEMPORAL_TRENDING_BASELINE_DAYS: 30,

  /** Minimum events in recent window for a term to appear in trending */
  TEMPORAL_TRENDING_MIN_RECENT: 3,

  /** Minimum events in baseline window for velocity calculation.
   *  Below this, baseline rate is too noisy for meaningful comparison. */
  TEMPORAL_TRENDING_MIN_BASELINE: 5,

  /** Velocity threshold to classify as 'rising' or 'falling'.
   *  0.25 = 25% faster/slower than baseline to trigger classification. */
  TEMPORAL_TRENDING_VELOCITY_THRESHOLD: 0.25,

  /** Max seasonal boost entries stored per tier (storage cap) */
  TEMPORAL_MAX_SEASONAL_PER_TIER: 300,

  /** Max weekly pattern entries stored per tier (storage cap) */
  TEMPORAL_MAX_WEEKLY_PER_TIER: 200,

  /** Max trending term entries stored per tier (storage cap) */
  TEMPORAL_MAX_TRENDING_PER_TIER: 100,

  /** Suggestion engine boost multiplier for seasonal relevance.
   *  Applied as: baseScore * (1 + (seasonalBoost - 1) * weight).
   *  At 0.15, a term with 2.0× seasonal boost gets +15% score. */
  TEMPORAL_SEASONAL_WEIGHT: 0.15,

  /** Suggestion engine boost for trending-up terms.
   *  Smaller than seasonal — trending is a hint, not a strong signal. */
  TEMPORAL_TRENDING_WEIGHT: 0.08,

  /** Confidence ramp threshold for seasonal boosts.
   *  Terms with totalEvents < this value have dampened seasonal signals.
   *  Formula: effectiveBoost = 1.0 + (rawBoost - 1.0) × min(1.0, totalEvents / ramp).
   *  At 200, a term with 50 events gets 25% of its seasonal signal;
   *  a term with 200+ events gets the full signal. */
  TEMPORAL_SEASONAL_CONFIDENCE_RAMP: 200,

  /** Staleness half-life for trending data (hours).
   *  Trending signals halve in strength every 24 hours after generation.
   *  After 48h: 25% strength. After 72h: 12.5%. */
  TEMPORAL_TRENDING_STALENESS_HALFLIFE_HOURS: 24,

  /** Staleness half-life for seasonal data (hours).
   *  Seasonal signals are more stable so decay slower — halve every 48h.
   *  After 96h: 25% strength. After 144h: 12.5%. */
  TEMPORAL_SEASONAL_STALENESS_HALFLIFE_HOURS: 48,

  /** Age in hours after which temporal data is considered fully stale (0 impact).
   *  Safety ceiling — after 168h (1 week) the data is completely ignored
   *  regardless of how much signal the half-life formula still produces. */
  TEMPORAL_MAX_STALENESS_HOURS: 168,

  // ── Phase 7.9: Compression Intelligence ───────────────────────────────
  //
  // Learned compression profiles from telemetry. Three capabilities:
  // 1. Optimal length profiles — per-tier "sweet spot" for prompt char length
  // 2. Expendable term detection — terms safe to remove during compression,
  //    cross-referencing quality, iteration, redundancy, and anti-pattern data.
  // 3. Platform-aware length profiles — per-platform length sweet spots
  //    (Midjourney vs DALL-E etc.) with tier-level fallback.
  //
  // Stored as cron Layer 17, runs in parallel with Layer 16 (Temporal).

  /** Storage key for compression profiles in learned_weights table */
  COMPRESSION_PROFILES_KEY: 'compression-profiles',

  /** Minimum events per tier before compression analysis is meaningful.
   *  Below this, the length histogram is too sparse for reliable peaks. */
  COMPRESSION_MIN_EVENTS_PER_TIER: 100,

  /** Minimum events a term must appear in (per tier) to be evaluated for
   *  expendability. Prevents flagging rare terms with noisy signals. */
  COMPRESSION_MIN_TERM_EVENTS: 10,

  /** Minimum combined expendability score (0–1) for a term to be flagged.
   *  0.40 = at least two moderate signals or one strong + one weak.
   *  Keeps false positive rate low — only terms with real evidence qualify. */
  COMPRESSION_MIN_EXPENDABILITY: 0.40,

  /** Maximum expendable terms stored per tier (storage cap).
   *  200 per tier × 4 tiers = 800 terms worst case. In practice ~40–80. */
  COMPRESSION_MAX_EXPENDABLE_PER_TIER: 200,

  /** Character bucket size for length histogram analysis.
   *  20 chars ≈ 3–4 words. Gives ~15–20 meaningful buckets for typical
   *  prompt lengths (20–400 chars). Too small = noisy; too large = imprecise. */
  COMPRESSION_LENGTH_BUCKET_SIZE: 20,

  /** Minimum events per length bucket for the bucket to count in analysis.
   *  Filters out outlier lengths with too few events for a reliable average. */
  COMPRESSION_MIN_EVENTS_PER_BUCKET: 10,

  /** Fractional outcome drop from peak that triggers the "diminishing returns"
   *  marker. 0.15 = outcome must fall >15% below peak to mark the boundary.
   *  Used for admin dashboard guidance, not active compression. */
  COMPRESSION_DIMINISHING_RETURNS_DROP: 0.15,

  /** Weight of replacement rate signal in expendability formula (Phase 7.2).
   *  Highest weight — if users actively replace a term, it's the strongest
   *  evidence that the term isn't pulling its weight. */
  COMPRESSION_WEIGHT_REPLACEMENT: 0.35,

  /** Weight of quality penalty signal in expendability formula (Phase 6).
   *  Second highest — low quality scores indicate poor contribution. */
  COMPRESSION_WEIGHT_QUALITY: 0.30,

  /** Weight of redundancy signal in expendability formula (Phase 7.3).
   *  Binary signal: 0.20 if a better alternative exists, 0 otherwise. */
  COMPRESSION_WEIGHT_REDUNDANCY: 0.20,

  /** Weight of anti-pattern count signal in expendability formula (Phase 7.1).
   *  Lowest weight — anti-patterns are about pairs, not individual terms.
   *  Capped at 3 pairs: min(1.0, antiPatternCount / 3) × this weight. */
  COMPRESSION_WEIGHT_ANTIPATTERN: 0.15,

  /** Maximum suggestion engine penalty for expendable terms (score points).
   *  Applied as: score -= expendabilityMax × expendability.
   *  At 8 and expendability 1.0, a maximally expendable term loses 8 points. */
  COMPRESSION_EXPENDABILITY_MAX_PENALTY: 8,

  /** Minimum events per platform within a tier for platform-specific length
   *  analysis. Reuses the same threshold as Phase 7.5 per-platform learning.
   *  Below this, the platform falls back to the tier-level length profile. */
  COMPRESSION_PLATFORM_MIN_EVENTS: 50,

  /** Maximum platform profiles stored per tier (storage cap).
   *  42 platforms × 4 tiers worst case, but in practice only 8–12 platforms
   *  per tier hit the minimum events threshold. 20 provides generous headroom. */
  COMPRESSION_MAX_PLATFORMS_PER_TIER: 20,

  /** Confidence threshold for platform length blending (events).
   *  Below this, platform length data is blended with tier-level data:
   *    confidence = min(1.0, eventCount / threshold)
   *    blendedChars = tierOptimal + (platformOptimal - tierOptimal) × confidence
   *  At 50 events: ~10% platform influence. At 500+: 100% platform.
   *  Same value as Phase 7.5 PLATFORM_CONFIDENCE_THRESHOLD for consistency. */
  COMPRESSION_PLATFORM_CONFIDENCE_THRESHOLD: 500,

  // ── Feedback Credibility (Phase 7.10) ──────────────────────────────────
  //
  // Four-factor credibility scoring for direct user feedback signals.
  // Determines how much to trust each feedback event in the learning pipeline.
  // Range: [CREDIBILITY_MIN, CREDIBILITY_MAX]
  //
  // Formula: tierMult × ageMult × frequencyMult × speedMult (clamped)

  // ── Tier Multipliers (financially invested = more deliberate) ─────────
  /** Paid (Pro Promagen): financially invested → most deliberate feedback */
  FEEDBACK_CREDIBILITY_TIER_PAID: 1.25,
  /** Free signed-in: accountable, trackable → baseline */
  FEEDBACK_CREDIBILITY_TIER_FREE: 1.0,
  /** Anonymous: no accountability, might be random clicking */
  FEEDBACK_CREDIBILITY_TIER_ANONYMOUS: 0.60,

  // ── Account Age Multipliers (taste develops over time) ────────────────
  /** 0–6 days: still exploring, may not know what good output looks like */
  FEEDBACK_CREDIBILITY_AGE_NEW: 0.85,
  /** 7–29 days: learning the platform → baseline */
  FEEDBACK_CREDIBILITY_AGE_SETTLING: 1.0,
  /** 30–89 days: familiar with the tool, reliable judgement */
  FEEDBACK_CREDIBILITY_AGE_EXPERIENCED: 1.10,
  /** 90+ days: veteran — knows what works across platforms */
  FEEDBACK_CREDIBILITY_AGE_VETERAN: 1.15,

  // ── Account Age Thresholds (days) ─────────────────────────────────────
  FEEDBACK_CREDIBILITY_AGE_THRESHOLD_SETTLING: 7,
  FEEDBACK_CREDIBILITY_AGE_THRESHOLD_EXPERIENCED: 30,
  FEEDBACK_CREDIBILITY_AGE_THRESHOLD_VETERAN: 90,

  // ── Usage Frequency Multipliers (power users test more = better calibration) ─
  /** 5+ copies this week: daily power user */
  FEEDBACK_CREDIBILITY_FREQ_DAILY: 1.15,
  /** 2–4 copies this week: regular user */
  FEEDBACK_CREDIBILITY_FREQ_WEEKLY: 1.05,
  /** 1 copy this week: casual */
  FEEDBACK_CREDIBILITY_FREQ_CASUAL: 1.0,
  /** 0 copies this week (returning user): may have forgotten context */
  FEEDBACK_CREDIBILITY_FREQ_RARE: 0.90,

  // ── Frequency Thresholds (weekly copy count) ──────────────────────────
  FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_DAILY: 5,
  FEEDBACK_CREDIBILITY_FREQ_THRESHOLD_WEEKLY: 2,

  // ── Response Speed Multipliers (fresher signal = more reliable) ───────
  /** < 2 minutes: just tested it — freshest possible signal */
  FEEDBACK_CREDIBILITY_SPEED_INSTANT: 1.10,
  /** < 1 hour: reasonable feedback window → baseline */
  FEEDBACK_CREDIBILITY_SPEED_QUICK: 1.0,
  /** < 24 hours: might be rating from memory */
  FEEDBACK_CREDIBILITY_SPEED_DELAYED: 0.95,
  /** > 24 hours: memory decay — less reliable */
  FEEDBACK_CREDIBILITY_SPEED_LATE: 0.85,

  // ── Speed Thresholds (milliseconds) ───────────────────────────────────
  /** 2 minutes in ms */
  FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_INSTANT: 2 * 60 * 1_000,
  /** 1 hour in ms */
  FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_QUICK: 60 * 60 * 1_000,
  /** 24 hours in ms */
  FEEDBACK_CREDIBILITY_SPEED_THRESHOLD_DELAYED: 24 * 60 * 60 * 1_000,

  // ── Clamp Range ───────────────────────────────────────────────────────
  /** Minimum credibility (prevent crushing any user's feedback signal) */
  FEEDBACK_CREDIBILITY_MIN: 0.40,
  /** Maximum credibility (prevent any single user from dominating) */
  FEEDBACK_CREDIBILITY_MAX: 1.80,

  // ── Feedback Rate Limiting ────────────────────────────────────────────
  /** Max feedback submissions per IP per minute */
  FEEDBACK_RATE_LIMIT_PER_MINUTE: 5,

  // ── Feedback Widget Timing ────────────────────────────────────────────
  /** Delay before showing feedback widget after copy (ms) */
  FEEDBACK_WIDGET_DELAY_MS: 4_000,
  /** Duration to suppress re-showing after dismiss (ms) — 24 hours */
  FEEDBACK_DISMISS_COOLDOWN_MS: 24 * 60 * 60 * 1_000,

  // ── Rate Limiting ──────────────────────────────────────────────────────

  /** Max telemetry events per IP per minute (production) */
  RATE_LIMIT_PER_MINUTE_PROD: 10,

  /** Max telemetry events per IP per minute (development) */
  RATE_LIMIT_PER_MINUTE_DEV: 1_000,

  // ── Cron ───────────────────────────────────────────────────────────────

  /** Advisory lock key for nightly aggregation (must be unique across crons) */
  AGGREGATION_ADVISORY_LOCK_ID: 50_5050,

  /** Maximum seconds before aggregation cron should abort (Vercel Pro: 60s) */
  AGGREGATION_TIMEOUT_SECONDS: 55,

  /** Batch size for processing events during aggregation */
  AGGREGATION_BATCH_SIZE: 10_000,

  // ── Data Retention ─────────────────────────────────────────────────────

  /** Maximum age of raw events before eligible for purge (days) */
  RAW_EVENT_RETENTION_DAYS: 365,

  // ── Feedback Sentiment Streaks (Phase 7.10f) ──────────────────────────
  //
  // Track consecutive feedback patterns per session per platform.
  // Hot streaks amplify winning formulas; cold streaks flag problems.

  /** Minimum consecutive same-rating to trigger a hot or cold streak */
  FEEDBACK_STREAK_THRESHOLD: 3,
  /** Minimum alternating ratings to trigger an oscillating pattern */
  FEEDBACK_OSCILLATING_THRESHOLD: 4,
  /** Quality score boost for term combos in hot-streak prompts (next cron) */
  FEEDBACK_STREAK_HOT_BOOST: 1.15,
  /** Quality score penalty for term combos in cold-streak prompts (next cron) */
  FEEDBACK_STREAK_COLD_PENALTY: 0.85,
  /** Maximum stored streak history entries per platform per session */
  FEEDBACK_STREAK_MAX_HISTORY: 20,
} as const;

/**
 * Look up the correct blending ratio for a given event count.
 *
 * Returns [curatedWeight, learnedWeight] where both sum to ~1.0.
 *
 * @example
 * getBlendRatio(0)      → [1.0, 0.0]   // cold start
 * getBlendRatio(5_000)  → [0.7, 0.3]   // early
 * getBlendRatio(50_000) → [0.5, 0.5]   // growing
 * getBlendRatio(100_000)→ [0.2, 0.8]   // established
 */
export function getBlendRatio(eventCount: number): [curated: number, learned: number] {
  const ratios = LEARNING_CONSTANTS.BLEND_RATIOS;

  // Walk backwards to find the highest threshold we meet
  for (let i = ratios.length - 1; i >= 0; i--) {
    const row = ratios[i];
    if (!row) continue;
    const [threshold, curated, learned] = row;
    if (eventCount >= threshold) {
      return [curated, learned];
    }
  }

  // Fallback: 100% curated (should never reach here)
  return [1.0, 0.0];
}
