// src/lib/telemetry/prompt-telemetry-client.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Frontend Telemetry Client
// ============================================================================
//
// Client-side module for sending anonymous prompt events to the learning
// pipeline. Fires when a user copies or saves a high-quality prompt.
//
// Key design decisions:
// - sessionId: crypto.randomUUID() in sessionStorage (dies on tab close)
// - attemptNumber: increments per copy/save within the same tab session
// - Quality gates: score >= 90, categoryCount >= 4 (mirrored from Zod schema)
// - Fire-and-forget: failures are silently logged, never block UI
// - GDPR safe: no user IDs, no cookies, no PII
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 9.4
//
// Version: 2.0.0 — Phase 7.1a confidence fields added
// Created: 2026-02-25
//
// Existing features preserved: Yes.
// ============================================================================

import type { PromptSelections } from '@/types/prompt-builder';
import type { PlatformTierId } from '@/data/platform-tiers';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Quality gate: minimum health score to send telemetry */
const SCORE_THRESHOLD = 90;

/** Quality gate: minimum non-empty categories */
const MIN_CATEGORIES = 4;

/** sessionStorage key for the anonymous session UUID */
const SESSION_KEY = 'promagen_telemetry_sid';

/** sessionStorage key for the attempt counter */
const ATTEMPT_KEY = 'promagen_telemetry_attempt';

/** sessionStorage key for last-copy timestamp (return-within-60s detection) */
const LAST_COPY_KEY = 'promagen_telemetry_lastcopy';

/** Endpoint */
const ENDPOINT = '/api/prompt-telemetry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for sending a telemetry event.
 * Collected from the prompt builder component at copy/save time.
 */
export interface TelemetryInput {
  /** Current category selections */
  selections: PromptSelections;
  /** Health score from prompt analysis (0-100) */
  healthScore: number;
  /** Score breakdown factors (e.g. { coherence: 85, fill: 90 }) */
  scoreFactors: Record<string, number>;
  /** Final assembled prompt text */
  promptText: string;
  /** Provider/platform ID (e.g. 'midjourney') */
  platformId: string;
  /** Platform tier (1-4) */
  tier: PlatformTierId;
  /** Active scene ID if one was used, null otherwise */
  sceneUsed: string | null;
  /** Whether this was a copy action */
  copied: boolean;
  /** Whether this was a save-to-library action */
  saved: boolean;
  /** Whether the user reused a prompt from their library */
  reusedFromLibrary: boolean;
  /** User subscription tier ('free' | 'paid') — optional, GDPR safe */
  userTier?: 'free' | 'paid';
  /** Days since account creation — optional, GDPR safe */
  accountAgeDays?: number;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Get or create the anonymous session UUID.
 * Stored in sessionStorage so it dies when the tab closes.
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return crypto.randomUUID();

  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    // sessionStorage blocked (incognito in some browsers)
    return crypto.randomUUID();
  }
}

/**
 * Increment and return the attempt number for this session.
 */
function getNextAttemptNumber(): number {
  if (typeof window === 'undefined') return 1;

  try {
    const current = parseInt(sessionStorage.getItem(ATTEMPT_KEY) ?? '0', 10);
    const next = (isNaN(current) ? 0 : current) + 1;
    sessionStorage.setItem(ATTEMPT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

/**
 * Check if the user returned within 60 seconds of their last copy.
 * This signals potential dissatisfaction with the previous prompt.
 */
function checkReturnedWithin60s(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const lastCopy = sessionStorage.getItem(LAST_COPY_KEY);
    if (!lastCopy) return false;

    const elapsed = Date.now() - parseInt(lastCopy, 10);
    return elapsed > 0 && elapsed < 60_000;
  } catch {
    return false;
  }
}

/**
 * Record the current timestamp as the last copy time.
 */
function recordCopyTimestamp(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(LAST_COPY_KEY, String(Date.now()));
  } catch {
    // Silently ignore
  }
}

// ============================================================================
// QUALITY GATES
// ============================================================================

/**
 * Count non-empty categories in selections.
 */
function countCategories(selections: PromptSelections): number {
  let count = 0;
  for (const terms of Object.values(selections)) {
    if (terms && terms.length > 0) count++;
  }
  return count;
}

/**
 * Check if the prompt passes quality gates for telemetry.
 *
 * Gates (must ALL pass):
 * 1. Health score >= 90
 * 2. Category count >= 4
 * 3. Prompt text is non-empty
 * 4. Platform ID is non-empty
 *
 * @returns null if gates pass, or a reason string if they fail
 */
export function checkQualityGates(input: TelemetryInput): string | null {
  if (input.healthScore < SCORE_THRESHOLD) {
    return `Score ${input.healthScore} < ${SCORE_THRESHOLD}`;
  }

  const categoryCount = countCategories(input.selections);
  if (categoryCount < MIN_CATEGORIES) {
    return `Categories ${categoryCount} < ${MIN_CATEGORIES}`;
  }

  if (!input.promptText || input.promptText.trim().length === 0) {
    return 'Empty prompt text';
  }

  if (!input.platformId) {
    return 'Missing platformId';
  }

  return null; // All gates pass
}

// ============================================================================
// SEND TELEMETRY
// ============================================================================

/**
 * Send a prompt telemetry event to the learning pipeline.
 *
 * Fire-and-forget: this function never throws and never blocks the UI.
 * If quality gates fail or the network request fails, it logs and returns.
 *
 * @param input — Data collected from the prompt builder at copy/save time
 * @returns true if the event was sent successfully, false otherwise
 *
 * @example
 * ```ts
 * // In handleCopyPrompt:
 * sendPromptTelemetry({
 *   selections,
 *   healthScore,
 *   scoreFactors: { coherence: 85, fill: 92 },
 *   promptText: optimizedResult.optimized,
 *   platformId: provider.id,
 *   tier: platformTier,
 *   sceneUsed: activeSceneId ?? null,
 *   copied: true,
 *   saved: false,
 *   reusedFromLibrary: false,
 * });
 * ```
 */
export async function sendPromptTelemetry(input: TelemetryInput): Promise<boolean> {
  try {
    // --- Quality gates ---
    const gateResult = checkQualityGates(input);
    if (gateResult) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Telemetry] Quality gate failed:', gateResult);
      }
      return false;
    }

    // --- Build event payload ---
    const categoryCount = countCategories(input.selections);
    const returnedWithin60s = checkReturnedWithin60s();

    const event = {
      sessionId: getSessionId(),
      attemptNumber: getNextAttemptNumber(),
      selections: input.selections,
      categoryCount,
      charLength: input.promptText.length,
      score: input.healthScore,
      scoreFactors: input.scoreFactors,
      platform: input.platformId.toLowerCase(),
      tier: input.tier,
      sceneUsed: input.sceneUsed,
      outcome: {
        copied: input.copied,
        saved: input.saved,
        returnedWithin60s,
        reusedFromLibrary: input.reusedFromLibrary,
      },
      // Phase 7.1: Confidence multiplier data (optional, GDPR safe)
      ...(input.userTier ? { userTier: input.userTier } : {}),
      ...(input.accountAgeDays != null ? { accountAgeDays: input.accountAgeDays } : {}),
    };

    // --- Record copy timestamp for return-within-60s detection ---
    if (input.copied) {
      recordCopyTimestamp();
    }

    // --- Fire-and-forget POST ---
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      // No credentials — fully anonymous
    });

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        const text = await response.text().catch(() => '');
        console.warn('[Telemetry] POST failed:', response.status, text);
      }
      return false;
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[Telemetry] Event sent:', {
        attempt: event.attemptNumber,
        score: event.score,
        categories: event.categoryCount,
        platform: event.platform,
        tier: event.tier,
        copied: event.outcome.copied,
        saved: event.outcome.saved,
      });
    }

    return true;
  } catch (err) {
    // Never throw — telemetry must not break the UI
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Telemetry] Error:', err);
    }
    return false;
  }
}
