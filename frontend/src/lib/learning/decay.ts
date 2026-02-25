// src/lib/learning/decay.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Decay & Diversity Functions
// ============================================================================
//
// Pure functions — no side effects, no I/O, fully testable.
// Used by the nightly aggregation cron (Step 5.3) to weight recent events
// more heavily and prevent popular-but-obvious pairs from dominating.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.3
//
// Version: 1.0.0
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ============================================================================
// TIME DECAY
// ============================================================================

/**
 * Exponential time decay: recent events matter more than old ones.
 *
 * Formula: weight = 0.5 ^ (ageDays / halfLifeDays)
 *
 * At halfLife days old, the event has 50% weight.
 * At 2× halfLife, 25%. At 3× halfLife, 12.5%. And so on.
 *
 * @param ageDays — Age of the event in days (0 = today, 90 = 3 months ago)
 * @param halfLifeDays — Number of days until weight halves (default: 90)
 * @returns Weight between 0 and 1 (inclusive)
 *
 * @example
 * timeDecay(0)   → 1.0   // today: full weight
 * timeDecay(90)  → 0.5   // 3 months: half weight
 * timeDecay(180) → 0.25  // 6 months: quarter weight
 * timeDecay(360) → 0.0625
 */
export function timeDecay(
  ageDays: number,
  halfLifeDays: number = LEARNING_CONSTANTS.DECAY_HALF_LIFE_DAYS,
): number {
  if (ageDays <= 0) return 1.0;
  if (halfLifeDays <= 0) return 0;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

/**
 * Compute the age of an event in fractional days from a reference date.
 *
 * @param eventDate — When the event occurred
 * @param referenceDate — "Now" for the computation (defaults to Date.now())
 * @returns Age in days (always >= 0)
 */
export function ageDays(eventDate: Date, referenceDate: Date = new Date()): number {
  const ms = referenceDate.getTime() - eventDate.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

// ============================================================================
// DIVERSITY CAP
// ============================================================================

/**
 * Prevents popular-but-obvious term pairs from dominating the co-occurrence matrix.
 *
 * If a pair appears in more than `threshold` share of all events,
 * its effective count is capped. This ensures uncommon-but-high-quality
 * combinations still surface in the dropdown reordering.
 *
 * @param pairCount — Raw count of events containing this pair
 * @param totalEvents — Total qualifying events in the dataset
 * @param threshold — Maximum share before capping (default: 0.3 = 30%)
 * @returns Effective count (capped if necessary)
 *
 * @example
 * diversityCap(500, 1000)  → 300  // 50% share → capped to 30%
 * diversityCap(200, 1000)  → 200  // 20% share → no cap
 * diversityCap(300, 1000)  → 300  // exactly 30% → no cap
 */
export function diversityCap(
  pairCount: number,
  totalEvents: number,
  threshold: number = LEARNING_CONSTANTS.DIVERSITY_CAP_THRESHOLD,
): number {
  if (totalEvents <= 0) return 0;
  if (pairCount <= 0) return 0;

  const share = pairCount / totalEvents;
  if (share <= threshold) return pairCount;

  return Math.floor(totalEvents * threshold);
}

// ============================================================================
// NORMALISATION
// ============================================================================

/**
 * Normalise an array of values to the 0–100 range.
 *
 * Used to scale co-occurrence weights so they're comparable across tiers
 * and independent of absolute event counts.
 *
 * @param values — Raw numeric values
 * @returns Values scaled to 0–100 (same order, same length)
 *
 * @example
 * normalise([10, 50, 100]) → [10, 50, 100]
 * normalise([5, 10, 20])   → [25, 50, 100]
 * normalise([7, 7, 7])     → [100, 100, 100] (all equal → all max)
 */
export function normalise(values: number[]): number[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  if (max <= 0) return values.map(() => 0);

  return values.map((v) => Math.round((v / max) * 100));
}

// ============================================================================
// JACCARD SIMILARITY (for scene candidate clustering)
// ============================================================================

/**
 * Compute Jaccard similarity between two sets of terms.
 *
 * Jaccard = |A ∩ B| / |A ∪ B|
 *
 * Used to cluster similar prompt selections when detecting scene candidates.
 * Threshold for "similar enough" is SCENE_JACCARD_THRESHOLD (default 0.6).
 *
 * @param setA — First set of terms
 * @param setB — Second set of terms
 * @returns Similarity between 0 (disjoint) and 1 (identical)
 *
 * @example
 * jaccard(['a','b','c'], ['b','c','d'])     → 0.5   (2 shared / 4 total)
 * jaccard(['a','b','c'], ['a','b','c'])     → 1.0   (identical)
 * jaccard(['a','b'],     ['c','d'])         → 0.0   (disjoint)
 */
export function jaccard(setA: string[], setB: string[]): number {
  if (setA.length === 0 && setB.length === 0) return 1.0;
  if (setA.length === 0 || setB.length === 0) return 0;

  const a = new Set(setA);
  const b = new Set(setB);

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }

  const union = a.size + b.size - intersection;
  if (union === 0) return 1.0;

  return intersection / union;
}

/**
 * Flatten a selections record into a single array of terms.
 *
 * Used before Jaccard comparison to treat all categories equally.
 *
 * @param selections — Record<string, string[]> from a prompt event
 * @returns Flat array of all selected terms
 *
 * @example
 * flattenSelections({ subject: ['hacker'], style: ['cinematic'] })
 * → ['hacker', 'cinematic']
 */
export function flattenSelections(
  selections: Record<string, string[]>,
): string[] {
  const terms: string[] = [];
  for (const values of Object.values(selections)) {
    if (Array.isArray(values)) {
      for (const v of values) {
        if (typeof v === 'string' && v.length > 0) {
          terms.push(v);
        }
      }
    }
  }
  return terms;
}
