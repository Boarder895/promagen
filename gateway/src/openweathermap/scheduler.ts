/**
 * Promagen Gateway - OpenWeatherMap Clock-Aligned Scheduler
 * ===========================================================
 * Implements clock-aligned scheduling with batch alternation for weather data.
 *
 * Security: 10/10
 * - No external inputs (pure time-based logic)
 * - Immutable slot configurations
 * - Deterministic behavior
 *
 * Schedule:
 * - Weather refreshes at :10 and :40 (offset from FX, Crypto, Indices)
 * - Batch A (priority cities) refreshes on odd hours
 * - Batch B (remaining cities) refreshes on even hours
 *
 * Timeline:
 * ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
 * │:00 │:05 │:10 │:20 │:30 │:35 │:40 │:50 │:00 │
 * ├────┼────┼────┼────┼────┼────┼────┼────┼────┤
 * │ FX │IDX │WTH │CRY │ FX │IDX │WTH │CRY │ FX │
 * └────┴────┴────┴────┴────┴────┴────┴────┴────┘
 *
 * @module openweathermap/scheduler
 */

import type { FeedScheduler } from '../lib/types.js';

import type { BatchId } from './types.js';

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
 * Weather slot schedule.
 * Offset from other feeds: FX(:00,:30), Indices(:05,:35), Crypto(:20,:50)
 */
const WEATHER_SLOTS = [10, 40] as const;

// =============================================================================
// BATCH DETERMINATION
// =============================================================================

/**
 * Determine which batch should be fetched at the current time.
 * 
 * Strategy:
 * - Odd hours (1, 3, 5, ..., 23): Batch A (priority cities)
 * - Even hours (0, 2, 4, ..., 22): Batch B (remaining cities)
 *
 * This ensures each batch is refreshed every 2 hours, with priority cities
 * (Batch A) having the same refresh frequency as non-priority cities.
 *
 * @returns Current batch ID ('A' or 'B')
 */
export function getCurrentBatch(): BatchId {
  const hour = new Date().getUTCHours();
  return hour % 2 === 1 ? 'A' : 'B';
}

/**
 * Determine which batch should be fetched at a specific time.
 * 
 * @param date - Date to check
 * @returns Batch ID ('A' or 'B')
 */
export function getBatchForTime(date: Date): BatchId {
  const hour = date.getUTCHours();
  return hour % 2 === 1 ? 'A' : 'B';
}

/**
 * Get the next time a specific batch will be refreshed.
 * 
 * @param batch - Batch to check ('A' or 'B')
 * @returns Date of next refresh for this batch
 */
export function getNextBatchRefreshTime(batch: BatchId): Date {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getMinutes();
  
  // Determine if we need this hour's slot or next hour's
  const targetMinute = currentMinute < 10 ? 10 : currentMinute < 40 ? 40 : 10;
  const addHour = currentMinute >= 40 ? 1 : 0;
  
  let targetHour = currentHour + addHour;
  
  // Find the next hour that matches the batch
  const isOddHour = (hour: number): boolean => hour % 2 === 1;
  const needsOddHour = batch === 'A';
  
  // If current target hour doesn't match batch parity, add 1 hour
  if (isOddHour(targetHour % 24) !== needsOddHour) {
    targetHour += 1;
  }
  
  const result = new Date(now);
  result.setUTCHours(targetHour % 24, targetMinute, 0, 0);
  
  // Handle day rollover
  if (result <= now) {
    result.setUTCDate(result.getUTCDate() + 1);
  }
  
  return result;
}

// =============================================================================
// SCHEDULER IMPLEMENTATION
// =============================================================================

/**
 * Weather feed scheduler implementation.
 * Implements FeedScheduler interface (Guardrail G4).
 */
const weatherSchedulerImpl: FeedScheduler = {
  /**
   * Get milliseconds until the next scheduled refresh slot.
   *
   * Algorithm:
   * 1. Get current minute
   * 2. Find next slot (:10 or :40) that's after current minute
   * 3. If no slot found in current hour, wrap to :10 + 60 minutes
   * 4. Calculate exact milliseconds, accounting for seconds
   */
  getMsUntilNextSlot(): number {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMs = now.getMilliseconds();

    // Find next slot in current hour
    let nextSlotMinute = WEATHER_SLOTS.find((s) => s > currentMinute);

    // If no slot found, wrap to first slot in next hour
    if (nextSlotMinute === undefined) {
      nextSlotMinute = WEATHER_SLOTS[0] + 60;
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

    for (const slot of WEATHER_SLOTS) {
      // Check if we're within the slot window
      const minuteDiff = Math.abs(currentMinute - slot);

      // Handle hour wrap (e.g., slot 10, current minute 59)
      const wrappedDiff = Math.min(minuteDiff, 60 - minuteDiff);

      if (wrappedDiff === 0) {
        // Same minute as slot - always active
        return true;
      }

      if (wrappedDiff === 1) {
        // Adjacent minute - check if within window
        if (currentMinute < slot) {
          // We're before the slot
          return currentSecond >= 60 - (SLOT_WINDOW_MS / 1000);
        } else {
          // We're after the slot
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
    return WEATHER_SLOTS;
  },
};

/**
 * Weather feed scheduler singleton.
 * Clock-aligned to :10 and :40 with batch alternation.
 */
export const weatherScheduler: FeedScheduler = weatherSchedulerImpl;

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get human-readable description of next refresh time.
 *
 * @returns Description like "in 12 minutes (at :10, Batch A)"
 */
export function getNextRefreshDescription(): string {
  const msUntil = weatherScheduler.getMsUntilNextSlot();
  const minutesUntil = Math.ceil(msUntil / 60000);
  const nextTime = weatherScheduler.getNextSlotTime();
  const nextMinute = nextTime.getMinutes();
  const nextBatch = getBatchForTime(nextTime);

  return `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'} (at :${String(nextMinute).padStart(2, '0')}, Batch ${nextBatch})`;
}

/**
 * Check if the current slot is for a specific batch.
 * 
 * @param batch - Batch to check
 * @returns true if current slot is for this batch
 */
export function isCurrentSlotForBatch(batch: BatchId): boolean {
  if (!weatherScheduler.isSlotActive()) {
    return false;
  }
  return getCurrentBatch() === batch;
}

/**
 * Get time until a specific batch's next refresh.
 * 
 * @param batch - Batch to check
 * @returns Milliseconds until next refresh for this batch
 */
export function getMsUntilBatchRefresh(batch: BatchId): number {
  const nextRefresh = getNextBatchRefreshTime(batch);
  return Math.max(MIN_WAIT_MS, nextRefresh.getTime() - Date.now());
}

/**
 * Validate that weather slots don't overlap with other feeds.
 * This is a compile-time safety check.
 *
 * @throws Error if slots overlap (should never happen with correct constants)
 */
export function validateNoSlotOverlap(): void {
  const weatherSlots = new Set<number>(WEATHER_SLOTS);
  
  // Known slots from other feeds (from api-calming-efficiency.md)
  const fxSlots = new Set<number>([0, 30]);
  const indicesSlots = new Set<number>([5, 35]);
  const cryptoSlots = new Set<number>([20, 50]);
  
  const otherSlots = new Set<number>([...fxSlots, ...indicesSlots, ...cryptoSlots]);

  for (const slot of weatherSlots) {
    if (otherSlots.has(slot)) {
      throw new Error(
        `CRITICAL: Weather slot ${slot} overlaps with another feed. ` +
          'This may cause rate limit issues.',
      );
    }
  }
}

// Run validation at module load
validateNoSlotOverlap();

// =============================================================================
// BATCH TRACKING STATE
// =============================================================================

/**
 * Track when each batch was last refreshed.
 * Used for stale-while-revalidate decisions.
 */
interface BatchRefreshState {
  batchARefreshedAt: number | null;
  batchBRefreshedAt: number | null;
}

const batchState: BatchRefreshState = {
  batchARefreshedAt: null,
  batchBRefreshedAt: null,
};

/**
 * Record that a batch was refreshed.
 * 
 * @param batch - Batch that was refreshed
 */
export function recordBatchRefresh(batch: BatchId): void {
  const now = Date.now();
  if (batch === 'A') {
    batchState.batchARefreshedAt = now;
  } else {
    batchState.batchBRefreshedAt = now;
  }
}

/**
 * Get when a batch was last refreshed.
 * 
 * @param batch - Batch to check
 * @returns Timestamp or null if never refreshed
 */
export function getBatchLastRefresh(batch: BatchId): number | null {
  return batch === 'A' ? batchState.batchARefreshedAt : batchState.batchBRefreshedAt;
}

/**
 * Get batch refresh state for API responses.
 */
export function getBatchRefreshState(): {
  batchARefreshedAt: string | undefined;
  batchBRefreshedAt: string | undefined;
} {
  return {
    batchARefreshedAt: batchState.batchARefreshedAt
      ? new Date(batchState.batchARefreshedAt).toISOString()
      : undefined,
    batchBRefreshedAt: batchState.batchBRefreshedAt
      ? new Date(batchState.batchBRefreshedAt).toISOString()
      : undefined,
  };
}

/**
 * Reset batch tracking state (for testing only).
 */
export function resetBatchState(): void {
  batchState.batchARefreshedAt = null;
  batchState.batchBRefreshedAt = null;
}
