// src/hooks/use-drift-detection.ts
// ============================================================================
// useDriftDetection — Prompt DNA Drift Detection
// ============================================================================
// Tracks whether the user's current text in "Describe Your Image" has
// drifted from the text that was last sent to generation (Call 1 + Call 2).
//
// Pure client-side — zero API calls, zero network, instant.
// Compares at the word level to produce a meaningful change count.
//
// Human factors:
//   §4 Zeigarnik Effect — the amber "N changes detected" indicator
//       creates a sense of incompleteness. The brain nags the user
//       to regenerate because the prompts are "stale". This keeps
//       the user in the generate→review→refine loop longer.
//   §1 Curiosity Gap — "3 changes detected" implies the new result
//       will be different, but the user can't see HOW until they
//       regenerate. The gap between "my text changed" and "what
//       would the prompts look like now?" drives the click.
//
// Usage:
//   const { isDrifted, changeCount, markSynced } = useDriftDetection(currentText);
//   // After successful generation:
//   markSynced();
//   // In UI:
//   {isDrifted && <DriftBadge count={changeCount} />}
//
// Authority: ai-disguise.md (Improvement 1 — Prompt DNA Drift Detection)
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import { useState, useMemo, useCallback } from 'react';

// ============================================================================
// WORD TOKENISER
// ============================================================================

/**
 * Split text into normalised word tokens for comparison.
 * Lowercases, strips punctuation, filters empties.
 * This is intentionally simple — we want "meaningful" changes,
 * not punctuation-level noise.
 */
function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // strip punctuation
    .split(/\s+/)                // split on whitespace
    .filter((w) => w.length > 0); // remove empties
}

// ============================================================================
// WORD-LEVEL DIFF
// ============================================================================

/**
 * Count meaningful word-level changes between two texts.
 *
 * Uses a simple bag-of-words symmetric difference:
 *   added words + removed words = total changes
 *
 * This is fast (O(n)) and produces intuitive counts:
 *   "red car on a hill" → "blue car on a mountain"
 *   changes: +blue, -red, +mountain, -hill = 4 word changes → displayed as 2 (net changes)
 *
 * We report net unique changes (words that appear in one but not the other)
 * which maps better to "how different is my text now?"
 */
function countWordChanges(textA: string, textB: string): number {
  const wordsA = tokenise(textA);
  const wordsB = tokenise(textB);

  // Build frequency maps
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const w of wordsA) {
    freqA.set(w, (freqA.get(w) ?? 0) + 1);
  }
  for (const w of wordsB) {
    freqB.set(w, (freqB.get(w) ?? 0) + 1);
  }

  // Count symmetric difference (words that changed in frequency)
  const allWords = new Set([...freqA.keys(), ...freqB.keys()]);
  let changes = 0;

  for (const word of allWords) {
    const countA = freqA.get(word) ?? 0;
    const countB = freqB.get(word) ?? 0;
    changes += Math.abs(countA - countB);
  }

  return changes;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseDriftDetectionReturn {
  /** Whether the current text has drifted from the last-synced text */
  isDrifted: boolean;
  /** Number of word-level changes detected */
  changeCount: number;
  /** Mark current text as synced (call after successful generation) */
  markSynced: (text: string) => void;
  /** The last-synced text (for debugging / display) */
  lastSyncedText: string;
}

/**
 * Track drift between the user's current text and the last text
 * that was sent for generation.
 *
 * @param currentText — The current value of the "Describe Your Image" textarea
 */
export function useDriftDetection(currentText: string): UseDriftDetectionReturn {
  // The text that was last successfully sent to generation
  const [lastSyncedText, setLastSyncedText] = useState('');

  // Compute drift on every render (cheap — word tokenisation + bag diff)
  const { isDrifted, changeCount } = useMemo(() => {
    // No drift if nothing has been synced yet (first use)
    if (!lastSyncedText) {
      return { isDrifted: false, changeCount: 0 };
    }

    // No drift if text is identical (common case — fast path)
    const trimmedCurrent = currentText.trim();
    const trimmedSynced = lastSyncedText.trim();

    if (trimmedCurrent === trimmedSynced) {
      return { isDrifted: false, changeCount: 0 };
    }

    // No drift if current text is empty (user cleared the textarea)
    if (!trimmedCurrent) {
      return { isDrifted: false, changeCount: 0 };
    }

    const changes = countWordChanges(trimmedSynced, trimmedCurrent);

    // Threshold: at least 1 word change to count as drifted
    // (prevents false positives from whitespace-only changes)
    return {
      isDrifted: changes > 0,
      changeCount: changes,
    };
  }, [currentText, lastSyncedText]);

  // Call this after a successful generation to sync the baseline
  const markSynced = useCallback((text: string) => {
    setLastSyncedText(text.trim());
  }, []);

  return {
    isDrifted,
    changeCount,
    markSynced,
    lastSyncedText,
  };
}
