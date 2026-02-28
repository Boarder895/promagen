// src/lib/learning/constants.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Tuning Constants (SSOT)
// ============================================================================
//
// All magic numbers for the learning pipeline live here.
// Code reads these; code never changes. Adjust values to tune behaviour.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9, § 11, § 7.3, § 7.6
//
// Version: 7.0.0 — Phase 7.6a A/B Testing constants added
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
