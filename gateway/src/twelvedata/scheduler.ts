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
 * v3.1: NEW SCHEDULE (Both Rows Always Populated)
 * - Startup: Top row fetches immediately, bottom row fetches after 1 minute
 * - After startup: Rows alternate hourly
 * - Both rows ALWAYS have data (unlike previous even/odd hour logic)
 *
 * FX ROW SCHEDULE:
 * - T+0 (startup): Top row (pairs 0-4) fetches
 * - T+1 min: Bottom row (pairs 5-9) fetches
 * - T+1 hour: Top row refreshes
 * - T+2 hours: Bottom row refreshes
 * - Continues alternating hourly...
 *
 * @module twelvedata/scheduler
 */

import { logDebug, logInfo } from '../lib/logging.js';
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
 * Startup delay before fetching second row (milliseconds).
 */
const STARTUP_SECOND_ROW_DELAY_MS = 60 * 1000; // 1 minute

/**
 * FX row configuration.
 * Pairs are split into two rows for alternating refresh.
 */
const FX_ROW_CONFIG = {
  topRowSize: 5,      // Pairs 0-4 (EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY)
  bottomRowSize: 5,   // Pairs 5-9 (USD/INR, USD/BRL, USD/AUD, USD/NOK, USD/MYR)
  intervalMinutes: 60, // Each row refreshes every 60 minutes (alternating)
} as const;

/**
 * Slot schedules for FX feed.
 * FX uses hourly slots with row alternation.
 */
const FX_SLOTS = [0] as readonly number[]; // Minute :00 only

/** TwelveData feed type (FX only after crypto removal) */
export type TwelveDataFeed = 'fx';

/** FX row identifier */
export type FxRow = 'top' | 'bottom';

// =============================================================================
// FX ROW STATE TRACKING
// =============================================================================

/**
 * Track FX row refresh state and startup sequence.
 */
interface FxRowState {
  /** Which row was last refreshed */
  lastRefreshedRow: FxRow | null;
  /** When it was refreshed */
  lastRefreshTime: Date | null;
  /** Has startup completed (both rows fetched)? */
  startupComplete: boolean;
  /** When did startup begin? */
  startupTime: Date | null;
  /** Has top row been fetched during startup? */
  topRowFetchedAtStartup: boolean;
  /** Has bottom row been fetched during startup? */
  bottomRowFetchedAtStartup: boolean;
}

const fxRowState: FxRowState = {
  lastRefreshedRow: null,
  lastRefreshTime: null,
  startupComplete: false,
  startupTime: null,
  topRowFetchedAtStartup: false,
  bottomRowFetchedAtStartup: false,
};

/**
 * Get the row that should be fetched RIGHT NOW.
 * 
 * During startup:
 * - First call returns 'top'
 * - After 1 minute, returns 'bottom'
 * 
 * After startup:
 * - Alternates hourly based on last refresh
 */
export function getCurrentFxRow(): FxRow {
  // During startup sequence
  if (!fxRowState.startupComplete) {
    if (!fxRowState.topRowFetchedAtStartup) {
      return 'top';
    }
    // Top row done, return bottom for second fetch
    return 'bottom';
  }
  
  // After startup: alternate from last refreshed row
  if (fxRowState.lastRefreshedRow === 'top') {
    return 'bottom';
  }
  return 'top';
}

/**
 * Get the next FX row to refresh (alternates from last).
 */
export function getNextFxRow(): FxRow {
  return fxRowState.lastRefreshedRow === 'top' ? 'bottom' : 'top';
}

/**
 * Record that a row was refreshed.
 */
export function recordFxRowRefresh(row: FxRow): void {
  const now = new Date();
  
  // Track startup sequence
  if (!fxRowState.startupComplete) {
    if (!fxRowState.startupTime) {
      fxRowState.startupTime = now;
    }
    
    if (row === 'top') {
      fxRowState.topRowFetchedAtStartup = true;
      logInfo('FX startup: Top row fetched', { time: now.toISOString() });
    } else {
      fxRowState.bottomRowFetchedAtStartup = true;
      logInfo('FX startup: Bottom row fetched', { time: now.toISOString() });
    }
    
    // Check if startup is complete
    if (fxRowState.topRowFetchedAtStartup && fxRowState.bottomRowFetchedAtStartup) {
      fxRowState.startupComplete = true;
      logInfo('FX startup complete: Both rows populated', {
        startupTime: fxRowState.startupTime?.toISOString(),
        completedAt: now.toISOString(),
        durationMs: fxRowState.startupTime ? now.getTime() - fxRowState.startupTime.getTime() : 0,
      });
    }
  }
  
  fxRowState.lastRefreshedRow = row;
  fxRowState.lastRefreshTime = now;
  
  logDebug('FX row refresh recorded', {
    row,
    time: now.toISOString(),
    startupComplete: fxRowState.startupComplete,
  });
}

/**
 * Get FX row indices for slicing the pairs array.
 */
export function getFxRowIndices(row: FxRow): { start: number; end: number } {
  if (row === 'top') {
    return { start: 0, end: FX_ROW_CONFIG.topRowSize };
  }
  return {
    start: FX_ROW_CONFIG.topRowSize,
    end: FX_ROW_CONFIG.topRowSize + FX_ROW_CONFIG.bottomRowSize,
  };
}

/**
 * Get the last refreshed row state (for trace/debug).
 */
export function getFxRowState(): Readonly<FxRowState> {
  return { ...fxRowState };
}

/**
 * Check if startup sequence is complete.
 */
export function isStartupComplete(): boolean {
  return fxRowState.startupComplete;
}

/**
 * Get milliseconds until second row should be fetched during startup.
 * Returns 0 if startup is complete or top row not yet fetched.
 */
 
export function getMsUntilSecondRowFetch(): number {
  if (fxRowState.startupComplete) return 0;
  if (!fxRowState.topRowFetchedAtStartup) return 0;
  if (fxRowState.bottomRowFetchedAtStartup) return 0;
  if (!fxRowState.startupTime) return STARTUP_SECOND_ROW_DELAY_MS;
  
  const elapsed = Date.now() - fxRowState.startupTime.getTime();
  const remaining = STARTUP_SECOND_ROW_DELAY_MS - elapsed;
  return Math.max(0, remaining);
}

/**
 * Reset FX row state (for testing).
 */
export function resetFxRowState(): void {
  fxRowState.lastRefreshedRow = null;
  fxRowState.lastRefreshTime = null;
  fxRowState.startupComplete = false;
  fxRowState.startupTime = null;
  fxRowState.topRowFetchedAtStartup = false;
  fxRowState.bottomRowFetchedAtStartup = false;
}

// =============================================================================
// SCHEDULER FACTORY
// =============================================================================

/**
 * Create a clock-aligned scheduler for the FX feed.
 * 
 * NEW BEHAVIOR (v3.1):
 * - During startup: Returns immediate/1-minute delays for both rows
 * - After startup: Returns hourly delays for alternating rows
 */
export function createTwelveDataScheduler(_feed: TwelveDataFeed): FeedScheduler {
  return {
    /**
     * Get milliseconds until the next scheduled refresh slot.
     * 
     * During startup:
     * - If top row not fetched: 0 (immediate)
     * - If top row fetched but bottom not: time until 1 minute after startup
     * 
     * After startup:
     * - Time until next hour boundary
     */
    getMsUntilNextSlot(): number {
      // During startup sequence
      if (!fxRowState.startupComplete) {
        if (!fxRowState.topRowFetchedAtStartup) {
          // Top row: fetch immediately
          return MIN_WAIT_MS;
        }
        // Bottom row: fetch after delay
        return Math.max(MIN_WAIT_MS, getMsUntilSecondRowFetch());
      }
      
      // After startup: hourly schedule
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const currentMs = now.getMilliseconds();

      // Minutes until next hour
      const minutesUntilNextHour = 60 - currentMinute;
      const msUntil =
        minutesUntilNextHour * 60 * 1000 -
        currentSecond * 1000 -
        currentMs;
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
     * During startup, always returns true to allow immediate fetches.
     */
    isSlotActive(): boolean {
      // During startup, always active
      if (!fxRowState.startupComplete) {
        return true;
      }
      
      const now = new Date();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();

      // Active at :00 of each hour (with 2-minute window)
      if (currentMinute === 0) return true;
      if (currentMinute === 59 && currentSecond >= 60 - (SLOT_WINDOW_MS / 1000)) return true;
      if (currentMinute === 1 && currentSecond < SLOT_WINDOW_MS / 1000) return true;
      return false;
    },

    /**
     * Get the scheduled slot minutes for FX feed.
     */
    getSlotMinutes(): readonly number[] {
      return FX_SLOTS;
    },
  };
}

// =============================================================================
// SINGLETON SCHEDULERS
// =============================================================================

/**
 * FX feed scheduler (clock-aligned with startup sequence).
 * 
 * Schedule:
 * - T+0: Top row (pairs 0-4) fetches immediately
 * - T+1min: Bottom row (pairs 5-9) fetches
 * - T+1hr: Top row refreshes
 * - T+2hr: Bottom row refreshes
 * - Continues alternating hourly...
 */
export const fxScheduler = createTwelveDataScheduler('fx');

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get human-readable description of next refresh time.
 */
export function getNextRefreshDescription(_feed: TwelveDataFeed): string {
  const msUntil = fxScheduler.getMsUntilNextSlot();
  const minutesUntil = Math.ceil(msUntil / 60000);
  const nextRow = getCurrentFxRow();

  if (!fxRowState.startupComplete) {
    if (!fxRowState.topRowFetchedAtStartup) {
      return `immediately (startup: top row)`;
    }
    return `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'} (startup: bottom row)`;
  }

  const nextTime = fxScheduler.getNextSlotTime();
  const nextMinute = nextTime.getMinutes();

  return `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'} (at :${String(nextMinute).padStart(2, '0')}, ${nextRow} row)`;
}
