// src/lib/learning/combo-lookup.ts
// ============================================================================
// HIGHER-ORDER COMBINATIONS — Combo Lookup
// ============================================================================
//
// Phase 7.4, Part 7.4c — Real-time Integration Bridge.
//
// Bridge between the raw MagicCombosData (from nightly cron Layer 13)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildComboLookup()  — converts data → fast Maps for O(1) lookups
// 2. lookupComboBoost()  — quick score: does adding this option complete
//                          (or nearly complete) a magic combo? Returns 0–1.
// 3. lookupComboInfo()   — full info: which combo, what synergy, missing terms
//
// Same pattern as redundancy-lookup.ts (Phase 7.3) and collision-lookup.ts
// (Phase 7.1).
//
// Key concept: "You're one term away from a proven winning combination."
// When the user has selected N-1 of N terms in a combo and this option is
// the missing Nth term → full boost (synergyScore).
// When N-2 of N are selected and this is the (N-1)th → partial boost (× 0.5).
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/phase-7.4-magic-combos-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { MagicCombosData } from '@/lib/learning/magic-combo-mining';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Full info about a combo match for a candidate term.
 * Returned by lookupComboInfo() for boost messages / UI hints.
 */
export interface ComboMatchInfo {
  /** Boost strength 0–1 (normalised synergy × completeness) */
  boostScore: number;
  /** The combo this option would contribute to */
  combo: ComboEntry;
  /** Terms already selected from this combo */
  selectedTerms: string[];
  /** Terms still missing (excluding the candidate) */
  missingTerms: string[];
  /** How close the user is: 1.0 = this option completes, 0.5 = one more needed */
  completeness: number;
}

/**
 * Lightweight combo record stored in the lookup.
 * Subset of MagicCombo — only what the scoring pipeline needs.
 */
export interface ComboEntry {
  /** Sorted term array (3 or 4 terms) */
  terms: string[];
  /** Combo size: 3 or 4 */
  size: number;
  /** Synergy score from the mining engine (0–1 range typically) */
  synergyScore: number;
  /** Categories the combo spans */
  categories: string[];
}

/**
 * Fast lookup structure for magic combo data.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Single-level lookup: term → list of combos containing that term.
 * Per-tier + global, with tier-first fallback.
 */
export interface ComboLookup {
  /** Per-tier maps: tier string → (term → combo indices) */
  tiers: Record<string, Map<string, number[]>>;
  /** Global map: term → combo indices */
  global: Map<string, number[]>;
  /** All combos (flat array, referenced by index) */
  combos: ComboEntry[];
  /** Total events that produced this data */
  eventCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Boost multiplier by completeness level.
 * - 1.0 completeness (option finishes the combo): full synergy
 * - 0.5 completeness (one more term needed after this): half synergy
 * - Below that: no boost (too far from completion)
 */
const COMPLETENESS_MULTIPLIER: Record<string, number> = {
  '1': 1.0,   // Option completes the combo
  '0.5': 0.5, // One more term needed after this option
};

/**
 * Minimum completeness to qualify for a boost.
 * For trios: need 2 of 3 selected (this is the 3rd) → completeness 1.0
 *   or need 1 of 3 selected (this is 2nd, 1 more needed) → completeness 0.5
 * For quads: need 3 of 4 selected → 1.0, or 2 of 4 selected → 0.5
 */
const MIN_COMPLETENESS = 0.5;

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert MagicCombosData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — MagicCombosData from the API (null = no data yet)
 * @returns ComboLookup with O(1) term lookups, or null if no data
 */
export function buildComboLookup(
  data: MagicCombosData | null | undefined,
): ComboLookup | null {
  if (!data || !data.tiers) return null;

  const combos: ComboEntry[] = [];
  const tiers: Record<string, Map<string, number[]>> = {};

  // ── Index per-tier combos ──────────────────────────────────────────
  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    const termMap = new Map<string, number[]>();

    for (const combo of tierData.combos) {
      const idx = combos.length;
      combos.push({
        terms: combo.terms,
        size: combo.size,
        synergyScore: combo.synergyScore,
        categories: combo.categories,
      });

      // Map each term → combo index
      for (const term of combo.terms) {
        let indices = termMap.get(term);
        if (!indices) {
          indices = [];
          termMap.set(term, indices);
        }
        indices.push(idx);
      }
    }

    tiers[tierKey] = termMap;
  }

  // ── Index global combos ────────────────────────────────────────────
  const global = new Map<string, number[]>();
  if (data.global) {
    for (const combo of data.global.combos) {
      const idx = combos.length;
      combos.push({
        terms: combo.terms,
        size: combo.size,
        synergyScore: combo.synergyScore,
        categories: combo.categories,
      });

      for (const term of combo.terms) {
        let indices = global.get(term);
        if (!indices) {
          indices = [];
          global.set(term, indices);
        }
        indices.push(idx);
      }
    }
  }

  if (combos.length === 0) return null;

  return {
    tiers,
    global,
    combos,
    eventCount: data.eventCount,
  };
}

// ============================================================================
// QUICK SCORE LOOKUP
// ============================================================================

/**
 * Check if adding a candidate term would complete or nearly complete
 * a magic combo given the currently selected terms.
 *
 * Returns the HIGHEST boost score found (0–1), or 0 if no match.
 *
 * Logic: for each combo containing the candidate term, check how many
 * other combo terms are already selected:
 * - All others selected → completeness 1.0 (this option finishes it)
 * - All but 1 selected → completeness 0.5 (one more needed after this)
 * - Below that → skip (too far from completion)
 *
 * Boost = synergyScore × completeness multiplier, capped at 1.0.
 *
 * Checks tier-specific combos first, then global combos.
 *
 * @param option — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built ComboLookup (null = no learned data)
 * @returns Highest boost score 0–1 (0 = no combo match / no data)
 */
export function lookupComboBoost(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: ComboLookup | null,
): number {
  if (!lookup || selectedTerms.length === 0) return 0;

  const info = lookupComboInfo(option, selectedTerms, tier, lookup);
  return info?.boostScore ?? 0;
}

// ============================================================================
// FULL INFO LOOKUP
// ============================================================================

/**
 * Full combo lookup for a candidate term against selected terms.
 *
 * Returns info about the BEST (highest boostScore) match found,
 * including the combo, selected terms, missing terms, and completeness.
 *
 * Returns null if no qualifying combo match found.
 *
 * Checks tier-specific combos first, then global combos.
 *
 * @param option — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built ComboLookup (null = no learned data)
 * @returns ComboMatchInfo or null if no match / no data
 */
export function lookupComboInfo(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: ComboLookup | null,
): ComboMatchInfo | null {
  if (!lookup || selectedTerms.length === 0) return null;

  const selectedSet = new Set(selectedTerms);

  // Don't boost if already selected (shouldn't happen, but defensive)
  if (selectedSet.has(option)) return null;

  let bestResult: ComboMatchInfo | null = null;

  // Collect combo indices to check: tier-first, then global
  const indicesToCheck: number[] = [];
  const seen = new Set<number>();

  // Tier-specific combos first
  if (tier != null) {
    const tierMap = lookup.tiers[String(tier)];
    if (tierMap) {
      const tierIndices = tierMap.get(option);
      if (tierIndices) {
        for (const idx of tierIndices) {
          if (!seen.has(idx)) {
            seen.add(idx);
            indicesToCheck.push(idx);
          }
        }
      }
    }
  }

  // Global combos (fallback / additional)
  const globalIndices = lookup.global.get(option);
  if (globalIndices) {
    for (const idx of globalIndices) {
      if (!seen.has(idx)) {
        seen.add(idx);
        indicesToCheck.push(idx);
      }
    }
  }

  // Evaluate each candidate combo
  for (const idx of indicesToCheck) {
    const combo = lookup.combos[idx];
    if (!combo) continue;

    // Count how many OTHER combo terms are already selected
    const selectedFromCombo: string[] = [];
    const missingFromCombo: string[] = [];

    for (const term of combo.terms) {
      if (term === option) continue; // Skip the candidate itself

      if (selectedSet.has(term)) {
        selectedFromCombo.push(term);
      } else {
        missingFromCombo.push(term);
      }
    }

    // Completeness: how close to finishing?
    // combo.size - 1 = other terms needed besides the candidate
    const othersNeeded = combo.size - 1;
    const othersPresent = selectedFromCombo.length;

    // completeness = 1.0 if all others present (this finishes it)
    // completeness = 0.5 if all but 1 present (one more needed)
    let completeness: number;
    if (othersPresent === othersNeeded) {
      completeness = 1.0;
    } else if (othersPresent === othersNeeded - 1) {
      completeness = 0.5;
    } else {
      continue; // Too far from completion — skip
    }

    if (completeness < MIN_COMPLETENESS) continue;

    // Look up multiplier
    const multiplier = COMPLETENESS_MULTIPLIER[String(completeness)] ?? 0;
    if (multiplier === 0) continue;

    // Boost = synergy × completeness multiplier, capped at 1.0
    const boostScore = round4(Math.min(1.0, combo.synergyScore * multiplier));

    if (boostScore <= 0) continue;

    if (bestResult === null || boostScore > bestResult.boostScore) {
      bestResult = {
        boostScore,
        combo,
        selectedTerms: selectedFromCombo,
        missingTerms: missingFromCombo,
        completeness,
      };
    }
  }

  return bestResult;
}

// ============================================================================
// UTILITY
// ============================================================================

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
