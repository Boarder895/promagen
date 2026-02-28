// src/lib/vocabulary/category-suggester.ts
// ============================================================================
// SMART CATEGORY SUGGESTION ENGINE — Phase 7.7 Part 2
// ============================================================================
//
// When a user submits a custom term in one category, this engine checks
// whether that term (or its tokens) also fits OTHER categories by matching
// against existing vocabulary across all 12 prompt builder categories.
//
// Example: User types "bioluminescent fog" in Atmosphere.
//   - "fog" appears in atmosphere's "morning fog", "dense fog"
//   - "bioluminescent" appears in lighting's "bioluminescent glow"
//   → suggestedCategories: ["atmosphere", "lighting"]
//
// On batch accept, the term is added to ALL suggested categories,
// not just the one the user originally typed it into.
//
// Design:
//   - Lightweight substring token matching (not ML)
//   - Vocab map cached at module level, invalidated after batch accept
//   - Always includes the original category in results
//   - Minimum token length of 3 to avoid false positives ("a", "in", "of")
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import {
  getOptions,
  type CategoryKey,
} from '@/data/vocabulary/prompt-builder';
import { getMergedOptions } from '@/data/vocabulary/merged';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum token length for substring matching.
 * Tokens shorter than this are ignored to prevent false positives
 * from common words like "a", "in", "of", "on", "at".
 */
const MIN_TOKEN_LENGTH = 3;

/**
 * Maximum number of suggested categories (including the original).
 * Prevents a very common token from suggesting every category.
 */
const MAX_SUGGESTIONS = 4;

// ============================================================================
// VOCAB CACHE
// ============================================================================

/**
 * Cached map of category → lowercased options array.
 * Built lazily on first call. Invalidated via invalidateVocabCache()
 * after a batch accept writes new terms to the JSONs.
 *
 * Key: PromptCategory (e.g. "atmosphere")
 * Value: Array of lowercased option strings from both core + merged vocab
 */
let _vocabCache: Map<PromptCategory, string[]> | null = null;

/**
 * Build the vocab cache from core prompt-builder and merged vocabulary.
 * Combines both sources per category into a single lowercased array.
 */
function buildVocabCache(): Map<PromptCategory, string[]> {
  const cache = new Map<PromptCategory, string[]>();

  for (const category of CATEGORY_ORDER) {
    const key = category as CategoryKey;
    const coreOptions = getOptions(key);
    const mergedOptions = getMergedOptions(key);

    // Combine, lowercase, deduplicate
    const combined = new Set<string>();
    for (const opt of coreOptions) {
      const lower = opt.trim().toLowerCase();
      if (lower) combined.add(lower);
    }
    for (const opt of mergedOptions) {
      const lower = opt.trim().toLowerCase();
      if (lower) combined.add(lower);
    }

    cache.set(category, Array.from(combined));
  }

  return cache;
}

/**
 * Get the vocab cache, building it if needed.
 */
function getVocabCache(): Map<PromptCategory, string[]> {
  if (!_vocabCache) {
    _vocabCache = buildVocabCache();
  }
  return _vocabCache;
}

/**
 * Invalidate the vocab cache.
 * MUST be called after batch accept writes new terms to vocab JSONs,
 * so subsequent suggestions reflect the updated vocabulary.
 */
export function invalidateVocabCache(): void {
  _vocabCache = null;
}

// ============================================================================
// TOKEN MATCHING
// ============================================================================

/**
 * Tokenise a term into meaningful words for matching.
 * Splits on spaces, hyphens, and underscores. Filters short tokens.
 *
 * Example: "bioluminescent fog" → ["bioluminescent", "fog"]
 * Example: "soft-lit corridor" → ["soft", "lit", "corridor"]
 * Example: "8K ultra"          → ["ultra"] (digits-only tokens skipped)
 */
function tokenise(term: string): string[] {
  return term
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((token) => token.length >= MIN_TOKEN_LENGTH)
    .filter((token) => !/^\d+$/.test(token)); // Skip pure numbers
}

/**
 * Check if any token from the term appears as a substring in any option
 * within a category's vocabulary.
 *
 * Returns true if at least one token matches at least one option.
 */
function categoryContainsToken(
  categoryOptions: string[],
  tokens: string[]
): boolean {
  for (const token of tokens) {
    for (const option of categoryOptions) {
      if (option.includes(token)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Suggest which categories a submitted term fits.
 *
 * Always includes the original category. Checks all 12 categories for
 * token substring matches against existing vocabulary.
 *
 * @param term            - The normalised term (trimmed, lowercased)
 * @param originalCategory - The category the user typed it into
 * @returns Array of PromptCategory, always includes originalCategory first
 *
 * @example
 * suggestCategories('bioluminescent fog', 'atmosphere')
 * // → ['atmosphere', 'lighting']
 *
 * @example
 * suggestCategories('golden hour warmth', 'lighting')
 * // → ['lighting', 'colour', 'atmosphere']
 */
export function suggestCategories(
  term: string,
  originalCategory: PromptCategory
): PromptCategory[] {
  const tokens = tokenise(term);

  // If no meaningful tokens (e.g. term is "8K" → no tokens after filter),
  // just return the original category
  if (tokens.length === 0) {
    return [originalCategory];
  }

  const vocabCache = getVocabCache();
  const suggestions: PromptCategory[] = [originalCategory];

  for (const category of CATEGORY_ORDER) {
    // Skip the original — it's already included
    if (category === originalCategory) continue;

    // Stop if we've hit the max
    if (suggestions.length >= MAX_SUGGESTIONS) break;

    const options = vocabCache.get(category);
    if (!options || options.length === 0) continue;

    if (categoryContainsToken(options, tokens)) {
      suggestions.push(category);
    }
  }

  return suggestions;
}

/**
 * Check if a term already exists in a specific category's vocabulary
 * (both core and merged).
 *
 * Used by the API route for dedup Layer 2 (server POST) and
 * Layer 3 (server ACCEPT re-check before write).
 *
 * @param term     - The normalised term (trimmed, lowercased)
 * @param category - The category to check
 * @returns true if the term already exists in that category's vocab
 */
export function termExistsInCategory(
  term: string,
  category: PromptCategory
): boolean {
  const vocabCache = getVocabCache();
  const options = vocabCache.get(category);
  if (!options) return false;
  return options.includes(term);
}

/**
 * Check if a term already exists in ANY category's vocabulary.
 * Used by the client-side Layer 1 dedup (lightweight check).
 *
 * @param term - The normalised term (trimmed, lowercased)
 * @returns The category it was found in, or null if not found
 */
export function termExistsInAnyCategory(
  term: string
): PromptCategory | null {
  const vocabCache = getVocabCache();

  for (const category of CATEGORY_ORDER) {
    const options = vocabCache.get(category);
    if (options && options.includes(term)) {
      return category;
    }
  }

  return null;
}
