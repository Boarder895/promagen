/**
 * Vocabulary Loader
 * =================
 * Loads vocabulary from JSON files and provides:
 * - Top 100 options for dropdown display
 * - All options for free-text chip display
 * - Context-aware suggestion pool
 *
 * v1.1.0 — Now combines core prompt-builder options with merged
 *          vocabulary from weather, commodity, and shared audits.
 *          Core options always appear first; merged options append.
 *
 * @version 1.1.0
 * @created 2026-01-21
 * @updated 2026-02-24
 */

import {
  vocabulary,
  type CategoryKey,
  type VocabularyCategory,
  getOptions,
} from '@/data/vocabulary/prompt-builder';

import { getMergedOptions, getMergedCount } from '@/data/vocabulary/merged';

import familiesData from '@/data/vocabulary/intelligence/families.json';

// ============================================================================
// TYPES
// ============================================================================

export interface VocabularyContext {
  /** Currently selected terms across all categories */
  selectedTerms?: string[];
  /** Detected dominant style family (e.g., 'cyberpunk', 'impressionism') */
  dominantFamily?: string | null;
  /** Platform tier (affects suggestion style) */
  platformTier?: 1 | 2 | 3 | 4;
  /** Market mood (affects atmosphere/colour suggestions) */
  marketMood?: 'bullish' | 'bearish' | 'neutral' | null;
}

export interface CategoryVocabulary {
  /** Top 100 options for dropdown (filtered/sorted by relevance) */
  dropdownOptions: string[];
  /** All options for free-text chip display */
  allOptions: string[];
  /** Top 20 context-aware suggestions */
  suggestionPool: string[];
  /** Category metadata */
  meta: {
    label: string;
    description: string;
    tooltipGuidance: string;
    totalAvailable: number;
    /** Count of core options (original prompt-builder) */
    coreCount: number;
    /** Count of merged options (weather + commodity + shared) */
    mergedCount: number;
  };
}

interface StyleFamily {
  id: string;
  name: string;
  members: string[];
  bestWith: string[];
  avoidWith: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DROPDOWN_LIMIT = 100;
const SUGGESTION_POOL_SIZE = 20;
const CHIP_DISPLAY_LIMIT = 50; // For performance in chip render

// ============================================================================
// COMBINED OPTIONS HELPER
// ============================================================================

/**
 * Get all options for a category: core first, then merged.
 * This is the single source of truth for "all available options".
 */
function getCombinedOptions(category: CategoryKey): string[] {
  const coreOpts = getOptions(category);
  const mergedOpts = getMergedOptions(category);

  if (mergedOpts.length === 0) return coreOpts;

  // Core first, merged appended — no duplicates possible
  // (dedup was enforced at build time in Part 0.4)
  return [...coreOpts, ...mergedOpts];
}

// ============================================================================
// FAMILY DETECTION
// ============================================================================

const styleFamilies = (familiesData as { families: StyleFamily[] }).families;

/**
 * Detect the dominant style family from selected terms
 */
export function detectDominantFamily(selectedTerms: string[]): string | null {
  if (!selectedTerms || selectedTerms.length === 0) return null;

  const lowerTerms = selectedTerms.map((t) => t.toLowerCase());

  // Score each family by how many of its members are selected
  let bestFamily: string | null = null;
  let bestScore = 0;

  for (const family of styleFamilies) {
    let score = 0;
    for (const member of family.members) {
      if (
        lowerTerms.some((t) => t.includes(member.toLowerCase()) || member.toLowerCase().includes(t))
      ) {
        score++;
      }
    }
    // Also check if family id/name matches
    if (lowerTerms.some((t) => t.includes(family.id) || family.id.includes(t))) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestFamily = family.id;
    }
  }

  return bestScore > 0 ? bestFamily : null;
}

/**
 * Get terms that work well with a style family
 */
function getFamilyBestWith(familyId: string): string[] {
  const family = styleFamilies.find((f) => f.id === familyId);
  return family?.bestWith ?? [];
}

/**
 * Get terms to avoid with a style family
 */
function getFamilyAvoidWith(familyId: string): string[] {
  const family = styleFamilies.find((f) => f.id === familyId);
  return family?.avoidWith ?? [];
}

// ============================================================================
// SCORING & SORTING
// ============================================================================

/**
 * Score a term based on context relevance
 * Higher score = more relevant to current selections
 */
function scoreTermByContext(term: string, context: VocabularyContext): number {
  let score = 0;
  const lowerTerm = term.toLowerCase();

  // Family match bonus
  if (context.dominantFamily) {
    const bestWith = getFamilyBestWith(context.dominantFamily);
    const avoidWith = getFamilyAvoidWith(context.dominantFamily);

    if (
      bestWith.some(
        (b) => lowerTerm.includes(b.toLowerCase()) || b.toLowerCase().includes(lowerTerm),
      )
    ) {
      score += 10;
    }

    if (
      avoidWith.some(
        (a) => lowerTerm.includes(a.toLowerCase()) || a.toLowerCase().includes(lowerTerm),
      )
    ) {
      score -= 5;
    }
  }

  // Market mood bonus (for atmosphere/colour categories)
  if (context.marketMood) {
    const moodTerms: Record<string, string[]> = {
      bullish: [
        'vibrant',
        'bright',
        'golden',
        'warm',
        'energetic',
        'triumphant',
        'ascending',
        'radiant',
      ],
      bearish: ['moody', 'dark', 'cold', 'dramatic', 'stormy', 'tense', 'shadowy', 'muted'],
      neutral: ['balanced', 'calm', 'serene', 'natural', 'soft', 'subtle'],
    };

    const relevantTerms = moodTerms[context.marketMood] ?? [];
    if (relevantTerms.some((m) => lowerTerm.includes(m))) {
      score += 5;
    }
  }

  // Avoid already-selected terms
  if (context.selectedTerms?.some((s) => s.toLowerCase() === lowerTerm)) {
    score -= 100;
  }

  return score;
}

/**
 * Sort options by relevance to context
 */
function sortByRelevance(options: string[], context?: VocabularyContext): string[] {
  if (
    !context ||
    (!context.dominantFamily && !context.marketMood && !context.selectedTerms?.length)
  ) {
    return options;
  }

  const scored = options.map((opt) => ({
    term: opt,
    score: scoreTermByContext(opt, context),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.term.localeCompare(b.term);
  });

  return scored.map((s) => s.term);
}

// ============================================================================
// MAIN LOADER FUNCTION
// ============================================================================

/**
 * Load vocabulary for a category with optional context-aware sorting
 *
 * @param category - The category key (subject, style, lighting, etc.)
 * @param context - Optional context for intelligent sorting
 * @returns CategoryVocabulary with dropdown options, all options, and suggestions
 *
 * @example
 * // Basic usage (no context)
 * const styleVocab = loadCategoryVocabulary('style');
 * console.log(styleVocab.allOptions.length); // ~325 (core 295 + merged 30)
 *
 * @example
 * // With context (intelligent sorting)
 * const vocab = loadCategoryVocabulary('lighting', {
 *   selectedTerms: ['cyberpunk', 'neon aesthetic'],
 *   dominantFamily: 'cyberpunk',
 *   marketMood: 'bullish'
 * });
 */
export function loadCategoryVocabulary(
  category: CategoryKey,
  context?: VocabularyContext,
): CategoryVocabulary {
  const allOptions = getCombinedOptions(category);
  const vocabData = vocabulary[category] as VocabularyCategory;
  const coreCount = getOptions(category).length;
  const mergedCount = getMergedCount(category);

  const sorted = sortByRelevance(allOptions, context);

  const suggestionPool = sorted
    .filter((term) => !context?.selectedTerms?.includes(term))
    .slice(0, SUGGESTION_POOL_SIZE);

  const dropdownOptions = sorted.slice(0, DROPDOWN_LIMIT);

  return {
    dropdownOptions,
    allOptions,
    suggestionPool,
    meta: {
      label: vocabData.meta.label,
      description: vocabData.meta.description,
      tooltipGuidance: vocabData.meta.tooltipGuidance,
      totalAvailable: allOptions.length,
      coreCount,
      mergedCount,
    },
  };
}

/**
 * Load vocabulary for all categories at once
 */
export function loadAllVocabulary(
  context?: VocabularyContext,
): Record<CategoryKey, CategoryVocabulary> {
  const categories: CategoryKey[] = [
    'subject',
    'action',
    'style',
    'environment',
    'composition',
    'camera',
    'lighting',
    'atmosphere',
    'colour',
    'materials',
    'fidelity',
    'negative',
  ];

  const result = {} as Record<CategoryKey, CategoryVocabulary>;

  for (const category of categories) {
    result[category] = loadCategoryVocabulary(category, context);
  }

  return result;
}

/**
 * Get chips to display in free-text area (performance-limited)
 */
export function getChipDisplayOptions(
  category: CategoryKey,
  selectedTerms: string[],
  searchQuery?: string,
): string[] {
  const allOptions = getCombinedOptions(category);

  let filtered = allOptions.filter(
    (opt) => !selectedTerms.some((s) => s.toLowerCase() === opt.toLowerCase()),
  );

  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((opt) => opt.toLowerCase().startsWith(query));
  }

  return filtered.slice(0, CHIP_DISPLAY_LIMIT);
}

/**
 * Search across a category's vocabulary (core + merged)
 */
export function searchCategoryVocabulary(
  category: CategoryKey,
  query: string,
): Array<{ term: string; matchType: 'exact' | 'startsWith' | 'contains' }> {
  if (!query || !query.trim()) return [];

  const allOptions = getCombinedOptions(category);
  const lowerQuery = query.toLowerCase();

  const results: Array<{ term: string; matchType: 'exact' | 'startsWith' | 'contains' }> = [];

  for (const term of allOptions) {
    const lowerTerm = term.toLowerCase();

    if (lowerTerm === lowerQuery) {
      results.push({ term, matchType: 'exact' });
    } else if (lowerTerm.startsWith(lowerQuery)) {
      results.push({ term, matchType: 'startsWith' });
    } else if (lowerTerm.includes(lowerQuery)) {
      results.push({ term, matchType: 'contains' });
    }
  }

  results.sort((a, b) => {
    const order = { exact: 0, startsWith: 1, contains: 2 };
    return order[a.matchType] - order[b.matchType];
  });

  return results;
}

/**
 * Get combined vocabulary statistics (core + merged)
 */
/**
 * Get the count of explorable terms for a category (total minus selected).
 * Used for the Explore Drawer trigger label: "Explore N more phrases ▾"
 */
export function getExploreCount(
  category: CategoryKey,
  selectedTerms: string[],
): number {
  const all = getCombinedOptions(category);
  const selectedSet = new Set(selectedTerms.map((s) => s.toLowerCase()));
  return all.filter((t) => !selectedSet.has(t.toLowerCase())).length;
}

export function getCombinedVocabularyStats(): {
  totalCategories: number;
  totalOptions: number;
  totalCore: number;
  totalMerged: number;
  categoryCounts: Record<CategoryKey, { core: number; merged: number; total: number }>;
} {
  const categories: CategoryKey[] = [
    'subject',
    'action',
    'style',
    'environment',
    'composition',
    'camera',
    'lighting',
    'atmosphere',
    'colour',
    'materials',
    'fidelity',
    'negative',
  ];

  const categoryCounts = {} as Record<CategoryKey, { core: number; merged: number; total: number }>;
  let totalCore = 0;
  let totalMerged = 0;

  for (const cat of categories) {
    const core = getOptions(cat).length;
    const merged = getMergedCount(cat);
    categoryCounts[cat] = { core, merged, total: core + merged };
    totalCore += core;
    totalMerged += merged;
  }

  return {
    totalCategories: categories.length,
    totalOptions: totalCore + totalMerged,
    totalCore,
    totalMerged,
    categoryCounts,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DROPDOWN_LIMIT, SUGGESTION_POOL_SIZE, CHIP_DISPLAY_LIMIT };

export type { StyleFamily, CategoryKey };

// Re-export merged utilities for direct access
export { getMergedOptions, getMergedCount, hasMergedData } from '@/data/vocabulary/merged';
export { getSourceGroupedOptions } from '@/data/vocabulary/merged';
export type { SourceGroup } from '@/data/vocabulary/merged';
