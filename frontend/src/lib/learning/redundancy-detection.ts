// src/lib/learning/redundancy-detection.ts
// ============================================================================
// SEMANTIC REDUNDANCY DETECTION — Engine
// ============================================================================
//
// Phase 7.3, Part 7.3b — Core Algorithm.
//
// Finds terms in the SAME category that users pick interchangeably:
// almost never selected together, yet producing similar outcome scores.
// These are functional synonyms — not harmful like anti-patterns, just
// wasteful (one is usually enough).
//
// Example: In the `lighting` category, "cinematic lighting" and
// "dramatic lighting" are both selected frequently but almost never
// together. When either appears, the copy rate is ~75%. They're
// semantically redundant — one is usually enough.
//
// Detection method: mutual exclusivity × outcome similarity.
//   soloA    = events where A is selected WITHOUT B in that category
//   soloB    = events where B is selected WITHOUT A in that category
//   together = events where BOTH A and B appear in that category
//   mutualExclusivity = 1.0 − (together / total)
//   outcomeSimilarity = 1.0 − |meanOutcomeA − meanOutcomeB|
//   redundancyScore   = mutualExclusivity × outcomeSimilarity
//
// Pairs exceeding thresholds are grouped transitively via union-find:
// if A≈B and B≈C then {A, B, C} form one redundancy group.
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 12).
//
// Uses the Phase 7.1a confidence multiplier for weighted outcome scoring.
//
// Authority: docs/authority/phase-7.3-semantic-redundancy-detection-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import type { PromptEventRow } from '@/lib/learning/database';
import {
  computeOutcomeScore,
  computeConfidenceMultiplier,
} from '@/lib/learning/outcome-score';

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A single detected redundant pair */
export interface RedundancyPair {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Shared category */
  category: string;
  /** How exclusively they avoid each other (0–1, 1 = never co-occur) */
  mutualExclusivity: number;
  /** How similar their solo outcomes are (0–1, 1 = identical) */
  outcomeSimilarity: number;
  /** Combined score: exclusivity × similarity (0–1) */
  redundancyScore: number;
  /** Solo appearances of term A */
  soloCountA: number;
  /** Solo appearances of term B */
  soloCountB: number;
  /** Co-occurrence count */
  togetherCount: number;
}

/** A group of mutually redundant terms (connected via union-find) */
export interface RedundancyGroup {
  /** Unique group ID, e.g. "rg_lighting_001" */
  id: string;
  /** Category all members share */
  category: string;
  /** Most-used term — the one to keep */
  canonical: string;
  /** All terms in the group (including canonical) */
  members: string[];
  /** Average pairwise redundancyScore */
  meanRedundancy: number;
  /** Sum of solo counts across all members */
  totalUsage: number;
  /** Underlying pair data */
  pairs: RedundancyPair[];
}

/** Per-tier redundancy data */
export interface TierRedundancyGroups {
  /** Total events analysed */
  eventCount: number;
  /** Number of redundancy groups detected */
  groupCount: number;
  /** Detected groups sorted by meanRedundancy descending */
  groups: RedundancyGroup[];
}

/** Complete output — stored in learned_weights table */
export interface RedundancyGroupsData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total groups detected across all tiers */
  totalGroups: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierRedundancyGroups>;
  /** Global (all-tier) results */
  global: TierRedundancyGroups;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** A scored event ready for processing */
interface ScoredEvent {
  evt: PromptEventRow;
  weightedOutcome: number;
}

/** Per-term accumulator within a single category */
interface CategoryTermAccumulator {
  /** Total events where this term appears (solo + together) */
  totalCount: number;
  /** Sum of weighted outcomes across all appearances */
  totalOutcomeSum: number;
  /** Per-other-term co-occurrence count within same category */
  pairCounts: Map<string, number>;
  /** Sum of weighted outcomes for events where this term co-occurs with another */
  pairOutcomeSums: Map<string, number>;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Detect redundancy groups from prompt event data.
 *
 * Algorithm:
 * 1. Compute weighted outcome for each event (outcome × confidence multiplier)
 * 2. Group events by tier
 * 3. For each tier, for each category:
 *    a. Build per-term accumulator: totalCount, totalOutcomeSum, pairCounts
 *    b. For each pair (A, B) in same category:
 *       - soloA = totalA - pairAB, soloB = totalB - pairAB, together = pairAB
 *       - Filter: soloA >= MIN_SOLO_EVENTS AND soloB >= MIN_SOLO_EVENTS
 *       - mutualExclusivity = 1.0 − (together / total)
 *       - outcomeSimilarity = 1.0 − |meanOutcomeA − meanOutcomeB|
 *       - redundancyScore = mutualExclusivity × outcomeSimilarity
 *       - Filter thresholds
 * 4. Union-find to group transitive pairs (cap at MAX_GROUP_SIZE)
 * 5. Pick canonical per group (highest solo count)
 * 6. Sort by meanRedundancy desc, trim to MAX_GROUPS_PER_TIER
 * 7. Also compute global (all-tier) groups
 *
 * @param events — ALL prompt events (no score floor — anti-pattern event set)
 * @param referenceDate — "Now" for output timestamp (default: new Date())
 * @returns RedundancyGroupsData or null if insufficient data
 */
export function computeRedundancyGroups(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): RedundancyGroupsData | null {
  if (events.length === 0) return null;

  const now = referenceDate;

  // ── Step 1: Compute weighted outcomes ─────────────────────────────────
  const scoredEvents: ScoredEvent[] = events.map((evt) => ({
    evt,
    weightedOutcome: computeWeightedOutcome(evt),
  }));

  // ── Step 2: Group by tier ─────────────────────────────────────────────
  const tierGroups = new Map<number, ScoredEvent[]>();
  for (const item of scoredEvents) {
    const tier = item.evt.tier;
    let group = tierGroups.get(tier);
    if (!group) {
      group = [];
      tierGroups.set(tier, group);
    }
    group.push(item);
  }

  // ── Step 3: Process each tier ─────────────────────────────────────────
  const tiers: Record<string, TierRedundancyGroups> = {};
  let totalGroups = 0;

  for (const [tier, tierItems] of tierGroups) {
    const tierResult = computeTierRedundancy(tierItems, String(tier));
    tiers[String(tier)] = tierResult;
    totalGroups += tierResult.groupCount;
  }

  // ── Step 4: Compute global (all-tier) groups ──────────────────────────
  const globalResult = computeTierRedundancy(scoredEvents, 'global');
  totalGroups += globalResult.groupCount;

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventCount: events.length,
    totalGroups,
    tiers,
    global: globalResult,
  };
}

// ============================================================================
// PER-TIER COMPUTATION
// ============================================================================

/**
 * Compute redundancy groups for a single group of scored events.
 *
 * Two-pass approach per category:
 * 1. Build per-term accumulators (totalCount, totalOutcomeSum, pairCounts)
 * 2. Evaluate each within-category pair for redundancy
 * 3. Union-find to form transitive groups
 */
function computeTierRedundancy(
  scoredEvents: ScoredEvent[],
  tierLabel: string,
): TierRedundancyGroups {
  const C = LEARNING_CONSTANTS;
  const eventCount = scoredEvents.length;

  if (eventCount === 0) {
    return { eventCount: 0, groupCount: 0, groups: [] };
  }

  // ── Build per-category, per-term accumulators ───────────────────────
  // category → term → accumulator
  const categoryTerms = new Map<string, Map<string, CategoryTermAccumulator>>();

  for (const { evt, weightedOutcome } of scoredEvents) {
    // For each category in this event's selections
    for (const [category, values] of Object.entries(evt.selections)) {
      if (!Array.isArray(values)) continue;

      // Get unique, non-empty terms in this category for this event
      const terms = values.filter((v) => typeof v === 'string' && v.length > 0);
      const uniqueTerms = [...new Set(terms)];
      if (uniqueTerms.length === 0) continue;

      // Ensure category map exists
      let termMap = categoryTerms.get(category);
      if (!termMap) {
        termMap = new Map<string, CategoryTermAccumulator>();
        categoryTerms.set(category, termMap);
      }

      // Accumulate per-term totals
      for (const term of uniqueTerms) {
        let acc = termMap.get(term);
        if (!acc) {
          acc = {
            totalCount: 0,
            totalOutcomeSum: 0,
            pairCounts: new Map(),
            pairOutcomeSums: new Map(),
          };
          termMap.set(term, acc);
        }
        acc.totalCount += 1;
        acc.totalOutcomeSum += weightedOutcome;

        // Accumulate pairwise co-occurrence within this category
        for (const otherTerm of uniqueTerms) {
          if (otherTerm === term) continue;
          acc.pairCounts.set(otherTerm, (acc.pairCounts.get(otherTerm) ?? 0) + 1);
          acc.pairOutcomeSums.set(
            otherTerm,
            (acc.pairOutcomeSums.get(otherTerm) ?? 0) + weightedOutcome,
          );
        }
      }
    }
  }

  // ── Detect redundant pairs ──────────────────────────────────────────
  const allPairs: RedundancyPair[] = [];
  const processedPairKeys = new Set<string>();

  for (const [category, termMap] of categoryTerms) {
    const termEntries = [...termMap.entries()];

    for (let i = 0; i < termEntries.length; i++) {
      const [termA, accA] = termEntries[i]!;

      for (let j = i + 1; j < termEntries.length; j++) {
        const [termB, accB] = termEntries[j]!;

        // Alphabetical sort for consistent pair key
        const [first, second] = termA < termB ? [termA, termB] : [termB, termA];
        const pairKey = `${category}|${first}|${second}`;

        // Skip if already processed (shouldn't happen within a category, but safety)
        if (processedPairKeys.has(pairKey)) continue;
        processedPairKeys.add(pairKey);

        // Co-occurrence count (symmetric — use A's count of B)
        const togetherCount = accA.pairCounts.get(termB) ?? 0;

        // Solo counts
        const soloCountA = accA.totalCount - togetherCount;
        const soloCountB = accB.totalCount - togetherCount;

        // Filter: both terms need enough solo appearances
        if (soloCountA < C.REDUNDANCY_MIN_SOLO_EVENTS) continue;
        if (soloCountB < C.REDUNDANCY_MIN_SOLO_EVENTS) continue;

        // Total events involving either or both terms
        const total = soloCountA + soloCountB + togetherCount;
        if (total === 0) continue;

        // ── Mutual exclusivity ────────────────────────────────────
        const mutualExclusivity = 1.0 - togetherCount / total;
        if (mutualExclusivity < C.REDUNDANCY_MIN_MUTUAL_EXCLUSIVITY) continue;

        // ── Outcome similarity ────────────────────────────────────
        // Solo outcome = (total outcome - together outcome) / solo count
        const togetherOutcomeSumA = accA.pairOutcomeSums.get(termB) ?? 0;
        const togetherOutcomeSumB = accB.pairOutcomeSums.get(termA) ?? 0;

        const soloOutcomeA =
          soloCountA > 0 ? (accA.totalOutcomeSum - togetherOutcomeSumA) / soloCountA : 0;
        const soloOutcomeB =
          soloCountB > 0 ? (accB.totalOutcomeSum - togetherOutcomeSumB) / soloCountB : 0;

        const outcomeSimilarity = 1.0 - Math.abs(soloOutcomeA - soloOutcomeB);
        if (outcomeSimilarity < C.REDUNDANCY_MIN_OUTCOME_SIMILARITY) continue;

        // ── Combined redundancy score ─────────────────────────────
        const redundancyScore = mutualExclusivity * outcomeSimilarity;
        if (redundancyScore < C.REDUNDANCY_MIN_SCORE) continue;

        allPairs.push({
          terms: [first, second],
          category,
          mutualExclusivity: round4(mutualExclusivity),
          outcomeSimilarity: round4(outcomeSimilarity),
          redundancyScore: round4(redundancyScore),
          soloCountA: first === termA ? soloCountA : soloCountB,
          soloCountB: first === termA ? soloCountB : soloCountA,
          togetherCount,
        });
      }
    }
  }

  if (allPairs.length === 0) {
    return { eventCount, groupCount: 0, groups: [] };
  }

  // ── Union-find grouping ─────────────────────────────────────────────
  const groups = buildGroups(allPairs, tierLabel);

  // ── Sort by meanRedundancy descending, trim to cap ──────────────────
  groups.sort((a, b) => b.meanRedundancy - a.meanRedundancy || b.totalUsage - a.totalUsage);
  const trimmed = groups.slice(0, C.REDUNDANCY_MAX_GROUPS_PER_TIER);

  return {
    eventCount,
    groupCount: trimmed.length,
    groups: trimmed,
  };
}

// ============================================================================
// UNION-FIND GROUPING
// ============================================================================

/**
 * Group redundant pairs transitively using union-find.
 *
 * If A≈B and B≈C, they form one group {A, B, C}.
 * Groups are capped at MAX_GROUP_SIZE to prevent runaway merging.
 *
 * For each group:
 * - canonical = term with highest solo count
 * - meanRedundancy = average redundancyScore across all pairs in the group
 * - totalUsage = sum of solo counts across all members
 */
function buildGroups(
  pairs: RedundancyPair[],
  tierLabel: string,
): RedundancyGroup[] {
  const C = LEARNING_CONSTANTS;

  // ── Union-find data structure ───────────────────────────────────────
  // term → parent (self if root)
  const parent = new Map<string, string>();
  // root → group size
  const size = new Map<string, number>();

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x);
      size.set(x, 1);
    }
    // Path compression
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Compress path
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): boolean {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return true; // Already same group

    const sizeA = size.get(rootA) ?? 1;
    const sizeB = size.get(rootB) ?? 1;

    // Cap: don't merge if combined exceeds max
    if (sizeA + sizeB > C.REDUNDANCY_MAX_GROUP_SIZE) return false;

    // Union by size (attach smaller to larger)
    if (sizeA >= sizeB) {
      parent.set(rootB, rootA);
      size.set(rootA, sizeA + sizeB);
    } else {
      parent.set(rootA, rootB);
      size.set(rootB, sizeA + sizeB);
    }
    return true;
  }

  // ── Build union-find from pairs ─────────────────────────────────────
  // Track per-term solo count for canonical selection
  const termSoloCount = new Map<string, number>();
  // Track which category each term belongs to
  const termCategory = new Map<string, string>();

  for (const pair of pairs) {
    const [termA, termB] = pair.terms;

    // Initialise terms in union-find
    find(termA);
    find(termB);

    // Try to merge
    union(termA, termB);

    // Track solo counts (accumulate across pairs — same term may appear
    // in multiple pairs, but its solo count is per-pair, so we take the max)
    const currentA = termSoloCount.get(termA) ?? 0;
    termSoloCount.set(termA, Math.max(currentA, pair.soloCountA));

    const currentB = termSoloCount.get(termB) ?? 0;
    termSoloCount.set(termB, Math.max(currentB, pair.soloCountB));

    // Track category
    termCategory.set(termA, pair.category);
    termCategory.set(termB, pair.category);
  }

  // ── Collect groups by root ──────────────────────────────────────────
  const rootToMembers = new Map<string, string[]>();
  for (const term of parent.keys()) {
    const root = find(term);
    let members = rootToMembers.get(root);
    if (!members) {
      members = [];
      rootToMembers.set(root, members);
    }
    members.push(term);
  }

  // ── Build RedundancyGroup for each root with 2+ members ─────────────
  const groups: RedundancyGroup[] = [];
  // Category-level counter for group IDs
  const categoryCounter = new Map<string, number>();

  for (const [, members] of rootToMembers) {
    if (members.length < 2) continue;

    // Determine category (all members share it)
    const category = termCategory.get(members[0]!) ?? 'unknown';

    // Find pairs that belong to this group
    const memberSet = new Set(members);
    const groupPairs = pairs.filter(
      (p) => memberSet.has(p.terms[0]) && memberSet.has(p.terms[1]),
    );

    if (groupPairs.length === 0) continue;

    // Canonical = highest solo count
    const sortedMembers = [...members].sort(
      (a, b) => (termSoloCount.get(b) ?? 0) - (termSoloCount.get(a) ?? 0),
    );
    const canonical = sortedMembers[0]!;

    // Mean redundancy
    const meanRedundancy = round4(
      groupPairs.reduce((sum, p) => sum + p.redundancyScore, 0) / groupPairs.length,
    );

    // Total usage
    const totalUsage = members.reduce((sum, m) => sum + (termSoloCount.get(m) ?? 0), 0);

    // Generate group ID
    const catCount = (categoryCounter.get(category) ?? 0) + 1;
    categoryCounter.set(category, catCount);
    const id = `rg_${sanitiseForId(category)}_${tierLabel}_${String(catCount).padStart(3, '0')}`;

    groups.push({
      id,
      category,
      canonical,
      members: sortedMembers, // sorted by usage descending (canonical first)
      meanRedundancy,
      totalUsage,
      pairs: groupPairs,
    });
  }

  return groups;
}

// ============================================================================
// WEIGHTED OUTCOME
// ============================================================================

/**
 * Compute a single weighted outcome score for an event.
 *
 * Formula: computeOutcomeScore(outcome) × computeConfidenceMultiplier(context)
 *
 * Same as anti-pattern-detection.ts — shared logic, duplicated to keep
 * each module self-contained (no cross-import between sibling engines).
 */
function computeWeightedOutcome(evt: PromptEventRow): number {
  const rawOutcome = computeOutcomeScore(evt.outcome);
  const confidence = computeConfidenceMultiplier({
    userTier: evt.user_tier ?? null,
    accountAgeDays: evt.account_age_days ?? null,
    categoryCount: evt.category_count,
  });
  return rawOutcome * confidence;
}

// ============================================================================
// UTILITY
// ============================================================================

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Sanitise a category name for use in a group ID (lowercase, replace spaces with dashes). */
function sanitiseForId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
