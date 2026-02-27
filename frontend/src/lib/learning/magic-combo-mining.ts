// src/lib/learning/magic-combo-mining.ts
// ============================================================================
// HIGHER-ORDER COMBINATIONS — Magic Combo Mining Engine
// ============================================================================
//
// Phase 7.4, Part 7.4b — Core Algorithm.
//
// Discovers trios and quads of terms with emergent synergy: the full
// combination produces better outcomes than any subset. Uses level-wise
// Apriori mining to efficiently prune the search space.
//
// Example: "oil painting" + "golden hour" + "impasto texture" → 93% outcome.
// No pair alone predicts this — it's the specific trio that works.
//
// Detection method: frequent itemset mining + synergy scoring.
//   Level 1: Frequent terms (min frequency filter)
//   Level 2: Frequent pairs (min support + Apriori property)
//   Level 3: Candidate trios (all sub-pairs must be frequent, synergy check)
//   Level 4: Candidate quads (all sub-trios must be frequent, synergy check)
//
// synergyScore = comboMeanOutcome − bestSubsetMeanOutcome
//   For trios: bestSubset = best pair outcome
//   For quads: bestSubset = best trio outcome
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 13).
//
// Uses the Phase 7.1a confidence multiplier for weighted outcome scoring.
//
// Authority: docs/authority/phase-7.4-magic-combos-buildplan.md § 5
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';
import type { PromptEventRow } from '@/lib/learning/database';
import { flattenSelections } from '@/lib/learning/decay';
import {
  computeOutcomeScore,
  computeConfidenceMultiplier,
} from '@/lib/learning/outcome-score';

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** A single magic combo (trio or quad) */
export interface MagicCombo {
  /** Sorted term array (3 or 4 terms) */
  terms: string[];
  /** Combo size: 3 (trio) or 4 (quad) */
  size: number;
  /** Mean weighted outcome when all terms present */
  meanOutcome: number;
  /** Best subset outcome (best pair for trios, best trio for quads) */
  bestSubsetOutcome: number;
  /** Synergy = meanOutcome − bestSubsetOutcome (positive = emergent value) */
  synergyScore: number;
  /** How many events contained the full combo */
  support: number;
  /** Categories represented in the combo (deduced from events) */
  categories: string[];
}

/** Per-tier slice of magic combos */
export interface TierMagicCombos {
  /** Total events analysed */
  eventCount: number;
  /** Total combos discovered */
  comboCount: number;
  /** Trio count */
  trioCount: number;
  /** Quad count */
  quadCount: number;
  /** Detected combos sorted by synergyScore descending */
  combos: MagicCombo[];
}

/** Complete output — stored in learned_weights table */
export interface MagicCombosData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total combos detected across all tiers */
  totalCombos: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierMagicCombos>;
  /** Global (all-tier) results */
  global: TierMagicCombos;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** A scored event with flattened terms ready for mining */
interface MinableEvent {
  /** Set of all terms in this event (for fast membership checks) */
  termSet: Set<string>;
  /** Weighted outcome for this event */
  weightedOutcome: number;
  /** Original event selections (for category extraction) */
  selections: Record<string, string[]>;
}

/** Accumulator for combo support and outcome stats */
interface ComboAccumulator {
  /** Number of events containing all combo terms */
  support: number;
  /** Sum of weighted outcomes for those events */
  outcomeSum: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Discover magic combos (trios and quads) from prompt event data.
 *
 * Algorithm (level-wise Apriori per tier):
 * 1. Compute weighted outcome for each event
 * 2. Group events by tier
 * 3. Per tier:
 *    a. Level 1: Frequent terms (prune below MIN_TERM_FREQUENCY)
 *    b. Level 2: Frequent pairs (prune below MIN_PAIR_SUPPORT)
 *    c. Level 3: Candidate trios (Apriori join on frequent pairs, synergy filter)
 *    d. Level 4: Candidate quads (Apriori join on frequent trios, synergy filter)
 * 4. Sort by synergyScore desc, trim to MAX_PER_TIER
 * 5. Also compute global (all-tier) combos
 *
 * @param events — ALL prompt events (no score floor — anti-pattern event set)
 * @param referenceDate — "Now" for output timestamp (default: new Date())
 * @returns MagicCombosData or null if insufficient data
 */
export function computeMagicCombos(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): MagicCombosData | null {
  if (events.length === 0) return null;

  const now = referenceDate;

  // ── Step 1: Score events and flatten terms ───────────────────────────
  const minableEvents: MinableEvent[] = [];
  const tierGroups = new Map<number, MinableEvent[]>();

  for (const evt of events) {
    const terms = flattenSelections(evt.selections);
    if (terms.length < 2) continue;

    const minable: MinableEvent = {
      termSet: new Set(terms),
      weightedOutcome: computeWeightedOutcome(evt),
      selections: evt.selections,
    };

    minableEvents.push(minable);

    // Group by tier (using the same MinableEvent — no double computation)
    const tier = evt.tier;
    let group = tierGroups.get(tier);
    if (!group) {
      group = [];
      tierGroups.set(tier, group);
    }
    group.push(minable);
  }

  if (minableEvents.length === 0) return null;

  // ── Step 2: Process each tier ────────────────────────────────────────
  const tiers: Record<string, TierMagicCombos> = {};
  let totalCombos = 0;

  for (const [tier, tierItems] of tierGroups) {
    const tierResult = mineTierCombos(tierItems);
    tiers[String(tier)] = tierResult;
    totalCombos += tierResult.comboCount;
  }

  // ── Step 3: Compute global (all-tier) combos ─────────────────────────
  const globalResult = mineTierCombos(minableEvents);
  totalCombos += globalResult.comboCount;

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventCount: events.length,
    totalCombos,
    tiers,
    global: globalResult,
  };
}

// ============================================================================
// PER-TIER MINING
// ============================================================================

/**
 * Mine magic combos for a single group of events.
 *
 * Level-wise Apriori:
 * 1. Frequent terms → 2. Frequent pairs → 3. Trios → 4. Quads
 */
function mineTierCombos(events: MinableEvent[]): TierMagicCombos {
  const C = LEARNING_CONSTANTS;
  const eventCount = events.length;

  if (eventCount === 0) {
    return { eventCount: 0, comboCount: 0, trioCount: 0, quadCount: 0, combos: [] };
  }

  // ── Level 1: Frequent terms ──────────────────────────────────────────
  const termFreq = new Map<string, number>();
  for (const evt of events) {
    for (const term of evt.termSet) {
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    }
  }

  const frequentTerms: string[] = [];
  for (const [term, count] of termFreq) {
    if (count >= C.MAGIC_COMBO_MIN_TERM_FREQUENCY) {
      frequentTerms.push(term);
    }
  }

  // Sort for deterministic pair/trio generation
  frequentTerms.sort();

  if (frequentTerms.length < 3) {
    // Need at least 3 frequent terms for a trio
    return { eventCount, comboCount: 0, trioCount: 0, quadCount: 0, combos: [] };
  }

  // Build frequent term set for fast membership checks
  const frequentTermSet = new Set(frequentTerms);

  // ── Level 2: Frequent pairs ──────────────────────────────────────────
  // Count pair support and accumulate outcomes
  const pairAccumulators = new Map<string, ComboAccumulator>();

  for (const evt of events) {
    // Only consider frequent terms in this event
    const eventFreqTerms: string[] = [];
    for (const term of evt.termSet) {
      if (frequentTermSet.has(term)) {
        eventFreqTerms.push(term);
      }
    }

    if (eventFreqTerms.length < 2) continue;
    eventFreqTerms.sort();

    // Generate 2-combinations
    for (let i = 0; i < eventFreqTerms.length; i++) {
      for (let j = i + 1; j < eventFreqTerms.length; j++) {
        const key = comboKey([eventFreqTerms[i]!, eventFreqTerms[j]!]);
        let acc = pairAccumulators.get(key);
        if (!acc) {
          acc = { support: 0, outcomeSum: 0 };
          pairAccumulators.set(key, acc);
        }
        acc.support++;
        acc.outcomeSum += evt.weightedOutcome;
      }
    }
  }

  // Filter to frequent pairs
  const frequentPairSet = new Set<string>();
  const pairOutcomes = new Map<string, number>(); // pairKey → mean outcome

  for (const [key, acc] of pairAccumulators) {
    if (acc.support >= C.MAGIC_COMBO_MIN_PAIR_SUPPORT) {
      frequentPairSet.add(key);
      pairOutcomes.set(key, acc.outcomeSum / acc.support);
    }
  }

  if (frequentPairSet.size === 0) {
    return { eventCount, comboCount: 0, trioCount: 0, quadCount: 0, combos: [] };
  }

  // ── Level 3: Candidate trios ─────────────────────────────────────────
  // Apriori join: trio (A,B,C) only if all 3 sub-pairs are frequent
  const trioCandidates = generateTrioCandidates(frequentTerms, frequentPairSet);

  // Count trio support and accumulate outcomes
  const trioAccumulators = new Map<string, ComboAccumulator>();

  for (const evt of events) {
    for (const trioKey of trioCandidates) {
      const terms = trioKey.split('|');
      if (terms.length !== 3) continue;
      if (terms.every((t) => evt.termSet.has(t))) {
        let acc = trioAccumulators.get(trioKey);
        if (!acc) {
          acc = { support: 0, outcomeSum: 0 };
          trioAccumulators.set(trioKey, acc);
        }
        acc.support++;
        acc.outcomeSum += evt.weightedOutcome;
      }
    }
  }

  // Evaluate trios for synergy
  const combos: MagicCombo[] = [];
  const frequentTrioSet = new Set<string>();

  for (const [trioKey, acc] of trioAccumulators) {
    if (acc.support < C.MAGIC_COMBO_MIN_SUPPORT) continue;

    const terms = trioKey.split('|');
    if (terms.length !== 3) continue;

    const trioMeanOutcome = acc.outcomeSum / acc.support;

    // Best pair subset outcome
    const pairKeys = [
      comboKey([terms[0]!, terms[1]!]),
      comboKey([terms[0]!, terms[2]!]),
      comboKey([terms[1]!, terms[2]!]),
    ];
    const bestPairOutcome = Math.max(
      ...pairKeys.map((k) => pairOutcomes.get(k) ?? 0),
    );

    const synergyScore = round4(trioMeanOutcome - bestPairOutcome);

    if (synergyScore >= C.MAGIC_COMBO_MIN_SYNERGY) {
      frequentTrioSet.add(trioKey);
      combos.push({
        terms: [...terms],
        size: 3,
        meanOutcome: round4(trioMeanOutcome),
        bestSubsetOutcome: round4(bestPairOutcome),
        synergyScore,
        support: acc.support,
        categories: extractCategories(terms, events),
      });
    }
  }

  // ── Level 4: Candidate quads (optional) ──────────────────────────────
  if (C.MAGIC_COMBO_MAX_SIZE >= 4 && frequentTrioSet.size > 0) {
    const quadCandidates = generateQuadCandidates(
      frequentTerms,
      frequentPairSet,
      frequentTrioSet,
    );

    // Build trio outcomes map for synergy calculation
    const trioOutcomes = new Map<string, number>();
    for (const [key, acc] of trioAccumulators) {
      if (acc.support >= C.MAGIC_COMBO_MIN_SUPPORT) {
        trioOutcomes.set(key, acc.outcomeSum / acc.support);
      }
    }

    // Count quad support
    const quadAccumulators = new Map<string, ComboAccumulator>();

    for (const evt of events) {
      for (const quadKey of quadCandidates) {
        const terms = quadKey.split('|');
        if (terms.length !== 4) continue;
        if (terms.every((t) => evt.termSet.has(t))) {
          let acc = quadAccumulators.get(quadKey);
          if (!acc) {
            acc = { support: 0, outcomeSum: 0 };
            quadAccumulators.set(quadKey, acc);
          }
          acc.support++;
          acc.outcomeSum += evt.weightedOutcome;
        }
      }
    }

    // Evaluate quads for synergy
    for (const [quadKey, acc] of quadAccumulators) {
      if (acc.support < C.MAGIC_COMBO_MIN_SUPPORT) continue;

      const terms = quadKey.split('|');
      if (terms.length !== 4) continue;

      const quadMeanOutcome = acc.outcomeSum / acc.support;

      // Best trio subset outcome (4 possible trios)
      const trioKeys = [
        comboKey([terms[0]!, terms[1]!, terms[2]!]),
        comboKey([terms[0]!, terms[1]!, terms[3]!]),
        comboKey([terms[0]!, terms[2]!, terms[3]!]),
        comboKey([terms[1]!, terms[2]!, terms[3]!]),
      ];
      const bestTrioOutcome = Math.max(
        ...trioKeys.map((k) => trioOutcomes.get(k) ?? 0),
      );

      const synergyScore = round4(quadMeanOutcome - bestTrioOutcome);

      if (synergyScore >= C.MAGIC_COMBO_MIN_SYNERGY) {
        combos.push({
          terms: [...terms],
          size: 4,
          meanOutcome: round4(quadMeanOutcome),
          bestSubsetOutcome: round4(bestTrioOutcome),
          synergyScore,
          support: acc.support,
          categories: extractCategories(terms, events),
        });
      }
    }
  }

  // ── Sort and trim ────────────────────────────────────────────────────
  combos.sort((a, b) => b.synergyScore - a.synergyScore);

  const trimmed = combos.slice(0, C.MAGIC_COMBO_MAX_PER_TIER);

  const trioCount = trimmed.filter((c) => c.size === 3).length;
  const quadCount = trimmed.filter((c) => c.size === 4).length;

  return {
    eventCount,
    comboCount: trimmed.length,
    trioCount,
    quadCount,
    combos: trimmed,
  };
}

// ============================================================================
// APRIORI CANDIDATE GENERATION
// ============================================================================

/**
 * Generate trio candidates using Apriori property:
 * A trio (A,B,C) is only a candidate if all 3 sub-pairs are frequent.
 *
 * @param frequentTerms — Sorted list of frequent terms
 * @param frequentPairSet — Set of frequent pair keys ("a|b")
 * @returns Set of candidate trio keys ("a|b|c")
 */
function generateTrioCandidates(
  frequentTerms: string[],
  frequentPairSet: Set<string>,
): Set<string> {
  const candidates = new Set<string>();
  const n = frequentTerms.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pairIJ = comboKey([frequentTerms[i]!, frequentTerms[j]!]);
      if (!frequentPairSet.has(pairIJ)) continue;

      for (let k = j + 1; k < n; k++) {
        const pairIK = comboKey([frequentTerms[i]!, frequentTerms[k]!]);
        const pairJK = comboKey([frequentTerms[j]!, frequentTerms[k]!]);

        if (frequentPairSet.has(pairIK) && frequentPairSet.has(pairJK)) {
          candidates.add(comboKey([frequentTerms[i]!, frequentTerms[j]!, frequentTerms[k]!]));
        }
      }
    }
  }

  return candidates;
}

/**
 * Generate quad candidates using Apriori property:
 * A quad (A,B,C,D) is only a candidate if all 6 sub-pairs AND all 4 sub-trios
 * are frequent.
 *
 * @param frequentTerms — Sorted list of frequent terms
 * @param frequentPairSet — Set of frequent pair keys
 * @param frequentTrioSet — Set of frequent trio keys
 * @returns Set of candidate quad keys ("a|b|c|d")
 */
function generateQuadCandidates(
  frequentTerms: string[],
  frequentPairSet: Set<string>,
  frequentTrioSet: Set<string>,
): Set<string> {
  const candidates = new Set<string>();
  const n = frequentTerms.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!frequentPairSet.has(comboKey([frequentTerms[i]!, frequentTerms[j]!]))) continue;

      for (let k = j + 1; k < n; k++) {
        if (!frequentPairSet.has(comboKey([frequentTerms[i]!, frequentTerms[k]!]))) continue;
        if (!frequentPairSet.has(comboKey([frequentTerms[j]!, frequentTerms[k]!]))) continue;

        // Check trio IJK is frequent
        const trioIJK = comboKey([frequentTerms[i]!, frequentTerms[j]!, frequentTerms[k]!]);
        if (!frequentTrioSet.has(trioIJK)) continue;

        for (let l = k + 1; l < n; l++) {
          // Check all 3 new pairs
          if (!frequentPairSet.has(comboKey([frequentTerms[i]!, frequentTerms[l]!]))) continue;
          if (!frequentPairSet.has(comboKey([frequentTerms[j]!, frequentTerms[l]!]))) continue;
          if (!frequentPairSet.has(comboKey([frequentTerms[k]!, frequentTerms[l]!]))) continue;

          // Check all 3 new trios
          const trioIJL = comboKey([frequentTerms[i]!, frequentTerms[j]!, frequentTerms[l]!]);
          const trioIKL = comboKey([frequentTerms[i]!, frequentTerms[k]!, frequentTerms[l]!]);
          const trioJKL = comboKey([frequentTerms[j]!, frequentTerms[k]!, frequentTerms[l]!]);

          if (
            frequentTrioSet.has(trioIJL) &&
            frequentTrioSet.has(trioIKL) &&
            frequentTrioSet.has(trioJKL)
          ) {
            candidates.add(
              comboKey([frequentTerms[i]!, frequentTerms[j]!, frequentTerms[k]!, frequentTerms[l]!]),
            );
          }
        }
      }
    }
  }

  return candidates;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute weighted outcome for an event.
 * Reuses Phase 7.1a helpers: outcome score × confidence multiplier.
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

/**
 * Canonical key for a sorted combo: "term1|term2|term3".
 * Terms are sorted alphabetically to ensure consistent keys.
 */
function comboKey(terms: string[]): string {
  return [...terms].sort().join('|');
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Extract categories represented in a combo.
 * Scans events to find which categories contain each term.
 */
function extractCategories(
  terms: string[],
  events: MinableEvent[],
): string[] {
  const categorySet = new Set<string>();

  // Sample first event that contains all terms
  for (const evt of events) {
    if (terms.every((t) => evt.termSet.has(t))) {
      for (const [category, values] of Object.entries(evt.selections)) {
        if (Array.isArray(values)) {
          for (const term of terms) {
            if (values.includes(term)) {
              categorySet.add(category);
            }
          }
        }
      }
      break; // One event is enough — terms live in the same categories across events
    }
  }

  return [...categorySet].sort();
}
