// src/lib/learning/anti-pattern-detection.ts
// ============================================================================
// NEGATIVE PATTERN LEARNING — Anti-pattern Detection Engine
// ============================================================================
//
// Phase 7.1, Part 7.1b — Core Algorithm.
//
// Finds term pairs that HURT prompt quality. Uses Fisher's enrichment ratio
// to identify pairs that appear disproportionately in low-outcome prompts
// compared to high-outcome prompts.
//
// Example: "oil painting" + "8k resolution" — aesthetic contradiction.
// The pair appears 5× more often in bad prompts than good ones, so it gets
// flagged with severity ~0.5 and demoted in the suggestion engine.
//
// This module is a pure computation layer — no I/O, no database access.
// Called by the nightly aggregation cron (Layer 9).
//
// Uses the Phase 7.1a confidence multiplier to weight outcome signals
// by user deliberateness: paid + veteran + deep-session users produce
// higher-confidence outcome scores.
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

/** A single detected anti-pattern */
export interface AntiPattern {
  /** Alphabetically sorted pair of terms */
  terms: [string, string];
  /** Severity score: 0–1 (higher = more toxic) */
  severity: number;
  /** How many times this pair appeared in low-outcome events */
  lowCount: number;
  /** How many times this pair appeared in high-outcome events */
  highCount: number;
  /** Enrichment ratio (lowRate / highRate) */
  enrichment: number;
  /** Categories these terms typically belong to */
  categories: string[];
}

/** Per-tier anti-pattern data */
export interface TierAntiPatterns {
  /** Total events analysed in this tier */
  eventCount: number;
  /** Low-outcome event count in this tier */
  lowEventCount: number;
  /** High-outcome event count in this tier */
  highEventCount: number;
  /** Detected anti-patterns sorted by severity descending */
  patterns: AntiPattern[];
}

/** Complete output — stored in learned_weights table */
export interface AntiPatternData {
  /** Schema version */
  version: string;
  /** ISO timestamp of generation */
  generatedAt: string;
  /** Total events processed */
  eventCount: number;
  /** Total anti-patterns detected across all tiers */
  totalPatterns: number;
  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierAntiPatterns>;
  /** Global (all-tier) results */
  global: TierAntiPatterns;
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Accumulator for a single term pair within a bucket */
interface PairAccumulator {
  /** Number of events in this bucket containing this pair */
  count: number;
  /** Set of categories the two terms appeared in */
  categorySet: Set<string>;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Detect anti-patterns from prompt event data.
 *
 * Algorithm:
 * 1. Compute weighted outcome for each event (outcome × confidence multiplier)
 * 2. Split events into low-outcome and high-outcome buckets
 * 3. Group events by tier, process each tier independently
 * 4. For each tier, build term pair → count maps for low/high buckets
 * 5. Compute Fisher's enrichment ratio per pair
 * 6. Filter: enrichment > MIN_ENRICHMENT AND lowCount >= MIN_PAIR_EVENTS
 * 7. Compute severity = clamp(enrichment / 10, 0, 1)
 * 8. Sort by severity descending, keep top MAX_PAIRS_PER_TIER
 * 9. Also compute global (all-tier) anti-patterns
 *
 * @param events — ALL prompt events (including low-scoring ones)
 * @param referenceDate — "Now" for output timestamp (default: new Date())
 * @returns AntiPatternData ready for upsert into learned_weights
 */
export function computeAntiPatterns(
  events: PromptEventRow[],
  referenceDate: Date = new Date(),
): AntiPatternData {
  const now = referenceDate;

  // ── Step 1: Compute weighted outcomes ─────────────────────────────────
  const scoredEvents = events.map((evt) => ({
    evt,
    weightedOutcome: computeWeightedOutcome(evt),
  }));

  // ── Step 2: Group by tier ─────────────────────────────────────────────
  const tierGroups = new Map<number, typeof scoredEvents>();
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
  const tiers: Record<string, TierAntiPatterns> = {};
  let totalPatterns = 0;

  for (const [tier, tierItems] of tierGroups) {
    const tierResult = computeTierAntiPatterns(tierItems);
    tiers[String(tier)] = tierResult;
    totalPatterns += tierResult.patterns.length;
  }

  // ── Step 4: Compute global (all-tier) anti-patterns ───────────────────
  const globalResult = computeTierAntiPatterns(scoredEvents);
  totalPatterns += globalResult.patterns.length;

  return {
    version: '1.0.0',
    generatedAt: now.toISOString(),
    eventCount: events.length,
    totalPatterns,
    tiers,
    global: globalResult,
  };
}

// ============================================================================
// PER-TIER COMPUTATION
// ============================================================================

/**
 * Compute anti-patterns for a single group of scored events.
 *
 * Used for both per-tier and global computation.
 */
function computeTierAntiPatterns(
  scoredEvents: Array<{ evt: PromptEventRow; weightedOutcome: number }>,
): TierAntiPatterns {
  const C = LEARNING_CONSTANTS;
  const eventCount = scoredEvents.length;

  // ── Split into low/high buckets ─────────────────────────────────────
  const lowEvents: Array<{ evt: PromptEventRow; weightedOutcome: number }> = [];
  const highEvents: Array<{ evt: PromptEventRow; weightedOutcome: number }> = [];

  for (const item of scoredEvents) {
    if (item.weightedOutcome < C.ANTI_PATTERN_LOW_THRESHOLD) {
      lowEvents.push(item);
    } else if (item.weightedOutcome >= C.ANTI_PATTERN_HIGH_THRESHOLD) {
      highEvents.push(item);
    }
    // Events between LOW and HIGH thresholds are "neutral" — ignored
  }

  const lowEventCount = lowEvents.length;
  const highEventCount = highEvents.length;

  // ── Build pair count maps for each bucket ───────────────────────────
  const lowPairs = buildPairCounts(lowEvents);
  const highPairs = buildPairCounts(highEvents);

  // ── Compute enrichment and build anti-patterns ──────────────────────
  //
  // Guard: need at least 1 event in each bucket to compute meaningful ratios.
  // If either bucket is empty, we can't compute enrichment.
  if (lowEventCount === 0 || highEventCount === 0) {
    return {
      eventCount,
      lowEventCount,
      highEventCount,
      patterns: [],
    };
  }

  const patterns: AntiPattern[] = [];

  for (const [pairKey, lowAcc] of lowPairs) {
    // Skip pairs that don't meet the minimum event threshold
    if (lowAcc.count < C.ANTI_PATTERN_MIN_PAIR_EVENTS) continue;

    // Get high-bucket count for this pair (0 if absent)
    const highAcc = highPairs.get(pairKey);
    const highCount = highAcc?.count ?? 0;

    // ── Fisher's enrichment ratio ────────────────────────────────────
    // lowRate  = how often this pair appears in bad prompts
    // highRate = how often this pair appears in good prompts
    // enrichment = lowRate / highRate (how over-represented in bad?)
    const lowRate = lowAcc.count / lowEventCount;
    const highRate = highCount / Math.max(highEventCount, 1);
    const enrichment = lowRate / Math.max(highRate, 0.001);

    // Must exceed minimum enrichment threshold (default 2.0×)
    if (enrichment < C.ANTI_PATTERN_MIN_ENRICHMENT) continue;

    // ── Severity ─────────────────────────────────────────────────────
    // Scales with enrichment: min(enrichment / 10, 1.0)
    const severity = Math.min(enrichment / 10, 1.0);

    // ── Parse pair key back into terms ───────────────────────────────
    const [termA, termB] = pairKey.split('|') as [string, string];

    // Merge categories from both buckets
    const cats = new Set<string>(lowAcc.categorySet);
    if (highAcc) {
      for (const c of highAcc.categorySet) cats.add(c);
    }

    patterns.push({
      terms: [termA, termB],
      severity: round4(severity),
      lowCount: lowAcc.count,
      highCount,
      enrichment: round4(enrichment),
      categories: Array.from(cats).sort(),
    });
  }

  // ── Sort by severity descending, trim to max ────────────────────────
  patterns.sort((a, b) => b.severity - a.severity || b.enrichment - a.enrichment);
  const trimmed = patterns.slice(0, C.ANTI_PATTERN_MAX_PAIRS_PER_TIER);

  return {
    eventCount,
    lowEventCount,
    highEventCount,
    patterns: trimmed,
  };
}

// ============================================================================
// PAIR COUNTING
// ============================================================================

/**
 * Build a map of term pair → accumulated counts for a bucket of events.
 *
 * Each event contributes to every unique pair that can be formed from its
 * selected terms (same O(n²) pair generation as co-occurrence.ts).
 *
 * @param items — Scored events in one bucket (low or high)
 * @returns Map of "termA|termB" → PairAccumulator
 */
function buildPairCounts(
  items: Array<{ evt: PromptEventRow; weightedOutcome: number }>,
): Map<string, PairAccumulator> {
  const pairMap = new Map<string, PairAccumulator>();

  for (const { evt } of items) {
    const terms = flattenSelections(evt.selections);
    if (terms.length < 2) continue;

    // Determine which categories each term belongs to
    const termToCategory = new Map<string, string>();
    for (const [category, values] of Object.entries(evt.selections)) {
      if (!Array.isArray(values)) continue;
      for (const v of values) {
        if (typeof v === 'string' && v.length > 0) {
          termToCategory.set(v, category);
        }
      }
    }

    // Sort for consistent pairing
    const sorted = [...new Set(terms)].sort();

    for (let i = 0; i < sorted.length; i++) {
      const termA = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const termB = sorted[j]!;
        if (termA === termB) continue;

        const pairKey = `${termA}|${termB}`;

        let acc = pairMap.get(pairKey);
        if (!acc) {
          acc = { count: 0, categorySet: new Set<string>() };
          pairMap.set(pairKey, acc);
        }

        acc.count += 1;

        // Track categories for UX
        const catA = termToCategory.get(termA);
        const catB = termToCategory.get(termB);
        if (catA) acc.categorySet.add(catA);
        if (catB) acc.categorySet.add(catB);
      }
    }
  }

  return pairMap;
}

// ============================================================================
// WEIGHTED OUTCOME
// ============================================================================

/**
 * Compute a single weighted outcome score for an event.
 *
 * Formula: computeOutcomeScore(outcome) × computeConfidenceMultiplier(context)
 *
 * The confidence multiplier adjusts the outcome by how deliberate the user
 * was: paid subscribers, veteran users, and deep sessions get higher trust.
 * Missing confidence data → multiplier of 1.0 (no change).
 *
 * @param evt — A single prompt event row
 * @returns Weighted outcome score (0–1.35 in theory, typically 0–1)
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
