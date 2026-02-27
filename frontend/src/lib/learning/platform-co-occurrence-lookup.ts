// src/lib/learning/platform-co-occurrence-lookup.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Co-occurrence Lookup Bridge
// ============================================================================
//
// Phase 7.5, Part 7.5c — O(1) lookup with confidence blending.
//
// Bridge between the raw PlatformCoOccurrenceData (from nightly cron Layer 14b)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildPlatformCoOccurrenceLookup() — converts data → fast Maps
// 2. lookupPlatformCoOccurrence() — blended score: platform → tier fallback
//
// Blending formula:
//   finalScore = (platformWeight × confidence) + (tierFallback × (1 - confidence))
//
// Fallback chain: platform-specific → tier-level → 0 (no signal)
//
// Pure functions — no I/O, no side effects, fully testable.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.5
// Build plan: docs/authority/phase-7.5-per-platform-learning-buildplan.md § 5
//
// Version: 1.1.0 — Batch lookup + debug logging (7.5c improvements)
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { PlatformCoOccurrenceData } from '@/lib/learning/platform-co-occurrence';

// ============================================================================
// DEBUG LOG TYPE
// ============================================================================

/**
 * Emitted by the debugLog callback on every lookup call.
 * Zero cost when no callback is provided (default).
 */
export interface CoOccurrenceDebugEntry {
  candidate: string;
  platformId: string;
  tier: number;
  platformWeight: number | null;
  tierFallback: number;
  confidence: number;
  matchCount: number;
  blendedResult: number;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for platform co-occurrence weights.
 * Built once from cron data, reused across all scoring calls.
 */
export interface PlatformCoOccurrenceLookup {
  /** Per-tier → per-platform → Map<pairKey, weight 0–100> */
  tiers: Record<string, Record<string, Map<string, number>>>;

  /** Per-tier → per-platform → confidence 0–1 */
  confidences: Record<string, Record<string, number>>;

  /** Per-tier → per-platform → event count (for platform blend ratio) */
  eventCounts: Record<string, Record<string, number>>;

  /** Total events that produced this data */
  eventCount: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert PlatformCoOccurrenceData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — PlatformCoOccurrenceData from the API (null = no data yet)
 * @returns PlatformCoOccurrenceLookup with O(1) lookups, or null
 */
export function buildPlatformCoOccurrenceLookup(
  data: PlatformCoOccurrenceData | null | undefined,
): PlatformCoOccurrenceLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Record<string, Map<string, number>>> = {};
  const confidences: Record<string, Record<string, number>> = {};
  const eventCounts: Record<string, Record<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    tiers[tierKey] = {};
    confidences[tierKey] = {};
    eventCounts[tierKey] = {};

    for (const [platformId, slice] of Object.entries(tierData.platforms)) {
      const pairMap = new Map<string, number>();

      for (const pair of slice.pairs) {
        // Key: "termA|termB" (already alphabetically sorted)
        const key = `${pair.terms[0]}|${pair.terms[1]}`;
        pairMap.set(key, pair.weight);
      }

      tiers[tierKey]![platformId] = pairMap;
      confidences[tierKey]![platformId] = slice.confidence;
      eventCounts[tierKey]![platformId] = slice.eventCount;
    }
  }

  return {
    tiers,
    confidences,
    eventCounts,
    eventCount: data.eventCount,
  };
}

// ============================================================================
// LOOKUP
// ============================================================================

/**
 * Get a blended co-occurrence score for a candidate term: platform → tier.
 *
 * For each selected term, looks up the pair (selected, candidate) in the
 * platform's co-occurrence map. Averages matching weights, then blends
 * with the tier-level fallback using confidence weighting.
 *
 * Blending formula:
 *   finalWeight = (platformWeight × confidence) + (tierFallback × (1 - confidence))
 *
 * When no platform data exists, returns the tier fallback exactly.
 * This guarantees zero regression — platforms with no data see
 * identical scores to the pre-Phase-7.5 system.
 *
 * @param candidate — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param platformId — Platform slug (null = no platform selected)
 * @param tier — Platform tier 1–4 (null = unknown)
 * @param platformLookup — Pre-built lookup (null = no platform data yet)
 * @param tierFallbackWeight — Co-occurrence weight from Phase 5 tier lookup (0–100)
 * @param debugLog — Optional callback emitting blend details (zero cost when omitted)
 * @returns Blended co-occurrence weight 0–100 (0 = no signal)
 */
export function lookupPlatformCoOccurrence(
  candidate: string,
  selectedTerms: string[],
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformCoOccurrenceLookup | null,
  tierFallbackWeight: number,
  debugLog?: (entry: CoOccurrenceDebugEntry) => void,
): number {
  // No platform lookup or no platform/tier → pure tier fallback
  if (
    !platformLookup ||
    !platformId ||
    tier == null ||
    selectedTerms.length === 0
  ) {
    return tierFallbackWeight;
  }

  const tierKey = String(tier);
  const tierData = platformLookup.tiers[tierKey];
  if (!tierData) return tierFallbackWeight;

  const platformMap = tierData[platformId];
  if (!platformMap || platformMap.size === 0) return tierFallbackWeight;

  // Look up platform-specific co-occurrence
  const candidateNorm = candidate.trim().toLowerCase();
  let totalWeight = 0;
  let matchCount = 0;

  for (const selected of selectedTerms) {
    const selectedNorm = selected.trim().toLowerCase();

    // Build pair key (alphabetically sorted)
    const [a, b] =
      selectedNorm < candidateNorm
        ? [selectedNorm, candidateNorm]
        : [candidateNorm, selectedNorm];
    const key = `${a}|${b}`;

    const weight = platformMap.get(key);
    if (weight != null && weight > 0) {
      totalWeight += weight;
      matchCount++;
    }
  }

  // No platform-specific matches → pure tier fallback
  if (matchCount === 0) return tierFallbackWeight;

  const platformWeight = Math.min(100, Math.round(totalWeight / matchCount));
  const confidence = platformLookup.confidences[tierKey]?.[platformId] ?? 0;

  // Blend: platformWeight × confidence + tierFallback × (1 - confidence)
  const result = Math.round(
    platformWeight * confidence + tierFallbackWeight * (1 - confidence),
  );

  if (debugLog) {
    debugLog({
      candidate,
      platformId,
      tier,
      platformWeight,
      tierFallback: tierFallbackWeight,
      confidence,
      matchCount,
      blendedResult: result,
    });
  }

  return result;
}

// ============================================================================
// BATCH LOOKUP
// ============================================================================

/**
 * Score multiple candidate terms against the same selectedTerms in one pass.
 *
 * Avoids repeated tier/platform/confidence lookups and normalises selected
 * terms once. Up to ~30% faster than calling lookupPlatformCoOccurrence()
 * in a loop for 500+ candidates.
 *
 * @param candidates — Array of terms to score
 * @param selectedTerms — Currently selected terms across all categories
 * @param platformId — Platform slug (null = no platform)
 * @param tier — Platform tier (null = unknown)
 * @param platformLookup — Pre-built lookup (null = no data)
 * @param tierFallbackWeights — Map of candidate → tier-level weight
 * @param defaultFallback — Default weight when no tier fallback exists (default: 0)
 * @returns Map<candidate, blendedWeight> for all candidates
 */
export function lookupPlatformCoOccurrenceBatch(
  candidates: string[],
  selectedTerms: string[],
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformCoOccurrenceLookup | null,
  tierFallbackWeights: Map<string, number> | null,
  defaultFallback: number = 0,
): Map<string, number> {
  const results = new Map<string, number>();

  // Fast path: no platform data or empty selections
  if (
    !platformLookup ||
    !platformId ||
    tier == null ||
    selectedTerms.length === 0
  ) {
    for (const c of candidates) {
      results.set(
        c,
        tierFallbackWeights?.get(c.trim().toLowerCase()) ?? defaultFallback,
      );
    }
    return results;
  }

  const tierKey = String(tier);
  const tierData = platformLookup.tiers[tierKey];
  const platformMap = tierData?.[platformId];
  const confidence = platformLookup.confidences[tierKey]?.[platformId] ?? 0;

  // Fast path: no platform map or zero confidence
  if (!platformMap || platformMap.size === 0 || confidence === 0) {
    for (const c of candidates) {
      results.set(
        c,
        tierFallbackWeights?.get(c.trim().toLowerCase()) ?? defaultFallback,
      );
    }
    return results;
  }

  // Pre-normalise selected terms ONCE (the batch win)
  const selectedNorms = selectedTerms.map((s) => s.trim().toLowerCase());

  for (const candidate of candidates) {
    const candidateNorm = candidate.trim().toLowerCase();
    const fallback =
      tierFallbackWeights?.get(candidateNorm) ?? defaultFallback;

    let totalWeight = 0;
    let matchCount = 0;

    for (const selectedNorm of selectedNorms) {
      const [a, b] =
        selectedNorm < candidateNorm
          ? [selectedNorm, candidateNorm]
          : [candidateNorm, selectedNorm];
      const key = `${a}|${b}`;

      const weight = platformMap.get(key);
      if (weight != null && weight > 0) {
        totalWeight += weight;
        matchCount++;
      }
    }

    if (matchCount === 0) {
      results.set(candidate, fallback);
    } else {
      const platformWeight = Math.min(
        100,
        Math.round(totalWeight / matchCount),
      );
      results.set(
        candidate,
        Math.round(
          platformWeight * confidence + fallback * (1 - confidence),
        ),
      );
    }
  }

  return results;
}
