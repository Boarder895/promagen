// src/lib/learning/anti-pattern-lookup.ts
// ============================================================================
// NEGATIVE PATTERN LEARNING — Anti-pattern Lookup
// ============================================================================
//
// Phase 7.1, Part 7.1d — Real-time Integration Bridge.
//
// Bridge between the raw AntiPatternData (from nightly cron Layer 9) and
// the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildAntiPatternLookup() — converts data → fast Map for O(1) pair lookups
// 2. lookupAntiPatternSeverity() — scores a candidate term against selected terms
//
// Same pattern as co-occurrence-lookup.ts (Phase 5).
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { AntiPatternData } from '@/lib/learning/anti-pattern-detection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Fast lookup structure for anti-pattern severities.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Key format: "termA|termB" (alphabetically sorted).
 * Value: severity 0–1 (higher = more toxic).
 */
export interface AntiPatternLookup {
  /** Per-tier maps: tier string → (pairKey → severity 0–1) */
  tiers: Record<string, Map<string, number>>;
  /** Global map (all-tier): pairKey → severity 0–1 */
  global: Map<string, number>;
  /** Total events that produced this data */
  eventCount: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert AntiPatternData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — AntiPatternData from the API (null = no data yet)
 * @returns AntiPatternLookup with O(1) pair lookups, or null if no data
 */
export function buildAntiPatternLookup(
  data: AntiPatternData | null | undefined,
): AntiPatternLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Map<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    const pairMap = new Map<string, number>();
    for (const pattern of tierData.patterns) {
      const key = `${pattern.terms[0]}|${pattern.terms[1]}`;
      pairMap.set(key, pattern.severity);
    }
    tiers[tierKey] = pairMap;
  }

  // Build global map
  const global = new Map<string, number>();
  if (data.global) {
    for (const pattern of data.global.patterns) {
      const key = `${pattern.terms[0]}|${pattern.terms[1]}`;
      global.set(key, pattern.severity);
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
 * Check if a candidate term has any anti-pattern relationships
 * with the currently selected terms.
 *
 * Returns the WORST (highest) severity found across all selected terms.
 * 0 = clean (no anti-patterns), 1.0 = extremely toxic pair.
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param candidate — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4)
 * @param lookup — Pre-built AntiPatternLookup (null = no learned data)
 * @returns Worst severity 0–1 (0 = no anti-pattern signal)
 */
export function lookupAntiPatternSeverity(
  candidate: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: AntiPatternLookup | null,
): number {
  if (!lookup || selectedTerms.length === 0) return 0;

  const tierMap = tier != null ? lookup.tiers[String(tier)] : undefined;
  let worstSeverity = 0;

  for (const selected of selectedTerms) {
    // Skip self
    if (selected === candidate) continue;

    // Build pair key (alphabetically sorted)
    const [a, b] =
      selected < candidate ? [selected, candidate] : [candidate, selected];
    const key = `${a}|${b}`;

    // Check tier-specific first, then global
    const tierSeverity = tierMap?.get(key);
    const globalSeverity = lookup.global.get(key);

    const severity = tierSeverity ?? globalSeverity ?? 0;
    if (severity > worstSeverity) {
      worstSeverity = severity;
    }
  }

  return worstSeverity;
}
