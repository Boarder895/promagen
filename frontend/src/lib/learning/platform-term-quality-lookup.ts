// src/lib/learning/platform-term-quality-lookup.ts
// ============================================================================
// PER-PLATFORM LEARNING — Platform Term Quality Lookup Bridge
// ============================================================================
//
// Phase 7.5, Part 7.5c — O(1) lookup with confidence blending.
//
// Bridge between the raw PlatformTermQualityData (from nightly cron Layer 14a)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildPlatformTermQualityLookup() — converts data → fast Maps
// 2. lookupPlatformTermQuality() — blended score: platform → tier → neutral
//
// Blending formula (from evolution plan § 7.5):
//   finalScore = (platformScore × confidence) + (tierFallback × (1 - confidence))
//
// Fallback chain: platform-specific → tier-level → neutral (50)
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

import type { PlatformTermQualityData } from '@/lib/learning/platform-term-quality';

// ============================================================================
// DEBUG LOG TYPE
// ============================================================================

/**
 * Emitted by the debugLog callback on every lookup call.
 * Zero cost when no callback is provided (default).
 * Surfaces in the Admin Command Centre's Blending Inspector (Phase 7.11).
 */
export interface TermQualityDebugEntry {
  term: string;
  platformId: string;
  tier: number;
  platformScore: number | null;
  tierFallback: number;
  confidence: number;
  blendedResult: number;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for platform term quality scores.
 * Built once from cron data, reused across all scoring calls.
 */
export interface PlatformTermQualityLookup {
  /** Per-tier → per-platform → Map<term, score 0–100> */
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
 * Convert PlatformTermQualityData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — PlatformTermQualityData from the API (null = no data yet)
 * @returns PlatformTermQualityLookup with O(1) lookups, or null
 */
export function buildPlatformTermQualityLookup(
  data: PlatformTermQualityData | null | undefined,
): PlatformTermQualityLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Record<string, Map<string, number>>> = {};
  const confidences: Record<string, Record<string, number>> = {};
  const eventCounts: Record<string, Record<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    tiers[tierKey] = {};
    confidences[tierKey] = {};
    eventCounts[tierKey] = {};

    for (const [platformId, slice] of Object.entries(tierData.platforms)) {
      const termMap = new Map<string, number>();

      for (const [term, quality] of Object.entries(slice.terms)) {
        termMap.set(term, quality.score);
      }

      tiers[tierKey]![platformId] = termMap;
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
 * Get a blended term quality score: platform → tier → neutral.
 *
 * Blending formula:
 *   finalScore = (platformScore × confidence) + (tierFallback × (1 - confidence))
 *
 * When no platform data exists, returns the tier fallback exactly.
 * When no tier fallback exists, returns neutral (50).
 * This guarantees zero regression — platforms with no data see
 * identical scores to the pre-Phase-7.5 system.
 *
 * @param term — The vocabulary term to look up
 * @param platformId — Platform slug (e.g. "leonardo"), null = no platform
 * @param tier — Platform tier (1–4), null = no tier
 * @param platformLookup — Pre-built lookup (null = no platform data yet)
 * @param tierFallbackScore — Score from Phase 6 tier-level lookup (null = no tier data)
 * @param debugLog — Optional callback emitting blend details (zero cost when omitted)
 * @returns Blended quality score 0–100 (50 = neutral)
 */
export function lookupPlatformTermQuality(
  term: string,
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformTermQualityLookup | null,
  tierFallbackScore: number | null,
  debugLog?: (entry: TermQualityDebugEntry) => void,
): number {
  const fallback = tierFallbackScore ?? 50;

  // No platform lookup or no platform/tier → pure tier fallback
  if (!platformLookup || !platformId || tier == null) {
    return fallback;
  }

  const tierKey = String(tier);
  const tierData = platformLookup.tiers[tierKey];
  if (!tierData) return fallback;

  const platformMap = tierData[platformId];
  if (!platformMap) return fallback;

  const platformScore = platformMap.get(term.trim().toLowerCase());
  if (platformScore == null) return fallback;

  const confidence = platformLookup.confidences[tierKey]?.[platformId] ?? 0;

  // Blend: platformScore × confidence + tierFallback × (1 - confidence)
  const result = Math.round(
    platformScore * confidence + fallback * (1 - confidence),
  );

  if (debugLog) {
    debugLog({
      term,
      platformId,
      tier,
      platformScore,
      tierFallback: fallback,
      confidence,
      blendedResult: result,
    });
  }

  return result;
}

// ============================================================================
// BATCH LOOKUP
// ============================================================================

/**
 * Score multiple candidate terms in a single pass.
 *
 * Avoids repeated tier/platform/confidence lookups when the suggestion
 * engine scores 500+ dropdown options per category. Up to ~30% faster
 * than calling lookupPlatformTermQuality() in a loop.
 *
 * @param candidates — Array of terms to score
 * @param platformId — Platform slug (null = no platform)
 * @param tier — Platform tier (null = unknown)
 * @param platformLookup — Pre-built lookup (null = no data)
 * @param tierFallbackScores — Map of term → tier-level score (null for missing)
 * @param defaultFallback — Default score when no tier fallback exists (default: 50)
 * @returns Map<term, blendedScore> for all candidates
 */
export function lookupPlatformTermQualityBatch(
  candidates: string[],
  platformId: string | null,
  tier: number | null,
  platformLookup: PlatformTermQualityLookup | null,
  tierFallbackScores: Map<string, number> | null,
  defaultFallback: number = 50,
): Map<string, number> {
  const results = new Map<string, number>();

  // Fast path: no platform data → return all tier fallbacks
  if (!platformLookup || !platformId || tier == null) {
    for (const term of candidates) {
      results.set(
        term,
        tierFallbackScores?.get(term.trim().toLowerCase()) ?? defaultFallback,
      );
    }
    return results;
  }

  const tierKey = String(tier);
  const tierData = platformLookup.tiers[tierKey];
  const platformMap = tierData?.[platformId];
  const confidence = platformLookup.confidences[tierKey]?.[platformId] ?? 0;

  // Fast path: no platform map or zero confidence → return all tier fallbacks
  if (!platformMap || confidence === 0) {
    for (const term of candidates) {
      results.set(
        term,
        tierFallbackScores?.get(term.trim().toLowerCase()) ?? defaultFallback,
      );
    }
    return results;
  }

  for (const term of candidates) {
    const termNorm = term.trim().toLowerCase();
    const fallback = tierFallbackScores?.get(termNorm) ?? defaultFallback;
    const platformScore = platformMap.get(termNorm);

    if (platformScore == null) {
      results.set(term, fallback);
    } else {
      results.set(
        term,
        Math.round(
          platformScore * confidence + fallback * (1 - confidence),
        ),
      );
    }
  }

  return results;
}
