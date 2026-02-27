// src/lib/learning/weak-term-lookup.ts
// ============================================================================
// ITERATION TRACKING — Weak Term Lookup
// ============================================================================
//
// Phase 7.2, Part 7.2c — Real-time Integration Bridge.
//
// Bridge between the raw IterationInsightsData (from nightly cron Layer 11)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildWeakTermLookup() — converts data → fast Map for O(1) term lookups
// 2. lookupWeakTermScore() — scores a single candidate term
//
// Same pattern as anti-pattern-lookup.ts (Phase 7.1).
// Simpler: single-term lookup instead of pair lookup.
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/phase-7.2-iteration-tracking-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { IterationInsightsData } from '@/lib/learning/iteration-tracking';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Info about a single weak term, stored in the lookup Map.
 */
export interface WeakTermInfo {
  /** Weakness score 0–1 (higher = more frequently replaced) */
  weaknessScore: number;
  /** Raw replacement rate (for display / tooltips) */
  replacementRate: number;
  /** Most common replacement term, null if no clear winner */
  topReplacement: string | null;
}

/**
 * Fast lookup structure for weak term scores.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Key: term string (exact match).
 * Value: WeakTermInfo.
 */
export interface WeakTermLookup {
  /** Per-tier maps: tier string → (term → WeakTermInfo) */
  tiers: Record<string, Map<string, WeakTermInfo>>;
  /** Global map (all-tier): term → WeakTermInfo */
  global: Map<string, WeakTermInfo>;
  /** Total events that produced this data */
  eventCount: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert IterationInsightsData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — IterationInsightsData from the API (null = no data yet)
 * @returns WeakTermLookup with O(1) term lookups, or null if no data
 */
export function buildWeakTermLookup(
  data: IterationInsightsData | null | undefined,
): WeakTermLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Map<string, WeakTermInfo>> = {};

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    const termMap = new Map<string, WeakTermInfo>();
    for (const entry of tierData.weakTerms) {
      termMap.set(entry.term, {
        weaknessScore: entry.weaknessScore,
        replacementRate: entry.replacementRate,
        topReplacement: entry.topReplacement,
      });
    }
    tiers[tierKey] = termMap;
  }

  // Build global map
  const global = new Map<string, WeakTermInfo>();
  if (data.global) {
    for (const entry of data.global.weakTerms) {
      global.set(entry.term, {
        weaknessScore: entry.weaknessScore,
        replacementRate: entry.replacementRate,
        topReplacement: entry.topReplacement,
      });
    }
  }

  return {
    tiers,
    global,
    eventCount: data.eventCount,
  };
}

// ============================================================================
// LOOKUP
// ============================================================================

/**
 * Look up the weakness score for a single candidate term.
 *
 * Returns 0 for strong/unknown terms, 0–1 for weak terms (higher = weaker).
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param term — The dropdown option being scored
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built WeakTermLookup (null = no learned data)
 * @returns Weakness score 0–1 (0 = not weak / no data)
 */
export function lookupWeakTermScore(
  term: string,
  tier: number | null,
  lookup: WeakTermLookup | null,
): number {
  if (!lookup) return 0;

  // Check tier-specific first
  if (tier != null) {
    const tierMap = lookup.tiers[`tier_${tier}`];
    const tierInfo = tierMap?.get(term);
    if (tierInfo) return tierInfo.weaknessScore;
  }

  // Fall back to global
  const globalInfo = lookup.global.get(term);
  return globalInfo?.weaknessScore ?? 0;
}

/**
 * Look up full weak term info (including replacement suggestion).
 *
 * Returns null for strong/unknown terms.
 * Useful for conflict detection messages ("Consider replacing X with Y").
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param term — The term to look up
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built WeakTermLookup (null = no learned data)
 * @returns WeakTermInfo or null if not weak / no data
 */
export function lookupWeakTermInfo(
  term: string,
  tier: number | null,
  lookup: WeakTermLookup | null,
): WeakTermInfo | null {
  if (!lookup) return null;

  // Check tier-specific first
  if (tier != null) {
    const tierMap = lookup.tiers[`tier_${tier}`];
    const tierInfo = tierMap?.get(term);
    if (tierInfo) return tierInfo;
  }

  // Fall back to global
  return lookup.global.get(term) ?? null;
}
