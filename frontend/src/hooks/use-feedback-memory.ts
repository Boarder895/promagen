// src/hooks/use-feedback-memory.ts
// ============================================================================
// CONTEXTUAL FEEDBACK MEMORY — localStorage persistence & pattern detection
// ============================================================================
//
// Phase 7.10g — Remember rated prompts per platform, surface contextual hints.
//
// Stores up to MAX_ENTRIES_PER_PLATFORM rated prompts in localStorage.
// Detects overlap between current selections and previously rated prompts.
// Exports term-level hints for the Feedback-Driven Term Autopilot.
//
// Pure hook — no side effects except localStorage I/O.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10g
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import type { FeedbackRating } from '@/types/feedback';
import type { PromptSelections } from '@/types/prompt-builder';

// ============================================================================
// CONSTANTS
// ============================================================================

/** localStorage key for feedback memory */
export const FEEDBACK_MEMORY_KEY = 'promagen_feedback_memory';

/** Maximum stored entries per platform */
export const MAX_ENTRIES_PER_PLATFORM = 10;

/** Minimum term overlap count to trigger a contextual hint */
export const OVERLAP_THRESHOLD = 2;

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single rated prompt stored in feedback memory.
 */
export interface FeedbackMemoryEntry {
  /** Platform the prompt was built for */
  platform: string;
  /** Rating the user gave */
  rating: FeedbackRating;
  /** Flattened list of terms from the prompt's selections */
  terms: string[];
  /** ISO timestamp */
  timestamp: string;
  /** Prompt event ID for linkage */
  eventId: string;
}

/**
 * Full memory store: platform → ordered list of entries (newest last).
 */
export interface FeedbackMemoryStore {
  platforms: Record<string, FeedbackMemoryEntry[]>;
}

/**
 * A detected overlap between current selections and a rated prompt.
 */
export interface FeedbackOverlap {
  /** The rating from the matched prompt */
  rating: FeedbackRating;
  /** Terms that overlap between current and rated prompt */
  overlappingTerms: string[];
  /** How long ago the rated prompt was created */
  timestamp: string;
}

/**
 * Term-level hint for the Feedback-Driven Autopilot.
 *
 * Positive = term appeared in hot-rated prompts → green hint
 * Negative = term appeared in cold-rated prompts → amber hint
 */
export type TermHintType = 'positive' | 'negative';

export interface TermHint {
  /** The vocabulary term */
  term: string;
  /** Whether this term is from a positively or negatively rated prompt */
  type: TermHintType;
  /** How many rated prompts this term appeared in (for strength) */
  count: number;
}

// ============================================================================
// LOCALSTORAGE I/O
// ============================================================================

function loadMemory(): FeedbackMemoryStore {
  try {
    const raw = localStorage.getItem(FEEDBACK_MEMORY_KEY);
    if (!raw) return { platforms: {} };
    const parsed = JSON.parse(raw) as FeedbackMemoryStore;
    if (!parsed.platforms || typeof parsed.platforms !== 'object') {
      return { platforms: {} };
    }
    return parsed;
  } catch {
    return { platforms: {} };
  }
}

function saveMemory(store: FeedbackMemoryStore): void {
  try {
    localStorage.setItem(FEEDBACK_MEMORY_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or blocked — silent fail
  }
}

// ============================================================================
// PURE HELPERS
// ============================================================================

/**
 * Flatten PromptSelections into a single string array.
 */
export function flattenSelections(selections: PromptSelections): string[] {
  const terms: string[] = [];
  for (const values of Object.values(selections)) {
    if (Array.isArray(values)) {
      terms.push(...values);
    }
  }
  return terms;
}

/**
 * Find overlapping terms between current selections and a rated prompt.
 */
export function findOverlap(
  currentTerms: string[],
  ratedTerms: string[],
): string[] {
  const ratedSet = new Set(ratedTerms);
  return currentTerms.filter((t) => ratedSet.has(t));
}

/**
 * Build term hints from all entries for a platform.
 *
 * Aggregates: for each unique term, count how many positive vs negative
 * rated prompts it appeared in. Terms with net positive → 'positive' hint.
 * Terms with net negative → 'negative' hint. Ties → no hint.
 * Neutral ratings are ignored (no signal).
 */
export function buildTermHints(entries: FeedbackMemoryEntry[]): TermHint[] {
  const termScores = new Map<string, { positive: number; negative: number }>();

  for (const entry of entries) {
    if (entry.rating === 'neutral') continue;

    for (const term of entry.terms) {
      const existing = termScores.get(term) ?? { positive: 0, negative: 0 };
      if (entry.rating === 'positive') {
        existing.positive++;
      } else {
        existing.negative++;
      }
      termScores.set(term, existing);
    }
  }

  const hints: TermHint[] = [];
  for (const [term, scores] of termScores) {
    if (scores.positive > scores.negative) {
      hints.push({ term, type: 'positive', count: scores.positive });
    } else if (scores.negative > scores.positive) {
      hints.push({ term, type: 'negative', count: scores.negative });
    }
    // Tie → no hint
  }

  return hints;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseFeedbackMemoryReturn {
  /**
   * Store a newly rated prompt in memory.
   * Call after FeedbackInvitation onComplete fires with a rating.
   */
  recordRatedPrompt: (
    platform: string,
    rating: FeedbackRating,
    selections: PromptSelections,
    eventId: string,
  ) => void;

  /**
   * Get overlaps between current selections and previously rated prompts.
   * Returns the most relevant overlap (strongest match) or null.
   */
  getOverlap: (
    platform: string,
    selections: PromptSelections,
  ) => FeedbackOverlap | null;

  /**
   * Get term-level hints for the Autopilot.
   * Returns terms annotated with positive/negative based on feedback history.
   */
  getTermHints: (platform: string) => TermHint[];

  /**
   * Get all entries for a platform (for debugging/admin).
   */
  getEntries: (platform: string) => readonly FeedbackMemoryEntry[];

  /**
   * Clear all feedback memory.
   */
  clear: () => void;
}

/**
 * Hook for contextual feedback memory.
 *
 * Persists rated prompts in localStorage, detects selection overlaps,
 * and provides term-level hints for the Feedback-Driven Autopilot.
 *
 * @example
 * ```tsx
 * const { recordRatedPrompt, getOverlap, getTermHints } = useFeedbackMemory();
 *
 * // After feedback submitted:
 * recordRatedPrompt('midjourney', 'positive', selections, eventId);
 *
 * // While building a new prompt:
 * const overlap = getOverlap('midjourney', selections);
 * const hints = getTermHints('midjourney');
 * ```
 */
export function useFeedbackMemory(): UseFeedbackMemoryReturn {
  // Revision counter to trigger re-renders when memory changes
  const [revision, setRevision] = useState(0);

  const recordRatedPrompt = useCallback(
    (
      platform: string,
      rating: FeedbackRating,
      selections: PromptSelections,
      eventId: string,
    ) => {
      const store = loadMemory();
      if (!store.platforms[platform]) {
        store.platforms[platform] = [];
      }

      const entry: FeedbackMemoryEntry = {
        platform,
        rating,
        terms: flattenSelections(selections),
        timestamp: new Date().toISOString(),
        eventId,
      };

      store.platforms[platform]!.push(entry);

      // Cap at max entries per platform (keep newest)
      if (store.platforms[platform]!.length > MAX_ENTRIES_PER_PLATFORM) {
        store.platforms[platform] = store.platforms[platform]!.slice(
          -MAX_ENTRIES_PER_PLATFORM,
        );
      }

      saveMemory(store);
      setRevision((r) => r + 1);
    },
    [],
  );

  const getOverlap = useCallback(
    (platform: string, selections: PromptSelections): FeedbackOverlap | null => {
      void revision; // read to establish dependency
      const store = loadMemory();
      const entries = store.platforms[platform];
      if (!entries || entries.length === 0) return null;

      const currentTerms = flattenSelections(selections);
      if (currentTerms.length === 0) return null;

      // Search from newest to oldest, return first strong overlap
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i]!;
        const overlapping = findOverlap(currentTerms, entry.terms);
        if (overlapping.length >= OVERLAP_THRESHOLD) {
          return {
            rating: entry.rating,
            overlappingTerms: overlapping,
            timestamp: entry.timestamp,
          };
        }
      }

      return null;
    },
    [revision],
  );

  const getTermHints = useCallback(
    (platform: string): TermHint[] => {
      void revision;
      const store = loadMemory();
      const entries = store.platforms[platform];
      if (!entries || entries.length === 0) return [];
      return buildTermHints(entries);
    },
    [revision],
  );

  const getEntries = useCallback(
    (platform: string): readonly FeedbackMemoryEntry[] => {
      void revision;
      const store = loadMemory();
      return store.platforms[platform] ?? [];
    },
    [revision],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(FEEDBACK_MEMORY_KEY);
    } catch {
      // silent
    }
    setRevision((r) => r + 1);
  }, []);

  return useMemo(
    () => ({
      recordRatedPrompt,
      getOverlap,
      getTermHints,
      getEntries,
      clear,
    }),
    [recordRatedPrompt, getOverlap, getTermHints, getEntries, clear],
  );
}

export default useFeedbackMemory;
