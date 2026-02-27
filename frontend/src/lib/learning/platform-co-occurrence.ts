// src/lib/learning/platform-co-occurrence.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Co-occurrence Mining Engine
// ============================================================================
//
// Phase 7.5, Part 7.5b — "Which Term PAIRS Work On THIS Platform?"
//
// The Phase 5 co-occurrence matrix (co-occurrence.ts) operates per-TIER.
// "golden hour" + "cinematic" might co-occur strongly on Tier 1, but
// within Tier 1, it could be brilliant on Leonardo and mediocre on Craiyon.
//
// This module computes per-PLATFORM co-occurrence matrices for all 42
// platforms. Same core loop as Phase 5 but partitioned by platform,
// without time-decay weighting (the existing tier-level matrix handles
// decay). Platform co-occurrence captures platform-SPECIFIC pair
// preferences above what the tier already knows.
//
// Cold-start blending handled by the lookup bridge (Part 7.5c):
//   confidence = min(1.0, eventCount / CONFIDENCE_THRESHOLD) × staleFactor
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
import { flattenSelections } from '@/lib/learning/decay';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_TIERS = [1, 2, 3, 4] as const;

/**
 * Minimum events a pair needs before it's included.
 * Prevents noise from one-off pairs dominating small platform slices.
 */
const MIN_PAIR_OCCURRENCES = 3;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A single co-occurring pair on a specific platform */
export interface PlatformCoOccurrencePair {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];

  /** Normalised weight: 0–100 */
  weight: number;

  /** Raw co-occurrence count */
  count: number;
}

/** Per-platform co-occurrence slice within a tier */
export interface PlatformCoOccurrenceSlice {
  /** Platform slug (e.g. "leonardo", "midjourney") */
  platformId: string;

  /** Total events for this platform in this tier */
  eventCount: number;

  /** Confidence 0–1 = min(1.0, eventCount / CONFIDENCE_THRESHOLD) × staleFactor */
  confidence: number;

  /** True if eventCount >= GRADUATION_THRESHOLD */
  graduated: boolean;

  /** ISO timestamp of the most recent event for this platform-tier slice */
  newestEventAt: string;

  /** Co-occurrence pairs sorted by weight descending */
  pairs: PlatformCoOccurrencePair[];

  /** Number of pairs */
  pairCount: number;
}

/** Per-tier container */
export interface TierPlatformCoOccurrence {
  /** Total events across all platforms in this tier */
  eventCount: number;

  /** Platform slices keyed by platform ID */
  platforms: Record<string, PlatformCoOccurrenceSlice>;

  /** How many platforms have data */
  platformCount: number;
}

/** Complete output — stored in learned_weights table */
export interface PlatformCoOccurrenceData {
  /** Schema version */
  version: string;

  /** ISO timestamp */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierPlatformCoOccurrence>;

  /** How many platforms have data across all tiers */
  totalPlatforms: number;

  /** Total pairs across all platforms and tiers */
  totalPairs: number;

  /** How many platforms have graduated */
  graduatedPlatforms: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute per-platform co-occurrence matrices from prompt event data.
 *
 * @param events — All qualifying prompt events
 * @param referenceDate — "Now" for stale detection (default: new Date())
 * @returns PlatformCoOccurrenceData ready for upsert, or null if insufficient data
 */
export function computePlatformCoOccurrence(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): PlatformCoOccurrenceData | null {
  if (!events || events.length < LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS) {
    return null;
  }

  const now = referenceDate;
  const generatedAt = now.toISOString();

  // ── Step 1: Group events by (tier, platform) ────────────────────────
  const groups = groupByTierAndPlatform(events);

  // ── Step 2: Process each (tier, platform) group ─────────────────────
  const tiers: Record<string, TierPlatformCoOccurrence> = {};
  let totalPlatforms = 0;
  let totalPairs = 0;
  let graduatedPlatforms = 0;
  const seenPlatforms = new Set<string>();

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const tierPlatformGroups = groups.get(tierId);

    if (!tierPlatformGroups) {
      tiers[tierKey] = buildEmptyTierPlatform();
      continue;
    }

    const platforms: Record<string, PlatformCoOccurrenceSlice> = {};
    let tierEventCount = 0;

    for (const [platformId, platformEvents] of tierPlatformGroups) {
      tierEventCount += platformEvents.length;

      // Skip platforms with too few events
      if (platformEvents.length < LEARNING_CONSTANTS.PLATFORM_MIN_EVENTS) {
        continue;
      }

      const slice = computePlatformCoOccurrenceSlice(
        platformId,
        platformEvents,
        now,
      );

      platforms[platformId] = slice;
      seenPlatforms.add(platformId);
      totalPairs += slice.pairCount;
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
    totalPairs,
    graduatedPlatforms,
  };
}

// ============================================================================
// INTERNAL: PER-PLATFORM SLICE COMPUTATION
// ============================================================================

/**
 * Compute co-occurrence pairs for a single platform within a single tier.
 */
function computePlatformCoOccurrenceSlice(
  platformId: string,
  events: PromptEventRow[],
  referenceDate: Date,
): PlatformCoOccurrenceSlice {
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

  // ── Accumulate pairs ────────────────────────────────────────────────
  const pairCounts = new Map<string, number>();

  for (const evt of events) {
    const terms = flattenSelections(evt.selections);
    if (terms.length < 2) continue;

    // Sort for consistent pairing (alphabetical)
    const sorted = [...terms].sort();

    for (let i = 0; i < sorted.length; i++) {
      const termA = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const termB = sorted[j]!;
        if (termA === termB) continue;

        const pairKey = `${termA}|${termB}`;
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
      }
    }
  }

  // ── Filter, normalise, sort, trim ───────────────────────────────────
  const filteredEntries: Array<{ key: string; count: number }> = [];

  for (const [key, count] of pairCounts) {
    if (count >= MIN_PAIR_OCCURRENCES) {
      filteredEntries.push({ key, count });
    }
  }

  // Find max count for normalisation
  let maxCount = 0;
  for (const entry of filteredEntries) {
    if (entry.count > maxCount) maxCount = entry.count;
  }

  // Build pairs with normalised weights
  const pairs: PlatformCoOccurrencePair[] = filteredEntries.map((entry) => {
    const [termA, termB] = entry.key.split('|') as [string, string];
    const weight =
      maxCount > 0 ? Math.round((entry.count / maxCount) * 100) : 0;
    return {
      terms: [termA, termB],
      weight,
      count: entry.count,
    };
  });

  // Sort by weight descending, then by count descending
  pairs.sort((a, b) => b.weight - a.weight || b.count - a.count);

  // Trim to max pairs per platform
  const trimmed = pairs.slice(0, LEARNING_CONSTANTS.PLATFORM_MAX_PAIRS);

  return {
    platformId,
    eventCount: events.length,
    confidence,
    graduated,
    newestEventAt: newestEventAt.toISOString(),
    pairs: trimmed,
    pairCount: trimmed.length,
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
function computeStaleFactor(
  newestEventDate: Date,
  referenceDate: Date,
): number {
  const staleDays = LEARNING_CONSTANTS.PLATFORM_STALE_DAYS;
  const daysSinceNewest = Math.max(
    0,
    (referenceDate.getTime() - newestEventDate.getTime()) /
      (1000 * 60 * 60 * 24),
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
 * Group events by (tier, platform).
 *
 * Returns Map<tier, Map<platformId, PromptEventRow[]>>
 */
function groupByTierAndPlatform(
  events: PromptEventRow[],
): Map<number, Map<string, PromptEventRow[]>> {
  const groups = new Map<number, Map<string, PromptEventRow[]>>();

  for (const evt of events) {
    const tier = evt.tier;
    const platform = evt.platform.toLowerCase();

    if (!groups.has(tier)) {
      groups.set(tier, new Map());
    }
    const tierMap = groups.get(tier)!;

    if (!tierMap.has(platform)) {
      tierMap.set(platform, []);
    }
    tierMap.get(platform)!.push(evt);
  }

  return groups;
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
// INTERNAL: EMPTY BUILDERS
// ============================================================================

function buildEmptyTierPlatform(): TierPlatformCoOccurrence {
  return {
    eventCount: 0,
    platforms: {},
    platformCount: 0,
  };
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/** Clamp a number to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
