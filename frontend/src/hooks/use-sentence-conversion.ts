// src/hooks/use-sentence-conversion.ts
// ============================================================================
// useSentenceConversion — Human Sentence → Structured Categories
// ============================================================================
// Calls POST /api/parse-sentence, then matches returned terms to the existing
// vocabulary (exact → fuzzy → custom entry). Returns a CategoryState map
// ready to apply to the prompt builder dropdowns.
//
// One Brain rule: this hook ONLY parses. assemblePrompt() optimises.
//
// Authority: human-sentence-conversion.md §4 (Dropdown Population)
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import type { PromptCategory, CategoryState } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';
import { getOptions } from '@/data/vocabulary/prompt-builder';
import type { CategoryKey } from '@/data/vocabulary/prompt-builder';

// ============================================================================
// TYPES
// ============================================================================

export interface SentenceConversionResult {
  /** Parsed categories ready to apply to builder state */
  categories: Record<PromptCategory, CategoryState> | null;
  /** Whether the API call is in progress */
  isLoading: boolean;
  /** Error message if the call failed */
  error: string | null;
  /** Which category is currently being "populated" (for staggered animation) */
  populatingCategory: PromptCategory | null;
  /** Trigger the conversion */
  convert: (sentence: string) => Promise<void>;
}

// ============================================================================
// TERM MATCHING
// ============================================================================

/**
 * Match a term from the API response to existing vocabulary.
 * Priority: exact match → substring containment → fuzzy (Levenshtein ≤ 3) → no match.
 *
 * Returns the matched vocabulary term, or null if no match found.
 * Exported for testing.
 */
export function matchTermToVocabulary(term: string, category: PromptCategory): string | null {
  const options = getOptions(category as CategoryKey);
  const termLower = term.toLowerCase().trim();

  if (!termLower) return null;

  // 1. Exact match (case-insensitive)
  const exact = options.find((opt) => opt.toLowerCase() === termLower);
  if (exact) return exact;

  // 2. Substring containment — term contains an option or option contains term
  const substringMatch = options.find((opt) => {
    const optLower = opt.toLowerCase();
    return termLower.includes(optLower) || optLower.includes(termLower);
  });
  if (substringMatch) return substringMatch;

  // 3. Levenshtein distance ≤ 3
  const fuzzyMatch = options.find((opt) => {
    return levenshteinDistance(termLower, opt.toLowerCase()) <= 3;
  });
  if (fuzzyMatch) return fuzzyMatch;

  // No match — will go into custom entry
  return null;
}

/**
 * Basic Levenshtein distance for fuzzy matching.
 * Exported for testing.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,       // deletion
        dp[i]![j - 1]! + 1,       // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  return dp[m]![n]!;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSentenceConversion(): SentenceConversionResult {
  const [categories, setCategories] = useState<Record<PromptCategory, CategoryState> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [populatingCategory, setPopulatingCategory] = useState<PromptCategory | null>(null);

  const convert = useCallback(async (sentence: string) => {
    const trimmed = sentence.trim();
    if (!trimmed) {
      setError('Please enter a description.');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Maximum 1,000 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCategories(null);
    setPopulatingCategory(null);

    try {
      const res = await fetch('/api/parse-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Request failed' }));
        setError(data.message ?? 'Failed to parse. Please try again.');
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const parsed = data.categories as Record<string, string[]>;

      if (!parsed) {
        setError('No categories returned. Please try again.');
        setIsLoading(false);
        return;
      }

      // ── Build CategoryState with staggered population animation ────
      // Each category populates with a 150ms delay between them
      // so the user watches the dropdowns fill in sequence.
      const result: Record<string, CategoryState> = {};

      // Initialise all categories as empty
      for (const cat of CATEGORY_ORDER) {
        result[cat] = { selected: [], customValue: '' };
      }

      // Process each category with staggered animation
      for (let i = 0; i < CATEGORY_ORDER.length; i++) {
        const cat = CATEGORY_ORDER[i]!;
        const apiTerms = parsed[cat] ?? [];

        if (apiTerms.length === 0) continue;

        // Signal which category is being populated (for animation)
        setPopulatingCategory(cat);

        // Match terms to vocabulary
        const matched: string[] = [];
        const customTerms: string[] = [];

        for (const term of apiTerms) {
          const vocabMatch = matchTermToVocabulary(term, cat);
          if (vocabMatch) {
            // Avoid duplicates
            if (!matched.includes(vocabMatch)) {
              matched.push(vocabMatch);
            }
          } else {
            // Unknown term → custom entry
            customTerms.push(term);
          }
        }

        result[cat] = {
          selected: matched,
          customValue: customTerms.join(', '),
        };

        // Staggered delay — 150ms between each category that has content
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      setCategories(result as Record<PromptCategory, CategoryState>);
      setPopulatingCategory(null);
      setIsLoading(false);
    } catch (err) {
      console.error('[useSentenceConversion] Error:', err);
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }, []);

  return { categories, isLoading, error, populatingCategory, convert };
}
