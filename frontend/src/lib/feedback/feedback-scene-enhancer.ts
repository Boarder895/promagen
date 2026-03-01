// src/lib/feedback/feedback-scene-enhancer.ts
// ============================================================================
// FEEDBACK-AWARE SCENE ENHANCER — Personalise scene prefills from feedback
// ============================================================================
//
// Pure function. When a user loads a scene, this checks their feedback memory
// term hints and silently adds terms from their personal hot-streak history
// into the scene prefills.
//
// Example:
//   User always rates 'cinematic lighting + volumetric fog' as 👍 on MJ.
//   They load "Moody Cityscape" scene. The scene's default lighting terms
//   get enriched with their proven winners. Scene description stays the same.
//
// Rules:
//   1. Only add within the same category (lighting for lighting, etc.)
//   2. Only add when signal is strong (count >= MIN_HINT_COUNT)
//   3. Never add more than MAX_ADDITIONS per category
//   4. Never remove scene defaults — additions are supplementary
//   5. Negative-hinted scene terms get flagged but not auto-removed
//
// Authority: prompt-builder-evolution-plan-v2.md § 7.10 Feedback-Aware Scenes
//
// Version: 1.1.0 — Confidence Halos
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import type { TermHint } from '@/hooks/use-feedback-memory';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum positive hint count required for a term to be added */
export const MIN_HINT_COUNT = 2;

/** Maximum terms added per category from feedback hints */
export const MAX_ADDITIONS_PER_CATEGORY = 2;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of enhancing scene prefills with feedback data.
 */
export interface EnhancedPrefills {
  /** The modified prefills map */
  prefills: Record<string, string[]>;
  /** Categories that were modified by the enhancer */
  modifiedCategories: string[];
  /** Terms added from feedback memory (for optional UI indicators) */
  addedTerms: { category: string; term: string }[];
  /** Scene terms that have negative hints (warnings, not removed) */
  warningTerms: { category: string; term: string }[];
}

/**
 * Vocabulary lookup: given a category name, return all valid terms.
 * Injected for testability — in production this is `getOptions(cat)`.
 */
export type VocabLookup = (category: string) => string[];

// ============================================================================
// CORE FUNCTION
// ============================================================================

/**
 * Enhance scene prefills with feedback-aware term additions.
 *
 * Pure function — no side effects, no hooks, no localStorage.
 *
 * @param scenePrefills — The scene's default prefills (e.g. `{ lighting: ['dramatic lighting'] }`)
 * @param termHints — Array of TermHint from `getTermHints(platform)`
 * @param vocabLookup — Function to get all valid vocab terms for a category
 * @returns Enhanced prefills with additions and metadata
 *
 * @example
 * ```ts
 * const hints = getTermHints('midjourney');
 * const result = enhanceScenePrefills(
 *   scene.prefills,
 *   hints,
 *   (cat) => getOptions(cat as CategoryKey),
 * );
 * // result.prefills now has personalised terms
 * ```
 */
export function enhanceScenePrefills(
  scenePrefills: Record<string, string[]>,
  termHints: TermHint[],
  vocabLookup: VocabLookup,
): EnhancedPrefills {
  // Fast path: no hints → return unmodified
  if (termHints.length === 0) {
    return {
      prefills: { ...scenePrefills },
      modifiedCategories: [],
      addedTerms: [],
      warningTerms: [],
    };
  }

  // Build lookup sets for positive and negative hints
  const positiveHints = new Map<string, number>(); // term → count
  const negativeHintSet = new Set<string>();

  for (const hint of termHints) {
    if (hint.type === 'positive' && hint.count >= MIN_HINT_COUNT) {
      positiveHints.set(hint.term, hint.count);
    } else if (hint.type === 'negative') {
      negativeHintSet.add(hint.term);
    }
  }

  const result: Record<string, string[]> = {};
  const modifiedCategories: string[] = [];
  const addedTerms: { category: string; term: string }[] = [];
  const warningTerms: { category: string; term: string }[] = [];

  for (const [category, sceneTerms] of Object.entries(scenePrefills)) {
    if (!Array.isArray(sceneTerms) || sceneTerms.length === 0) {
      result[category] = [...(sceneTerms ?? [])];
      continue;
    }

    // 1. Detect negative-hinted scene terms (flag, don't remove)
    for (const term of sceneTerms) {
      if (negativeHintSet.has(term)) {
        warningTerms.push({ category, term });
      }
    }

    // 2. Find positive-hinted terms that belong to this category's vocabulary
    let categoryVocab: Set<string>;
    try {
      const vocabTerms = vocabLookup(category);
      categoryVocab = new Set(vocabTerms);
    } catch {
      // Category not in vocabulary (e.g. custom) — skip enhancement
      result[category] = [...sceneTerms];
      continue;
    }

    const candidates: { term: string; count: number }[] = [];
    for (const [term, count] of positiveHints) {
      // Must be in this category's vocabulary AND not already in scene prefills
      if (categoryVocab.has(term) && !sceneTerms.includes(term)) {
        candidates.push({ term, count });
      }
    }

    // Sort by strongest signal first
    candidates.sort((a, b) => b.count - a.count);

    // Take top N
    const toAdd = candidates.slice(0, MAX_ADDITIONS_PER_CATEGORY);

    if (toAdd.length > 0) {
      // Keep all original scene terms + add proven winners
      result[category] = [...sceneTerms, ...toAdd.map((c) => c.term)];
      modifiedCategories.push(category);
      for (const c of toAdd) {
        addedTerms.push({ category, term: c.term });
      }
    } else {
      result[category] = [...sceneTerms];
    }
  }

  return {
    prefills: result,
    modifiedCategories,
    addedTerms,
    warningTerms,
  };
}

/**
 * Check if there's enough feedback data to warrant scene enhancement.
 * Returns true if there are at least `threshold` strong positive hints.
 *
 * Use this to skip enhancement entirely for new users with little data.
 */
export function hasEnoughFeedbackForEnhancement(
  termHints: TermHint[],
  threshold: number = 3,
): boolean {
  let strongPositives = 0;
  for (const hint of termHints) {
    if (hint.type === 'positive' && hint.count >= MIN_HINT_COUNT) {
      strongPositives++;
    }
  }
  return strongPositives >= threshold;
}

// ============================================================================
// CONFIDENCE HALOS — Scene-level feedback confidence scoring
// ============================================================================
//
// Computes a confidence level for each scene card by measuring overlap
// between the scene's prefill terms and the user's feedback memory hints.
//
// Visual mapping (applied as CSS halo on SceneCard):
//   'proven' → emerald glow ring  (3+ strong positive terms overlap)
//   'warm'   → faint emerald ring (1–2 positive, zero negatives)
//   'risky'  → amber warning ring (2+ negative terms overlap)
//   null     → no halo            (insufficient data or mixed signal)
//
// Pure functions — no side effects, no hooks, no localStorage.
// ============================================================================

/** Minimum positive overlapping terms for 'proven' status */
export const PROVEN_THRESHOLD = 3;

/** Minimum positive overlapping terms for 'warm' status */
export const WARM_THRESHOLD = 1;

/** Minimum negative overlapping terms for 'risky' status */
export const RISKY_THRESHOLD = 2;

/** Confidence level for a scene card's feedback halo. */
export type SceneConfidence = 'proven' | 'warm' | 'risky' | null;

/**
 * Compute feedback confidence for a single scene.
 *
 * Counts overlap between scene prefill terms and user's TermHint[],
 * then classifies into proven / warm / risky / null.
 *
 * Safety-first: 'risky' beats 'proven' when both thresholds are met.
 */
export function computeSceneConfidence(
  scenePrefills: Record<string, string[] | undefined>,
  termHints: TermHint[],
): SceneConfidence {
  if (termHints.length === 0) return null;

  // Flatten all scene prefill terms into a Set
  const sceneTerms = new Set<string>();
  for (const values of Object.values(scenePrefills)) {
    if (Array.isArray(values)) {
      for (const v of values) {
        if (v) sceneTerms.add(v);
      }
    }
  }
  if (sceneTerms.size === 0) return null;

  // Count overlaps
  let positiveOverlap = 0;
  let negativeOverlap = 0;

  for (const hint of termHints) {
    if (sceneTerms.has(hint.term)) {
      if (hint.type === 'positive' && hint.count >= MIN_HINT_COUNT) {
        positiveOverlap++;
      } else if (hint.type === 'negative') {
        negativeOverlap++;
      }
    }
  }

  // Decision: negatives take priority (safety-first)
  if (negativeOverlap >= RISKY_THRESHOLD) return 'risky';
  if (positiveOverlap >= PROVEN_THRESHOLD) return 'proven';
  if (positiveOverlap >= WARM_THRESHOLD && negativeOverlap === 0) return 'warm';

  return null;
}

/**
 * Batch-compute confidence for an array of scenes.
 *
 * Returns Map<sceneId, SceneConfidence> — null entries omitted.
 * Called inside a useMemo keyed on [scenesForWorld, feedbackTermHints].
 */
export function computeSceneConfidenceMap(
  scenes: { id: string; prefills: Record<string, string[] | undefined> }[],
  termHints: TermHint[],
): Map<string, SceneConfidence> {
  const map = new Map<string, SceneConfidence>();
  if (termHints.length === 0) return map;

  for (const scene of scenes) {
    const confidence = computeSceneConfidence(scene.prefills, termHints);
    if (confidence !== null) {
      map.set(scene.id, confidence);
    }
  }
  return map;
}
