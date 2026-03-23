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
 * Priority: exact match → substring containment (shortest preferred) → fuzzy (Levenshtein ≤ 3) → no match.
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

  // 2. Substring containment — prefer shortest matching option to avoid
  //    embellishment (e.g., "shot on Leica" should NOT match "vintage Leica look")
  const substringMatches = options.filter((opt) => {
    const optLower = opt.toLowerCase();
    return termLower.includes(optLower) || optLower.includes(termLower);
  });
  if (substringMatches.length > 0) {
    // Sort by length ascending — shortest match is closest to the user's intent
    substringMatches.sort((a, b) => a.length - b.length);
    return substringMatches[0]!;
  }

  // 3. Levenshtein distance ≤ 3 (only for terms 5+ chars to avoid "art"→"cart")
  // SKIP fuzzy matching if term contains a digit — numbers are precise specs
  // (e.g., "90mm lens" must not fuzzy-match to "50mm lens" at distance 1)
  const containsDigit = /\d/.test(termLower);
  if (termLower.length >= 5 && !containsDigit) {
    const fuzzyMatch = options.find((opt) => {
      return levenshteinDistance(termLower, opt.toLowerCase()) <= 3;
    });
    if (fuzzyMatch) return fuzzyMatch;
  }

  // No match — will go into custom entry
  return null;
}

// ============================================================================
// POST-PARSE TERM CLEANERS
// ============================================================================

/** Light-related nouns — if a Lighting term lacks one, it's a contextless fragment */
const LIGHT_NOUNS = /\b(light|lighting|glow|sunlight|moonlight|illumination|shadow|shadows|backlit|backlight|lamp|candle|neon|flash|spotlight|ray|rays|beam)\b/i;

/**
 * Clean up parsed terms per category. Applied after engine extraction, before
 * vocabulary matching. Fixes contextless fragments and known issues.
 *
 * Fix 1: Lighting terms missing a light-noun get " light" appended.
 * Fix 8: Strips orphaned fragments like "one in the" (time-of-day leakage).
 */
function cleanParsedTerms(category: PromptCategory, terms: string[]): string[] {
  if (terms.length === 0) return terms;

  return terms
    .map((term) => {
      const trimmed = term.trim();
      if (!trimmed) return '';

      // Fix 1: Lighting terms without a light-noun → append " light"
      if (category === 'lighting' && !LIGHT_NOUNS.test(trimmed)) {
        return `${trimmed} light`;
      }

      return trimmed;
    })
    .filter((term) => {
      if (!term) return false;
      // Fix 8: Strip orphan time-of-day fragments that leak from weather generator
      if (/^one in the\b/i.test(term) && term.length < 20) return false;
      // Strip very short fragments (1-2 chars) that are noise
      if (term.length < 3) return false;
      return true;
    });
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
        const rawTerms = parsed[cat] ?? [];
        const apiTerms = cleanParsedTerms(cat, rawTerms);

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
