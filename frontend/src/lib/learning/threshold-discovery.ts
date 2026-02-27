// src/lib/learning/threshold-discovery.ts
// ============================================================================
// SELF-IMPROVING SCORER — Threshold Auto-Adjustment
// ============================================================================
//
// Phase 6, Part 6.6 — Mechanism 2: "Where Does Quality Plateau?"
//
// Finds the "knee" in the score-vs-copy-rate curve. The current
// TELEMETRY_SCORE_THRESHOLD = 90 is a guess. The real threshold
// should sit where quality plateaus — i.e. where increasing the
// score further stops meaningfully improving user outcomes.
//
// Algorithm:
//   1. Bucket events by score: [70-74], [75-79], ..., [95-100]
//   2. For each bucket: copyRate = count(copied) / count(all)
//   3. Walk buckets: find the elbow where marginal gain < 2%
//   4. Clamp to safety bounds [70, 95]
//   5. Smooth against previous threshold (70/30 inertia)
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.3
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.6
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Width of each score bucket (5 points) */
export const BUCKET_WIDTH = 5;

/** Lowest bucket starts here */
export const BUCKET_MIN = 70;

/** Highest bucket starts here (95–100) */
export const BUCKET_MAX = 95;

/** Marginal gain below this is considered "plateau" */
export const ELBOW_THRESHOLD = 0.02;

/** Safety floor — threshold never drops below this */
export const SAFETY_MIN = 70;

/** Safety ceiling — threshold never exceeds this */
export const SAFETY_MAX = 95;

/** Smoothing factor for threshold updates (70% previous, 30% discovered) */
export const THRESHOLD_SMOOTHING = 0.7;

/** Minimum events per bucket before it's trustworthy */
export const MIN_EVENTS_PER_BUCKET = 10;

/** Minimum total events before we attempt threshold discovery */
export const MIN_EVENTS_FOR_THRESHOLD = 100;

const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A single score bucket with copy rate data */
export interface ScoreBucket {
  /** Lower bound of the bucket (inclusive) */
  rangeStart: number;

  /** Upper bound of the bucket (inclusive) */
  rangeEnd: number;

  /** Total events in this bucket */
  totalEvents: number;

  /** Events where copied = true */
  copiedEvents: number;

  /** Copy rate: copiedEvents / totalEvents (0–1) */
  copyRate: number;
}

/** Per-tier threshold result */
export interface TierThresholdResult {
  /** Discovered threshold (score value, e.g. 85) */
  threshold: number;

  /** Score buckets used for the discovery */
  buckets: ScoreBucket[];

  /** Event count for this tier */
  eventCount: number;
}

/** Complete output */
export interface ThresholdDiscoveryResult {
  /** Schema version */
  version: string;

  /** ISO timestamp */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

  /** Per-tier thresholds (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierThresholdResult>;

  /** Global threshold (all tiers combined) */
  global: TierThresholdResult;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Discover optimal score thresholds per tier from event data.
 *
 * @param events — ALL prompt events (not just qualifying ones — we need
 *                 the full score range to find the elbow)
 * @param previousResult — Previous ThresholdDiscoveryResult (null on first run)
 * @returns Complete ThresholdDiscoveryResult
 *
 * @example
 * const events = await fetchAllEvents();
 * const previous = await getLearnedWeights('threshold-discovery');
 * const result = discoverThresholds(events, previous);
 */
export function discoverThresholds(
  events: PromptEventRow[],
  previousResult: ThresholdDiscoveryResult | null = null,
): ThresholdDiscoveryResult {
  const now = new Date().toISOString();

  if (events.length < MIN_EVENTS_FOR_THRESHOLD) {
    return buildDefaultResult(events.length, now);
  }

  // Group events by tier
  const tierGroups = groupByTier(events);

  // Compute global
  const globalBuckets = buildBuckets(events);
  const globalRawThreshold = findElbow(globalBuckets);
  const previousGlobal = previousResult?.global?.threshold ?? null;
  const globalThreshold = smoothThreshold(previousGlobal, globalRawThreshold);

  const global: TierThresholdResult = {
    threshold: globalThreshold,
    buckets: globalBuckets,
    eventCount: events.length,
  };

  // Compute per-tier
  const tiers: Record<string, TierThresholdResult> = {};

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const tierEvents = tierGroups.get(tierId) ?? [];

    if (tierEvents.length < MIN_EVENTS_FOR_THRESHOLD) {
      // Not enough data — use global threshold
      tiers[tierKey] = {
        threshold: globalThreshold,
        buckets: buildBuckets(tierEvents),
        eventCount: tierEvents.length,
      };
      continue;
    }

    const tierBuckets = buildBuckets(tierEvents);
    const tierRawThreshold = findElbow(tierBuckets);
    const previousTier = previousResult?.tiers[tierKey]?.threshold ?? null;
    const tierThreshold = smoothThreshold(previousTier, tierRawThreshold);

    tiers[tierKey] = {
      threshold: tierThreshold,
      buckets: tierBuckets,
      eventCount: tierEvents.length,
    };
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
// BUCKET CONSTRUCTION
// ============================================================================

/**
 * Build score buckets from events.
 *
 * Buckets: [70-74], [75-79], [80-84], [85-89], [90-94], [95-100]
 */
export function buildBuckets(events: PromptEventRow[]): ScoreBucket[] {
  // Initialise buckets
  const bucketStarts: number[] = [];
  for (let s = BUCKET_MIN; s <= BUCKET_MAX; s += BUCKET_WIDTH) {
    bucketStarts.push(s);
  }

  const buckets: ScoreBucket[] = bucketStarts.map((start) => ({
    rangeStart: start,
    rangeEnd: start === BUCKET_MAX ? 100 : start + BUCKET_WIDTH - 1,
    totalEvents: 0,
    copiedEvents: 0,
    copyRate: 0,
  }));

  // Assign events to buckets
  for (const event of events) {
    const score = event.score;
    if (score < BUCKET_MIN) continue; // Below our range

    const bucketIndex = Math.min(
      Math.floor((score - BUCKET_MIN) / BUCKET_WIDTH),
      buckets.length - 1,
    );

    const bucket = buckets[bucketIndex];
    if (!bucket) continue;

    bucket.totalEvents++;
    if (event.outcome?.copied) {
      bucket.copiedEvents++;
    }
  }

  // Compute copy rates
  for (const bucket of buckets) {
    bucket.copyRate =
      bucket.totalEvents > 0
        ? round4(bucket.copiedEvents / bucket.totalEvents)
        : 0;
  }

  return buckets;
}

// ============================================================================
// ELBOW DETECTION
// ============================================================================

/**
 * Find the elbow point in the copy-rate curve.
 *
 * Walks buckets from lowest to highest. At each step, computes the
 * marginal gain in copy rate. The threshold is the first bucket where
 * the marginal gain drops below ELBOW_THRESHOLD (2%).
 *
 * If no elbow is found (copy rate keeps climbing), returns SAFETY_MIN.
 * Result is always clamped to [SAFETY_MIN, SAFETY_MAX].
 */
export function findElbow(buckets: ScoreBucket[]): number {
  // Filter out buckets with insufficient data
  const trustworthy = buckets.filter(
    (b) => b.totalEvents >= MIN_EVENTS_PER_BUCKET,
  );

  if (trustworthy.length < 2) {
    return SAFETY_MIN; // Not enough data — use minimum
  }

  // Walk from low to high, find where marginal gain plateaus
  for (let i = 0; i < trustworthy.length - 1; i++) {
    const current = trustworthy[i]!;
    const next = trustworthy[i + 1]!;
    const marginalGain = next.copyRate - current.copyRate;

    // Plateau found: marginal gain below threshold
    if (marginalGain < ELBOW_THRESHOLD) {
      return clamp(current.rangeStart, SAFETY_MIN, SAFETY_MAX);
    }
  }

  // No elbow found — copy rate keeps climbing → use minimum
  return SAFETY_MIN;
}

// ============================================================================
// SMOOTHING
// ============================================================================

/**
 * Smooth the discovered threshold against the previous value.
 *
 * smoothed = α × previous + (1 - α) × discovered
 *
 * @param previous — Previous threshold (null on first run)
 * @param discovered — Newly discovered threshold
 * @returns Smoothed threshold, rounded to nearest integer, clamped to safety bounds
 */
export function smoothThreshold(
  previous: number | null,
  discovered: number,
): number {
  if (previous === null) {
    return clamp(discovered, SAFETY_MIN, SAFETY_MAX);
  }

  const smoothed = THRESHOLD_SMOOTHING * previous + (1 - THRESHOLD_SMOOTHING) * discovered;
  return clamp(Math.round(smoothed), SAFETY_MIN, SAFETY_MAX);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function groupByTier(
  events: PromptEventRow[],
): Map<number, PromptEventRow[]> {
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

function buildDefaultResult(
  eventCount: number,
  now: string,
): ThresholdDiscoveryResult {
  const defaultTier: TierThresholdResult = {
    threshold: 90, // Current static default
    buckets: [],
    eventCount: 0,
  };

  const tiers: Record<string, TierThresholdResult> = {};
  for (const tierId of VALID_TIERS) {
    tiers[String(tierId)] = { ...defaultTier };
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount,
    tiers,
    global: { ...defaultTier },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
