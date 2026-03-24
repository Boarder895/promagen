// src/types/category-assessment.ts
// ============================================================================
// Category Assessment Types — Prompt Lab v4 Flow
// ============================================================================
// Types for Call 1's new role: category coverage assessment (not term extraction).
// Used by: parse-sentence/route.ts (mode: "assess"), use-category-assessment.ts
//
// Authority: prompt-lab-v4-flow.md §8, §9, §13
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// CALL 1 — COVERAGE ASSESSMENT OUTPUT (§8)
// ============================================================================

/** Confidence of the engine's assessment for a single category */
export type AssessmentConfidence = 'high' | 'medium';

/** Coverage result for a single category */
export interface CategoryCoverage {
  /** Whether the category is covered by the human text */
  covered: boolean;
  /** How confident the engine is in the assessment */
  confidence: AssessmentConfidence;
}

/** Full coverage map returned by Call 1 in assess mode */
export interface CoverageAssessment {
  /** Per-category coverage results */
  coverage: Record<PromptCategory, CategoryCoverage>;
  /** Number of categories covered (convenience field, derived from coverage) */
  coveredCount: number;
  /** Total categories assessed (always 12) */
  totalCategories: 12;
  /** Whether all 12 are covered (convenience field) */
  allSatisfied: boolean;
}

// ============================================================================
// CALL 2 — CATEGORY DECISIONS (§9)
// ============================================================================

/** One decision per missing category */
export interface CategoryDecision {
  /**
   * Must be a valid PromptCategory AND must be a category
   * Call 1 reported as NOT covered.
   */
  category: PromptCategory;
  /**
   * "engine" = the engine fills this.
   * A string value = user's chosen term (side note).
   *
   * String validation (enforced by Zod):
   * - Trimmed (leading/trailing whitespace stripped)
   * - Minimum 1 character after trim
   * - Maximum 100 characters
   * - Not the literal "engine" (reserved keyword)
   */
  fill: 'engine' | string;
}

/**
 * Gap intent — why Call 2 is receiving this shape of input.
 * "all-satisfied": all 12 covered, no decisions needed.
 * "skipped": user acknowledged gaps but chose to ignore them.
 * "user-decided": user made active decisions about missing categories.
 */
export type GapIntent = 'all-satisfied' | 'skipped' | 'user-decided';

// ============================================================================
// SIDE NOTES (§7)
// ============================================================================

/** A user-chosen term for a missing category */
export interface SideNote {
  /** The category this side note fills */
  category: PromptCategory;
  /** The user's chosen term (from Manual dropdown) */
  term: string;
}

// ============================================================================
// CLIENT STATE MACHINE (§13)
// ============================================================================

/** Valid states for the Prompt Lab client */
export type PromptLabPhase =
  | 'idle'
  | 'checking'
  | 'assessed-all-good'
  | 'deciding'
  | 'generating'
  | 'generated'
  | 'failed-check'
  | 'failed-generate';

/** Error types for failed states */
export type PromptLabErrorType = 'network' | 'rate-limit' | 'content-policy' | 'unknown';

/** Error metadata carried by failed-* states */
export interface PromptLabError {
  type: PromptLabErrorType;
  message: string;
}

/** Full client state shape (§13 reducer) */
export interface PromptLabState {
  phase: PromptLabPhase;
  /** The text that was sent to Call 1 (for stale-check on return) */
  sentText: string | null;
  /** Call 1 result — null until checking completes */
  assessment: CoverageAssessment | null;
  /** User's category decisions — persists across retry */
  decisions: CategoryDecision[];
  /** Side notes created from manual decisions — persists across re-assessment */
  sideNotes: SideNote[];
  /** Error metadata when in failed-* states */
  error: PromptLabError | null;
}
