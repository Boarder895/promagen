// src/lib/feedback/feedback-client.ts
// ============================================================================
// FEEDBACK CLIENT — sessionStorage tracking + fire-and-forget POST
// ============================================================================
//
// Phase 7.10c — Client feedback submission layer.
//
// Responsibilities:
//   1. sessionStorage management for pending feedback metadata
//   2. Dismissal tracking (24-hour cooldown)
//   3. Compute credibility score client-side (reuses pure function)
//   4. Fire-and-forget POST to /api/feedback
//
// The feedback-client never throws — all errors are swallowed with dev-mode
// console warnings. The UI must never break because of feedback plumbing.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10c
//
// Version: 1.0.0 — Phase 7.10c Feedback Client
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import type { FeedbackRating } from '@/types/feedback';
import { computeFeedbackCredibilityDetailed } from '@/types/feedback';

// ============================================================================
// SESSION STORAGE KEYS
// ============================================================================

/** Pending feedback metadata — set on copy, cleared on rate/dismiss */
const PENDING_KEY = 'promagen_feedback_pending';

/** Dismiss timestamp — prevents re-showing for 24h after dismiss */
const DISMISSED_KEY = 'promagen_feedback_dismissed';

/** 24-hour cooldown in milliseconds */
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

/** API endpoint */
const FEEDBACK_ENDPOINT = '/api/feedback';

// ============================================================================
// PENDING FEEDBACK DATA
// ============================================================================

/**
 * Metadata stored in sessionStorage when a prompt is copied.
 * Read back when the feedback widget appears 4s later.
 */
export interface FeedbackPendingData {
  /** The prompt_events row ID — links feedback to the original prompt */
  eventId: string;
  /** Platform the prompt was built for (e.g. 'midjourney') */
  platform: string;
  /** Platform tier (1–4) */
  tier: number;
  /** Timestamp when copy happened (Date.now()) — used for responseTimeMs */
  copiedAt: number;
}

/**
 * User context passed to credibility computation.
 * All fields optional — missing = neutral (1.0×).
 */
export interface FeedbackUserContext {
  /** 'paid' | 'free' | null (anonymous) */
  userTier?: string | null;
  /** Days since account creation */
  accountAgeDays?: number | null;
  /** Prompt copies in the last 7 days */
  weeklyUsageCount?: number | null;
}

// ============================================================================
// SESSION STORAGE HELPERS
// ============================================================================

/**
 * Store pending feedback metadata after a successful copy.
 * Called from prompt-builder.tsx copy handler (wired in Phase 7.10d).
 */
export function storeFeedbackPending(data: FeedbackPendingData): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage blocked (incognito in some browsers) — silent fail
  }
}

/**
 * Read pending feedback metadata. Returns null if none exists.
 */
export function readFeedbackPending(): FeedbackPendingData | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedbackPendingData;
    // Sanity check: must have eventId and copiedAt
    if (!parsed.eventId || !parsed.copiedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear pending feedback metadata (after submission or dismiss).
 */
export function clearFeedbackPending(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // silent
  }
}

/**
 * Record a dismissal timestamp. Prevents re-showing for 24 hours.
 */
export function recordDismissal(): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // silent
  }
}

/**
 * Check if the user dismissed feedback within the last 24 hours.
 */
export function isDismissedRecently(): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

// ============================================================================
// SEND FEEDBACK — fire-and-forget POST
// ============================================================================

/**
 * Submit user feedback to /api/feedback.
 *
 * Fire-and-forget: never throws, never blocks the UI.
 * Computes credibility score client-side using the same pure function
 * the server will validate against.
 *
 * @param rating     — The user's rating choice
 * @param pending    — Metadata from sessionStorage (eventId, platform, etc.)
 * @param userCtx    — Optional user context for credibility computation
 * @returns true on success, false on any error
 */
export async function sendFeedback(
  rating: FeedbackRating,
  pending: FeedbackPendingData,
  userCtx: FeedbackUserContext = {},
): Promise<boolean> {
  try {
    const responseTimeMs = Date.now() - pending.copiedAt;

    // Compute credibility (client-side — server re-validates range)
    const { credibility, factors } = computeFeedbackCredibilityDetailed({
      userTier: userCtx.userTier,
      accountAgeDays: userCtx.accountAgeDays,
      weeklyUsageCount: userCtx.weeklyUsageCount,
      responseTimeMs,
    });

    const body = {
      promptEventId: pending.eventId,
      rating,
      credibilityScore: credibility,
      credibilityFactors: factors,
      responseTimeMs,
      platform: pending.platform,
      tier: pending.tier,
      ...(userCtx.userTier !== undefined ? { userTier: userCtx.userTier } : {}),
      ...(userCtx.accountAgeDays != null
        ? { accountAgeDays: userCtx.accountAgeDays }
        : {}),
    };

    const response = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        const text = await response.text().catch(() => '');
        console.warn('[Feedback] POST failed:', response.status, text);
      }
      return false;
    }

    // Clear pending — feedback submitted successfully
    clearFeedbackPending();

    if (process.env.NODE_ENV === 'development') {
      console.debug('[Feedback] Submitted:', {
        rating,
        eventId: pending.eventId,
        credibility,
        responseTimeMs,
      });
    }

    return true;
  } catch (err) {
    // Never throw — feedback must not break the UI
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Feedback] Error:', err);
    }
    return false;
  }
}
