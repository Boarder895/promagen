// src/lib/learning/redundancy-lookup.ts
// ============================================================================
// SEMANTIC REDUNDANCY DETECTION — Lookup
// ============================================================================
//
// Phase 7.3, Part 7.3c — Real-time Integration Bridge.
//
// Bridge between the raw RedundancyGroupsData (from nightly cron Layer 12)
// and the suggestion engine's per-option scoring pipeline.
//
// Provides:
// 1. buildRedundancyLookup() — converts data → fast Maps for O(1) lookups
// 2. lookupRedundancy()      — quick score: is this option redundant with
//                               any selected term? Returns 0–1.
// 3. lookupRedundancyInfo()  — full info: which term, what group, canonical
//
// Same pattern as collision-lookup.ts (Phase 7.1) and weak-term-lookup.ts
// (Phase 7.2).
//
// Key distinction from collisions: collisions detect terms that HURT each
// other when combined (quality drops). Redundancy detects terms that are
// FUNCTIONALLY IDENTICAL (quality stays the same — they just waste slots).
//
// Pure functions — no I/O, no side effects.
//
// Authority: docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Full info about a redundancy match for a candidate term.
 * Returned by lookupRedundancyInfo() for conflict messages.
 */
export interface RedundancyInfo {
  /** Group-level redundancy score (0–1) */
  redundancyScore: number;
  /** The selected term the candidate overlaps with */
  redundantWith: string;
  /** The preferred (most-used) term in the group */
  canonical: string;
  /** All terms in the redundancy group */
  groupMembers: string[];
}

/**
 * Lightweight group record stored in the groups Map.
 * Subset of RedundancyGroup — only what the scoring pipeline needs.
 */
export interface RedundancyGroupEntry {
  /** Most-used term — the one to keep */
  canonical: string;
  /** All terms in the group (including canonical) */
  members: string[];
  /** Average pairwise redundancyScore */
  meanRedundancy: number;
}

/**
 * Fast lookup structure for redundancy data.
 * Built once from nightly cron output, reused across all scoring calls.
 *
 * Two-level lookup:
 * 1. term → groupId (per-tier or global)
 * 2. groupId → group data (canonical, members, meanRedundancy)
 */
export interface RedundancyLookup {
  /** Per-tier maps: tier string → (term → groupId) */
  tiers: Record<string, Map<string, string>>;
  /** Global map (all-tier): term → groupId */
  global: Map<string, string>;
  /** groupId → group data */
  groups: Map<string, RedundancyGroupEntry>;
  /** Total events that produced this data */
  eventCount: number;
}

// ============================================================================
// BUILD LOOKUP
// ============================================================================

/**
 * Convert RedundancyGroupsData into a fast lookup structure.
 *
 * Called once when the hook fetches fresh data, then reused
 * for all scoring calls until the next fetch.
 *
 * @param data — RedundancyGroupsData from the API (null = no data yet)
 * @returns RedundancyLookup with O(1) term lookups, or null if no data
 */
export function buildRedundancyLookup(
  data: RedundancyGroupsData | null | undefined,
): RedundancyLookup | null {
  if (!data || !data.tiers) return null;

  const tiers: Record<string, Map<string, string>> = {};
  const groups = new Map<string, RedundancyGroupEntry>();

  // ── Index per-tier groups ───────────────────────────────────────────
  for (const [tierKey, tierData] of Object.entries(data.tiers)) {
    const termMap = new Map<string, string>();
    for (const group of tierData.groups) {
      // Store group data (deduplicates if same ID appears across tiers)
      groups.set(group.id, {
        canonical: group.canonical,
        members: group.members,
        meanRedundancy: group.meanRedundancy,
      });

      // Map each member term → groupId
      for (const member of group.members) {
        termMap.set(member, group.id);
      }
    }
    tiers[tierKey] = termMap;
  }

  // ── Index global groups ─────────────────────────────────────────────
  const global = new Map<string, string>();
  if (data.global) {
    for (const group of data.global.groups) {
      groups.set(group.id, {
        canonical: group.canonical,
        members: group.members,
        meanRedundancy: group.meanRedundancy,
      });

      for (const member of group.members) {
        global.set(member, group.id);
      }
    }
  }

  return {
    tiers,
    global,
    groups,
    eventCount: data.eventCount,
  };
}

// ============================================================================
// QUICK SCORE LOOKUP
// ============================================================================

/**
 * Check if a candidate term is redundant with any currently selected term.
 *
 * Returns the HIGHEST meanRedundancy score found (0–1), or 0 if none.
 *
 * Logic: for each selected term, check if the candidate is in the same
 * redundancy group. If yes, return the group's meanRedundancy.
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param option — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built RedundancyLookup (null = no learned data)
 * @returns Highest redundancy score 0–1 (0 = no redundancy / no data)
 */
export function lookupRedundancy(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: RedundancyLookup | null,
): number {
  if (!lookup || selectedTerms.length === 0) return 0;

  const info = lookupRedundancyInfo(option, selectedTerms, tier, lookup);
  return info?.redundancyScore ?? 0;
}

// ============================================================================
// FULL INFO LOOKUP
// ============================================================================

/**
 * Full redundancy lookup for a candidate term against selected terms.
 *
 * Returns info about the WORST (highest redundancyScore) match found,
 * including which selected term overlaps and what the canonical term is.
 *
 * Returns null if no redundancy found.
 *
 * Checks tier-specific map first, falls back to global map.
 *
 * @param option — The dropdown option being scored
 * @param selectedTerms — All currently selected terms across all categories
 * @param tier — Platform tier (1–4), null = global only
 * @param lookup — Pre-built RedundancyLookup (null = no learned data)
 * @returns RedundancyInfo or null if no redundancy / no data
 */
export function lookupRedundancyInfo(
  option: string,
  selectedTerms: string[],
  tier: number | null,
  lookup: RedundancyLookup | null,
): RedundancyInfo | null {
  if (!lookup || selectedTerms.length === 0) return null;

  const tierMap = tier != null ? lookup.tiers[String(tier)] : undefined;
  let worstResult: RedundancyInfo | null = null;

  // Resolve the candidate's group ID (tier-first → global fallback)
  const optionGroupId = tierMap?.get(option) ?? lookup.global.get(option);
  if (!optionGroupId) return null;

  // Get the group data
  const groupData = lookup.groups.get(optionGroupId);
  if (!groupData) return null;

  // Check if any selected term is in the same group
  for (const selected of selectedTerms) {
    // Skip self
    if (selected === option) continue;

    // Resolve the selected term's group ID (tier-first → global fallback)
    const selectedGroupId = tierMap?.get(selected) ?? lookup.global.get(selected);

    // Same group? → redundancy detected
    if (selectedGroupId === optionGroupId) {
      const score = groupData.meanRedundancy;

      if (worstResult === null || score > worstResult.redundancyScore) {
        worstResult = {
          redundancyScore: score,
          redundantWith: selected,
          canonical: groupData.canonical,
          groupMembers: groupData.members,
        };
      }
    }
  }

  return worstResult;
}
