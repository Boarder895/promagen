// src/lib/prompt-intelligence/phrase-filter.ts
// ============================================================================
// CASCADING FILTER ENGINE
// ============================================================================
// Extracts context from user selections, accumulates it across the category
// chain (Subject → Action → … → Fidelity), and filters intelligent phrases
// so that downstream dropdowns get progressively smarter.
//
// RULES:
//   1. Subject always returns ALL phrases (nothing upstream to filter from)
//   2. Technical categories (Style, Composition, Camera, Fidelity, Negative)
//      bypass filtering — they always return the full pool
//   3. Content categories (Action, Environment, Lighting, Colour, Atmosphere,
//      Materials) filter against accumulated context from upstream selections
//   4. Filtering uses ≥50% tag overlap: a phrase passes if at least half of
//      its non-null tags match the accumulated context
//   5. If a filter would reduce the pool to <10 phrases, it broadens (returns
//      all) — this is the re-anchoring behaviour for conflicting selections
//   6. Empty context → no filtering → all phrases returned
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 5
// Existing features preserved: Yes
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import type {
  IntelligentPhrase,
  PhraseGroup,
  PhraseMood,
} from '@/data/vocabulary/phrase-category-types';
import { getIntelligentPhrases } from '@/data/vocabulary/phrase-category-map';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Accumulated context from upstream phrase selections.
 * Each field is a Set because multiple upstream selections may contribute
 * different values — e.g. two phrases referencing different commodities.
 *
 * When filtering, a phrase matches if its tag value is IN the corresponding
 * context set (union / OR logic within a tag, AND across tags at ≥50%).
 */
export interface PromptContext {
  /** Commodity IDs mentioned in upstream selections */
  commodityIds: Set<string>;
  /** Commodity groups */
  groups: Set<PhraseGroup>;
  /** Mood / sentiment */
  moods: Set<PhraseMood>;
  /** Weather events */
  weatherEvents: Set<string>;
  /** Country codes */
  countryCodes: Set<string>;
  /** Extraction methods */
  extractionMethods: Set<string>;
  /** Source sub-sections (for fine-grained affinity) */
  subSections: Set<string>;
}

/**
 * A single phrase selection made by the user (category + the chosen phrase).
 */
export interface PhraseSelection {
  category: PromptCategory;
  phrase: IntelligentPhrase;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Technical categories bypass filtering — they always return the full pool.
 * These categories contain universal/stylistic phrases not tied to specific
 * commodities, geographies, or moods.
 */
const BYPASS_CATEGORIES: ReadonlySet<PromptCategory> = new Set([
  'subject', // First category — nothing upstream to filter from
  'style', // Universal stylistic phrases
  'composition', // Universal framing phrases
  'camera', // Universal camera phrases
  'fidelity', // Quality boosters
  'negative', // Exclusion terms
]);

/**
 * Content categories that benefit from cascading filtering.
 */
const _FILTERABLE_CATEGORIES: ReadonlySet<PromptCategory> = new Set([
  'action',
  'environment',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
]);

/**
 * Minimum pool size after filtering. If filtering would reduce the pool
 * below this threshold, we broaden (return all) to avoid over-constraining.
 * This implements the re-anchoring behaviour for conflicting selections.
 */
const MIN_POOL_SIZE = 10;

/**
 * Minimum tag overlap ratio for a phrase to pass the filter.
 * A phrase with 4 non-null tags must match at least 2 (50%) to pass.
 */
const OVERLAP_THRESHOLD = 0.5;

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

/**
 * Create an empty PromptContext.
 */
export function createEmptyContext(): PromptContext {
  return {
    commodityIds: new Set(),
    groups: new Set(),
    moods: new Set(),
    weatherEvents: new Set(),
    countryCodes: new Set(),
    extractionMethods: new Set(),
    subSections: new Set(),
  };
}

/**
 * Extract context tags from a single IntelligentPhrase.
 * Returns a partial context containing only the tags present on the phrase.
 */
export function extractContext(phrase: IntelligentPhrase): Partial<PromptContext> {
  const ctx: Partial<PromptContext> = {};

  if (phrase.commodityId) {
    ctx.commodityIds = new Set([phrase.commodityId]);
  }
  if (phrase.commodityGroup) {
    ctx.groups = new Set([phrase.commodityGroup]);
  }
  if (phrase.mood && phrase.mood !== 'neutral') {
    ctx.moods = new Set([phrase.mood]);
  }
  if (phrase.weatherEvent) {
    ctx.weatherEvents = new Set([phrase.weatherEvent]);
  }
  if (phrase.countryCodes && phrase.countryCodes.length > 0) {
    ctx.countryCodes = new Set(phrase.countryCodes);
  }
  if (phrase.extractionMethod) {
    ctx.extractionMethods = new Set([phrase.extractionMethod]);
  }
  if (phrase.subSection) {
    ctx.subSections = new Set([phrase.subSection]);
  }

  return ctx;
}

// ============================================================================
// CONTEXT ACCUMULATION
// ============================================================================

/**
 * Merge a partial context into an existing context (union / broadening).
 * This implements the re-anchoring rule: conflicting selections broaden
 * the context rather than narrowing it.
 *
 * @example
 * // User selects a gold phrase, then a wheat phrase
 * // Context now has commodityIds: { 'gold', 'wheat' }
 * // → downstream filtering allows phrases for EITHER gold or wheat
 */
export function mergeContext(
  existing: PromptContext,
  incoming: Partial<PromptContext>,
): PromptContext {
  const merged = { ...existing };

  if (incoming.commodityIds) {
    merged.commodityIds = new Set([...existing.commodityIds, ...incoming.commodityIds]);
  }
  if (incoming.groups) {
    merged.groups = new Set([...existing.groups, ...incoming.groups]);
  }
  if (incoming.moods) {
    merged.moods = new Set([...existing.moods, ...incoming.moods]);
  }
  if (incoming.weatherEvents) {
    merged.weatherEvents = new Set([...existing.weatherEvents, ...incoming.weatherEvents]);
  }
  if (incoming.countryCodes) {
    merged.countryCodes = new Set([...existing.countryCodes, ...incoming.countryCodes]);
  }
  if (incoming.extractionMethods) {
    merged.extractionMethods = new Set([
      ...existing.extractionMethods,
      ...incoming.extractionMethods,
    ]);
  }
  if (incoming.subSections) {
    merged.subSections = new Set([...existing.subSections, ...incoming.subSections]);
  }

  return merged;
}

/**
 * Build accumulated context from all selections upstream of a given category.
 *
 * Walks CATEGORY_ORDER from the top (Subject) down to the category BEFORE
 * the target, extracting and merging context from each selection.
 *
 * @param selections - All current phrase selections (one per category max)
 * @param targetCategory - The category we're about to populate
 * @returns Accumulated context from everything above
 */
export function buildContextForCategory(
  selections: PhraseSelection[],
  targetCategory: PromptCategory,
): PromptContext {
  const targetIndex = CATEGORY_ORDER.indexOf(targetCategory);
  if (targetIndex <= 0) return createEmptyContext(); // Subject or unknown

  // Build a lookup: category → selection
  const selectionMap = new Map<PromptCategory, PhraseSelection>();
  for (const sel of selections) {
    selectionMap.set(sel.category, sel);
  }

  // Walk upstream categories and accumulate
  let context = createEmptyContext();
  for (let i = 0; i < targetIndex; i++) {
    const cat = CATEGORY_ORDER[i];
    if (!cat) continue;
    const sel = selectionMap.get(cat);
    if (!sel) continue;
    const phraseCtx = extractContext(sel.phrase);
    context = mergeContext(context, phraseCtx);
  }

  return context;
}

// ============================================================================
// PHRASE FILTERING
// ============================================================================

/**
 * Check if a context has any meaningful tags (non-empty sets).
 */
function isContextEmpty(ctx: PromptContext): boolean {
  return (
    ctx.commodityIds.size === 0 &&
    ctx.groups.size === 0 &&
    ctx.moods.size === 0 &&
    ctx.weatherEvents.size === 0 &&
    ctx.countryCodes.size === 0 &&
    ctx.extractionMethods.size === 0
    // subSections excluded — too granular for filtering
  );
}

/**
 * Score how well a phrase matches the accumulated context.
 *
 * Only counts tags that are present on BOTH the phrase AND the context.
 * Returns a ratio: matched tags / total comparable tags.
 *
 * Tags with no value on the phrase are skipped (universal phrases always
 * pass because they have no tags to conflict with).
 *
 * @returns 0.0–1.0, where 1.0 = perfect match, 0.0 = no match
 */
function scorePhrase(phrase: IntelligentPhrase, ctx: PromptContext): number {
  let comparableTags = 0;
  let matchedTags = 0;

  // commodityId
  if (phrase.commodityId && ctx.commodityIds.size > 0) {
    comparableTags++;
    if (ctx.commodityIds.has(phrase.commodityId)) matchedTags++;
  }

  // commodityGroup
  if (phrase.commodityGroup && ctx.groups.size > 0) {
    comparableTags++;
    if (ctx.groups.has(phrase.commodityGroup)) matchedTags++;
  }

  // mood (neutral always matches)
  if (phrase.mood && phrase.mood !== 'neutral' && ctx.moods.size > 0) {
    comparableTags++;
    if (ctx.moods.has(phrase.mood)) matchedTags++;
  }

  // weatherEvent
  if (phrase.weatherEvent && ctx.weatherEvents.size > 0) {
    comparableTags++;
    if (ctx.weatherEvents.has(phrase.weatherEvent)) matchedTags++;
  }

  // countryCodes (any overlap counts as match)
  if (phrase.countryCodes && phrase.countryCodes.length > 0 && ctx.countryCodes.size > 0) {
    comparableTags++;
    if (phrase.countryCodes.some((cc) => ctx.countryCodes.has(cc))) matchedTags++;
  }

  // extractionMethod
  if (phrase.extractionMethod && ctx.extractionMethods.size > 0) {
    comparableTags++;
    if (ctx.extractionMethods.has(phrase.extractionMethod)) matchedTags++;
  }

  // Universal phrases (no comparable tags) → score 1.0 (always pass)
  if (comparableTags === 0) return 1.0;

  return matchedTags / comparableTags;
}

/**
 * Filter intelligent phrases for a category based on accumulated context.
 *
 * This is the main entry point for the cascading filter engine.
 *
 * ALGORITHM:
 * 1. If category is a bypass category → return all phrases unfiltered
 * 2. If context is empty → return all phrases
 * 3. Score every phrase against context
 * 4. Keep phrases scoring ≥ OVERLAP_THRESHOLD
 * 5. If filtered pool < MIN_POOL_SIZE → return all (re-anchoring)
 * 6. Sort by score descending (best matches first)
 *
 * @param category - Which category to get phrases for
 * @param context - Accumulated context from upstream selections
 * @returns Filtered and sorted IntelligentPhrase[]
 */
export function filterPhrases(
  category: PromptCategory,
  context: PromptContext,
): IntelligentPhrase[] {
  const allPhrases = getIntelligentPhrases(category);

  // Rule 1: Bypass categories return everything
  if (BYPASS_CATEGORIES.has(category)) {
    return allPhrases;
  }

  // Rule 2: Empty context returns everything
  if (isContextEmpty(context)) {
    return allPhrases;
  }

  // Rule 3-4: Score and filter
  const scored = allPhrases.map((phrase) => ({
    phrase,
    score: scorePhrase(phrase, context),
  }));

  const filtered = scored.filter((s) => s.score >= OVERLAP_THRESHOLD);

  // Rule 5: Re-anchoring — if too few matches, return all
  if (filtered.length < MIN_POOL_SIZE) {
    return allPhrases;
  }

  // Rule 6: Sort best matches first
  filtered.sort((a, b) => b.score - a.score);

  return filtered.map((s) => s.phrase);
}

/**
 * Convenience: filter phrases using current selections instead of raw context.
 *
 * Builds context from all selections upstream of the target category,
 * then filters.
 *
 * @param category - Which category to populate
 * @param selections - All current phrase selections
 * @returns Filtered IntelligentPhrase[] for the category
 */
export function filterPhrasesFromSelections(
  category: PromptCategory,
  selections: PhraseSelection[],
): IntelligentPhrase[] {
  const context = buildContextForCategory(selections, category);
  return filterPhrases(category, context);
}

// ============================================================================
// TEXT SEARCH (for Phase 6 first-letter matching)
// ============================================================================

/**
 * Filter phrases by text query — matches any word in the phrase that
 * starts with the query string (case-insensitive).
 *
 * This implements the "first-letter matching on any word" behaviour
 * described in §3.3: typing "go" shows "golden ore veins glistening...".
 *
 * @param phrases - Pre-filtered phrases (from filterPhrases)
 * @param query - User's typed text (e.g. "go")
 * @returns Phrases where any word starts with the query
 */
export function searchPhrases(phrases: IntelligentPhrase[], query: string): IntelligentPhrase[] {
  if (!query || query.length === 0) return [];

  const q = query.toLowerCase();

  return phrases.filter((p) => {
    const words = p.text.toLowerCase().split(/\s+/);
    return words.some((word) => word.startsWith(q));
  });
}

// ============================================================================
// CONTEXT SUMMARY (for debugging / UI display)
// ============================================================================

/**
 * Get a human-readable summary of the current context.
 * Useful for debugging or showing users why certain phrases appear.
 */
export function summarizeContext(ctx: PromptContext): string {
  const parts: string[] = [];

  if (ctx.commodityIds.size > 0) {
    parts.push(`commodities: ${[...ctx.commodityIds].join(', ')}`);
  }
  if (ctx.groups.size > 0) {
    parts.push(`groups: ${[...ctx.groups].join(', ')}`);
  }
  if (ctx.moods.size > 0) {
    parts.push(`mood: ${[...ctx.moods].join(', ')}`);
  }
  if (ctx.weatherEvents.size > 0) {
    parts.push(`weather: ${[...ctx.weatherEvents].join(', ')}`);
  }
  if (ctx.countryCodes.size > 0) {
    parts.push(`countries: ${[...ctx.countryCodes].join(', ')}`);
  }
  if (ctx.extractionMethods.size > 0) {
    parts.push(`extraction: ${[...ctx.extractionMethods].join(', ')}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '(empty context)';
}

/**
 * Get filter statistics — how much narrowing happened.
 */
export function getFilterStats(
  category: PromptCategory,
  context: PromptContext,
): { total: number; filtered: number; ratio: number; bypassed: boolean } {
  const total = getIntelligentPhrases(category).length;
  const bypassed = BYPASS_CATEGORIES.has(category) || isContextEmpty(context);

  if (bypassed) {
    return { total, filtered: total, ratio: 1.0, bypassed: true };
  }

  const filtered = filterPhrases(category, context).length;
  return {
    total,
    filtered,
    ratio: total > 0 ? filtered / total : 1.0,
    bypassed: false,
  };
}
