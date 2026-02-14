// src/hooks/use-intelligent-phrases.ts
// ============================================================================
// INTELLIGENT PHRASES HOOK
// ============================================================================
// Manages intelligent phrase state alongside the standard prompt builder.
// Tracks one phrase per category (11 categories, not Negative), feeds the
// cascading filter engine, and provides the text search for type-to-discover.
//
// DESIGN:
// - Runs ALONGSIDE use-prompt-intelligence, not inside it (no modification)
// - phraseSelections: Record<PromptCategory, IntelligentPhrase | null>
// - On select/remove, rebuilds cascading context and notifies consumers
// - searchPhrases: filters pre-filtered pool by typed query
// - getAvailablePhrases: returns cascading-filtered pool for a category
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 6
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import type { IntelligentPhrase } from '@/data/vocabulary/phrase-category-types';
import {
  filterPhrasesFromSelections,
  searchPhrases as searchPhrasesEngine,
  type PhraseSelection,
} from '@/lib/prompt-intelligence/phrase-filter';

// ============================================================================
// TYPES
// ============================================================================

/** One phrase per category (null = nothing selected) */
export type PhraseSelections = Record<PromptCategory, IntelligentPhrase | null>;

/** Empty state factory */
const EMPTY_PHRASE_SELECTIONS: PhraseSelections = {
  subject: null,
  action: null,
  style: null,
  environment: null,
  composition: null,
  camera: null,
  lighting: null,
  colour: null,
  atmosphere: null,
  materials: null,
  fidelity: null,
  negative: null,
};

/** Categories that DO NOT get an intelligent phrases dropdown */
const EXCLUDED_CATEGORIES: ReadonlySet<PromptCategory> = new Set(['negative']);

// ============================================================================
// HOOK
// ============================================================================

export interface UseIntelligentPhrasesReturn {
  /** Current phrase selection per category (null = none) */
  phraseSelections: PhraseSelections;

  /** Select a phrase for a category (replaces any existing) */
  selectPhrase: (category: PromptCategory, phrase: IntelligentPhrase) => void;

  /** Remove the phrase from a category */
  removePhrase: (category: PromptCategory) => void;

  /** Clear all phrase selections */
  clearAllPhrases: () => void;

  /** Get the cascading-filtered phrase pool for a category */
  getAvailablePhrases: (category: PromptCategory) => IntelligentPhrase[];

  /** Search within the filtered pool (type-to-discover) */
  searchPhrases: (category: PromptCategory, query: string) => IntelligentPhrase[];

  /** Check if a category has a phrase selected */
  hasPhrase: (category: PromptCategory) => boolean;

  /** Check if a category is eligible for phrases (not Negative) */
  isEligible: (category: PromptCategory) => boolean;

  /** Get the selected phrase text for a category (for prompt assembly) */
  getPhraseText: (category: PromptCategory) => string | null;

  /** Get all selected phrase texts keyed by category (for prompt output) */
  getAllPhraseTexts: () => Partial<Record<PromptCategory, string>>;

  /** Count of categories with a phrase selected */
  selectedCount: number;
}

export function useIntelligentPhrases(): UseIntelligentPhrasesReturn {
  const [phraseSelections, setPhraseSelections] = useState<PhraseSelections>(
    () => ({ ...EMPTY_PHRASE_SELECTIONS }),
  );

  // =========================================================================
  // Build PhraseSelection[] for the filter engine (converts our state format)
  // =========================================================================
  const filterSelections: PhraseSelection[] = useMemo(() => {
    const result: PhraseSelection[] = [];
    for (const cat of CATEGORY_ORDER) {
      const phrase = phraseSelections[cat];
      if (phrase) {
        result.push({ category: cat, phrase });
      }
    }
    return result;
  }, [phraseSelections]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  /** Select a phrase for a category. Replaces any existing (limit 1). */
  const selectPhrase = useCallback(
    (category: PromptCategory, phrase: IntelligentPhrase) => {
      if (EXCLUDED_CATEGORIES.has(category)) return;
      setPhraseSelections((prev) => ({
        ...prev,
        [category]: phrase,
      }));
    },
    [],
  );

  /** Remove the phrase from a category. */
  const removePhrase = useCallback((category: PromptCategory) => {
    setPhraseSelections((prev) => ({
      ...prev,
      [category]: null,
    }));
  }, []);

  /** Clear all phrase selections (used by "Clear All" button). */
  const clearAllPhrases = useCallback(() => {
    setPhraseSelections({ ...EMPTY_PHRASE_SELECTIONS });
  }, []);

  // =========================================================================
  // PHRASE RETRIEVAL
  // =========================================================================

  /**
   * Get the cascading-filtered phrase pool for a category.
   * Uses all upstream phrase selections to narrow the pool.
   */
  const getAvailablePhrases = useCallback(
    (category: PromptCategory): IntelligentPhrase[] => {
      if (EXCLUDED_CATEGORIES.has(category)) return [];
      return filterPhrasesFromSelections(category, filterSelections);
    },
    [filterSelections],
  );

  /**
   * Search within the filtered pool — type-to-discover.
   * First-letter matching on any word in each phrase.
   * Returns empty array if query is empty (phrases hidden by default).
   */
  const searchPhrases = useCallback(
    (category: PromptCategory, query: string): IntelligentPhrase[] => {
      if (EXCLUDED_CATEGORIES.has(category)) return [];
      if (!query || query.length === 0) return [];
      const pool = filterPhrasesFromSelections(category, filterSelections);
      return searchPhrasesEngine(pool, query);
    },
    [filterSelections],
  );

  // =========================================================================
  // UTILITIES
  // =========================================================================

  const hasPhrase = useCallback(
    (category: PromptCategory): boolean => phraseSelections[category] !== null,
    [phraseSelections],
  );

  const isEligible = useCallback(
    (category: PromptCategory): boolean => !EXCLUDED_CATEGORIES.has(category),
    [],
  );

  const getPhraseText = useCallback(
    (category: PromptCategory): string | null => phraseSelections[category]?.text ?? null,
    [phraseSelections],
  );

  const getAllPhraseTexts = useCallback((): Partial<Record<PromptCategory, string>> => {
    const result: Partial<Record<PromptCategory, string>> = {};
    for (const cat of CATEGORY_ORDER) {
      const phrase = phraseSelections[cat];
      if (phrase) {
        result[cat] = phrase.text;
      }
    }
    return result;
  }, [phraseSelections]);

  const selectedCount = useMemo(
    () => CATEGORY_ORDER.filter((cat) => phraseSelections[cat] !== null).length,
    [phraseSelections],
  );

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    phraseSelections,
    selectPhrase,
    removePhrase,
    clearAllPhrases,
    getAvailablePhrases,
    searchPhrases,
    hasPhrase,
    isEligible,
    getPhraseText,
    getAllPhraseTexts,
    selectedCount,
  };
}

export default useIntelligentPhrases;
