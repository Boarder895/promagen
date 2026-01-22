/**
 * Vocabulary Loader
 * =================
 * Loads vocabulary from JSON files and provides:
 * - Top 100 options for dropdown display
 * - All options for free-text chip display
 * - Context-aware suggestion pool
 *
 * @version 1.0.0
 * @created 2026-01-21
 */

import {
  vocabulary,
  type CategoryKey,
  type VocabularyCategory,
  getOptions,
} from '@/data/vocabulary/prompt-builder';

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

  // Base score: common/popular terms get slight boost
  // (first 50 in JSON are typically most common)

  // Family match bonus
  if (context.dominantFamily) {
    const bestWith = getFamilyBestWith(context.dominantFamily);
    const avoidWith = getFamilyAvoidWith(context.dominantFamily);

    // Boost terms that work well with detected family
    if (
      bestWith.some(
        (b) => lowerTerm.includes(b.toLowerCase()) || b.toLowerCase().includes(lowerTerm),
      )
    ) {
      score += 10;
    }

    // Penalise terms that conflict with detected family
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
    score -= 100; // Strongly deprioritise duplicates
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
    // No context - return as-is (already in sensible order from JSON)
    return options;
  }

  // Score and sort
  const scored = options.map((opt) => ({
    term: opt,
    score: scoreTermByContext(opt, context),
  }));

  // Sort by score descending, then alphabetically for ties
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
 * console.log(styleVocab.dropdownOptions.length); // 100
 * console.log(styleVocab.allOptions.length); // ~300
 *
 * @example
 * // With context (intelligent sorting)
 * const vocab = loadCategoryVocabulary('lighting', {
 *   selectedTerms: ['cyberpunk', 'neon aesthetic'],
 *   dominantFamily: 'cyberpunk',
 *   marketMood: 'bullish'
 * });
 * // vocab.suggestionPool will prioritise neon/bright lighting
 */
export function loadCategoryVocabulary(
  category: CategoryKey,
  context?: VocabularyContext,
): CategoryVocabulary {
  // Get all options from vocabulary (excludes empty string)
  const allOptions = getOptions(category);
  const vocabData = vocabulary[category] as VocabularyCategory;

  // Sort by relevance if context provided
  const sorted = sortByRelevance(allOptions, context);

  // Build suggestion pool from top-scored items
  const suggestionPool = sorted
    .filter((term) => !context?.selectedTerms?.includes(term)) // Exclude already selected
    .slice(0, SUGGESTION_POOL_SIZE);

  // Dropdown gets top 100 (or all if fewer)
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
    },
  };
}

/**
 * Load vocabulary for all categories at once
 * Useful for initial render optimisation
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
 * Returns subset of all options, excluding already selected
 */
export function getChipDisplayOptions(
  category: CategoryKey,
  selectedTerms: string[],
  searchQuery?: string,
): string[] {
  const allOptions = getOptions(category);

  // Filter out already selected
  let filtered = allOptions.filter(
    (opt) => !selectedTerms.some((s) => s.toLowerCase() === opt.toLowerCase()),
  );

  // Apply search filter if provided
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((opt) => opt.toLowerCase().startsWith(query));
  }

  // Limit for performance
  return filtered.slice(0, CHIP_DISPLAY_LIMIT);
}

/**
 * Search across a category's vocabulary
 * Returns matching terms with match type indicator
 */
export function searchCategoryVocabulary(
  category: CategoryKey,
  query: string,
): Array<{ term: string; matchType: 'exact' | 'startsWith' | 'contains' }> {
  if (!query || !query.trim()) return [];

  const allOptions = getOptions(category);
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

  // Sort: exact first, then startsWith, then contains
  results.sort((a, b) => {
    const order = { exact: 0, startsWith: 1, contains: 2 };
    return order[a.matchType] - order[b.matchType];
  });

  return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DROPDOWN_LIMIT, SUGGESTION_POOL_SIZE, CHIP_DISPLAY_LIMIT };

export type { StyleFamily, CategoryKey };
