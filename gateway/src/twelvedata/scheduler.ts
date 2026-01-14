/**
 * Promagen Gateway - TwelveData Clock-Aligned Scheduler
 * =======================================================
 * Implements clock-aligned scheduling to prevent TwelveData rate limit violations.
 *
 * Security: 10/10
 * - No external inputs (pure time-based logic)
 * - Immutable slot configurations
 * - Deterministic behavior
 *
 * CRITICAL: FX and Crypto MUST use different slots to avoid simultaneous calls.
 * - FX:     :00, :30 (base schedule)
 * - Crypto: :20, :50 (20-minute offset)
 *
 * @module twelvedata/scheduler
 */

import type { FeedScheduler } from '../lib/types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Slot window tolerance in milliseconds.
 * A slot is considered "active" for this duration around the target time.
 * This prevents edge cases where refresh might be slightly early/late.
 */
const SLOT_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Minimum wait time before a refresh (prevents thrashing).
 */
const MIN_WAIT_MS = 1000; // 1 second

/**
 * Slot schedules per TwelveData feed.
 * These are the minute marks when each feed should refresh.
 *
 * CRITICAL: FX and Crypto slots MUST NOT overlap.
 */
const TWELVEDATA_SLOTS = {
  fx: [0, 30] as const,      // Minutes :00 and :30
  crypto: [20, 50] as const, // Minutes :20 and :50
} as const;

/** TwelveData feed type */
export type TwelveDataFeed = keyof typeof TWELVEDATA_SLOTS;

// =============================================================================
// SCHEDULER FACTORY
// =============================================================================

/**
 * Create a clock-aligned scheduler for a TwelveData feed.
 *
 * @param feed - The feed type ('fx' or 'crypto')
 * @returns FeedScheduler implementation (Guardrail G4)
 *
 * @example
 * ```typescript
 * const fxScheduler = createTwelveDataScheduler('fx');
 *
 * // Wait for next slot
 * const msUntil = fxScheduler.getMsUntilNextSlot();
 * setTimeout(() => refresh(), msUntil);
 *
 * // Check if in active slot
 * if (fxScheduler.isSlotActive()) {
 *   // Good time to refresh
 * }
 * ```
 */
export function createTwelveDataScheduler(feed: TwelveDataFeed): FeedScheduler {
  const slots = TWELVEDATA_SLOTS[feed];

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
     * This is useful for deciding whether to skip a refresh
     * if we just missed a slot (we're still in the window).
     */
    isSlotActive(): boolean {
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      for (const slot of slots) {
        // Check if we're within the slot window
        const minuteDiff = Math.abs(currentMinute - slot);

        // Handle hour wrap (e.g., slot 0, current minute 59)
        const wrappedDiff = Math.min(minuteDiff, 60 - minuteDiff);

        if (wrappedDiff === 0) {
          // Same minute as slot - always active
          return true;
        }

        if (wrappedDiff === 1) {
          // Adjacent minute - check if within window
          if (currentMinute < slot) {
            // We're before the slot (e.g., :29 for :30 slot)
            // Active if seconds > 58 (last 2 seconds of previous minute)
            return currentSecond >= 60 - (SLOT_WINDOW_MS / 1000);
          } else {
            // We're after the slot (e.g., :31 for :30 slot)
            // Active if seconds < 2 (first 2 seconds of next minute)
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
 * FX feed scheduler (clock-aligned to :00 and :30).
 */
export const fxScheduler = createTwelveDataScheduler('fx');

/**
 * Crypto feed scheduler (clock-aligned to :20 and :50).
 */
export const cryptoScheduler = createTwelveDataScheduler('crypto');

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get human-readable description of next refresh time.
 *
 * @param feed - The feed type
 * @returns Description like "in 12 minutes (at :30)"
 */
export function getNextRefreshDescription(feed: TwelveDataFeed): string {
  const scheduler =
    feed === 'fx' ? fxScheduler : cryptoScheduler;

  const msUntil = scheduler.getMsUntilNextSlot();
  const minutesUntil = Math.ceil(msUntil / 60000);
  const nextTime = scheduler.getNextSlotTime();
  const nextMinute = nextTime.getMinutes();

  return `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'} (at :${String(nextMinute).padStart(2, '0')})`;
}

/**
 * Validate that feed slots don't overlap.
 * This is a compile-time safety check.
 *
 * @throws Error if slots overlap (should never happen with correct constants)
 */
export function validateNoSlotOverlap(): void {
  const fxSlots = new Set<number>(TWELVEDATA_SLOTS.fx);
  const cryptoSlots = new Set<number>(TWELVEDATA_SLOTS.crypto);

  for (const slot of fxSlots) {
    if (cryptoSlots.has(slot)) {
      throw new Error(
        `CRITICAL: FX and Crypto slots overlap at minute ${slot}. ` +
          'This will cause TwelveData rate limit violations.',
      );
    }
  }
}

// Run validation at module load
validateNoSlotOverlap();
