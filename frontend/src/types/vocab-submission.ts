// src/types/vocab-submission.ts
// ============================================================================
// VOCABULARY CROWDSOURCING PIPELINE — Types & Schema
// ============================================================================
//
// Defines the shape of user-submitted custom vocabulary terms captured from
// the prompt builder. When a user types a custom word/phrase into any category
// and presses Enter, the system silently captures it. Terms accumulate in
// data/learned/vocab-submissions.json and surface in the Admin Command Centre
// at /admin/vocab-submissions for batch review and one-click acceptance.
//
// Three layers of deduplication prevent duplicates:
//   Layer 1 (client): in-memory Set check before POST
//   Layer 2 (server POST): checks prompt-builder/*.json + merged/*-merged.json
//   Layer 3 (server ACCEPT): re-checks target JSON right before write
//
// Intelligence features:
//   - Smart Category Suggestion: keyword matching across all 12 vocabularies
//   - Confidence Scoring: frequency + session diversity → High/Medium/Low
//   - Profanity/Spam Auto-Filter: blocklist + pattern detection pre-queue
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.7
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { PlatformTierId } from '@/data/platform-tiers';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum unique sessions for HIGH confidence */
export const HIGH_CONFIDENCE_SESSIONS = 5;

/** Minimum unique platforms for HIGH confidence */
export const HIGH_CONFIDENCE_PLATFORMS = 3;

/** Minimum unique sessions for MEDIUM confidence */
export const MEDIUM_CONFIDENCE_SESSIONS = 2;

/** Minimum submission count for MEDIUM confidence */
export const MEDIUM_CONFIDENCE_COUNT = 3;

/** Maximum term length (characters) — anything longer is likely spam */
export const MAX_TERM_LENGTH = 120;

/** Minimum term length (characters) — single chars are noise */
export const MIN_TERM_LENGTH = 2;

// ============================================================================
// CONFIDENCE
// ============================================================================

/**
 * Confidence level for a submission.
 *
 * 🟢 high   — 5+ unique sessions across 3+ platforms. Rubber-stamp candidate.
 * 🟡 medium — 2+ sessions OR 3+ total submissions. Worth reviewing.
 * 🔴 low    — Single submission from one session. Could be noise.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Calculate confidence level from submission metrics.
 *
 * Pure function — no side effects, easily testable.
 */
export function calculateConfidence(
  uniqueSessions: number,
  uniquePlatformCount: number,
  totalCount: number
): ConfidenceLevel {
  if (
    uniqueSessions >= HIGH_CONFIDENCE_SESSIONS &&
    uniquePlatformCount >= HIGH_CONFIDENCE_PLATFORMS
  ) {
    return 'high';
  }

  if (
    uniqueSessions >= MEDIUM_CONFIDENCE_SESSIONS ||
    totalCount >= MEDIUM_CONFIDENCE_COUNT
  ) {
    return 'medium';
  }

  return 'low';
}

// ============================================================================
// AUTO-FILTER (Profanity / Spam)
// ============================================================================

/**
 * Reason a submission was auto-filtered before reaching the review queue.
 *
 * - profanity:  matched the blocklist
 * - spam:       URL, email, repeated chars, or gibberish pattern
 * - too-short:  below MIN_TERM_LENGTH
 * - too-long:   above MAX_TERM_LENGTH
 */
export type AutoFilterReason =
  | 'profanity'
  | 'spam'
  | 'too-short'
  | 'too-long';

/**
 * A submission that was caught by the auto-filter.
 * Stored separately so the admin can rescue false positives.
 */
export interface FilteredSubmission {
  /** Unique ID (crypto.randomUUID) */
  id: string;
  /** The raw term as submitted (before normalisation) */
  rawTerm: string;
  /** Normalised term (trimmed, lowercased) */
  term: string;
  /** Category the user typed it into */
  category: PromptCategory;
  /** Why it was filtered */
  reason: AutoFilterReason;
  /** The specific pattern/word that triggered the filter (for debugging) */
  matchedPattern: string;
  /** ISO timestamp */
  filteredAt: string;
}

// ============================================================================
// CORE SUBMISSION
// ============================================================================

/**
 * Status lifecycle of a vocabulary submission.
 *
 *   pending → accepted  (batch accept)
 *   pending → rejected  (admin clicked ❌)
 *   rejected → pending  (admin clicked ↩️ undo)
 */
export type SubmissionStatus = 'pending' | 'accepted' | 'rejected';

/**
 * A single user-submitted vocabulary term captured from the prompt builder.
 *
 * Deduplication key: `term + category` (normalised).
 * When the same term+category arrives again, `count` increments and
 * `sessionIds` / `platformIds` grow — no new row is created.
 */
export interface VocabSubmission {
  /** Unique ID (crypto.randomUUID) */
  id: string;

  /** Normalised term: trimmed + lowercased */
  term: string;

  /** Category the user typed it into */
  category: PromptCategory;

  /**
   * Smart Category Suggestion results.
   * Always includes the original `category`. May include others
   * where the term's tokens match existing vocabulary.
   *
   * Example: "bioluminescent fog" submitted in atmosphere →
   *          suggestedCategories: ["atmosphere", "lighting"]
   *
   * On batch accept, the term is added to ALL suggested categories.
   */
  suggestedCategories: PromptCategory[];

  /**
   * Set of platform IDs that users submitted this term from.
   * Stored as array (JSON doesn't support Set).
   * Example: ["midjourney", "dall-e-3", "stable-diffusion-xl"]
   */
  platformIds: string[];

  /**
   * Tier the user was building in when they submitted.
   * If submitted across multiple tiers, stores the first seen.
   */
  tier: PlatformTierId;

  /** Total number of times this term+category was submitted */
  count: number;

  /**
   * Number of unique anonymous sessions that submitted this term.
   * Uses the same crypto.randomUUID() sessionId from prompt telemetry.
   * Higher uniqueSessions = more confidence this is a real user need.
   */
  uniqueSessions: number;

  /**
   * Anonymous session IDs that have submitted this term.
   * Used for dedup counting — not displayed in UI.
   * Capped at 50 to prevent unbounded growth.
   */
  sessionIds: string[];

  /** Calculated confidence level based on sessions + platforms + count */
  confidence: ConfidenceLevel;

  /** Current review status */
  status: SubmissionStatus;

  /** ISO timestamp of first submission */
  submittedAt: string;

  /** ISO timestamp when batch-accepted (null if pending/rejected) */
  acceptedAt: string | null;

  /** ISO timestamp when rejected by admin (null if pending/accepted) */
  rejectedAt: string | null;
}

// ============================================================================
// GROWTH DASHBOARD
// ============================================================================

/**
 * A single data point for the vocabulary growth timeline.
 * One entry per day, tracking submissions and outcomes.
 */
export interface GrowthDataPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Terms submitted on this date */
  submitted: number;
  /** Terms accepted on this date */
  accepted: number;
  /** Terms rejected on this date */
  rejected: number;
  /** Terms auto-filtered on this date */
  autoFiltered: number;
}

/**
 * Per-category submission breakdown for the growth dashboard.
 * Shows which categories users contribute to most.
 */
export interface CategoryGrowthStats {
  category: PromptCategory;
  /** Total pending submissions in this category */
  pending: number;
  /** Total accepted all-time for this category */
  accepted: number;
  /** Total rejected all-time for this category */
  rejected: number;
}

/**
 * Per-platform submission breakdown for the growth dashboard.
 * Shows which AI platforms generate the most creative user input.
 */
export interface PlatformGrowthStats {
  platformId: string;
  /** Total submissions originating from this platform */
  totalSubmissions: number;
}

// ============================================================================
// FILE SCHEMA (data/learned/vocab-submissions.json)
// ============================================================================

/**
 * Aggregate statistics — maintained incrementally on each POST/PATCH
 * so the admin page can show counts without scanning the full array.
 */
export interface VocabSubmissionStats {
  /** Total submissions ever received (including deduped increments) */
  totalReceived: number;
  /** Current pending count */
  pending: number;
  /** Total accepted all-time */
  accepted: number;
  /** Total rejected all-time */
  rejected: number;
  /** Total auto-filtered all-time */
  autoFiltered: number;
}

/**
 * Root shape of `data/learned/vocab-submissions.json`.
 *
 * This file is the single source of truth for the crowdsourcing pipeline.
 * Read/written by the API route at /api/admin/vocab-submissions.
 */
export interface VocabSubmissionsFile {
  /** Schema version for migration support */
  version: string;

  /** ISO timestamp of the last batch accept operation */
  lastBatchAt: string | null;

  /** The review queue */
  submissions: VocabSubmission[];

  /** Auto-filtered submissions (profanity/spam catches) */
  filtered: FilteredSubmission[];

  /** Aggregate stats */
  stats: VocabSubmissionStats;

  /**
   * Daily growth data points for the dashboard timeline chart.
   * Appended to on each POST/PATCH. One entry per date.
   * Capped at 365 entries (rolling year).
   */
  dailyGrowth: GrowthDataPoint[];
}

// ============================================================================
// API PAYLOADS
// ============================================================================

/**
 * POST /api/admin/vocab-submissions — body from client hook.
 * Minimal payload: the prompt builder provides all context.
 */
export interface VocabSubmissionPayload {
  /** The custom term the user typed */
  term: string;
  /** Category they typed it into */
  category: PromptCategory;
  /** Platform they're building for */
  platformId: string;
  /** Tier they're building in */
  tier: PlatformTierId;
  /** Anonymous session ID (from sessionStorage) */
  sessionId: string;
}

/**
 * PATCH /api/admin/vocab-submissions — reject specific terms.
 */
export interface VocabRejectPayload {
  action: 'reject';
  /** IDs of submissions to reject */
  ids: string[];
}

/**
 * PATCH /api/admin/vocab-submissions — undo reject (flip back to pending).
 */
export interface VocabUndoRejectPayload {
  action: 'undo-reject';
  /** IDs of submissions to flip back to pending */
  ids: string[];
}

/**
 * PATCH /api/admin/vocab-submissions — accept all remaining pending terms.
 * No IDs needed — accepts everything with status === 'pending'.
 */
export interface VocabAcceptBatchPayload {
  action: 'accept-batch';
}

/**
 * PATCH /api/admin/vocab-submissions — rescue a false positive from auto-filter.
 */
export interface VocabRescuePayload {
  action: 'rescue';
  /** IDs of filtered submissions to move into the pending queue */
  ids: string[];
}

/**
 * PATCH /api/admin/vocab-submissions — reassign a submission to a different category.
 * Admin clicked a category badge and picked a different one from the popover.
 */
export interface VocabReassignCategoryPayload {
  action: 'reassign-category';
  /** ID of the submission to reassign */
  id: string;
  /** New primary category */
  newCategory: string;
}

/**
 * PATCH /api/admin/vocab-submissions — override a submission's confidence level.
 * Admin clicked the confidence badge and picked a different level.
 */
export interface VocabOverrideConfidencePayload {
  action: 'override-confidence';
  /** ID of the submission to update */
  id: string;
  /** New confidence level */
  newConfidence: ConfidenceLevel;
}

/** Union of all PATCH payloads */
export type VocabPatchPayload =
  | VocabRejectPayload
  | VocabUndoRejectPayload
  | VocabAcceptBatchPayload
  | VocabRescuePayload
  | VocabReassignCategoryPayload
  | VocabOverrideConfidencePayload;

/**
 * Response from a batch accept operation.
 * Tells the admin exactly what happened.
 */
export interface VocabAcceptBatchResponse {
  /** Number of terms successfully added to vocab JSONs */
  accepted: number;
  /** Categories that had new terms written */
  categoriesModified: PromptCategory[];
  /** Terms that were skipped because they appeared in a JSON between review and accept */
  skippedDuplicates: number;
  /** ISO timestamp of this batch operation */
  batchedAt: string;
}
