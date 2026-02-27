// src/lib/learning/category-value-discovery.ts
// ============================================================================
// SELF-IMPROVING SCORER — Category Value Discovery
// ============================================================================
//
// Phase 6, Part 6.4 — Mechanism 4: "Which Categories Actually Matter?"
//
// Learns which categories (style, lighting, colour, ...) are high-value
// vs low-value per tier. A prompt with 4 high-value categories should
// score higher than one with 6 low-value categories.
//
// Algorithm (per tier):
//   For each category:
//     1. Split events into two groups: "has category filled" vs "empty"
//     2. Compare mean outcome scores between groups
//     3. categoryValue = mean(filled) - mean(empty)
//     4. Positive = valuable, negative = irrelevant
//     5. Clamp negative values at 0 (we don't punish filling more)
//
// Pure computation layer — receives rows, returns data.
// No I/O, no database access, no side effects.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 10.4
// Build plan: docs/authority/phase-6-self-improving-scorer-buildplan.md § 4.4
//
// Version: 1.0.0
// Created: 26 February 2026
//
// Existing features preserved: Yes.
// ============================================================================

import { computeOutcomeScore } from '@/lib/learning/outcome-score';
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
}

/** Per-tier category values */
export interface TierCategoryValues {
  /** Category name → value data */
  categories: Record<string, CategoryValue>;

  /** How many events contributed to this tier */
  eventCount: number;
}

/** Complete output — stored alongside scoring weights */
export interface CategoryValueMap {
  /** Schema version */
  version: string;

  /** ISO timestamp of generation */
  generatedAt: string;

  /** Total events processed */
  eventCount: number;

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

  if (events.length < MIN_EVENTS_FOR_DISCOVERY) {
    return buildEmptyResult(events.length, now);
  }

  // Discover all category keys from the data
  const categoryKeys = discoverCategories(events);

  if (categoryKeys.length === 0) {
    return buildEmptyResult(events.length, now);
  }

  // Pre-compute outcome scores once
  const outcomeScores = events.map((e) => computeOutcomeScore(e.outcome));

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
    version: '1.0.0',
    generatedAt: now,
    eventCount: events.length,
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
 */
function computeTierCategoryValues(
  events: PromptEventRow[],
  outcomeScores: number[],
  categoryKeys: string[],
): TierCategoryValues {
  const categories: Record<string, CategoryValue> = {};

  for (const category of categoryKeys) {
    // Split into filled vs empty
    const filledOutcomes: number[] = [];
    const emptyOutcomes: number[] = [];

    for (let i = 0; i < events.length; i++) {
      const filled = isCategoryFilled(
        events[i]!.selections,
        category,
      );

      if (filled) {
        filledOutcomes.push(outcomeScores[i]!);
      } else {
        emptyOutcomes.push(outcomeScores[i]!);
      }
    }

    // Need enough events in the filled group to trust the value
    if (filledOutcomes.length < MIN_EVENTS_PER_CATEGORY) {
      categories[category] = {
        value: 0,
        meanFilled: mean(filledOutcomes),
        meanEmpty: mean(emptyOutcomes),
        filledCount: filledOutcomes.length,
        emptyCount: emptyOutcomes.length,
      };
      continue;
    }

    const meanF = mean(filledOutcomes);
    const meanE = mean(emptyOutcomes);
    const rawValue = meanF - meanE;

    // Clamp at 0: we never penalise users for filling a category
    categories[category] = {
      value: Math.max(0, round4(rawValue)),
      meanFilled: round4(meanF),
      meanEmpty: round4(meanE),
      filledCount: filledOutcomes.length,
      emptyCount: emptyOutcomes.length,
    };
  }

  return {
    categories,
    eventCount: events.length,
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
    };
  }
  return result;
}

/**
 * Build empty result for cold-start.
 */
function buildEmptyResult(eventCount: number, now: string): CategoryValueMap {
  const emptyTier: TierCategoryValues = {
    categories: {},
    eventCount: 0,
  };

  const tiers: Record<string, TierCategoryValues> = {};
  for (const tierId of VALID_TIERS) {
    tiers[String(tierId)] = { ...emptyTier, categories: {} };
  }

  return {
    version: '1.0.0',
    generatedAt: now,
    eventCount,
    tiers,
    global: { ...emptyTier, categories: {} },
  };
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
