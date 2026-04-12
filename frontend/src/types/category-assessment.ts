// src/types/category-assessment.ts
// ============================================================================
// Category Assessment Types — Call 1 Coverage + Matched Phrases
// ============================================================================
// Call 1 returns per-category coverage (covered/not) with the exact phrases
// from the user's text that address each category. Used for:
// 1. Text colouring — matched phrases build the termIndex for colour overlay
// 2. Category pills — covered categories shown bright, uncovered faded
// 3. Gap education — uncovered pills show hover hints from vocabulary
//
// Used by: parse-sentence/route.ts (mode: "assess"), use-category-assessment.ts
// Authority: prompt-lab.md, code-standard.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// CALL 1 — COVERAGE + MATCHED PHRASES
// ============================================================================

/** Coverage result for a single category */
export interface CategoryCoverage {
  /** Whether the category is covered by the human text */
  covered: boolean;
  /** Exact phrases from the user's text that address this category */
  matchedPhrases: string[];
}

/** Full coverage map returned by Call 1 in assess mode */
export interface CoverageAssessment {
  /** Per-category coverage results with matched phrases */
  coverage: Record<PromptCategory, CategoryCoverage>;
  /** Number of categories covered (convenience field, derived from coverage) */
  coveredCount: number;
  /** Total categories assessed (always 12) */
  totalCategories: 12;
  /** Whether all 12 are covered (convenience field) */
  allSatisfied: boolean;
}

// ============================================================================
// ERROR TYPES (for hook error classification)
// ============================================================================

/** Error types for failed states */
export type PromptLabErrorType = 'network' | 'rate-limit' | 'content-policy' | 'unknown';

// ============================================================================
// DOWNSTREAM PHRASE SEEDING (Phase A prep for anatomy array)
// ============================================================================

/**
 * Normalised phrase→category mapping from Call 1's assessment.
 * Passed to Call 2/Call T2 as `coverageSeed` so GPT knows which
 * phrases belong to which categories — seeds the anatomy array.
 *
 * State owner: useCategoryAssessment hook (assessment.coverage)
 * Prop path: playground-workspace → generateTiers → route body
 * Consumed by: generate-tier-prompts/route.ts (appended to user message)
 */
export interface CoverageSeed {
  category: PromptCategory;
  matchedPhrases: string[];
}

/**
 * Build a CoverageSeed array from a CoverageAssessment.
 * Filters to covered categories only — uncovered categories have no phrases.
 */
export function buildCoverageSeed(assessment: CoverageAssessment): CoverageSeed[] {
  const seeds: CoverageSeed[] = [];
  for (const [cat, data] of Object.entries(assessment.coverage)) {
    if (data.covered && data.matchedPhrases.length > 0) {
      seeds.push({ category: cat as PromptCategory, matchedPhrases: data.matchedPhrases });
    }
  }
  return seeds;
}
