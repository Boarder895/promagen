// src/lib/learning/co-occurrence-lookup.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Co-occurrence Lookup
// ============================================================================
//
// Bridge between the raw CoOccurrenceMatrix (from nightly cron) and the
// suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildLookup() — converts matrix → fast Map for O(1) pair lookups
// 2. lookupCoOccurrence() — scores a candidate term against selected terms
//
// Pure functions — no I/O, no side effects, fully testable.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.1
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for co-occurrence weights.
 * Built once from the matrix, reused across all scoring calls.
 *
 * Key format: "termA|termB" (alphabetically sorted) — same as in the matrix.
 * Value: normalised weight 0–100.
 */
export interface CoOccurrenceLookup {
  /** Per-tier maps: tier string → (pairKey → weight 0–100) */
  tiers: Record<string, Map<string, number>>;
  /** Total qualifying events that produced this matrix */
  eventCount: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert a CoOccurrenceMatrix into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param matrix — CoOccurrenceMatrix from the API
 * @returns CoOccurrenceLookup with O(1) pair lookups per tier
 */
export function buildCoOccurrenceLookup(
  matrix: CoOccurrenceMatrix | null | undefined,
): CoOccurrenceLookup | null {
  if (!matrix || !matrix.tiers) return null;

  const tiers: Record<string, Map<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(matrix.tiers)) {
    const pairMap = new Map<string, number>();

    for (const pair of tierData.pairs) {
      // Key: "termA|termB" (already alphabetically sorted in the matrix)
      const key = `${pair.terms[0]}|${pair.terms[1]}`;
      pairMap.set(key, pair.weight);
    }

    tiers[tierKey] = pairMap;
  }

  return {
    tiers,
    eventCount: matrix.eventCount,
  };
}

// ============================================================================
// LOOKUP
// ============================================================================

/**
 * Compute a co-occurrence boost score for a candidate term.
 *
 * For each selected term, look up the pair (selected, candidate) in the
 * tier's co-occurrence map. Sum all matching weights, then normalise
 * to 0–100 range.
 *
 * @param candidate — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4) to look up the right co-occurrence slice
 * @param lookup — Pre-built CoOccurrenceLookup (null = no learned data yet)
 * @returns Normalised co-occurrence score 0–100 (0 = no signal)
 */
export function lookupCoOccurrence(
  candidate: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: CoOccurrenceLookup | null,
): number {
  // No learned data yet → no signal
  if (!lookup || selectedTerms.length === 0 || tier == null) return 0;

  const tierMap = lookup.tiers[String(tier)];
  if (!tierMap || tierMap.size === 0) return 0;

  let totalWeight = 0;
  let matchCount = 0;

  for (const selected of selectedTerms) {
    // Build pair key (alphabetically sorted, matching matrix format)
    const [a, b] =
      selected < candidate ? [selected, candidate] : [candidate, selected];
    const key = `${a}|${b}`;

    const weight = tierMap.get(key);
    if (weight != null && weight > 0) {
      totalWeight += weight;
      matchCount++;
    }
  }

  if (matchCount === 0) return 0;

  // Average the weights across all matching pairs, capped at 100
  const avg = totalWeight / matchCount;
  return Math.min(100, Math.round(avg));
}
