// src/lib/learning/category-value-discovery.ts
// ============================================================================
// SELF-IMPROVING SCORER — Category Value Discovery + Feedback Sentiment
// ============================================================================
//
// Phase 6, Part 6.4 — Mechanism 4: "Which Categories Actually Matter?"
// Gap 3 extension (7 March 2026): "Which Categories Need Better Vocabulary?"
//
// Learns which categories (style, lighting, colour, ...) are high-value
// vs low-value per tier. A prompt with 4 high-value categories should
// score higher than one with 6 low-value categories.
//
// Gap 3: For events WITH direct user feedback, computes per-category
// feedback sentiment. If users consistently 👎 prompts containing
// atmosphere terms but 👍 prompts with lighting terms, that signals
// which categories need more diverse vocabulary.
//
// Algorithm (per tier, per category):
//   1. Split events into "filled" vs "empty" → compare mean outcomes
//   2. categoryValue = max(0, mean(filled) - mean(empty))
//   3. (Gap 3) From events WITH feedback where category IS filled:
//      sentiment = (positive - negative) / total_with_feedback
//      Range: -1.0 (all 👎) to +1.0 (all 👍). null if < 5 feedback events.
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.4
// Authority: docs/authority/the-like-system.md (Gap 3 — feedback sentiment)
//
// Version: 2.0.0 — Gap 1 fix (outcomeWithFeedback) + Gap 3 (feedback sentiment)
// Created: 26 February 2026
// Updated: 7 March 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { computeOutcomeScore, outcomeWithFeedback } from '@/lib/learning/outcome-score';
import type { PromptEventRow } from '@/lib/learning/database';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum events in the "filled" group before we trust the category value.
 * Below this, the category value defaults to 0 (neutral).
 */
export const MIN_EVENTS_PER_CATEGORY = 20;

/**
 * Minimum events per tier before we compute category values.
 * Below this, return empty (all neutral).
 */
export const MIN_EVENTS_FOR_DISCOVERY = 50;

/**
 * Minimum feedback events containing a category before we trust sentiment.
 * Below this, feedback fields default to null (insufficient data).
 */
const MIN_FEEDBACK_FOR_SENTIMENT = 5;

/** Valid feedback ratings — defensive validation even though DB Zod-validates on write */
const VALID_RATINGS = new Set(['positive', 'neutral', 'negative']);

/**
 * Standard categories tracked by the prompt builder.
 * Data-driven discovery uses these as the base set, but also picks up
 * any additional categories found in the event data.
 */
export const KNOWN_CATEGORIES = [
  'subject',
  'style',
  'lighting',
  'colour',
  'atmosphere',
  'environment',
  'action',
  'composition',
  'camera',
  'materials',
  'fidelity',
  'negative',
] as const;

const VALID_TIERS = [1, 2, 3, 4] as const;

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/** Value score for a single category within a tier */
export interface CategoryValue {
  /** Difference in mean outcome: mean(filled) - mean(empty). Clamped >= 0. */
  value: number;

  /** Mean outcome score for events where this category was filled */
  meanFilled: number;

  /** Mean outcome score for events where this category was empty */
  meanEmpty: number;

  /** Number of events where this category was filled */
  filledCount: number;

  /** Number of events where this category was empty */
  emptyCount: number;

  // ── Gap 3: Feedback sentiment (7 March 2026) ────────────────────────
  // null = insufficient feedback data (< MIN_FEEDBACK_FOR_SENTIMENT)

  /** 👍 count for events containing this category */
  feedbackPositive: number | null;
  /** 👌 count for events containing this category */
  feedbackNeutral: number | null;
  /** 👎 count for events containing this category */
  feedbackNegative: number | null;
  /**
   * Sentiment: (positive - negative) / total. Range -1.0 to +1.0.
   * Negative → category vocabulary needs diversification.
   * Positive → category terms are working well.
   * null = insufficient data.
   */
  feedbackSentiment: number | null;
}

/** Per-tier category values */
export interface TierCategoryValues {
  /** Category name → value data */
  categories: Record<string, CategoryValue>;

  /** How many events contributed to this tier */
  eventCount: number;

  /** How many events had direct feedback in this tier (Gap 3) */
  feedbackEventCount: number;
}

/** Complete output — stored alongside scoring weights */
export interface CategoryValueMap {
  /** Schema version */
  version: string;

  /** ISO timestamp of generation */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

  /** Total events with direct feedback (Gap 3) */
  feedbackEventCount: number;

  /** Per-tier results (keys: "1", "2", "3", "4") */
  tiers: Record<string, TierCategoryValues>;

  /** Global (all-tier) results */
  global: TierCategoryValues;
}

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Compute per-tier category values from prompt event data.
 *
 * For each category in each tier, compares mean outcome scores of events
 * where the category was filled vs empty. The difference tells us how
 * much that category contributes to successful prompts.
 *
 * @param events — Qualifying prompt events
 * @returns Complete CategoryValueMap ready for storage
 *
 * @example
 * const events = await fetchQualifyingEvents();
 * const values = computeCategoryValues(events);
 * // values.global.categories['style'].value → 0.12 (high value)
 * // values.global.categories['materials'].value → 0.01 (low value)
 */
export function computeCategoryValues(
  events: PromptEventRow[],
): CategoryValueMap {
  const now = new Date().toISOString();
  const feedbackEventCount = countFeedbackEvents(events);

  if (events.length < MIN_EVENTS_FOR_DISCOVERY) {
    return buildEmptyResult(events.length, feedbackEventCount, now);
  }

  // Discover all category keys from the data
  const categoryKeys = discoverCategories(events);

  if (categoryKeys.length === 0) {
    return buildEmptyResult(events.length, feedbackEventCount, now);
  }

  // Pre-compute outcome scores once (feedback-aware — Gap 1 fix)
  const outcomeScores = events.map((e) =>
    computeOutcomeScore(outcomeWithFeedback(e.outcome, e.feedback_rating, e.feedback_credibility)),
  );

  // Group events by tier
  const tierGroups = groupByTier(events, outcomeScores);

  // Compute global values
  const global = computeTierCategoryValues(
    events,
    outcomeScores,
    categoryKeys,
  );

  // Compute per-tier values
  const tiers: Record<string, TierCategoryValues> = {};

  for (const tierId of VALID_TIERS) {
    const tierKey = String(tierId);
    const group = tierGroups.get(tierId);

    if (!group || group.events.length < MIN_EVENTS_FOR_DISCOVERY) {
      // Not enough data — empty tier
      tiers[tierKey] = {
        categories: buildNeutralCategories(categoryKeys),
        eventCount: group?.events.length ?? 0,
        feedbackEventCount: group ? countFeedbackEvents(group.events) : 0,
      };
      continue;
    }

    tiers[tierKey] = computeTierCategoryValues(
      group.events,
      group.outcomes,
      categoryKeys,
    );
  }

  return {
    version: '2.0.0',
    generatedAt: now,
    eventCount: events.length,
    feedbackEventCount,
    tiers,
    global,
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Discover all category keys from event selections.
 * Merges known categories with any additional ones found in data.
 */
function discoverCategories(events: PromptEventRow[]): string[] {
  const found = new Set<string>(KNOWN_CATEGORIES);

  for (const event of events) {
    if (event.selections && typeof event.selections === 'object') {
      for (const key of Object.keys(event.selections)) {
        found.add(key);
      }
    }
  }

  return Array.from(found).sort();
}

/**
 * Check if a category is "filled" in an event's selections.
 * Filled = key exists AND has at least one non-empty string value.
 */
function isCategoryFilled(
  selections: Record<string, string[]>,
  category: string,
): boolean {
  const values = selections[category];
  if (!values || !Array.isArray(values)) return false;
  return values.some((v) => typeof v === 'string' && v.trim().length > 0);
}

/**
 * Group events and their pre-computed outcome scores by tier.
 */
function groupByTier(
  events: PromptEventRow[],
  outcomeScores: number[],
): Map<number, { events: PromptEventRow[]; outcomes: number[] }> {
  const groups = new Map<
    number,
    { events: PromptEventRow[]; outcomes: number[] }
  >();

  for (let i = 0; i < events.length; i++) {
    const tier = events[i]!.tier;
    if (!groups.has(tier)) {
      groups.set(tier, { events: [], outcomes: [] });
    }
    const group = groups.get(tier)!;
    group.events.push(events[i]!);
    group.outcomes.push(outcomeScores[i]!);
  }

  return groups;
}

/**
 * Compute category values for a set of events (one tier or global).
 *
 * Two signals computed in a single fused loop per category (cache-efficient):
 *   1. Existing: filled vs empty mean outcome comparison
 *   2. Gap 3: feedback sentiment per category (from events WITH ratings)
 */
function computeTierCategoryValues(
  events: PromptEventRow[],
  outcomeScores: number[],
  categoryKeys: string[],
): TierCategoryValues {
  const categories: Record<string, CategoryValue> = {};
  const feedbackEventCount = countFeedbackEvents(events);

  for (const category of categoryKeys) {
    // Outcome accumulators
    const filledOutcomes: number[] = [];
    const emptyOutcomes: number[] = [];

    // Gap 3: Feedback sentiment accumulators (only events WITH feedback AND category filled)
    let fbPositive = 0;
    let fbNeutral = 0;
    let fbNegative = 0;

    // Single pass per category: classify + accumulate both signals
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      const filled = isCategoryFilled(event.selections, category);

      // Signal 1: outcome split (all events)
      if (filled) {
        filledOutcomes.push(outcomeScores[i]!);
      } else {
        emptyOutcomes.push(outcomeScores[i]!);
      }

      // Signal 2: feedback sentiment (only when category filled AND has feedback)
      if (filled && event.feedback_rating && VALID_RATINGS.has(event.feedback_rating)) {
        if (event.feedback_rating === 'positive') fbPositive++;
        else if (event.feedback_rating === 'neutral') fbNeutral++;
        else if (event.feedback_rating === 'negative') fbNegative++;
      }
    }

    // Existing: value from outcome comparison
    const hasSufficientData = filledOutcomes.length >= MIN_EVENTS_PER_CATEGORY;
    const meanF = mean(filledOutcomes);
    const meanE = mean(emptyOutcomes);
    const rawValue = hasSufficientData ? meanF - meanE : 0;

    // Gap 3: feedback sentiment
    const totalFb = fbPositive + fbNeutral + fbNegative;
    const hasSufficientFeedback = totalFb >= MIN_FEEDBACK_FOR_SENTIMENT;

    categories[category] = {
      value: Math.max(0, round4(rawValue)),
      meanFilled: round4(meanF),
      meanEmpty: round4(meanE),
      filledCount: filledOutcomes.length,
      emptyCount: emptyOutcomes.length,
      feedbackPositive: hasSufficientFeedback ? fbPositive : null,
      feedbackNeutral: hasSufficientFeedback ? fbNeutral : null,
      feedbackNegative: hasSufficientFeedback ? fbNegative : null,
      feedbackSentiment: hasSufficientFeedback
        ? round4((fbPositive - fbNegative) / totalFb)
        : null,
    };
  }

  return {
    categories,
    eventCount: events.length,
    feedbackEventCount,
  };
}

/**
 * Build neutral (value = 0) categories for tiers with insufficient data.
 */
function buildNeutralCategories(
  categoryKeys: string[],
): Record<string, CategoryValue> {
  const result: Record<string, CategoryValue> = {};
  for (const key of categoryKeys) {
    result[key] = {
      value: 0,
      meanFilled: 0,
      meanEmpty: 0,
      filledCount: 0,
      emptyCount: 0,
      feedbackPositive: null,
      feedbackNeutral: null,
      feedbackNegative: null,
      feedbackSentiment: null,
    };
  }
  return result;
}

/**
 * Build empty result for cold-start.
 */
function buildEmptyResult(
  eventCount: number,
  feedbackEventCount: number,
  now: string,
): CategoryValueMap {
  const emptyTier: TierCategoryValues = {
    categories: {},
    eventCount: 0,
    feedbackEventCount: 0,
  };

  const tiers: Record<string, TierCategoryValues> = {};
  for (const tierId of VALID_TIERS) {
    tiers[String(tierId)] = { ...emptyTier, categories: {} };
  }

  return {
    version: '2.0.0',
    generatedAt: now,
    eventCount,
    feedbackEventCount,
    tiers,
    global: { ...emptyTier, categories: {} },
  };
}

// ============================================================================
// FEEDBACK COUNTING
// ============================================================================

/** Count events with a valid feedback_rating. Used for feedbackEventCount. */
function countFeedbackEvents(events: PromptEventRow[]): number {
  let count = 0;
  for (const e of events) {
    if (e.feedback_rating && VALID_RATINGS.has(e.feedback_rating)) count++;
  }
  return count;
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/** Arithmetic mean. Returns 0 for empty arrays. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Round to 4 decimal places. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
