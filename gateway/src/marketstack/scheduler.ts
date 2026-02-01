/**
 * Promagen Gateway - Marketstack Clock-Aligned Scheduler
 * ========================================================
 * Implements clock-aligned scheduling for Marketstack feeds.
 *
 * UPDATED: 2026-01-31 - Changed to 15-minute refresh (4×/hour)
 *
 * Security: 10/10
 * - No external inputs (pure time-based logic)
 * - Immutable slot configurations
 * - Deterministic behavior
 *
 * CRITICAL: Indices refresh at :05, :20, :35, :50 (every 15 min)
 * Staggered from TwelveData feeds to avoid collision.
 *
 * Timeline (minutes past hour):
 * ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
 * │:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
 * ├────┼────┼────┼────┼────┼────┼────┼────┼────┤
 * │ FX │IDX │WTH │IDX │ FX │IDX │WTH │IDX │ FX │
 * └────┴────┴────┴────┴────┴────┴────┴────┴────┘
 *       ↑        ↑        ↑        ↑
 *       MS       MS       MS       MS (every 15 min)
 *
 * @module marketstack/scheduler
 */

import type { FeedScheduler } from '../lib/types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Slot window tolerance in milliseconds.
 * A slot is considered "active" for this duration around the target time.
 */
const SLOT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Minimum wait time before a refresh (prevents thrashing).
 */
const MIN_WAIT_MS = 1000; // 1 second

/**
 * Slot schedules for Marketstack feeds.
 * Indices: :05, :20, :35, :50 (every 15 minutes, staggered from FX/Crypto)
 *
 * API Budget Math (Professional tier - 100K/month):
 * - 4 calls/hour × 24 hours = 96 calls/day
 * - 96 calls/day × 30 days = 2,880 calls/month
 * - Usage: 2.88% of 100,000 budget
 */
const MARKETSTACK_SLOTS = {
  indices: [5, 20, 35, 50] as const, // Every 15 minutes
} as const;

/** Marketstack feed type */
export type MarketstackFeed = keyof typeof MARKETSTACK_SLOTS;

// =============================================================================
// SCHEDULER FACTORY
// =============================================================================

/**
 * Create a clock-aligned scheduler for a Marketstack feed.
 *
 * @param feed - The feed type ('indices')
 * @returns FeedScheduler implementation (Guardrail G4)
 *
 * @example
 * ```typescript
 * const indicesScheduler = createMarketstackScheduler('indices');
 *
 * // Wait for next slot
 * const msUntil = indicesScheduler.getMsUntilNextSlot();
 * setTimeout(() => refresh(), msUntil);
 *
 * // Check if in active slot
 * if (indicesScheduler.isSlotActive()) {
 *   // Good time to refresh
 * }
 * ```
 */
export function createMarketstackScheduler(feed: MarketstackFeed): FeedScheduler {
  const slots = MARKETSTACK_SLOTS[feed];

  return {
    /**
     * Get milliseconds until the next scheduled refresh slot.
     *
     * Algorithm:
     * 1. Get current minute
     * 2. Find next slot that's after current minute
     * 3. If no slot found in current hour, wrap to first slot + 60 minutes
     * 4. Calculate exact milliseconds, accounting for seconds
     */
    getMsUntilNextSlot(): number {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const currentMs = now.getMilliseconds();

      // Find next slot in current hour
      let nextSlotMinute = slots.find((s) => s > currentMinute);

      // If no slot found, wrap to first slot in next hour
      if (nextSlotMinute === undefined) {
        nextSlotMinute = slots[0] + 60;
      }

      // Calculate milliseconds until slot
      const minutesUntil = nextSlotMinute - currentMinute;
      const msUntil =
        minutesUntil * 60 * 1000 -
        currentSecond * 1000 -
        currentMs;

      // Ensure minimum wait time
      return Math.max(MIN_WAIT_MS, msUntil);
    },

    /**
     * Get the next scheduled refresh time.
     */
    getNextSlotTime(): Date {
      const now = new Date();
      const msUntil = this.getMsUntilNextSlot();
      return new Date(now.getTime() + msUntil);
    },

    /**
     * Check if the current time is within a refresh slot window.
     *
     * Returns true if we're within SLOT_WINDOW_MS of a slot.
     */
    isSlotActive(): boolean {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      for (const slot of slots) {
        // Check if we're within the slot window
        const minuteDiff = Math.abs(currentMinute - slot);

        // Handle hour wrap
        const wrappedDiff = Math.min(minuteDiff, 60 - minuteDiff);

        if (wrappedDiff === 0) {
          // Same minute as slot - always active
          return true;
        }

        if (wrappedDiff === 1) {
          // Adjacent minute - check if within window
          if (currentMinute < slot) {
            // Before the slot
            return currentSecond >= 60 - (SLOT_WINDOW_MS / 1000);
          } else {
            // After the slot
            return currentSecond < SLOT_WINDOW_MS / 1000;
          }
        }
      }

      return false;
    },

    /**
     * Get the scheduled slot minutes for this feed.
     */
    getSlotMinutes(): readonly number[] {
      return slots;
    },
  };
}

// =============================================================================
// SINGLETON SCHEDULERS
// =============================================================================

/**
 * Indices feed scheduler (clock-aligned to :05, :20, :35, :50).
 * Refreshes every 15 minutes for fresher market data.
 */
export const indicesScheduler = createMarketstackScheduler('indices');

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get human-readable description of next refresh time.
 *
 * @param feed - The feed type
 * @returns Description like "in 12 minutes (at :35)"
 */
export function getNextRefreshDescription(_feed: MarketstackFeed): string {
  const scheduler = indicesScheduler; // Currently only indices

  const msUntil = scheduler.getMsUntilNextSlot();
  const minutesUntil = Math.ceil(msUntil / 60000);
  const nextTime = scheduler.getNextSlotTime();
  const nextMinute = nextTime.getMinutes();

  return `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'} (at :${String(nextMinute).padStart(2, '0')})`;
}
