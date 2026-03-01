// src/lib/admin/weight-simulator.ts
// ============================================================================
// WEIGHT TUNING SANDBOX — Pure Simulation Engine
// ============================================================================
//
// Client-side re-scoring logic that mirrors the server scoring formula.
// Used by the Weight Tuning Sandbox modal to instantly preview the impact
// of weight changes without server round-trips.
//
// Scoring formula:
//   score = Σ(weight[factor] × score_factors[factor]) / Σ(weight[factor])
//   (weights normalised to sum = 1.0, so denominator = 1.0)
//
// Pure functions — no fetch, no DOM, no side effects. Trivially testable.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 11
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/** Minimal event shape needed for simulation */
export interface SimulationEvent {
  id: string;
  /** Truncated prompt text for display */
  promptPreview: string;
  /** Raw score factors from the event */
  scoreFactors: Record<string, number>;
  /** Original score from the database */
  originalScore: number;
  /** Platform used */
  platform: string;
  /** Tier */
  tier: number;
}

/** Result of simulating one event with new weights */
export interface SimulatedEvent {
  id: string;
  promptPreview: string;
  platform: string;
  tier: number;
  originalScore: number;
  newScore: number;
  scoreDelta: number;
  /** Original rank (1-based, by original score descending) */
  originalRank: number;
  /** New rank (1-based, by new score descending) */
  newRank: number;
  rankDelta: number;
}

/** Aggregate impact metrics */
export interface SimulationImpact {
  /** Average score change across all events */
  avgScoreDelta: number;
  /** Number of events that changed rank */
  rankChanges: number;
  /** Total events simulated */
  totalEvents: number;
  /** Simulated events, sorted by new score descending */
  events: SimulatedEvent[];
}

/** Diff entry for a single weight change */
export interface WeightDiff {
  factor: string;
  oldWeight: number;
  newWeight: number;
  changePercent: number;
}

// ============================================================================
// CORE SIMULATION
// ============================================================================

/**
 * Compute a single score using the weighted-sum formula.
 * Weights MUST be normalised (sum ≈ 1.0).
 *
 * score = Σ(weight[f] × scoreFactors[f]) for each factor f
 *
 * Missing factors in scoreFactors default to 0.
 * Missing factors in weights are skipped (contribute 0).
 */
export function computeWeightedScore(
  scoreFactors: Record<string, number>,
  weights: Record<string, number>,
): number {
  let score = 0;
  for (const [factor, weight] of Object.entries(weights)) {
    score += weight * (scoreFactors[factor] ?? 0);
  }
  return Math.round(score * 1000) / 1000; // 3 decimal places
}

/**
 * Normalise weights so they sum to exactly 1.0.
 * If all zero, returns uniform distribution.
 */
export function normaliseWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  if (entries.length === 0) return {};

  const sum = entries.reduce((s, [, v]) => s + v, 0);

  if (sum === 0) {
    const uniform = 1 / entries.length;
    return Object.fromEntries(entries.map(([k]) => [k, uniform]));
  }

  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum]));
}

/**
 * Simulate the impact of new weights on a batch of events.
 *
 * 1. Ranks events by original score (descending).
 * 2. Re-scores each event with new (normalised) weights.
 * 3. Re-ranks by new score (descending).
 * 4. Computes per-event deltas and aggregate metrics.
 */
export function simulateBatch(
  events: SimulationEvent[],
  currentWeights: Record<string, number>,
  proposedWeights: Record<string, number>,
): SimulationImpact {
  if (events.length === 0) {
    return { avgScoreDelta: 0, rankChanges: 0, totalEvents: 0, events: [] };
  }

  const normProposed = normaliseWeights(proposedWeights);

  // Compute original ranks (by original score descending)
  const originalRanked = [...events]
    .sort((a, b) => b.originalScore - a.originalScore)
    .map((e, i) => ({ ...e, originalRank: i + 1 }));

  // Re-score with proposed weights
  const reScored = originalRanked.map((e) => ({
    ...e,
    newScore: computeWeightedScore(e.scoreFactors, normProposed),
  }));

  // Sort by new score descending for new ranks
  const newRanked = [...reScored]
    .sort((a, b) => b.newScore - a.newScore)
    .map((e, i) => ({ ...e, newRank: i + 1 }));

  // Build lookup: id → newRank
  const newRankMap = new Map(newRanked.map((e) => [e.id, e.newRank]));

  // Build final results
  const simulated: SimulatedEvent[] = reScored.map((e) => ({
    id: e.id,
    promptPreview: e.promptPreview,
    platform: e.platform,
    tier: e.tier,
    originalScore: e.originalScore,
    newScore: e.newScore,
    scoreDelta: Math.round((e.newScore - e.originalScore) * 1000) / 1000,
    originalRank: e.originalRank,
    newRank: newRankMap.get(e.id) ?? e.originalRank,
    rankDelta: (newRankMap.get(e.id) ?? e.originalRank) - e.originalRank,
  }));

  // Sort by new score descending for display
  simulated.sort((a, b) => b.newScore - a.newScore);

  const avgScoreDelta =
    simulated.reduce((s, e) => s + e.scoreDelta, 0) / simulated.length;

  const rankChanges = simulated.filter((e) => e.rankDelta !== 0).length;

  return {
    avgScoreDelta: Math.round(avgScoreDelta * 1000) / 1000,
    rankChanges,
    totalEvents: simulated.length,
    events: simulated,
  };
}

// ============================================================================
// WEIGHT DIFF
// ============================================================================

/**
 * Compute a diff between current and proposed weights.
 * Only includes factors that changed by more than 0.1%.
 */
export function computeWeightDiff(
  currentWeights: Record<string, number>,
  proposedWeights: Record<string, number>,
): WeightDiff[] {
  const allFactors = new Set([
    ...Object.keys(currentWeights),
    ...Object.keys(proposedWeights),
  ]);

  const diffs: WeightDiff[] = [];

  for (const factor of allFactors) {
    const oldW = currentWeights[factor] ?? 0;
    const newW = proposedWeights[factor] ?? 0;
    const delta = newW - oldW;

    if (Math.abs(delta) < 0.001) continue; // Skip negligible changes

    const changePct = oldW === 0 ? (newW > 0 ? 100 : 0) : (delta / oldW) * 100;

    diffs.push({
      factor,
      oldWeight: Math.round(oldW * 1000) / 1000,
      newWeight: Math.round(newW * 1000) / 1000,
      changePercent: Math.round(changePct),
    });
  }

  // Sort by absolute change (biggest first)
  diffs.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return diffs;
}

// ============================================================================
// SIMPLE CORRELATION ESTIMATE
// ============================================================================

/**
 * Estimate Pearson r between new scores and original outcome-based scores.
 * This is a rough proxy — the real correlation uses outcome signals,
 * but if new scores track the original scores closely, the correlation
 * is preserved.
 */
export function estimateCorrelationPreservation(
  events: SimulationEvent[],
  proposedWeights: Record<string, number>,
): number {
  if (events.length < 3) return 0;

  const normProposed = normaliseWeights(proposedWeights);

  const originals = events.map((e) => e.originalScore);
  const newScores = events.map((e) => computeWeightedScore(e.scoreFactors, normProposed));

  return pearsonR(originals, newScores);
}

/** Pearson correlation coefficient */
function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;

  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 1000;
}
