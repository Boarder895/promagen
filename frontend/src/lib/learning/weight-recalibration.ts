// src/lib/learning/weight-recalibration.ts
// ============================================================================
// SELF-IMPROVING SCORER — Weight Recalibration Engine
// ============================================================================
//
// Phase 6, Part 6.2 — Mechanism 1: "What Actually Matters?"
//
// Computes Pearson correlation between each scoring factor and the outcome
// score, per tier. Normalises correlations to weights summing to 1.0.
// No ML — just arithmetic on the data Phase 5 already collects.
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
// Called by the nightly aggregation cron (Layer 4).
//
// Algorithm:
//   1. Group events by tier
//   2. For each tier, for each scoring factor:
//      a. Collect paired arrays [factorValues, outcomeScores]
//      b. Compute Pearson r
//      c. Take absolute value (we want magnitude, not direction)
//   3. Normalise: weight_i = |r_i| / sum(|r_j|)
//   4. Floor at WEIGHT_FLOOR (no factor drops to zero)
//   5. Re-normalise after flooring so weights still sum to 1.0
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.3
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.2
//
// Version: 1.0.0
// Created: 25 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { computeOutcomeScore } from '@/lib/learning/outcome-score';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum events per tier before we trust the per-tier weights.
 * Below this, fall back to global (all-tier) weights.
 */
export const MIN_EVENTS_PER_TIER = 100;

/**
 * Minimum events globally before we trust any learned weights.
 * Below this, return static defaults entirely.
 */
export const MIN_EVENTS_GLOBAL = 100;

/**
 * Weight floor — no factor's weight drops below this value.
 * Prevents division collapse where one dominant factor hogs all weight.
 */
export const WEIGHT_FLOOR = 0.02;

/**
 * Smoothing factor for weight updates.
 * newWeight = SMOOTHING × previous + (1 - SMOOTHING) × discovered
 * Prevents wild oscillation between cron runs.
 */
export const SMOOTHING_FACTOR = 0.7;

/**
 * Static default weights — the current hard-coded weights.
 * Used as cold-start fallback when insufficient data exists.
 * These are the "educated guesses" that Phase 6 will eventually replace.
 */
export const STATIC_DEFAULTS: Record<string, number> = {
  categoryCount: 0.20,
  coherence: 0.20,
  promptLength: 0.15,
  tierFormat: 0.15,
  negative: 0.10,
  fidelity: 0.10,
  density: 0.10,
};

/**
 * Valid tier IDs. Events outside this range are ignored.
 */
const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Per-tier weight profile */
export interface TierWeightProfile {
  /** Factor → normalised weight (sum = 1.0) */
  weights: Record<string, number>;

  /** Factor → raw Pearson r (for diagnostics / admin dashboard) */
  correlations: Record<string, number>;

  /** How many events contributed to this tier's weights */
  eventCount: number;
}

/** Complete scoring weights output — stored in learned_weights table */
export interface ScoringWeights {
  /** Schema version for forward compatibility */
  version: string;

  /** ISO timestamp when this was generated */
  generatedAt: string;

  /** Total events processed across all tiers */
  eventCount: number;

  /** Per-tier weight profiles (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierWeightProfile>;

  /** Global (all-tier) fallback when a tier has too few events */
  global: TierWeightProfile;
}

// ============================================================================
// PEARSON CORRELATION
// ============================================================================

/**
 * Compute Pearson correlation coefficient between two arrays of numbers.
 *
 * r = Σ((xi - x̄)(yi - ȳ)) / √(Σ(xi - x̄)² × Σ(yi - ȳ)²)
 *
 * Returns 0 if arrays are empty, different lengths, or have zero variance
 * (all identical values — can't correlate with no variance).
 *
 * @param xs — First variable (e.g. scoring factor values)
 * @param ys — Second variable (e.g. outcome scores)
 * @returns Pearson r between -1 and 1 (0 if degenerate)
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return 0;

  // Compute means
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  // Compute covariance and variances
  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  // Zero variance → can't compute correlation
  const denom = Math.sqrt(varX * varY);
  if (denom === 0) return 0;

  return cov / denom;
}

// ============================================================================
// WEIGHT NORMALISATION
// ============================================================================

/**
 * Normalise raw absolute correlations into weights summing to 1.0.
 *
 * Steps:
 * 1. Take absolute value of each correlation (we want magnitude)
 * 2. Apply floor (no weight < WEIGHT_FLOOR)
 * 3. Normalise so all weights sum to 1.0
 *
 * If all correlations are zero (no signal), returns equal weights.
 *
 * @param correlations — Factor → raw Pearson r
 * @param floor — Minimum weight per factor
 * @returns Factor → normalised weight (sum ≈ 1.0)
 */
export function normaliseToWeights(
  correlations: Record<string, number>,
  floor: number = WEIGHT_FLOOR,
): Record<string, number> {
  const factors = Object.keys(correlations);
  if (factors.length === 0) return {};

  // Step 1: absolute values
  const absCorr: Record<string, number> = {};
  let allZero = true;
  for (const f of factors) {
    const val = Math.abs(correlations[f]!);
    absCorr[f] = val;
    if (val > 0) allZero = false;
  }

  // If all zero, return equal weights
  if (allZero) {
    const equalWeight = 1.0 / factors.length;
    const result: Record<string, number> = {};
    for (const f of factors) {
      result[f] = equalWeight;
    }
    return result;
  }

  // Step 2: floor
  const floored: Record<string, number> = {};
  for (const f of factors) {
    floored[f] = Math.max(absCorr[f]!, floor);
  }

  // Step 3: normalise to sum = 1.0
  let total = 0;
  for (const f of factors) {
    total += floored[f]!;
  }

  const weights: Record<string, number> = {};
  for (const f of factors) {
    // Round to 4 decimal places for clean JSON output
    weights[f] = Math.round((floored[f]! / total) * 10_000) / 10_000;
  }

  return weights;
}

/**
 * Apply exponential smoothing between previous and new weights.
 *
 * smoothed = α × previous + (1 - α) × discovered
 *
 * This prevents wild oscillation between cron runs. A single bad batch
 * of data can't flip the entire weight profile.
 *
 * @param previous — Weights from the last cron run (null if first run)
 * @param discovered — Newly computed weights from this run
 * @param alpha — Smoothing factor (0.7 = 70% inertia from previous)
 * @returns Smoothed weights (sum ≈ 1.0)
 */
export function smoothWeights(
  previous: Record<string, number> | null,
  discovered: Record<string, number>,
  alpha: number = SMOOTHING_FACTOR,
): Record<string, number> {
  // First run: no smoothing, just use discovered
  if (!previous) return { ...discovered };

  const factors = Object.keys(discovered);
  const smoothed: Record<string, number> = {};
  let total = 0;

  for (const f of factors) {
    const prev = previous[f] ?? discovered[f]!;
    const disc = discovered[f]!;
    const val = alpha * prev + (1 - alpha) * disc;
    smoothed[f] = val;
    total += val;
  }

  // Re-normalise after smoothing (smoothed values may not sum to exactly 1.0)
  if (total > 0) {
    for (const f of factors) {
      smoothed[f] = Math.round((smoothed[f]! / total) * 10_000) / 10_000;
    }
  }

  return smoothed;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute per-tier scoring weights from prompt event data.
 *
 * This is the main entry point called by the nightly aggregation cron.
 *
 * @param events — Qualifying prompt events (score >= 90, 4+ categories)
 * @param previousWeights — Previous ScoringWeights (null on first run)
 * @returns Complete ScoringWeights ready for upsert to learned_weights table
 *
 * @example
 * const events = await fetchQualifyingEvents();
 * const previous = await getLearnedWeights('scoring-weights');
 * const weights = computeScoringWeights(events, previous);
 * await upsertLearnedWeights('scoring-weights', weights);
 */
export function computeScoringWeights(
  events: PromptEventRow[],
  previousWeights: ScoringWeights | null = null,
): ScoringWeights {
  const now = new Date().toISOString();

  // ── Cold start: not enough data globally ─────────────────────────
  if (events.length < MIN_EVENTS_GLOBAL) {
    return buildColdStartResult(events.length, now);
  }

  // ── Discover scoring factor keys from the data ───────────────────
  // Use the first event's score_factors keys as the factor list.
  // This is data-driven: if the scorer adds a new factor, it's automatically
  // picked up without code changes here.
  const factorKeys = discoverFactorKeys(events);
  if (factorKeys.length === 0) {
    return buildColdStartResult(events.length, now);
  }

  // ── Group events by tier ─────────────────────────────────────────
  const tierGroups = groupByTier(events);

  // ── Compute global (all-tier) profile ────────────────────────────
  const globalCorrelations = computeCorrelations(events, factorKeys);
  const globalRawWeights = normaliseToWeights(globalCorrelations);
  const previousGlobal = previousWeights?.global?.weights ?? null;
  const globalWeights = smoothWeights(previousGlobal, globalRawWeights);

  const globalProfile: TierWeightProfile = {
    weights: globalWeights,
    correlations: globalCorrelations,
    eventCount: events.length,
  };

  // ── Compute per-tier profiles ────────────────────────────────────
  const tiers: Record<string, TierWeightProfile> = {};

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const tierEvents = tierGroups.get(tierId) ?? [];

    if (tierEvents.length < MIN_EVENTS_PER_TIER) {
      // Not enough data for this tier — use global as fallback
      tiers[tierKey] = {
        weights: { ...globalWeights },
        correlations: computeCorrelations(tierEvents, factorKeys),
        eventCount: tierEvents.length,
      };
      continue;
    }

    const tierCorrelations = computeCorrelations(tierEvents, factorKeys);
    const tierRawWeights = normaliseToWeights(tierCorrelations);
    const previousTier = previousWeights?.tiers[tierKey]?.weights ?? null;
    const tierWeights = smoothWeights(previousTier, tierRawWeights);

    tiers[tierKey] = {
      weights: tierWeights,
      correlations: tierCorrelations,
      eventCount: tierEvents.length,
    };
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount: events.length,
    tiers,
    global: globalProfile,
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Discover scoring factor keys from event data.
 * Uses the union of all score_factors keys across events.
 */
function discoverFactorKeys(events: PromptEventRow[]): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.score_factors && typeof event.score_factors === 'object') {
      for (const key of Object.keys(event.score_factors)) {
        keys.add(key);
      }
    }
  }
  return Array.from(keys).sort();
}

/**
 * Group events by tier ID.
 */
function groupByTier(events: PromptEventRow[]): Map<number, PromptEventRow[]> {
  const groups = new Map<number, PromptEventRow[]>();
  for (const event of events) {
    const tier = event.tier;
    if (!groups.has(tier)) {
      groups.set(tier, []);
    }
    groups.get(tier)!.push(event);
  }
  return groups;
}

/**
 * Compute Pearson correlations between each scoring factor and outcome scores.
 *
 * @param events — Events to analyse
 * @param factorKeys — Which scoring factors to correlate
 * @returns Factor → Pearson r
 */
function computeCorrelations(
  events: PromptEventRow[],
  factorKeys: string[],
): Record<string, number> {
  if (events.length === 0) {
    const zeros: Record<string, number> = {};
    for (const key of factorKeys) {
      zeros[key] = 0;
    }
    return zeros;
  }

  // Pre-compute outcome scores for all events (once, not per-factor)
  const outcomeScores: number[] = [];
  for (const event of events) {
    outcomeScores.push(computeOutcomeScore(event.outcome));
  }

  // Correlate each factor with outcome scores
  const correlations: Record<string, number> = {};
  for (const key of factorKeys) {
    const factorValues: number[] = [];
    for (const event of events) {
      factorValues.push(event.score_factors[key] ?? 0);
    }
    correlations[key] = pearsonCorrelation(factorValues, outcomeScores);
  }

  return correlations;
}

/**
 * Build a cold-start result using static defaults.
 */
function buildColdStartResult(eventCount: number, now: string): ScoringWeights {
  const defaultProfile: TierWeightProfile = {
    weights: { ...STATIC_DEFAULTS },
    correlations: Object.fromEntries(
      Object.keys(STATIC_DEFAULTS).map((k) => [k, 0]),
    ),
    eventCount: 0,
  };

  const tiers: Record<string, TierWeightProfile> = {};
  for (const tierId of VALID_TIERS) {
    tiers[String(tierId)] = {
      weights: { ...STATIC_DEFAULTS },
      correlations: { ...defaultProfile.correlations },
      eventCount: 0,
    };
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount,
    tiers,
    global: { ...defaultProfile },
  };
}
