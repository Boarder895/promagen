// src/lib/learning/collision-lookup.ts
// ============================================================================
// NEGATIVE PATTERN LEARNING — Collision Lookup
// ============================================================================
//
// Phase 7.1, Part 7.1d — Real-time Integration Bridge.
//
// Bridge between the raw CollisionMatrixData (from nightly cron Layer 10) and
// the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildCollisionLookup() — converts data → fast Map for O(1) pair lookups
// 2. lookupCollision() — returns collision info for a candidate + selected terms
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

import type { CollisionMatrixData, TermCollision } from '@/lib/learning/collision-matrix';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Lightweight collision record stored in the lookup Map.
 * Subset of TermCollision — only what the suggestion engine needs.
 */
export interface CollisionEntry {
  /** Competition score 0–1 */
  competitionScore: number;
  /** The weaker term in the pair (suggest removing this one) */
  weakerTerm: string;
  /** Quality delta for display */
  qualityDelta: number;
}

/**
 * Fast lookup structure for collision data.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Key format: "termA|termB" (alphabetically sorted).
 * Value: CollisionEntry.
 */
export interface CollisionLookup {
  /** Per-tier maps: tier string → (pairKey → CollisionEntry) */
  tiers: Record<string, Map<string, CollisionEntry>>;
  /** Global map (all-tier): pairKey → CollisionEntry */
  global: Map<string, CollisionEntry>;
  /** Total events that produced this data */
  eventCount: number;
}

/**
 * Result of a collision lookup for a single candidate term.
 * Null if no collision found.
 */
export interface CollisionResult {
  /** The selected term that collides with the candidate */
  collidingTerm: string;
  /** Competition score 0–1 */
  competitionScore: number;
  /** The weaker term in the pair (suggest removing this one) */
  weakerTerm: string;
  /** Quality delta */
  qualityDelta: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert CollisionMatrixData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — CollisionMatrixData from the API (null = no data yet)
 * @returns CollisionLookup with O(1) pair lookups, or null if no data
 */
export function buildCollisionLookup(
  data: CollisionMatrixData | null | undefined,
): CollisionLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Map<string, CollisionEntry>> = {};

  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    const pairMap = new Map<string, CollisionEntry>();
    for (const collision of tierData.collisions) {
      const key = `${collision.terms[0]}|${collision.terms[1]}`;
      pairMap.set(key, toEntry(collision));
    }
    tiers[tierKey] = pairMap;
  }

  // Build global map
  const global = new Map<string, CollisionEntry>();
  if (data.global) {
    for (const collision of data.global.collisions) {
      const key = `${collision.terms[0]}|${collision.terms[1]}`;
      global.set(key, toEntry(collision));
    }
  }

  return {
    tiers,
    global,
    eventCount: data.eventCount,
  };
}

/** Extract the fields the suggestion engine needs from a full TermCollision. */
function toEntry(c: TermCollision): CollisionEntry {
  return {
    competitionScore: c.competitionScore,
    weakerTerm: c.weakerTerm,
    qualityDelta: c.qualityDelta,
  };
}

// ============================================================================
// LOOKUP
// ============================================================================

/**
 * Check if a candidate term collides with any currently selected terms.
 *
 * Returns the WORST (highest competitionScore) collision found,
 * or null if no collision exists.
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param candidate — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4)
 * @param lookup — Pre-built CollisionLookup (null = no learned data)
 * @returns Worst collision result, or null if clean
 */
export function lookupCollision(
  candidate: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: CollisionLookup | null,
): CollisionResult | null {
  if (!lookup || selectedTerms.length === 0) return null;

  const tierMap = tier != null ? lookup.tiers[String(tier)] : undefined;
  let worstResult: CollisionResult | null = null;

  for (const selected of selectedTerms) {
    // Skip self
    if (selected === candidate) continue;

    // Build pair key (alphabetically sorted)
    const [a, b] =
      selected < candidate ? [selected, candidate] : [candidate, selected];
    const key = `${a}|${b}`;

    // Check tier-specific first, then global
    const entry = tierMap?.get(key) ?? lookup.global.get(key);

    if (entry && (worstResult === null || entry.competitionScore > worstResult.competitionScore)) {
      worstResult = {
        collidingTerm: selected,
        competitionScore: entry.competitionScore,
        weakerTerm: entry.weakerTerm,
        qualityDelta: entry.qualityDelta,
      };
    }
  }

  return worstResult;
}
