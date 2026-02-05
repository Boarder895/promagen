/**
 * Promagen Gateway - OpenWeatherMap Clock-Aligned Scheduler
 * ===========================================================
 * Implements clock-aligned scheduling with 4-batch rotation for weather data.
 *
 * Security: 10/10
 * - No external inputs (pure time-based logic)
 * - Immutable slot configurations
 * - Deterministic behavior
 *
 * Schedule (v3.0.0 — 4-batch):
 * - Weather refreshes at :10 only (dropped :40 to stay within budget)
 * - 4 batches rotate by hour: hour % 4 → 0=A, 1=B, 2=C, 3=D
 * - Each batch refreshes every 4 hours (6× per day)
 * - ~21 calls per batch << 60/min limit
 *
 * Timeline:
 * ┌────┬────┬────┬────┬────┬────┬────┬────┬────┐
 * │:00 │:05 │:10 │:20 │:30 │:35 │    │:50 │:00 │
 * ├────┼────┼────┼────┼────┼────┼────┼────┼────┤
 * │ FX │IDX │WTH │CRY │ FX │IDX │    │CRY │ FX │
 * └────┴────┴────┴────┴────┴────┴────┴────┴────┘
 *
 * :40 slot freed — available for future feeds.
 *
 * Existing features preserved: Yes
 *
 * @module openweathermap/scheduler
 */

import type { FeedScheduler } from '../lib/types.js';

import type { BatchId } from './types.js';
import { ALL_BATCH_IDS } from './types.js';

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
 * v3.0.0: Reduced from [10, 40] to [10] only.
 * Single slot per hour — batches rotate instead of alternating.
 */
const WEATHER_SLOTS = [10] as const;

// =============================================================================
// BATCH DETERMINATION
// =============================================================================

/**
 * Determine which batch should be fetched at the current time.
 *
 * v3.0.0 Strategy (4-batch rotation):
 * - hour % 4 === 0 → Batch A
 * - hour % 4 === 1 → Batch B
 * - hour % 4 === 2 → Batch C
 * - hour % 4 === 3 → Batch D
 *
 * Each batch refreshes every 4 hours (6× per day).
 *
 * @returns Current batch ID ('A', 'B', 'C', or 'D')
 */
export function getCurrentBatch(): BatchId {
  const hour = new Date().getUTCHours();
  return ALL_BATCH_IDS[hour % 4]!;
}

/**
 * Determine which batch should be fetched at a specific time.
 *
 * @param date - Date to check
 * @returns Batch ID ('A', 'B', 'C', or 'D')
 */
export function getBatchForTime(date: Date): BatchId {
  const hour = date.getUTCHours();
  return ALL_BATCH_IDS[hour % 4]!;
}

/**
 * Get the next time a specific batch will be refreshed.
 *
 * @param batch - Batch to check ('A', 'B', 'C', or 'D')
 * @returns Date of next refresh for this batch
 */
export function getNextBatchRefreshTime(batch: BatchId): Date {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getMinutes();

  // Target minute is always :10 (single slot)
  const targetMinute = WEATHER_SLOTS[0];

  // If we've already passed :10 this hour, start looking from the next hour
  const startHour = currentMinute >= targetMinute ? currentHour + 1 : currentHour;

  // Find the next hour whose batch matches the requested one
  const batchIndex = ALL_BATCH_IDS.indexOf(batch);
  for (let offset = 0; offset < 4; offset++) {
    const candidateHour = (startHour + offset) % 24;
    if (candidateHour % 4 === batchIndex) {
      const result = new Date(now);
      result.setUTCHours(candidateHour, targetMinute, 0, 0);

      // Handle day rollover
      if (result <= now) {
        result.setUTCDate(result.getUTCDate() + 1);
      }

      return result;
    }
  }

  // Fallback: should never reach here but return 4 hours from now
  return new Date(now.getTime() + 4 * 60 * 60 * 1000);
}

// =============================================================================
// SCHEDULER IMPLEMENTATION
// =============================================================================

/**
 * Weather feed scheduler implementation.
 * Implements FeedScheduler interface (Guardrail G4).
 *
 * v3.0.0: Single slot at :10 (was :10 and :40).
 */
const weatherSchedulerImpl: FeedScheduler = {
  /**
   * Get milliseconds until the next scheduled refresh slot.
   *
   * Algorithm:
   * 1. Get current minute
   * 2. Find next slot (:10) that's after current minute
   * 3. If no slot found in current hour, wrap to :10 of next hour
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
   * Returns true if we're within SLOT_WINDOW_MS of the :10 slot.
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
 * v3.0.0: Clock-aligned to :10 only with 4-batch rotation.
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
// BATCH TRACKING STATE (v3.0.0 — 4 batches)
// =============================================================================

/**
 * Track when each batch was last refreshed.
 * Used for stale-while-revalidate decisions and /trace endpoint.
 */
interface BatchRefreshState {
  batchARefreshedAt: number | null;
  batchBRefreshedAt: number | null;
  batchCRefreshedAt: number | null;
  batchDRefreshedAt: number | null;
}

const batchState: BatchRefreshState = {
  batchARefreshedAt: null,
  batchBRefreshedAt: null,
  batchCRefreshedAt: null,
  batchDRefreshedAt: null,
};

/**
 * Record that a batch was refreshed.
 *
 * @param batch - Batch that was refreshed
 */
export function recordBatchRefresh(batch: BatchId): void {
  const now = Date.now();
  switch (batch) {
    case 'A':
      batchState.batchARefreshedAt = now;
      break;
    case 'B':
      batchState.batchBRefreshedAt = now;
      break;
    case 'C':
      batchState.batchCRefreshedAt = now;
      break;
    case 'D':
      batchState.batchDRefreshedAt = now;
      break;
  }
}

/**
 * Get when a batch was last refreshed.
 *
 * @param batch - Batch to check
 * @returns Timestamp or null if never refreshed
 */
export function getBatchLastRefresh(batch: BatchId): number | null {
  switch (batch) {
    case 'A':
      return batchState.batchARefreshedAt;
    case 'B':
      return batchState.batchBRefreshedAt;
    case 'C':
      return batchState.batchCRefreshedAt;
    case 'D':
      return batchState.batchDRefreshedAt;
  }
}

/**
 * Get batch refresh state for API responses.
 */
export function getBatchRefreshState(): {
  batchARefreshedAt: string | undefined;
  batchBRefreshedAt: string | undefined;
  batchCRefreshedAt: string | undefined;
  batchDRefreshedAt: string | undefined;
} {
  return {
    batchARefreshedAt: batchState.batchARefreshedAt
      ? new Date(batchState.batchARefreshedAt).toISOString()
      : undefined,
    batchBRefreshedAt: batchState.batchBRefreshedAt
      ? new Date(batchState.batchBRefreshedAt).toISOString()
      : undefined,
    batchCRefreshedAt: batchState.batchCRefreshedAt
      ? new Date(batchState.batchCRefreshedAt).toISOString()
      : undefined,
    batchDRefreshedAt: batchState.batchDRefreshedAt
      ? new Date(batchState.batchDRefreshedAt).toISOString()
      : undefined,
  };
}

/**
 * Reset batch tracking state (for testing only).
 */
export function resetBatchState(): void {
  batchState.batchARefreshedAt = null;
  batchState.batchBRefreshedAt = null;
  batchState.batchCRefreshedAt = null;
  batchState.batchDRefreshedAt = null;
}
