// src/lib/learning/feedback-streaks.ts
// ============================================================================
// FEEDBACK SENTIMENT STREAKS — Real-time feedback pattern detection
// ============================================================================
//
// Phase 7.10f — Tracks consecutive feedback patterns per session per platform.
//
// Three streak types:
//   🔥 Hot streak  — 3+ consecutive 👍 on same platform
//                    → boost term combination weights (user found a formula)
//   ❄️ Cold streak — 3+ consecutive 👎 on same platform
//                    → flag for admin review (something systematic is failing)
//   🔄 Oscillating — alternating 👍👎👍👎 (4+ ratings)
//                    → record as high-variance (useful for A/B decisions)
//
// Architecture:
//   - FeedbackStreakTracker class — per-session, per-platform state
//   - detectStreak() — pure function, given a history → streak or null
//   - computeStreakBoost() — maps streak → weight multiplier
//   - sessionStorage persistence — survives page refreshes within session
//
// Integration:
//   - Called from feedback-client.ts after each sendFeedback()
//   - Streak metadata flushed to server as part of feedback event
//   - Hot streak boosts consumed by nightly cron (learned_weights)
//   - Cold streak alerts consumed by admin dashboard
//
// Pure functions except for sessionStorage I/O in the tracker class.
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md § 7.10f
//
// Version: 1.0.0 — Phase 7.10f Feedback Sentiment Streaks
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import type { FeedbackRating } from '@/types/feedback';
import { LEARNING_CONSTANTS } from '@/lib/learning/constants';

// ============================================================================
// TYPES
// ============================================================================

/** The three detectable streak patterns */
export type StreakType = 'hot' | 'cold' | 'oscillating';

/**
 * A detected streak signal.
 * Returned by detectStreak() when a pattern is found.
 */
export interface StreakSignal {
  /** Which pattern was detected */
  type: StreakType;
  /** How many ratings form this streak */
  length: number;
  /** The platform this streak applies to */
  platform: string;
  /** Timestamp of detection */
  detectedAt: number;
}

/**
 * Per-platform feedback history entry.
 * Stored in sessionStorage, flushed to server with feedback events.
 */
export interface FeedbackHistoryEntry {
  /** The rating given */
  rating: FeedbackRating;
  /** Prompt event ID (for linking to specific term combinations) */
  eventId: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Full session streak state (serialised to sessionStorage).
 */
export interface StreakSessionState {
  /** Per-platform history: platform → ordered list of ratings */
  platforms: Record<string, FeedbackHistoryEntry[]>;
}

// ============================================================================
// CONSTANTS (from LEARNING_CONSTANTS)
// ============================================================================

const c = LEARNING_CONSTANTS;

// ============================================================================
// PURE FUNCTIONS — streak detection
// ============================================================================

/**
 * Detect a streak pattern in a sequence of ratings.
 *
 * Checks the most recent ratings (tail of the array) for:
 * 1. Hot streak: last N are all 'positive' (N >= threshold)
 * 2. Cold streak: last N are all 'negative' (N >= threshold)
 * 3. Oscillating: last N alternate positive↔negative (N >= oscillating threshold)
 *
 * Returns the first pattern found (priority: hot > cold > oscillating),
 * or null if no pattern is detected.
 *
 * @param ratings — Ordered history (oldest first)
 * @param platform — Platform these ratings apply to
 * @returns StreakSignal or null
 */
export function detectStreak(
  ratings: FeedbackRating[],
  platform: string,
): StreakSignal | null {
  const threshold = c.FEEDBACK_STREAK_THRESHOLD;
  const oscThreshold = c.FEEDBACK_OSCILLATING_THRESHOLD;

  if (ratings.length < threshold) return null;

  // --- Check hot streak (consecutive positive from tail) ---
  const hotLength = countConsecutiveFromTail(ratings, 'positive');
  if (hotLength >= threshold) {
    return {
      type: 'hot',
      length: hotLength,
      platform,
      detectedAt: Date.now(),
    };
  }

  // --- Check cold streak (consecutive negative from tail) ---
  const coldLength = countConsecutiveFromTail(ratings, 'negative');
  if (coldLength >= threshold) {
    return {
      type: 'cold',
      length: coldLength,
      platform,
      detectedAt: Date.now(),
    };
  }

  // --- Check oscillating pattern (alternating pos/neg from tail) ---
  if (ratings.length >= oscThreshold) {
    const oscLength = countAlternatingFromTail(ratings);
    if (oscLength >= oscThreshold) {
      return {
        type: 'oscillating',
        length: oscLength,
        platform,
        detectedAt: Date.now(),
      };
    }
  }

  return null;
}

/**
 * Count consecutive ratings matching `target` from the tail of the array.
 */
function countConsecutiveFromTail(
  ratings: FeedbackRating[],
  target: FeedbackRating,
): number {
  let count = 0;
  for (let i = ratings.length - 1; i >= 0; i--) {
    if (ratings[i] === target) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count alternating positive↔negative ratings from the tail.
 * 'neutral' breaks the alternating pattern.
 */
function countAlternatingFromTail(ratings: FeedbackRating[]): number {
  if (ratings.length < 2) return 0;

  let count = 1; // Start with the last rating
  for (let i = ratings.length - 2; i >= 0; i--) {
    const current = ratings[i];
    const next = ratings[i + 1];

    // Must alternate between 'positive' and 'negative'
    if (
      (current === 'positive' && next === 'negative') ||
      (current === 'negative' && next === 'positive')
    ) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Compute the quality score multiplier for a detected streak.
 *
 * Hot streak → boost (1.15×): amplify winning term combinations
 * Cold streak → penalty (0.85×): dampen failing term combinations
 * Oscillating → neutral (1.0×): no weight change, recorded for analytics
 *
 * @param streak — The detected streak signal
 * @returns Multiplier for term combination weights in the learning pipeline
 */
export function computeStreakBoost(streak: StreakSignal): number {
  switch (streak.type) {
    case 'hot':
      return c.FEEDBACK_STREAK_HOT_BOOST;
    case 'cold':
      return c.FEEDBACK_STREAK_COLD_PENALTY;
    case 'oscillating':
      return 1.0; // No weight change — informational only
    default:
      return 1.0;
  }
}

// ============================================================================
// SESSION STORAGE KEY
// ============================================================================

const STREAK_STATE_KEY = 'promagen_feedback_streaks';

// ============================================================================
// FeedbackStreakTracker — per-session state management
// ============================================================================

/**
 * Tracks feedback streaks per platform within a browser session.
 *
 * State is persisted in sessionStorage so it survives page refreshes
 * but dies when the tab closes (matching telemetry session semantics).
 *
 * Usage:
 * ```ts
 * const tracker = new FeedbackStreakTracker();
 * tracker.record('midjourney', 'positive', 'evt_123');
 * const streak = tracker.currentStreak('midjourney');
 * // streak → { type: 'hot', length: 3, ... } or null
 * ```
 */
export class FeedbackStreakTracker {
  private state: StreakSessionState;

  constructor() {
    this.state = this.loadState();
  }

  /**
   * Record a new feedback rating for a platform.
   * Returns the current streak signal (if any) after recording.
   */
  record(
    platform: string,
    rating: FeedbackRating,
    eventId: string,
  ): StreakSignal | null {
    if (!this.state.platforms[platform]) {
      this.state.platforms[platform] = [];
    }

    const history = this.state.platforms[platform]!;
    history.push({ rating, eventId, timestamp: Date.now() });

    // Cap history length to prevent unbounded growth
    if (history.length > c.FEEDBACK_STREAK_MAX_HISTORY) {
      this.state.platforms[platform] = history.slice(-c.FEEDBACK_STREAK_MAX_HISTORY);
    }

    this.saveState();

    return this.currentStreak(platform);
  }

  /**
   * Get the current streak signal for a platform (or null if no streak).
   */
  currentStreak(platform: string): StreakSignal | null {
    const history = this.state.platforms[platform];
    if (!history || history.length === 0) return null;

    const ratings = history.map((e) => e.rating);
    return detectStreak(ratings, platform);
  }

  /**
   * Get the full history for a platform.
   */
  getHistory(platform: string): readonly FeedbackHistoryEntry[] {
    return this.state.platforms[platform] ?? [];
  }

  /**
   * Get all platforms that have recorded feedback.
   */
  getPlatforms(): string[] {
    return Object.keys(this.state.platforms);
  }

  /**
   * Clear all streak state (e.g. on session reset).
   */
  clear(): void {
    this.state = { platforms: {} };
    this.saveState();
  }

  // --- sessionStorage I/O ---

  private loadState(): StreakSessionState {
    try {
      const raw = sessionStorage.getItem(STREAK_STATE_KEY);
      if (!raw) return { platforms: {} };
      const parsed = JSON.parse(raw) as StreakSessionState;
      if (!parsed.platforms || typeof parsed.platforms !== 'object') {
        return { platforms: {} };
      }
      return parsed;
    } catch {
      return { platforms: {} };
    }
  }

  private saveState(): void {
    try {
      sessionStorage.setItem(STREAK_STATE_KEY, JSON.stringify(this.state));
    } catch {
      // sessionStorage blocked — silent fail
    }
  }
}
