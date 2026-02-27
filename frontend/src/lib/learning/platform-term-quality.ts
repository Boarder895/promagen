// src/lib/learning/platform-term-quality.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Term Quality Mining Engine
// ============================================================================
//
// Phase 7.5, Part 7.5b — "Which Terms Produce Great Images On THIS Platform?"
//
// The Phase 6 term quality scorer (term-quality-scoring.ts) operates per-TIER.
// Within Tier 1 alone there are 13 platforms, and "neon glow" might score
// brilliantly on Leonardo yet struggle on NightCafe. This module adds a
// per-PLATFORM quality layer for all 42 AI image generation platforms.
//
// Algorithm (per tier, per platform with >= PLATFORM_MIN_EVENTS events):
//   For each term with >= MIN_EVENTS_PER_TERM appearances:
//     1. meanOutcome = mean(weightedOutcome for events containing this term)
//     2. platformMean = mean(all outcomes for this platform on this tier)
//     3. z = (meanOutcome - platformMean) / platformStdDev
//     4. score = 50 + (z * 15), clamped [0, 100]
//
// Cold-start blending:
//   confidence = min(1.0, eventCount / CONFIDENCE_THRESHOLD)
//   Stale decay: if newest event > PLATFORM_STALE_DAYS old, confidence *= staleFactor
//   At 0 events → pure tier fallback. At 500+ → pure platform data.
//
// Graduation:
//   graduated = eventCount >= PLATFORM_GRADUATION_THRESHOLD
//   Surfaces as metadata for Admin Command Centre (Phase 7.11).
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.5
// Build plan: docs/authority/phase-7.5-per-platform-learning-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import { computeOutcomeScore } from '@/lib/learning/outcome-score';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS (re-exported from LEARNING_CONSTANTS for readability)
// ============================================================================

const MIN_EVENTS_PER_TERM = 5;
const ZSCORE_SCALE = 15;
const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Quality data for a single term on a specific platform */
export interface PlatformTermQuality {
  /** Human-readable score: 0–100 (50 = average) */
  score: number;

  /** How many events include this term on this platform */
  eventCount: number;

  /** Change vs last run: score delta, clamped [-1, +1] */
  trend: number;
}

/** Per-platform slice within a tier */
export interface PlatformTermSlice {
  /** Platform slug (e.g. "leonardo", "midjourney") */
  platformId: string;

  /** Total events for this platform in this tier */
  eventCount: number;

  /** Confidence 0–1 = min(1.0, eventCount / CONFIDENCE_THRESHOLD) × staleFactor */
  confidence: number;

  /** True if eventCount >= GRADUATION_THRESHOLD — reliable platform model */
  graduated: boolean;

  /** ISO timestamp of the most recent event for this platform-tier slice */
  newestEventAt: string;

  /** Term → quality data */
  terms: Record<string, PlatformTermQuality>;

  /** How many terms scored */
  termCount: number;

  /** Average score across all scored terms (should be ~50) */
  averageScore: number;
}

/** Per-tier container holding platform slices */
export interface TierPlatformTermQuality {
  /** Total events across all platforms in this tier */
  eventCount: number;

  /** Platform slices keyed by platform ID */
  platforms: Record<string, PlatformTermSlice>;

  /** How many platforms have data */
  platformCount: number;
}

/** Complete output — stored in learned_weights table */
export interface PlatformTermQualityData {
  /** Schema version */
  version: string;

  /** ISO timestamp */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierPlatformTermQuality>;

  /** How many platforms have data across all tiers */
  totalPlatforms: number;

  /** Total terms scored across all platforms and tiers */
  totalTermsScored: number;

  /** How many platforms have graduated (eventCount >= GRADUATION_THRESHOLD) */
  graduatedPlatforms: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute per-platform term quality scores from prompt event data.
 *
 * @param events — All qualifying prompt events
 * @param previousData — Previous PlatformTermQualityData (null on first run, used for trend)
 * @param referenceDate — "Now" for stale detection (default: new Date())
 * @returns PlatformTermQualityData ready for upsert, or null if insufficient data
 *
 * @example
 * const events = await fetchQualifyingEvents();
 * const previous = await getLearnedWeights('platform-term-quality');
 * const data = computePlatformTermQuality(events, previous);
 * if (data) await upsertLearnedWeights('platform-term-quality', data);
 */
export function computePlatformTermQuality(
  events: PromptEventRow[],
  previousData: PlatformTermQualityData | null = null,
  referenceDate: Date = new Date(),
): PlatformTermQualityData | null {
  if (!events || events.length < LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS) {
    return null;
  }

  const now = referenceDate;
  const generatedAt = now.toISOString();

  // ── Step 1: Pre-compute outcome scores once ─────────────────────────
  const outcomeScores = events.map((e) => computeOutcomeScore(e.outcome));

  // ── Step 2: Group events + outcomes by (tier, platform) ─────────────
  const groups = groupByTierAndPlatform(events, outcomeScores);

  // ── Step 3: Process each (tier, platform) group ─────────────────────
  const tiers: Record<string, TierPlatformTermQuality> = {};
  let totalPlatforms = 0;
  let totalTermsScored = 0;
  let graduatedPlatforms = 0;
  const seenPlatforms = new Set<string>();

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const tierPlatformGroups = groups.get(tierId);

    if (!tierPlatformGroups) {
      tiers[tierKey] = buildEmptyTierPlatform();
      continue;
    }

    const platforms: Record<string, PlatformTermSlice> = {};
    let tierEventCount = 0;

    for (const [platformId, group] of tierPlatformGroups) {
      tierEventCount += group.events.length;

      // Skip platforms with too few events
      if (group.events.length < LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS) {
        continue;
      }

      const previousSlice =
        previousData?.tiers[tierKey]?.platforms[platformId] ?? null;

      const slice = computePlatformSlice(
        platformId,
        group.events,
        group.outcomes,
        previousSlice,
        now,
      );

      platforms[platformId] = slice;
      seenPlatforms.add(platformId);
      totalTermsScored += slice.termCount;
      if (slice.graduated) graduatedPlatforms++;
    }

    tiers[tierKey] = {
      eventCount: tierEventCount,
      platforms,
      platformCount: Object.keys(platforms).length,
    };
  }

  totalPlatforms = seenPlatforms.size;

  // If no platform met the minimum threshold, return null
  if (totalPlatforms === 0) {
    return null;
  }

  return {
    version: '1.0.0',
    generatedAt,
    eventCount: events.length,
    tiers,
    totalPlatforms,
    totalTermsScored,
    graduatedPlatforms,
  };
}

// ============================================================================
// INTERNAL: PER-PLATFORM SLICE COMPUTATION
// ============================================================================

/**
 * Compute term quality for a single platform within a single tier.
 */
function computePlatformSlice(
  platformId: string,
  events: PromptEventRow[],
  outcomeScores: number[],
  previousSlice: PlatformTermSlice | null,
  referenceDate: Date,
): PlatformTermSlice {
  // ── Compute platform-level stats ────────────────────────────────────
  const platformMean = mean(outcomeScores);
  const platformStddev = stddev(outcomeScores, platformMean);

  // ── Find newest event ───────────────────────────────────────────────
  const newestEventAt = findNewestEventDate(events);

  // ── Compute confidence with stale decay ─────────────────────────────
  const rawConfidence = Math.min(
    1.0,
    events.length / LEARNING_CONSTANTS.PLATFORM_CONFIDENCE_THRESHOLD,
  );
  const staleFactor = computeStaleFactor(newestEventAt, referenceDate);
  const confidence = round4(rawConfidence * staleFactor);

  // ── Graduation check ────────────────────────────────────────────────
  const graduated =
    events.length >= LEARNING_CONSTANTS.PLATFORM_GRADUATION_THRESHOLD;

  // ── Build term → event indices mapping ──────────────────────────────
  const termEventIndices = buildTermIndex(events);

  // ── Score each term ─────────────────────────────────────────────────
  const terms: Record<string, PlatformTermQuality> = {};
  let totalScore = 0;
  let scoredCount = 0;

  // Sort by event count descending, take top MAX_TERMS
  const sortedTerms = Array.from(termEventIndices.entries())
    .filter(([, indices]) => indices.length >= MIN_EVENTS_PER_TERM)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, LEARNING_CONSTANTS.PLATFORM_MAX_TERMS);

  for (const [term, indices] of sortedTerms) {
    // Collect outcome scores for events containing this term
    const termOutcomes: number[] = [];
    for (const idx of indices) {
      termOutcomes.push(outcomeScores[idx]!);
    }

    const termMean = mean(termOutcomes);

    // Z-score: how many standard deviations above/below the platform mean
    const z =
      platformStddev > 0 ? (termMean - platformMean) / platformStddev : 0;

    // Scale to 0–100 (50 = average)
    const score = clamp(Math.round(50 + z * ZSCORE_SCALE), 0, 100);

    // Trend: compare with previous run
    const previousScore =
      previousSlice?.terms[term]?.score ?? null;
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
    platformId,
    eventCount: events.length,
    confidence,
    graduated,
    newestEventAt: newestEventAt.toISOString(),
    terms,
    termCount: scoredCount,
    averageScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : 50,
  };
}

// ============================================================================
// INTERNAL: STALE DECAY
// ============================================================================

/**
 * Compute stale decay factor for a platform's data.
 *
 * If the newest event is within PLATFORM_STALE_DAYS, factor = 1.0 (no decay).
 * Beyond that, linearly decay toward 0 over the next PLATFORM_STALE_DAYS.
 *
 * Example (STALE_DAYS=90):
 *   newest event 30 days ago → 1.0  (fresh)
 *   newest event 90 days ago → 1.0  (just at threshold)
 *   newest event 135 days ago → 0.5 (halfway through decay window)
 *   newest event 180+ days ago → 0.0 (fully stale, pure tier fallback)
 */
export function computeStaleFactor(
  newestEventDate: Date,
  referenceDate: Date,
): number {
  const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
  const daysSinceNewest = Math.max(
    0,
    (referenceDate.getTime() - newestEventDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceNewest <= staleDays) {
    return 1.0; // Fresh — no decay
  }

  // Linear decay over the next STALE_DAYS window
  const decayProgress = (daysSinceNewest - staleDays) / staleDays;
  return clamp(round4(1.0 - decayProgress), 0, 1);
}

// ============================================================================
// INTERNAL: GROUPING
// ============================================================================

/**
 * Group events and their pre-computed outcome scores by (tier, platform).
 *
 * Returns Map<tier, Map<platformId, { events, outcomes }>>
 */
function groupByTierAndPlatform(
  events: PromptEventRow[],
  outcomeScores: number[],
): Map<number, Map<string, { events: PromptEventRow[]; outcomes: number[] }>> {
  const groups = new Map<
    number,
    Map<string, { events: PromptEventRow[]; outcomes: number[] }>
  >();

  for (let i = 0; i < events.length; i++) {
    const evt = events[i]!;
    const tier = evt.tier;
    const platform = evt.platform.toLowerCase();

    if (!groups.has(tier)) {
      groups.set(tier, new Map());
    }
    const tierMap = groups.get(tier)!;

    if (!tierMap.has(platform)) {
      tierMap.set(platform, { events: [], outcomes: [] });
    }
    const group = tierMap.get(platform)!;
    group.events.push(evt);
    group.outcomes.push(outcomeScores[i]!);
  }

  return groups;
}

// ============================================================================
// INTERNAL: TERM INDEX
// ============================================================================

/**
 * Build a map of term → list of event indices where that term appears.
 * Same algorithm as term-quality-scoring.ts — terms normalised to lowercase + trimmed.
 */
function buildTermIndex(events: PromptEventRow[]): Map<string, number[]> {
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
// INTERNAL: NEWEST EVENT
// ============================================================================

/**
 * Find the most recent event date in a list of events.
 */
function findNewestEventDate(events: PromptEventRow[]): Date {
  let newest = new Date(0);

  for (const evt of events) {
    const d =
      evt.created_at instanceof Date
        ? evt.created_at
        : new Date(String(evt.created_at));

    if (d.getTime() > newest.getTime()) {
      newest = d;
    }
  }

  return newest;
}

// ============================================================================
// INTERNAL: TREND
// ============================================================================

/**
 * Compute trend between current and previous score.
 * Returns [-1, +1]: (current - previous) / 100. 0 if no previous data.
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
// INTERNAL: EMPTY BUILDERS
// ============================================================================

function buildEmptyTierPlatform(): TierPlatformTermQuality {
  return {
    eventCount: 0,
    platforms: {},
    platformCount: 0,
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
