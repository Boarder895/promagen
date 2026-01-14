/**
 * Promagen Gateway - Fallback Feed Scheduler
 * ===========================================
 * Clock-aligned scheduling for fallback feeds (Commodities).
 *
 * Slot Schedule:
 * - Commodities: :10, :40 (minutes past the hour)
 *
 * Why clock-align when there's no API?
 * - Consistency: All feeds use the same pattern
 * - Future-proof: Ready to plug in a provider
 * - Predictable: Cache refresh is deterministic
 *
 * Timeline visualization:
 * :00  :05  :10  :20  :30  :35  :40  :50
 *  FX  IDX  CMD  CRY  FX  IDX  CMD  CRY
 *  TD   MS   --   TD   TD   MS   --   TD
 *
 * GUARDRAIL G4: Implements FeedScheduler interface.
 *
 * @module fallback/scheduler
 */

import type { FeedScheduler } from '../lib/types.js';

// =============================================================================
// COMMODITIES SCHEDULER (:10, :40)
// =============================================================================

/**
 * Clock-aligned scheduler for Commodities feed.
 * Refreshes at :10 and :40 past each hour.
 * No API calls - just cache refresh timing.
 */
class CommoditiesScheduler implements FeedScheduler {
  /**
   * Slot minutes for Commodities.
   * - :10 and :40 past each hour
   * - Staggered from FX (:00/:30), Indices (:05/:35), Crypto (:20/:50)
   */
  private readonly SLOT_MINUTES = [10, 40] as const;

  /**
   * Slot window in milliseconds.
   * A slot is "active" for 2 minutes around the target time.
   */
  private readonly SLOT_WINDOW_MS = 2 * 60 * 1000;

  /**
   * Get milliseconds until the next scheduled slot.
   * Used by background refresh to sleep until next refresh time.
   */
  getMsUntilNextSlot(): number {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMs = now.getMilliseconds();

    // Find next slot minute
    let nextSlotMinute: number | null = null;
    let minutesUntilSlot = 0;

    for (const slotMinute of this.SLOT_MINUTES) {
      if (currentMinute < slotMinute) {
        nextSlotMinute = slotMinute;
        minutesUntilSlot = slotMinute - currentMinute;
        break;
      }
    }

    // If no slot found in current hour, use first slot of next hour
    if (nextSlotMinute === null) {
      nextSlotMinute = this.SLOT_MINUTES[0];
      minutesUntilSlot = 60 - currentMinute + nextSlotMinute;
    }

    // Calculate ms until slot
    const msUntilSlot =
      minutesUntilSlot * 60 * 1000 -
      currentSecond * 1000 -
      currentMs;

    // Ensure minimum 1 second wait
    return Math.max(msUntilSlot, 1000);
  }

  /**
   * Get the next scheduled slot time.
   */
  getNextSlotTime(): Date {
    const now = new Date();
    const msUntilSlot = this.getMsUntilNextSlot();
    return new Date(now.getTime() + msUntilSlot);
  }

  /**
   * Check if current time is within a slot window.
   * Returns true if within 2 minutes of a slot.
   */
  isSlotActive(): boolean {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    for (const slotMinute of this.SLOT_MINUTES) {
      // Calculate distance to slot in seconds
      let distanceMinutes = Math.abs(currentMinute - slotMinute);

      // Handle hour wraparound
      if (distanceMinutes > 30) {
        distanceMinutes = 60 - distanceMinutes;
      }

      const distanceSeconds = distanceMinutes * 60 + currentSecond;

      // Check if within window (2 minutes = 120 seconds)
      if (distanceSeconds <= this.SLOT_WINDOW_MS / 1000) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get slot minutes for trace info.
   */
  getSlotMinutes(): readonly number[] {
    return this.SLOT_MINUTES;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Commodities scheduler singleton.
 * Exported for use by commodities feed handler.
 */
export const commoditiesScheduler = new CommoditiesScheduler();
