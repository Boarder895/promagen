// src/lib/learning/temporal-intelligence.ts
// ============================================================================
// TEMPORAL INTELLIGENCE — Seasonal, Weekly & Trending Analysis Engine
// ============================================================================
//
// Phase 7.8, Part 7.8a — Core Algorithm.
//
// Adds time-awareness to the learning pipeline. Three capabilities:
//
// 1. Seasonal patterns — "snow" terms 340% more popular Nov–Feb.
//    Detects per-term monthly popularity relative to annual average.
//
// 2. Weekly patterns — Weekend prompts 40% more experimental.
//    Detects per-term day-of-week popularity relative to weekly average.
//
// 3. Trending velocity — Terms rising or falling in the last 7 days
//    compared to a 30-day baseline. Early indicator of shifting tastes.
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 16).
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.8
//
// Version: 1.0.0
// Created: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// OUTPUT TYPES — Seasonal
// ============================================================================

/** Per-term monthly popularity relative to annual average */
export interface SeasonalBoost {
  /** The vocabulary term */
  term: string;
  /** Category the term belongs to (most frequent category for this term) */
  category: string;
  /** Month index (1–12) → boost multiplier.
   *  1.0 = average. 2.5 = 250% of average. 0.3 = 30% of average.
   *  Only months with significant deviation from 1.0 are stored. */
  monthlyBoosts: Record<number, number>;
  /** Total events this term appeared in (confidence signal) */
  totalEvents: number;
}

// ============================================================================
// OUTPUT TYPES — Weekly
// ============================================================================

/** Per-term day-of-week popularity relative to weekly average */
export interface WeeklyPattern {
  /** The vocabulary term */
  term: string;
  /** Category */
  category: string;
  /** Day-of-week (0=Sun, 6=Sat) → relative popularity.
   *  Only days with significant deviation stored. */
  dayBoosts: Record<number, number>;
  /** Total events */
  totalEvents: number;
}

// ============================================================================
// OUTPUT TYPES — Trending
// ============================================================================

/** A term's recent velocity vs baseline */
export interface TrendingTerm {
  /** The vocabulary term */
  term: string;
  /** Category */
  category: string;
  /** Events in the recent window (last 7 days) */
  recentCount: number;
  /** Events in the baseline window (8–37 days ago) */
  baselineCount: number;
  /** Velocity: (recentRate - baselineRate) / baselineRate.
   *  Positive = trending up. Negative = trending down. */
  velocity: number;
  /** Direction: 'rising' | 'falling' | 'stable' */
  direction: 'rising' | 'falling' | 'stable';
}

// ============================================================================
// OUTPUT TYPES — Combined
// ============================================================================

/** Per-tier seasonal boost data */
export interface TierSeasonalData {
  /** Events analysed in this tier */
  eventCount: number;
  /** Seasonal boost entries sorted by totalEvents descending */
  boosts: SeasonalBoost[];
}

/** Per-tier weekly pattern data */
export interface TierWeeklyData {
  /** Events analysed in this tier */
  eventCount: number;
  /** Weekly pattern entries sorted by totalEvents descending */
  patterns: WeeklyPattern[];
}

/** Per-tier trending term data */
export interface TierTrendingData {
  /** Events in recent window */
  recentWindowEvents: number;
  /** Events in baseline window */
  baselineWindowEvents: number;
  /** Trending terms sorted by absolute velocity descending */
  terms: TrendingTerm[];
}

/** Complete temporal boosts output — stored in learned_weights table */
export interface TemporalBoostsData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events analysed */
  eventsAnalysed: number;
  /** Per-tier seasonal boosts (keys: "1", "2", "3", "4") */
  seasonal: Record<string, TierSeasonalData>;
  /** Per-tier weekly patterns (keys: "1", "2", "3", "4") */
  weekly: Record<string, TierWeeklyData>;
}

/** Complete trending terms output — stored in learned_weights table */
export interface TrendingTermsData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events analysed */
  eventsAnalysed: number;
  /** Per-tier trending terms (keys: "1", "2", "3", "4") */
  trending: Record<string, TierTrendingData>;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Accumulator for a term's appearances across time buckets */
interface TermTimeBucket {
  /** Map of bucket key (month 1–12, or dow 0–6) → count */
  buckets: Map<number, number>;
  /** Total appearances */
  total: number;
  /** Category frequency map — used to pick the dominant category */
  categoryFreq: Map<string, number>;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Run all temporal analysis on a set of events.
 *
 * Splits events by tier, then computes seasonal, weekly, and trending
 * analysis for each tier independently.
 *
 * @param events — ALL prompt events (anti-pattern set, not just qualifying)
 * @param referenceDate — "Now" for output timestamp and trending window calc
 * @returns Two output objects ready for upsert into learned_weights
 */
export function runTemporalAnalysis(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): { temporalBoosts: TemporalBoostsData; trendingTerms: TrendingTermsData } {
  const C = LEARNING_CONSTANTS;
  const now = referenceDate;

  // ── Group events by tier ────────────────────────────────────────────
  const tierGroups = groupByTier(events);

  // ── Compute seasonal + weekly per tier ──────────────────────────────
  const seasonal: Record<string, TierSeasonalData> = {};
  const weekly: Record<string, TierWeeklyData> = {};
  const trending: Record<string, TierTrendingData> = {};

  for (const [tier, tierEvents] of tierGroups) {
    const tierKey = String(tier);

    // Seasonal
    const monthBuckets = extractTermsByMonth(tierEvents);
    const seasonalBoosts = computeSeasonalBoosts(
      monthBuckets,
      C.TEMPORAL_MIN_TOTAL_EVENTS,
      C.TEMPORAL_SEASONAL_SIGNIFICANCE,
      C.TEMPORAL_MAX_SEASONAL_PER_TIER,
    );
    seasonal[tierKey] = {
      eventCount: tierEvents.length,
      boosts: seasonalBoosts,
    };

    // Weekly
    const dowBuckets = extractTermsByDayOfWeek(tierEvents);
    const weeklyPatterns = computeWeeklyPatterns(
      dowBuckets,
      C.TEMPORAL_MIN_TOTAL_EVENTS,
      C.TEMPORAL_WEEKLY_SIGNIFICANCE,
      C.TEMPORAL_MAX_WEEKLY_PER_TIER,
    );
    weekly[tierKey] = {
      eventCount: tierEvents.length,
      patterns: weeklyPatterns,
    };

    // Trending
    const trendingTerms = computeTrendingTerms(
      tierEvents,
      now,
      C.TEMPORAL_TRENDING_RECENT_DAYS,
      C.TEMPORAL_TRENDING_BASELINE_DAYS,
      C.TEMPORAL_TRENDING_MIN_RECENT,
      C.TEMPORAL_TRENDING_MIN_BASELINE,
      C.TEMPORAL_TRENDING_VELOCITY_THRESHOLD,
      C.TEMPORAL_MAX_TRENDING_PER_TIER,
    );
    trending[tierKey] = trendingTerms;
  }

  const temporalBoosts: TemporalBoostsData = {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventsAnalysed: events.length,
    seasonal,
    weekly,
  };

  const trendingTermsData: TrendingTermsData = {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventsAnalysed: events.length,
    trending,
  };

  return { temporalBoosts, trendingTerms: trendingTermsData };
}

// ============================================================================
// SEASONAL ANALYSIS
// ============================================================================

/**
 * Bucket term occurrences by calendar month (1–12).
 *
 * Each event's `created_at` timestamp determines its month. Each term
 * in the event's selections is counted once per event per month.
 *
 * @param events — Events for a single tier
 * @returns Map of term → TermTimeBucket (with month keys 1–12)
 */
export function extractTermsByMonth(
  events: PromptEventRow[],
): Map<string, TermTimeBucket> {
  const termMap = new Map<string, TermTimeBucket>();

  for (const evt of events) {
    const date = toDate(evt.created_at);
    const month = date.getUTCMonth() + 1; // 1-indexed (Jan=1, Dec=12)

    const termToCategory = buildTermCategoryMap(evt.selections);

    for (const [term, category] of termToCategory) {
      let bucket = termMap.get(term);
      if (!bucket) {
        bucket = { buckets: new Map(), total: 0, categoryFreq: new Map() };
        termMap.set(term, bucket);
      }

      bucket.buckets.set(month, (bucket.buckets.get(month) ?? 0) + 1);
      bucket.total += 1;
      bucket.categoryFreq.set(
        category,
        (bucket.categoryFreq.get(category) ?? 0) + 1,
      );
    }
  }

  return termMap;
}

/**
 * Compute seasonal boost multipliers from monthly term counts.
 *
 * For each term, the monthly average is `totalEvents / 12`. Each month's
 * boost is `monthCount / monthlyAverage`. Months that deviate from 1.0
 * by less than `significance` are excluded from the output.
 *
 * @param termBuckets — Output of extractTermsByMonth()
 * @param minTotalEvents — Minimum total events for a term to qualify
 * @param significance — Minimum |boost - 1.0| to store a month entry
 * @param maxPerTier — Maximum entries per tier (storage cap)
 * @returns SeasonalBoost[] sorted by totalEvents descending
 */
export function computeSeasonalBoosts(
  termBuckets: Map<string, TermTimeBucket>,
  minTotalEvents: number,
  significance: number,
  maxPerTier: number,
): SeasonalBoost[] {
  const results: SeasonalBoost[] = [];

  for (const [term, bucket] of termBuckets) {
    if (bucket.total < minTotalEvents) continue;

    // Monthly average = total / 12 (even if some months have 0 events)
    const monthlyAvg = bucket.total / 12;
    if (monthlyAvg <= 0) continue;

    const monthlyBoosts: Record<number, number> = {};
    let hasSignificant = false;

    for (let m = 1; m <= 12; m++) {
      const count = bucket.buckets.get(m) ?? 0;
      const boost = round4(count / monthlyAvg);

      if (Math.abs(boost - 1.0) >= significance) {
        monthlyBoosts[m] = boost;
        hasSignificant = true;
      }
    }

    // Only include terms that have at least one significant month
    if (!hasSignificant) continue;

    results.push({
      term,
      category: dominantCategory(bucket.categoryFreq),
      monthlyBoosts,
      totalEvents: bucket.total,
    });
  }

  // Sort by totalEvents descending (most confident first), then trim
  results.sort((a, b) => b.totalEvents - a.totalEvents);
  return results.slice(0, maxPerTier);
}

// ============================================================================
// WEEKLY ANALYSIS
// ============================================================================

/**
 * Bucket term occurrences by day of week (0=Sun, 6=Sat).
 *
 * @param events — Events for a single tier
 * @returns Map of term → TermTimeBucket (with dow keys 0–6)
 */
export function extractTermsByDayOfWeek(
  events: PromptEventRow[],
): Map<string, TermTimeBucket> {
  const termMap = new Map<string, TermTimeBucket>();

  for (const evt of events) {
    const date = toDate(evt.created_at);
    const dow = date.getUTCDay(); // 0=Sun, 6=Sat

    const termToCategory = buildTermCategoryMap(evt.selections);

    for (const [term, category] of termToCategory) {
      let bucket = termMap.get(term);
      if (!bucket) {
        bucket = { buckets: new Map(), total: 0, categoryFreq: new Map() };
        termMap.set(term, bucket);
      }

      bucket.buckets.set(dow, (bucket.buckets.get(dow) ?? 0) + 1);
      bucket.total += 1;
      bucket.categoryFreq.set(
        category,
        (bucket.categoryFreq.get(category) ?? 0) + 1,
      );
    }
  }

  return termMap;
}

/**
 * Compute weekly pattern multipliers from day-of-week term counts.
 *
 * For each term, the daily average is `totalEvents / 7`. Each day's
 * boost is `dayCount / dailyAverage`. Days that deviate from 1.0
 * by less than `significance` are excluded.
 *
 * @param termBuckets — Output of extractTermsByDayOfWeek()
 * @param minTotalEvents — Minimum total events for a term to qualify
 * @param significance — Minimum |boost - 1.0| to store a day entry
 * @param maxPerTier — Maximum entries per tier (storage cap)
 * @returns WeeklyPattern[] sorted by totalEvents descending
 */
export function computeWeeklyPatterns(
  termBuckets: Map<string, TermTimeBucket>,
  minTotalEvents: number,
  significance: number,
  maxPerTier: number,
): WeeklyPattern[] {
  const results: WeeklyPattern[] = [];

  for (const [term, bucket] of termBuckets) {
    if (bucket.total < minTotalEvents) continue;

    const dailyAvg = bucket.total / 7;
    if (dailyAvg <= 0) continue;

    const dayBoosts: Record<number, number> = {};
    let hasSignificant = false;

    for (let d = 0; d <= 6; d++) {
      const count = bucket.buckets.get(d) ?? 0;
      const boost = round4(count / dailyAvg);

      if (Math.abs(boost - 1.0) >= significance) {
        dayBoosts[d] = boost;
        hasSignificant = true;
      }
    }

    if (!hasSignificant) continue;

    results.push({
      term,
      category: dominantCategory(bucket.categoryFreq),
      dayBoosts,
      totalEvents: bucket.total,
    });
  }

  results.sort((a, b) => b.totalEvents - a.totalEvents);
  return results.slice(0, maxPerTier);
}

// ============================================================================
// TRENDING ANALYSIS
// ============================================================================

/**
 * Compute trending velocity for terms in the recent window vs baseline.
 *
 * Algorithm:
 * 1. Split events into "recent" (last N days) and "baseline" (N+1 to N+M days ago)
 * 2. Count term occurrences in each window
 * 3. Normalise by window duration to get daily rate
 * 4. Velocity = (recentRate - baselineRate) / baselineRate
 * 5. Classify direction based on velocity threshold
 *
 * @param events — Events for a single tier
 * @param referenceDate — "Now" for window calculation
 * @param recentDays — Recent window size (default: 7)
 * @param baselineDays — Baseline window size (default: 30)
 * @param minRecent — Minimum events in recent window for a term to qualify
 * @param minBaseline — Minimum events in baseline window for velocity calc
 * @param velocityThreshold — Minimum |velocity| for rising/falling classification
 * @param maxPerTier — Maximum trending terms stored per tier
 * @returns TierTrendingData with terms sorted by |velocity| descending
 */
export function computeTrendingTerms(
  events: PromptEventRow[],
  referenceDate: Date,
  recentDays: number,
  baselineDays: number,
  minRecent: number,
  minBaseline: number,
  velocityThreshold: number,
  maxPerTier: number,
): TierTrendingData {
  const now = referenceDate.getTime();
  const msPerDay = 86_400_000;

  // Window boundaries
  const recentCutoff = now - recentDays * msPerDay;
  const baselineStart = now - (recentDays + baselineDays) * msPerDay;

  // ── Split events into windows ─────────────────────────────────────
  const recentTermCounts = new Map<string, { count: number; category: string }>();
  const baselineTermCounts = new Map<string, { count: number; category: string }>();
  let recentWindowEvents = 0;
  let baselineWindowEvents = 0;

  for (const evt of events) {
    const ts = toDate(evt.created_at).getTime();
    const termToCategory = buildTermCategoryMap(evt.selections);

    if (ts >= recentCutoff) {
      // Recent window
      recentWindowEvents++;
      for (const [term, category] of termToCategory) {
        const existing = recentTermCounts.get(term);
        if (existing) {
          existing.count++;
        } else {
          recentTermCounts.set(term, { count: 1, category });
        }
      }
    } else if (ts >= baselineStart) {
      // Baseline window
      baselineWindowEvents++;
      for (const [term, category] of termToCategory) {
        const existing = baselineTermCounts.get(term);
        if (existing) {
          existing.count++;
        } else {
          baselineTermCounts.set(term, { count: 1, category });
        }
      }
    }
    // Events older than baseline window are ignored
  }

  // ── Compute velocity for each term ────────────────────────────────
  const terms: TrendingTerm[] = [];

  for (const [term, recent] of recentTermCounts) {
    if (recent.count < minRecent) continue;

    const baseline = baselineTermCounts.get(term);
    const baselineCount = baseline?.count ?? 0;

    if (baselineCount < minBaseline) continue;

    // Normalise to daily rate (accounts for different window sizes)
    const recentRate = recent.count / recentDays;
    const baselineRate = baselineCount / baselineDays;

    // Velocity: how much faster/slower is the recent rate?
    // Guard against division by zero (already gated by minBaseline)
    const velocity = round4((recentRate - baselineRate) / Math.max(baselineRate, 0.001));

    let direction: 'rising' | 'falling' | 'stable';
    if (velocity >= velocityThreshold) {
      direction = 'rising';
    } else if (velocity <= -velocityThreshold) {
      direction = 'falling';
    } else {
      direction = 'stable';
    }

    terms.push({
      term,
      category: recent.category,
      recentCount: recent.count,
      baselineCount,
      velocity,
      direction,
    });
  }

  // Sort by absolute velocity descending (most dramatic changes first)
  terms.sort((a, b) => Math.abs(b.velocity) - Math.abs(a.velocity));

  return {
    recentWindowEvents,
    baselineWindowEvents,
    terms: terms.slice(0, maxPerTier),
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Group events by tier.
 *
 * @param events — All events
 * @returns Map of tier → events
 */
function groupByTier(events: PromptEventRow[]): Map<number, PromptEventRow[]> {
  const groups = new Map<number, PromptEventRow[]>();

  for (const evt of events) {
    let group = groups.get(evt.tier);
    if (!group) {
      group = [];
      groups.set(evt.tier, group);
    }
    group.push(evt);
  }

  return groups;
}

/**
 * Build a Map of term → category from an event's selections.
 *
 * Each unique term maps to its category. If a term appears in multiple
 * categories within one event (unusual but possible), the last one wins.
 *
 * @param selections — Record<category, string[]> from PromptEventRow
 * @returns Map<term, category>
 */
function buildTermCategoryMap(
  selections: Record<string, string[]>,
): Map<string, string> {
  const map = new Map<string, string>();

  for (const [category, values] of Object.entries(selections)) {
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (typeof v === 'string' && v.length > 0) {
        map.set(v, category);
      }
    }
  }

  return map;
}

/**
 * Pick the most frequent category from a frequency map.
 *
 * @param freq — Map<category, count>
 * @returns Most frequent category string, or 'unknown' if empty
 */
function dominantCategory(freq: Map<string, number>): string {
  let best = 'unknown';
  let bestCount = 0;

  for (const [cat, count] of freq) {
    if (count > bestCount) {
      best = cat;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Safely convert created_at (Date | string) to a Date object.
 *
 * @param value — Date or ISO string from PromptEventRow.created_at
 * @returns Date object
 */
function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
