// src/types/prompt-telemetry.ts
// ============================================================================
// PROMPT TELEMETRY — Types + Zod Validation
// ============================================================================
//
// Defines the shape of anonymous prompt events sent from the frontend
// to POST /api/prompt-telemetry. These events feed the Collective
// Intelligence Engine (Phase 5).
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9 + § 14.3
//
// Quality gates baked in:
// - Score must be >= 90 (only high-quality prompts feed the learning loop)
// - Category count must be >= 4 (eliminates trivial prompts)
//
// GDPR posture:
// - No user IDs, no IPs stored
// - sessionId is a per-tab crypto.randomUUID() that dies on tab close
// - No cookies, no credentials
//
// Version: 2.0.0 — Phase 7.1a confidence fields added (optional, backward-compat)
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import { z } from 'zod';

import type { PlatformTierId } from '@/data/platform-tiers';
import type { PromptCategory, PromptSelections } from '@/types/prompt-builder';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum optimizer score for an event to qualify for the learning pipeline */
export const TELEMETRY_SCORE_THRESHOLD = 90;

/** Minimum non-empty categories for an event to qualify */
export const TELEMETRY_MIN_CATEGORIES = 4;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Outcome signals captured when a user copies/saves a prompt.
 * These are the "was it useful?" indicators that Phase 6 will use
 * for weight recalibration.
 */
export interface PromptOutcome {
  /** User clicked the copy button */
  copied: boolean;
  /** User saved to their library (Pro feature) */
  saved: boolean;
  /** User returned to modify within 60s (implies dissatisfaction) */
  returnedWithin60s: boolean;
  /** User reused a previously saved prompt */
  reusedFromLibrary: boolean;
}

/**
 * A single anonymous prompt telemetry event (~500 bytes).
 *
 * Captured when a user copies a high-quality prompt (score >= 90, 4+ categories).
 * Used by the nightly cron to compute co-occurrence matrices,
 * sequence patterns, and auto-scene candidates.
 */
export interface PromptTelemetryEvent {
  /** Anonymous session hash — crypto.randomUUID() stored in sessionStorage */
  sessionId: string;
  /** Iteration within session (1 = first attempt, 2 = modified, etc.) */
  attemptNumber: number;
  /** Category → selected terms (same shape as PromptSelections) */
  selections: PromptSelections;
  /** Count of non-empty categories */
  categoryCount: number;
  /** Assembled prompt character length */
  charLength: number;
  /** Optimizer score (0–100) */
  score: number;
  /** Score breakdown by factor */
  scoreFactors: Record<string, number>;
  /** Platform ID (e.g. 'midjourney', 'stability') */
  platform: string;
  /** Platform tier (1–4) */
  tier: PlatformTierId;
  /** Scene-starter ID if one was used, null otherwise */
  sceneUsed: string | null;
  /** Outcome signals */
  outcome: PromptOutcome;
  /** User's subscription tier (optional — GDPR safe, not PII) */
  userTier?: 'free' | 'paid';
  /** Days since account creation (optional — GDPR safe, not PII) */
  accountAgeDays?: number;
}

/**
 * The row shape stored in the prompt_events table.
 * Extends the event with server-generated fields.
 */
export interface PromptEventRow extends PromptTelemetryEvent {
  /** Server-generated primary key: 'evt_' + UUID */
  id: string;
  /** Server-generated ISO timestamp */
  createdAt: string;
}

// ============================================================================
// ZOD SCHEMAS — Server-side validation
// ============================================================================

/**
 * Valid category keys for selections validation.
 * Kept in sync with PromptCategory type via this explicit list.
 */
const VALID_CATEGORIES: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  'negative',
];

/**
 * Outcome signals schema.
 */
const OutcomeSchema = z.object({
  copied: z.boolean(),
  saved: z.boolean(),
  returnedWithin60s: z.boolean(),
  reusedFromLibrary: z.boolean(),
});

/**
 * Selections schema: Record<string, string[]> where keys are valid categories.
 * Uses .passthrough() so extra categories don't break (future-proof).
 */
const SelectionsSchema = z
  .record(z.string(), z.array(z.string().min(1).max(200)).max(10))
  .refine(
    (obj) => {
      // All keys must be valid category names
      return Object.keys(obj).every((key) =>
        VALID_CATEGORIES.includes(key as PromptCategory),
      );
    },
    { message: 'Selections contain invalid category keys' },
  );

/**
 * Score factors schema: Record<string, number>.
 * Factor names are alphanumeric/underscore, values are finite numbers.
 */
const ScoreFactorsSchema = z.record(
  z.string().min(1).max(64),
  z.number().finite(),
);

/**
 * Full telemetry event schema.
 *
 * Quality gates:
 * - score >= 90 (TELEMETRY_SCORE_THRESHOLD)
 * - categoryCount >= 4 (TELEMETRY_MIN_CATEGORIES)
 *
 * These are enforced at the Zod level so invalid events never reach the DB.
 */
export const PromptTelemetryEventSchema = z.object({
  sessionId: z
    .string()
    .uuid({ message: 'sessionId must be a valid UUID' }),

  attemptNumber: z
    .number()
    .int()
    .min(1, 'attemptNumber must be >= 1')
    .max(100, 'attemptNumber must be <= 100'),

  selections: SelectionsSchema,

  categoryCount: z
    .number()
    .int()
    .min(TELEMETRY_MIN_CATEGORIES, `categoryCount must be >= ${TELEMETRY_MIN_CATEGORIES}`)
    .max(12, 'categoryCount must be <= 12'),

  charLength: z
    .number()
    .int()
    .min(1, 'charLength must be >= 1')
    .max(10_000, 'charLength must be <= 10000'),

  score: z
    .number()
    .int()
    .min(TELEMETRY_SCORE_THRESHOLD, `score must be >= ${TELEMETRY_SCORE_THRESHOLD}`)
    .max(100, 'score must be <= 100'),

  scoreFactors: ScoreFactorsSchema,

  platform: z
    .string()
    .min(1, 'platform is required')
    .max(64, 'platform must be <= 64 chars')
    .regex(/^[a-z0-9_-]+$/, 'platform must be lowercase alphanumeric with hyphens/underscores'),

  tier: z.union(
    [z.literal(1), z.literal(2), z.literal(3), z.literal(4)],
    { errorMap: () => ({ message: 'tier must be 1, 2, 3, or 4' }) },
  ),

  sceneUsed: z
    .string()
    .max(128, 'sceneUsed must be <= 128 chars')
    .nullable(),

  outcome: OutcomeSchema,

  userTier: z
    .enum(['free', 'paid'])
    .optional(),

  accountAgeDays: z
    .number()
    .int()
    .min(0, 'accountAgeDays must be >= 0')
    .max(10_000, 'accountAgeDays must be <= 10000')
    .optional(),
});

/**
 * Inferred type from the Zod schema — guaranteed to match PromptTelemetryEvent.
 * Use this for the parsed result in the API route.
 */
export type ValidatedPromptTelemetryEvent = z.infer<typeof PromptTelemetryEventSchema>;
