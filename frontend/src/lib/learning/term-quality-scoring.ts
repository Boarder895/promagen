// src/lib/learning/term-quality-scoring.ts
// ============================================================================
// SELF-IMPROVING SCORER — Term Quality Scoring
// ============================================================================
//
// Phase 6, Part 6.5 — Mechanism 5: "Which Terms Produce Great Images?"
//
// Each vocabulary term gets a per-tier quality score based on how often
// it appears in high-outcome prompts. High-quality terms float to the
// top of dropdown ordering; low-quality terms sink to the bottom
// (but are never removed — users can still pick them).
//
// Algorithm (per tier, per term with >= MIN_EVENTS_PER_TERM appearances):
//   1. Collect all events containing this term
//   2. meanOutcome = mean(outcomeScores for events with this term)
//   3. globalMean = mean(all outcome scores for this tier)
//   4. z = (meanOutcome - globalMean) / stddev(allOutcomes)
//   5. score = 50 + (z * 15), clamped [0, 100]
//      → 50 = average, >65 = good, <35 = poor
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.5
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { computeOutcomeScore } from '@/lib/learning/outcome-score';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum events a term must appear in before it gets a quality score.
 * Below this, the term is excluded (not enough data to judge).
 */
export const MIN_EVENTS_PER_TERM = 5;

/**
 * Minimum events per tier before we compute term quality for that tier.
 */
export const MIN_EVENTS_FOR_SCORING = 30;

/**
 * Z-score scaling factor for the 0–100 readability scale.
 * score = 50 + (z × ZSCORE_SCALE)
 * At ZSCORE_SCALE=15: z=+1 → 65, z=+2 → 80, z=-2 → 20
 */
export const ZSCORE_SCALE = 15;

/**
 * Maximum number of terms stored per tier.
 * Prevents unbounded growth from custom/typed terms.
 * Keeps the JSON payload under ~30 KB.
 */
export const MAX_TERMS_PER_TIER = 2_000;

const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Quality data for a single term */
export interface TermQuality {
  /** Human-readable score: 0–100 (50 = average) */
  score: number;

  /** How many events include this term */
  eventCount: number;

  /** Change vs last run: score delta, clamped [-1, +1] for trend indicator */
  trend: number;
}

/** Per-tier term quality data */
export interface TierTermQuality {
  /** Term → quality data */
  terms: Record<string, TermQuality>;

  /** How many terms have quality scores */
  termCount: number;

  /** Average score across all scored terms (should be ~50) */
  averageScore: number;
}

/** Complete output — stored in learned_weights table */
export interface TermQualityScores {
  /** Schema version */
  version: string;

  /** ISO timestamp of generation */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierTermQuality>;

  /** Global (all-tier) results */
  global: TierTermQuality;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute per-tier term quality scores from prompt event data.
 *
 * @param events — Qualifying prompt events
 * @param previousScores — Previous TermQualityScores (null on first run, used for trend)
 * @returns Complete TermQualityScores ready for upsert
 *
 * @example
 * const events = await fetchQualifyingEvents();
 * const previous = await getLearnedWeights('term-quality-scores');
 * const scores = computeTermQualityScores(events, previous);
 * await upsertLearnedWeights('term-quality-scores', scores);
 */
export function computeTermQualityScores(
  events: PromptEventRow[],
  previousScores: TermQualityScores | null = null,
): TermQualityScores {
  const now = new Date().toISOString();

  if (events.length < MIN_EVENTS_FOR_SCORING) {
    return buildEmptyResult(events.length, now);
  }

  // Pre-compute outcome scores once
  const outcomeScores = events.map((e) => computeOutcomeScore(e.outcome));

  // Group events + outcomes by tier
  const tierGroups = groupByTier(events, outcomeScores);

  // Compute global
  const global = computeTierTermQuality(
    events,
    outcomeScores,
    previousScores?.global ?? null,
  );

  // Compute per-tier
  const tiers: Record<string, TierTermQuality> = {};

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const group = tierGroups.get(tierId);

    if (!group || group.events.length < MIN_EVENTS_FOR_SCORING) {
      tiers[tierKey] = buildEmptyTier();
      continue;
    }

    tiers[tierKey] = computeTierTermQuality(
      group.events,
      group.outcomes,
      previousScores?.tiers[tierKey] ?? null,
    );
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount: events.length,
    tiers,
    global,
  };
}

// ============================================================================
// INTERNAL: TIER COMPUTATION
// ============================================================================

/**
 * Compute term quality for a single tier (or global).
 */
function computeTierTermQuality(
  events: PromptEventRow[],
  outcomeScores: number[],
  previousTier: TierTermQuality | null,
): TierTermQuality {
  // Compute global stats for this tier
  const globalMean = mean(outcomeScores);
  const globalStddev = stddev(outcomeScores, globalMean);

  // Build term → event indices mapping
  const termEventIndices = buildTermIndex(events);

  // Score each term
  const terms: Record<string, TermQuality> = {};
  let totalScore = 0;
  let scoredCount = 0;

  // Sort by event count descending, take top MAX_TERMS_PER_TIER
  const sortedTerms = Array.from(termEventIndices.entries())
    .filter(([, indices]) => indices.length >= MIN_EVENTS_PER_TERM)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, MAX_TERMS_PER_TIER);

  for (const [term, indices] of sortedTerms) {
    // Collect outcome scores for events containing this term
    const termOutcomes: number[] = [];
    for (const idx of indices) {
      termOutcomes.push(outcomeScores[idx]!);
    }

    const termMean = mean(termOutcomes);

    // Z-score: how many standard deviations above/below the tier mean
    const z = globalStddev > 0 ? (termMean - globalMean) / globalStddev : 0;

    // Scale to 0–100 (50 = average)
    const score = clamp(Math.round(50 + z * ZSCORE_SCALE), 0, 100);

    // Trend: compare with previous run
    const previousScore = previousTier?.terms[term]?.score ?? null;
    const trend = computeTrend(score, previousScore);

    terms[term] = {
      score,
      eventCount: indices.length,
      trend,
    };

    totalScore += score;
    scoredCount++;
  }

  return {
    terms,
    termCount: scoredCount,
    averageScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 50,
  };
}

// ============================================================================
// INTERNAL: TERM INDEX
// ============================================================================

/**
 * Build a map of term → list of event indices where that term appears.
 *
 * Extracts terms from all categories in each event's selections.
 * Terms are normalised to lowercase + trimmed for consistent matching.
 */
function buildTermIndex(
  events: PromptEventRow[],
): Map<string, number[]> {
  const index = new Map<string, number[]>();

  for (let i = 0; i < events.length; i++) {
    const selections = events[i]!.selections;
    if (!selections || typeof selections !== 'object') continue;

    for (const values of Object.values(selections)) {
      if (!Array.isArray(values)) continue;

      for (const raw of values) {
        if (typeof raw !== 'string') continue;
        const term = raw.trim().toLowerCase();
        if (term.length === 0) continue;

        if (!index.has(term)) {
          index.set(term, []);
        }
        index.get(term)!.push(i);
      }
    }
  }

  return index;
}

// ============================================================================
// INTERNAL: TREND
// ============================================================================

/**
 * Compute trend between current and previous score.
 *
 * Returns a value clamped to [-1, +1]:
 *   - Normalised as (current - previous) / 100
 *   - 0 if no previous data
 *
 * This gives a simple directional indicator for UI (↑, →, ↓).
 */
function computeTrend(
  currentScore: number,
  previousScore: number | null,
): number {
  if (previousScore === null) return 0;
  const delta = (currentScore - previousScore) / 100;
  return clamp(round4(delta), -1, 1);
}

// ============================================================================
// INTERNAL: GROUPING
// ============================================================================

/**
 * Group events and their pre-computed outcome scores by tier.
 */
function groupByTier(
  events: PromptEventRow[],
  outcomeScores: number[],
): Map<number, { events: PromptEventRow[]; outcomes: number[] }> {
  const groups = new Map<
    number,
    { events: PromptEventRow[]; outcomes: number[] }
  >();

  for (let i = 0; i < events.length; i++) {
    const tier = events[i]!.tier;
    if (!groups.has(tier)) {
      groups.set(tier, { events: [], outcomes: [] });
    }
    const group = groups.get(tier)!;
    group.events.push(events[i]!);
    group.outcomes.push(outcomeScores[i]!);
  }

  return groups;
}

// ============================================================================
// INTERNAL: EMPTY BUILDERS
// ============================================================================

function buildEmptyResult(
  eventCount: number,
  now: string,
): TermQualityScores {
  const tiers: Record<string, TierTermQuality> = {};
  for (const tierId of VALID_TIERS) {
    tiers[String(tierId)] = buildEmptyTier();
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount,
    tiers,
    global: buildEmptyTier(),
  };
}

function buildEmptyTier(): TierTermQuality {
  return {
    terms: {},
    termCount: 0,
    averageScore: 50,
  };
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/** Arithmetic mean. Returns 0 for empty arrays. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Population standard deviation. Returns 0 for empty/single-element arrays. */
function stddev(values: number[], precomputedMean?: number): number {
  if (values.length <= 1) return 0;
  const m = precomputedMean ?? mean(values);
  let sumSq = 0;
  for (const v of values) {
    const d = v - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
