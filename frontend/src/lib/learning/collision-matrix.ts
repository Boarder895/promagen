// src/lib/learning/collision-matrix.ts
// ============================================================================
// NEGATIVE PATTERN LEARNING — Collision Matrix Engine
// ============================================================================
//
// Phase 7.1, Part 7.1c — Core Algorithm.
//
// Finds term pairs that COMPETE for the same role. Each term works well
// alone, but using both together hurts prompt quality (redundancy / confusion).
//
// Example: "golden hour" + "moonlight" — both lighting sources. Solo outcomes
// are high, but together the model gets confused and output quality drops.
//
// Detection method: solo-vs-together quality delta.
//   soloA    = mean weighted outcome when A present WITHOUT B
//   soloB    = mean weighted outcome when B present WITHOUT A
//   together = mean weighted outcome when BOTH A and B present
//   delta    = max(soloA, soloB) - together
//
// If delta > COLLISION_MIN_DELTA (0.10), the pair is flagged as a collision.
// competitionScore = clamp(delta / 0.50, 0, 1)
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 10).
//
// Uses the Phase 7.1a confidence multiplier for weighted outcome scoring.
//
// Authority: docs/authority/phase-7.1-negative-pattern-learning-buildplan.md § 5
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

/** A single detected collision */
export interface TermCollision {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Competition score: 0–1 (higher = more redundant) */
  competitionScore: number;
  /** Mean outcome when term A appears WITHOUT term B */
  soloOutcomeA: number;
  /** Mean outcome when term B appears WITHOUT term A */
  soloOutcomeB: number;
  /** Mean outcome when BOTH appear together */
  togetherOutcome: number;
  /** Quality delta: bestSolo - together */
  qualityDelta: number;
  /** How many events contain both terms */
  togetherCount: number;
  /** The "weaker" term (lower solo outcome) — suggest removing this one */
  weakerTerm: string;
}

/** Per-tier collision data */
export interface TierCollisions {
  /** Total events analysed */
  eventCount: number;
  /** Detected collisions sorted by competitionScore descending */
  collisions: TermCollision[];
}

/** Complete output — stored in learned_weights table */
export interface CollisionMatrixData {
  /** Schema version */
  version: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total collisions detected across all tiers */
  totalCollisions: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierCollisions>;
  /** Global (all-tier) results */
  global: TierCollisions;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Per-term accumulator: tracks total outcome sum and event count */
interface TermAccumulator {
  outcomeSum: number;
  count: number;
}

/** Per-pair accumulator: tracks together outcome sum and event count */
interface PairAccumulator {
  outcomeSum: number;
  count: number;
}

/** A scored event ready for processing */
interface ScoredEvent {
  evt: PromptEventRow;
  weightedOutcome: number;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Detect term collisions from prompt event data.
 *
 * Algorithm:
 * 1. Compute weighted outcome for each event (outcome × confidence multiplier)
 * 2. Group events by tier, process each tier independently
 * 3. For each tier:
 *    a. Build per-term accumulators (total outcome sum + count)
 *    b. Build per-pair accumulators (together outcome sum + count)
 *    c. Derive solo outcomes: soloA = (totalA - together) / (countA - togetherCount)
 *    d. Compute quality delta = max(soloA, soloB) - together
 *    e. Filter: delta > MIN_DELTA && solo counts >= MIN_SOLO_EVENTS
 *       && together count >= MIN_PAIR_EVENTS
 *    f. competitionScore = clamp(delta / 0.50, 0, 1)
 * 4. Sort by competitionScore descending, keep top MAX_PAIRS_PER_TIER
 * 5. Also compute global (all-tier) collisions
 *
 * @param events — ALL prompt events (including low-scoring ones)
 * @param referenceDate — "Now" for output timestamp (default: new Date())
 * @returns CollisionMatrixData ready for upsert into learned_weights
 */
export function computeCollisionMatrix(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): CollisionMatrixData {
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
  const tiers: Record<string, TierCollisions> = {};
  let totalCollisions = 0;

  for (const [tier, tierItems] of tierGroups) {
    const tierResult = computeTierCollisions(tierItems);
    tiers[String(tier)] = tierResult;
    totalCollisions += tierResult.collisions.length;
  }

  // ── Step 4: Compute global (all-tier) collisions ──────────────────────
  const globalResult = computeTierCollisions(scoredEvents);
  totalCollisions += globalResult.collisions.length;

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventCount: events.length,
    totalCollisions,
    tiers,
    global: globalResult,
  };
}

// ============================================================================
// PER-TIER COMPUTATION
// ============================================================================

/**
 * Compute collisions for a single group of scored events.
 *
 * Efficient approach:
 * - Build per-term totals (sum + count) in one pass over events
 * - Build per-pair totals (together sum + count) in same pass
 * - Derive solo outcomes from (total - together) without extra passes
 */
function computeTierCollisions(scoredEvents: ScoredEvent[]): TierCollisions {
  const C = LEARNING_CONSTANTS;
  const eventCount = scoredEvents.length;

  if (eventCount === 0) {
    return { eventCount: 0, collisions: [] };
  }

  // ── Per-term totals ─────────────────────────────────────────────────
  // term → { outcomeSum, count }
  const termTotals = new Map<string, TermAccumulator>();

  // ── Per-pair totals ─────────────────────────────────────────────────
  // "termA|termB" → { outcomeSum, count }
  const pairTotals = new Map<string, PairAccumulator>();

  // ── Single pass: accumulate both ────────────────────────────────────
  for (const { evt, weightedOutcome } of scoredEvents) {
    const terms = [...new Set(flattenSelections(evt.selections))].sort();
    if (terms.length < 2) continue;

    // Accumulate per-term totals
    for (const term of terms) {
      let acc = termTotals.get(term);
      if (!acc) {
        acc = { outcomeSum: 0, count: 0 };
        termTotals.set(term, acc);
      }
      acc.outcomeSum += weightedOutcome;
      acc.count += 1;
    }

    // Accumulate per-pair totals
    for (let i = 0; i < terms.length; i++) {
      const termA = terms[i]!;
      for (let j = i + 1; j < terms.length; j++) {
        const termB = terms[j]!;
        if (termA === termB) continue;

        const pairKey = `${termA}|${termB}`;
        let acc = pairTotals.get(pairKey);
        if (!acc) {
          acc = { outcomeSum: 0, count: 0 };
          pairTotals.set(pairKey, acc);
        }
        acc.outcomeSum += weightedOutcome;
        acc.count += 1;
      }
    }
  }

  // ── Evaluate each pair ──────────────────────────────────────────────
  const collisions: TermCollision[] = [];

  for (const [pairKey, pairAcc] of pairTotals) {
    // Must have enough together events
    if (pairAcc.count < C.ANTI_PATTERN_MIN_PAIR_EVENTS) continue;

    const [termA, termB] = pairKey.split('|') as [string, string];

    const totalA = termTotals.get(termA);
    const totalB = termTotals.get(termB);
    if (!totalA || !totalB) continue;

    // Solo counts: total appearances of the term minus together appearances
    const soloCountA = totalA.count - pairAcc.count;
    const soloCountB = totalB.count - pairAcc.count;

    // Must have enough solo events for both terms
    if (soloCountA < C.COLLISION_MIN_SOLO_EVENTS) continue;
    if (soloCountB < C.COLLISION_MIN_SOLO_EVENTS) continue;

    // ── Derive solo and together means ─────────────────────────────
    const soloSumA = totalA.outcomeSum - pairAcc.outcomeSum;
    const soloSumB = totalB.outcomeSum - pairAcc.outcomeSum;

    const soloOutcomeA = soloSumA / soloCountA;
    const soloOutcomeB = soloSumB / soloCountB;
    const togetherOutcome = pairAcc.outcomeSum / pairAcc.count;

    // ── Quality delta ──────────────────────────────────────────────
    const bestSolo = Math.max(soloOutcomeA, soloOutcomeB);
    const delta = bestSolo - togetherOutcome;

    // Must exceed minimum delta threshold (default 0.10)
    if (delta < C.COLLISION_MIN_DELTA) continue;

    // ── Competition score ──────────────────────────────────────────
    // Scales with delta: 0.10 → 0.20, 0.25 → 0.50, 0.50+ → 1.0
    const competitionScore = Math.min(delta / 0.50, 1.0);

    // ── Weaker term: the one with lower solo outcome ──────────────
    const weakerTerm = soloOutcomeA <= soloOutcomeB ? termA : termB;

    collisions.push({
      terms: [termA, termB],
      competitionScore: round4(competitionScore),
      soloOutcomeA: round4(soloOutcomeA),
      soloOutcomeB: round4(soloOutcomeB),
      togetherOutcome: round4(togetherOutcome),
      qualityDelta: round4(delta),
      togetherCount: pairAcc.count,
      weakerTerm,
    });
  }

  // ── Sort by competitionScore descending, trim to max ────────────────
  collisions.sort(
    (a, b) => b.competitionScore - a.competitionScore || b.qualityDelta - a.qualityDelta,
  );
  const trimmed = collisions.slice(0, C.COLLISION_MAX_PAIRS_PER_TIER);

  return {
    eventCount,
    collisions: trimmed,
  };
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
// MATH UTILITY
// ============================================================================

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
