// src/lib/learning/co-occurrence.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Co-occurrence Matrix Computation
// ============================================================================
//
// Layer 1 of the nightly aggregation cron.
//
// For every pair of terms that appeared together in a high-quality prompt
// (score ≥ 90, 4+ categories), increment a weighted counter grouped by tier.
// Apply time decay, diversity caps, normalisation, then keep only the top
// MAX_PAIRS_PER_TIER pairs per tier.
//
// This module is a pure computation layer — it receives rows, returns data.
// No I/O, no database access. Called by the aggregate cron route.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.1
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import {
  timeDecay,
  ageDays,
  diversityCap,
  normalise,
  flattenSelections,
} from '@/lib/learning/decay';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// OUTPUT TYPE
// ============================================================================

/** A single co-occurring term pair with its computed weight */
export interface CoOccurrencePair {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Normalised weight: 0–100 (post-decay, post-diversity-cap) */
  weight: number;
  /** Raw co-occurrence count (before decay/cap) */
  count: number;
  /** Platforms where this pair appeared */
  platforms: string[];
}

/** Per-tier slice of the co-occurrence matrix */
export interface TierCoOccurrence {
  /** Total qualifying events in this tier */
  eventCount: number;
  /** Top pairs sorted by weight descending */
  pairs: CoOccurrencePair[];
}

/** Full co-occurrence matrix output — stored via upsertLearnedWeights */
export interface CoOccurrenceMatrix {
  /** Schema version for forward compat */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total qualifying events processed across all tiers */
  eventCount: number;
  /** Total unique pairs generated across all tiers */
  totalPairs: number;
  /** Per-tier data keyed by tier number (1–4) */
  tiers: Record<string, TierCoOccurrence>;
}

// ============================================================================
// INTERNAL ACCUMULATOR TYPES
// ============================================================================

/** Tracks raw accumulation before normalisation */
interface PairAccumulator {
  /** Decay-weighted count */
  weightedCount: number;
  /** Raw event count (for diversity cap input) */
  rawCount: number;
  /** Set of platform names this pair appeared on */
  platformSet: Set<string>;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute the co-occurrence matrix from qualifying prompt events.
 *
 * Algorithm:
 * 1. Group events by tier
 * 2. For each event, flatten selections → list of terms
 * 3. Generate all unique pairs (sorted alphabetically)
 * 4. Weight each pair by time decay of its event
 * 5. Sum weighted counts per pair per tier
 * 6. Apply diversity cap (prevent >30% dominance)
 * 7. Normalise to 0–100 scale per tier
 * 8. Keep only top MAX_PAIRS_PER_TIER pairs per tier
 *
 * @param events — Qualifying PromptEventRow[] from database
 * @param referenceDate — "Now" for decay computation (default: Date.now())
 * @returns CoOccurrenceMatrix ready for storage
 */
export function computeCoOccurrenceMatrix(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): CoOccurrenceMatrix {
  const now = referenceDate;

  // ── Step 1: Group by tier ───────────────────────────────────────────────
  const tierGroups = new Map<number, PromptEventRow[]>();
  for (const evt of events) {
    const tier = evt.tier;
    let group = tierGroups.get(tier);
    if (!group) {
      group = [];
      tierGroups.set(tier, group);
    }
    group.push(evt);
  }

  // ── Step 2–6: Process each tier ─────────────────────────────────────────
  const tiers: Record<string, TierCoOccurrence> = {};
  let totalPairs = 0;

  for (const [tier, tierEvents] of tierGroups) {
    const tierResult = computeTierCoOccurrence(tierEvents, now);
    tiers[String(tier)] = tierResult;
    totalPairs += tierResult.pairs.length;
  }

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventCount: events.length,
    totalPairs,
    tiers,
  };
}

// ============================================================================
// PER-TIER COMPUTATION
// ============================================================================

/**
 * Compute co-occurrence pairs for a single tier.
 *
 * @param events — Events belonging to one tier
 * @param now — Reference date for decay computation
 * @returns TierCoOccurrence with normalised, capped, sorted pairs
 */
function computeTierCoOccurrence(
  events: PromptEventRow[],
  now: Date,
): TierCoOccurrence {
  // Accumulators: "termA|termB" → PairAccumulator
  const pairMap = new Map<string, PairAccumulator>();
  const tierEventCount = events.length;

  // ── Accumulate pairs ──────────────────────────────────────────────────
  for (const evt of events) {
    // Parse created_at to Date
    const eventDate =
      evt.created_at instanceof Date
        ? evt.created_at
        : new Date(String(evt.created_at));

    // Compute time decay weight for this event
    const age = ageDays(eventDate, now);
    const decay = timeDecay(age);

    // Flatten selections → list of all selected terms
    const terms = flattenSelections(evt.selections);

    // Skip events with fewer than 2 terms (can't form pairs)
    if (terms.length < 2) continue;

    // Sort terms for consistent pairing (alphabetical)
    const sorted = [...terms].sort();

    // Generate all unique pairs
    for (let i = 0; i < sorted.length; i++) {
      const termA = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const termB = sorted[j]!;

        // Skip if same term (shouldn't happen with proper data, but safety)
        if (termA === termB) continue;

        const pairKey = `${termA}|${termB}`;

        let acc = pairMap.get(pairKey);
        if (!acc) {
          acc = {
            weightedCount: 0,
            rawCount: 0,
            platformSet: new Set<string>(),
          };
          pairMap.set(pairKey, acc);
        }

        acc.weightedCount += decay;
        acc.rawCount += 1;
        acc.platformSet.add(evt.platform);
      }
    }
  }

  // ── Apply diversity cap ───────────────────────────────────────────────
  // Cap pairs that appear in >30% of tier events to prevent domination
  const cappedEntries: Array<{
    key: string;
    cappedWeight: number;
    rawCount: number;
    platforms: string[];
  }> = [];

  for (const [key, acc] of pairMap) {
    // Apply diversity cap on raw count, then scale the weighted count proportionally
    const cappedRaw = diversityCap(acc.rawCount, tierEventCount);
    const capRatio = acc.rawCount > 0 ? cappedRaw / acc.rawCount : 0;
    const cappedWeight = acc.weightedCount * capRatio;

    cappedEntries.push({
      key,
      cappedWeight,
      rawCount: acc.rawCount,
      platforms: Array.from(acc.platformSet).sort(),
    });
  }

  // ── Normalise ─────────────────────────────────────────────────────────
  const weights = cappedEntries.map((e) => e.cappedWeight);
  const normalisedWeights = normalise(weights);

  // ── Combine, sort, trim ───────────────────────────────────────────────
  const pairs: CoOccurrencePair[] = cappedEntries.map((entry, i) => {
    const [termA, termB] = entry.key.split('|') as [string, string];
    return {
      terms: [termA, termB],
      weight: normalisedWeights[i] ?? 0,
      count: entry.rawCount,
      platforms: entry.platforms,
    };
  });

  // Sort by normalised weight descending, then by raw count descending
  pairs.sort((a, b) => b.weight - a.weight || b.count - a.count);

  // Keep only top N pairs per tier
  const trimmed = pairs.slice(0, LEARNING_CONSTANTS.MAX_PAIRS_PER_TIER);

  return {
    eventCount: tierEventCount,
    pairs: trimmed,
  };
}
