// src/lib/learning/temporal-lookup.ts
// ============================================================================
// TEMPORAL INTELLIGENCE — Lookup Functions
// ============================================================================
//
// Phase 7.8, Part 7.8b — Real-time Integration Bridge.
//
// Bridge between the raw TemporalBoostsData / TrendingTermsData
// (from nightly cron Layer 16) and the suggestion engine's per-option
// scoring pipeline.
//
// Provides:
// 1. buildTemporalLookup()     — converts boosts data → fast Maps for O(1) lookups
// 2. lookupSeasonalBoost()     — returns seasonal multiplier for a term this month
// 3. lookupWeeklyBoost()       — returns day-of-week multiplier for a term today
// 4. lookupTrendingVelocity()  — returns trending velocity for a term
//
// Same pattern as anti-pattern-lookup.ts (Phase 7.1).
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.8
//
// Version: 1.2.0 — Added staleness decay + generatedAt passthrough
// Created: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

import type {
  TemporalBoostsData,
  TrendingTermsData,
} from '@/lib/learning/temporal-intelligence';

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for temporal boosts.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Seasonal key: "term" → Record<month(1–12), multiplier>
 * Weekly key:   "term" → Record<dow(0–6), multiplier>
 */
export interface TemporalLookup {
  /** Per-tier seasonal maps: tier → (term → monthBoosts) */
  seasonal: Record<string, Map<string, Record<number, number>>>;
  /** Per-tier seasonal event counts: tier → (term → totalEvents).
   *  Used by the confidence ramp to dampen signals from low-data terms. */
  seasonalEvents: Record<string, Map<string, number>>;
  /** Per-tier weekly maps: tier → (term → dayBoosts) */
  weekly: Record<string, Map<string, Record<number, number>>>;
  /** Total events that produced this data */
  eventsAnalysed: number;
  /** ISO timestamp of when this data was generated (for staleness decay) */
  generatedAt: string;
}

/**
 * Fast lookup structure for trending terms.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Key: "term" → velocity (positive = rising, negative = falling)
 */
export interface TrendingLookup {
  /** Per-tier trending maps: tier → (term → velocity) */
  tiers: Record<string, Map<string, number>>;
  /** Total events that produced this data */
  eventsAnalysed: number;
  /** ISO timestamp of when this data was generated (for staleness decay) */
  generatedAt: string;
}

// ============================================================================
// BUILD LOOKUPS
// ============================================================================

/**
 * Convert TemporalBoostsData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — TemporalBoostsData from the API (null = no data yet)
 * @returns TemporalLookup with O(1) term lookups, or null if no data
 */
export function buildTemporalLookup(
  data: TemporalBoostsData | null | undefined,
): TemporalLookup | null {
  if (!data) return null;

  const seasonal: Record<string, Map<string, Record<number, number>>> = {};
  const seasonalEvents: Record<string, Map<string, number>> = {};
  const weekly: Record<string, Map<string, Record<number, number>>> = {};

  // Build seasonal maps (boosts + event counts for confidence ramp)
  if (data.seasonal) {
    for (const [tierKey, tierData] of Object.entries(data.seasonal)) {
      const termMap = new Map<string, Record<number, number>>();
      const eventsMap = new Map<string, number>();
      for (const boost of tierData.boosts) {
        termMap.set(boost.term, boost.monthlyBoosts);
        eventsMap.set(boost.term, boost.totalEvents);
      }
      seasonal[tierKey] = termMap;
      seasonalEvents[tierKey] = eventsMap;
    }
  }

  // Build weekly maps
  if (data.weekly) {
    for (const [tierKey, tierData] of Object.entries(data.weekly)) {
      const termMap = new Map<string, Record<number, number>>();
      for (const pattern of tierData.patterns) {
        termMap.set(pattern.term, pattern.dayBoosts);
      }
      weekly[tierKey] = termMap;
    }
  }

  return {
    seasonal,
    seasonalEvents,
    weekly,
    eventsAnalysed: data.eventsAnalysed,
    generatedAt: data.generatedAt,
  };
}

/**
 * Convert TrendingTermsData into a fast lookup structure.
 *
 * @param data — TrendingTermsData from the API (null = no data yet)
 * @returns TrendingLookup with O(1) term lookups, or null if no data
 */
export function buildTrendingLookup(
  data: TrendingTermsData | null | undefined,
): TrendingLookup | null {
  if (!data || !data.trending) return null;

  const tiers: Record<string, Map<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(data.trending)) {
    const termMap = new Map<string, number>();
    for (const term of tierData.terms) {
      termMap.set(term.term, term.velocity);
    }
    tiers[tierKey] = termMap;
  }

  return {
    tiers,
    eventsAnalysed: data.eventsAnalysed,
    generatedAt: data.generatedAt,
  };
}

// ============================================================================
// STALENESS DECAY (Improvement 2, Phase 7.8e)
// ============================================================================

/**
 * Compute a decay factor based on how old the temporal data is.
 *
 * Uses exponential half-life decay: factor = 2^(-ageHours / halfLifeHours).
 * Returns 0 when age exceeds TEMPORAL_MAX_STALENESS_HOURS (safety ceiling).
 *
 * @param generatedAt — ISO timestamp of data generation
 * @param halfLifeHours — Hours for signal to halve (24 for trending, 48 for seasonal)
 * @param now — Current time (injectable for testing)
 * @returns Decay factor 0.0–1.0 (1.0 = fresh, 0.0 = fully stale)
 */
export function computeStalenessFactor(
  generatedAt: string,
  halfLifeHours: number,
  now: Date = new Date(),
): number {
  const ageMs = now.getTime() - new Date(generatedAt).getTime();
  if (ageMs <= 0) return 1.0; // Future timestamp = treat as fresh
  const ageHours = ageMs / 3_600_000;

  // Safety ceiling — data beyond max age is completely ignored
  if (ageHours >= LEARNING_CONSTANTS.TEMPORAL_MAX_STALENESS_HOURS) return 0;

  // Exponential half-life decay: 2^(-age/halfLife)
  return Math.pow(2, -(ageHours / halfLifeHours));
}

// ============================================================================
// LOOKUPS
// ============================================================================

/**
 * Look up the seasonal boost for a term in a given month and tier.
 *
 * Returns a multiplier around 1.0:
 * - 1.0  = average (no seasonal signal)
 * - 2.5  = 250% of average (highly seasonal for this month)
 * - 0.3  = 30% of average (out-of-season)
 *
 * Applies a confidence ramp: terms with fewer total events have their
 * seasonal signal dampened proportionally. A term with 50 events and a
 * ramp threshold of 200 gets only 25% of the raw seasonal signal.
 * Formula: effectiveBoost = 1.0 + (rawBoost - 1.0) × min(1.0, totalEvents / ramp)
 *
 * Falls back to 1.0 (neutral) when data is missing.
 *
 * @param lookup — Pre-built TemporalLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param month — Current month (1–12)
 * @param tier — Platform tier (1–4)
 * @param now — Current time (injectable for testing, default: new Date())
 * @returns Confidence-weighted seasonal multiplier (default 1.0 = no boost)
 */
export function lookupSeasonalBoost(
  lookup: TemporalLookup | null,
  term: string,
  month: number,
  tier: number | null,
  now?: Date,
): number {
  if (!lookup) return 1.0;

  const tierKey = tier != null ? String(tier) : undefined;
  const tierMap = tierKey ? lookup.seasonal[tierKey] : undefined;

  if (!tierMap) return 1.0;

  const monthBoosts = tierMap.get(term);
  if (!monthBoosts) return 1.0;

  const rawBoost = monthBoosts[month] ?? 1.0;

  // Confidence ramp: dampen signal from low-data terms
  const eventsMap = tierKey ? lookup.seasonalEvents[tierKey] : undefined;
  const totalEvents = eventsMap?.get(term) ?? 0;
  const ramp = LEARNING_CONSTANTS.TEMPORAL_SEASONAL_CONFIDENCE_RAMP;
  const confidence = Math.min(1.0, totalEvents / ramp);

  // Staleness decay: dampen signal from old data (half-life = 48h)
  const staleness = computeStalenessFactor(
    lookup.generatedAt,
    LEARNING_CONSTANTS.TEMPORAL_SEASONAL_STALENESS_HALFLIFE_HOURS,
    now,
  );

  return 1.0 + (rawBoost - 1.0) * confidence * staleness;
}

/**
 * Look up the weekly boost for a term on a given day of week and tier.
 *
 * Returns a multiplier around 1.0 (same semantics as seasonal).
 *
 * @param lookup — Pre-built TemporalLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param dayOfWeek — Current day of week (0=Sun, 6=Sat)
 * @param tier — Platform tier (1–4)
 * @param now — Current time (injectable for testing, default: new Date())
 * @returns Weekly multiplier (default 1.0 = no boost)
 */
export function lookupWeeklyBoost(
  lookup: TemporalLookup | null,
  term: string,
  dayOfWeek: number,
  tier: number | null,
  now?: Date,
): number {
  if (!lookup) return 1.0;

  const tierKey = tier != null ? String(tier) : undefined;
  const tierMap = tierKey ? lookup.weekly[tierKey] : undefined;

  if (!tierMap) return 1.0;

  const dayBoosts = tierMap.get(term);
  if (!dayBoosts) return 1.0;

  const rawBoost = dayBoosts[dayOfWeek] ?? 1.0;

  // Staleness decay: same half-life as seasonal (same data source)
  const staleness = computeStalenessFactor(
    lookup.generatedAt,
    LEARNING_CONSTANTS.TEMPORAL_SEASONAL_STALENESS_HALFLIFE_HOURS,
    now,
  );

  return 1.0 + (rawBoost - 1.0) * staleness;
}

/**
 * Look up the trending velocity for a term in a given tier.
 *
 * Returns the velocity value:
 * - Positive = trending up (e.g. 0.5 = 50% faster than baseline)
 * - Negative = trending down
 * - 0 = no trending signal / term not found
 *
 * @param lookup — Pre-built TrendingLookup (null = no learned data)
 * @param term — The vocabulary term to check
 * @param tier — Platform tier (1–4)
 * @param now — Current time (injectable for testing, default: new Date())
 * @returns Velocity value (default 0 = no signal)
 */
export function lookupTrendingVelocity(
  lookup: TrendingLookup | null,
  term: string,
  tier: number | null,
  now?: Date,
): number {
  if (!lookup) return 0;

  const tierKey = tier != null ? String(tier) : undefined;
  const tierMap = tierKey ? lookup.tiers[tierKey] : undefined;

  if (!tierMap) return 0;

  const rawVelocity = tierMap.get(term) ?? 0;
  if (rawVelocity === 0) return 0;

  // Staleness decay: trending halves every 24h (faster than seasonal)
  const staleness = computeStalenessFactor(
    lookup.generatedAt,
    LEARNING_CONSTANTS.TEMPORAL_TRENDING_STALENESS_HALFLIFE_HOURS,
    now,
  );

  return rawVelocity * staleness;
}
