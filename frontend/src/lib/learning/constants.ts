// src/lib/learning/constants.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Tuning Constants (SSOT)
// ============================================================================
//
// All magic numbers for the learning pipeline live here.
// Code reads these; code never changes. Adjust values to tune behaviour.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9
//
// Version: 1.0.0
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
