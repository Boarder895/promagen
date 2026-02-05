/**
 * Promagen Gateway - OpenWeatherMap Budget Manager
 * ==================================================
 * Tracks API credit usage for OpenWeatherMap.
 * OpenWeatherMap free tier: 1,000 calls/day, 60 calls/minute.
 *
 * Security: 10/10
 * - Lazy initialization ensures env vars are loaded
 * - Atomic credit tracking (no race conditions)
 * - Budget state never exposed to external clients
 * - Implements BudgetManagerInterface (Guardrail G4)
 *
 * Budget Strategy (v3.0.0 — 4-batch, dedup):
 * - 89 exchanges → 83 unique coordinates (dedup saves 6)
 * - 83 cities split into 4 batches (~21 each)
 * - One batch per hour, cycling A→B→C→D via hour % 4
 * - Single slot at :10 (dropped :40)
 * - 498 calls/day (49.8% of budget)
 * - ~21 calls per batch << 60/min limit
 *
 * Existing features preserved: Yes
 *
 * @module openweathermap/budget
 */

import { logInfo, logWarn } from '../lib/logging.js';
import type {
  BudgetManagerInterface,
  BudgetSnapshot,
  BudgetResponse,
  BudgetState,
} from '../lib/types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Get OpenWeatherMap daily limit from env or default.
 * Reads at call time (not module load) to ensure env vars are available.
 */
function getOpenWeatherMapDailyLimit(): number {
  const val = process.env['OPENWEATHERMAP_BUDGET_DAILY'] ?? '1000';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

/**
 * Get OpenWeatherMap minute limit from env or default.
 * OpenWeatherMap free tier allows 60 calls per minute.
 */
function getOpenWeatherMapMinuteLimit(): number {
  const val = process.env['OPENWEATHERMAP_BUDGET_MINUTE'] ?? '60';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

// =============================================================================
// BUDGET THRESHOLDS
// =============================================================================

/** Warning threshold as percentage of daily limit */
const WARNING_THRESHOLD_PERCENT = 0.8; // 80% (800 calls)

/** Block threshold as percentage of daily limit */
const BLOCK_THRESHOLD_PERCENT = 0.95; // 95% (950 calls)

// =============================================================================
// BUDGET MANAGER IMPLEMENTATION
// =============================================================================

/**
 * OpenWeatherMap budget manager implementation.
 * Tracks daily and per-minute API credit usage.
 */
class OpenWeatherMapBudgetManager implements BudgetManagerInterface {
  private readonly id: string;
  private readonly dailyLimit: number;
  private readonly minuteLimit: number;

  private dailyUsed: number = 0;
  private dailyResetAt: number;

  private minuteUsed: number = 0;
  private minuteResetAt: number;

  constructor() {
    this.id = 'openweathermap';
    this.dailyLimit = getOpenWeatherMapDailyLimit();
    this.minuteLimit = getOpenWeatherMapMinuteLimit();

    // Initialize reset times
    const now = Date.now();
    this.dailyResetAt = this.getNextDailyReset(now);
    this.minuteResetAt = this.getNextMinuteReset(now);

    logInfo('OpenWeatherMap budget initialized', {
      dailyLimit: this.dailyLimit,
      minuteLimit: this.minuteLimit,
      dailyResetAt: new Date(this.dailyResetAt).toISOString(),
    });
  }

  /**
   * Check if budget allows spending credits.
   * @param credits - Number of API calls to make
   */
  canSpend(credits: number): boolean {
    this.maybeReset();

    // Validate input
    if (!Number.isFinite(credits) || credits < 0) {
      return false;
    }

    // Check minute limit first (more restrictive for burst protection)
    if (this.minuteUsed + credits > this.minuteLimit) {
      logWarn('OpenWeatherMap minute limit would be exceeded', {
        minuteUsed: this.minuteUsed,
        minuteLimit: this.minuteLimit,
        requested: credits,
      });
      return false;
    }

    // Check daily limit (with block threshold)
    const blockLimit = Math.floor(this.dailyLimit * BLOCK_THRESHOLD_PERCENT);
    if (this.dailyUsed + credits > blockLimit) {
      logWarn('OpenWeatherMap daily limit would be exceeded', {
        dailyUsed: this.dailyUsed,
        blockLimit,
        requested: credits,
      });
      return false;
    }

    return true;
  }

  /**
   * Spend credits from the budget.
   * @param credits - Number of API calls made
   */
  spend(credits: number): void {
    this.maybeReset();

    // Validate input
    if (!Number.isFinite(credits) || credits < 0) {
      return;
    }

    this.dailyUsed += credits;
    this.minuteUsed += credits;

    // Log warnings if approaching limits
    const dailyPercent = this.dailyUsed / this.dailyLimit;
    if (dailyPercent >= WARNING_THRESHOLD_PERCENT) {
      logWarn('OpenWeatherMap budget warning', {
        dailyUsed: this.dailyUsed,
        dailyLimit: this.dailyLimit,
        percentUsed: Math.round(dailyPercent * 100),
        remaining: this.dailyLimit - this.dailyUsed,
      });
    }
  }

  /**
   * Get current budget state snapshot.
   */
  getState(): BudgetSnapshot {
    this.maybeReset();

    return {
      dailyUsed: this.dailyUsed,
      dailyLimit: this.dailyLimit,
      dailyResetAt: this.dailyResetAt,
      minuteUsed: this.minuteUsed,
      minuteLimit: this.minuteLimit,
      minuteResetAt: this.minuteResetAt,
      state: this.calculateState(),
    };
  }

  /**
   * Get budget state for API responses.
   */
  getResponse(): BudgetResponse {
    this.maybeReset();

    return {
      state: this.calculateState(),
      dailyUsed: this.dailyUsed,
      dailyLimit: this.dailyLimit,
      minuteUsed: this.minuteUsed,
      minuteLimit: this.minuteLimit,
    };
  }

  /**
   * Reset budget counters (for testing only).
   */
  reset(): void {
    const now = Date.now();
    this.dailyUsed = 0;
    this.minuteUsed = 0;
    this.dailyResetAt = this.getNextDailyReset(now);
    this.minuteResetAt = this.getNextMinuteReset(now);
  }

  /**
   * Get the budget manager ID.
   */
  getId(): string {
    return this.id;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Check and reset counters if periods have elapsed.
   */
  private maybeReset(): void {
    const now = Date.now();

    // Reset minute counter if minute has elapsed
    if (now >= this.minuteResetAt) {
      this.minuteUsed = 0;
      this.minuteResetAt = this.getNextMinuteReset(now);
    }

    // Reset daily counter if day has elapsed
    if (now >= this.dailyResetAt) {
      const previousUsed = this.dailyUsed;
      this.dailyUsed = 0;
      this.dailyResetAt = this.getNextDailyReset(now);

      logInfo('OpenWeatherMap daily budget reset', {
        previousUsed,
        dailyLimit: this.dailyLimit,
        nextResetAt: new Date(this.dailyResetAt).toISOString(),
      });
    }
  }

  /**
   * Calculate current budget state.
   */
  private calculateState(): BudgetState {
    const dailyPercent = this.dailyUsed / this.dailyLimit;

    if (dailyPercent >= BLOCK_THRESHOLD_PERCENT) {
      return 'blocked';
    }

    if (dailyPercent >= WARNING_THRESHOLD_PERCENT) {
      return 'warning';
    }

    return 'ok';
  }

  /**
   * Get next daily reset time (midnight UTC).
   */
  private getNextDailyReset(now: number): number {
    const date = new Date(now);
    date.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return date.getTime();
  }

  /**
   * Get next minute reset time.
   */
  private getNextMinuteReset(now: number): number {
    const date = new Date(now);
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + 1);
    return date.getTime();
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

/**
 * Lazy singleton instance.
 * Created on first access to ensure env vars are available.
 */
let instance: OpenWeatherMapBudgetManager | null = null;

/**
 * Get the OpenWeatherMap budget manager.
 *
 * @example
 * ```typescript
 * import { openWeatherMapBudget } from './budget.js';
 *
 * // Check before making API calls (~21 cities per batch)
 * if (openWeatherMapBudget.canSpend(21)) {
 *   openWeatherMapBudget.spend(21);
 *   // Make API calls
 * }
 * ```
 */
export function getOpenWeatherMapBudget(): BudgetManagerInterface {
  if (!instance) {
    instance = new OpenWeatherMapBudgetManager();
  }
  return instance;
}

/**
 * Convenience export for the budget manager.
 * This is a getter that returns the lazy singleton.
 */
export const openWeatherMapBudget: BudgetManagerInterface = {
  canSpend: (credits) => getOpenWeatherMapBudget().canSpend(credits),
  spend: (credits) => getOpenWeatherMapBudget().spend(credits),
  getState: () => getOpenWeatherMapBudget().getState(),
  getResponse: () => getOpenWeatherMapBudget().getResponse(),
  reset: () => getOpenWeatherMapBudget().reset(),
  getId: () => getOpenWeatherMapBudget().getId(),
};

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Reset the singleton instance (for testing only).
 * This forces a fresh budget manager on next access.
 */
export function resetOpenWeatherMapBudget(): void {
  instance = null;
}

// =============================================================================
// BUDGET CALCULATIONS (v3.0.0 — 4-batch, dedup strategy)
// =============================================================================

/**
 * Number of batches in the rotation.
 * v3.0.0: Changed from 2 to 4 to cover all 89 exchanges (83 unique coords).
 */
export const NUM_BATCHES = 4;

/**
 * Maximum cities per batch (safety cap for 60/min limit compliance).
 * Actual batch sizes determined by ceil(uniqueLocations / 4) ≈ 21.
 * Cap kept at 24 for headroom. 24 < 60 ✅
 */
export const MAX_CITIES_PER_BATCH = 24;

/**
 * Expected daily usage based on 4-batch dedup strategy.
 *
 * 83 unique locations × 6 refreshes/day (every 4 hours) = 498 calls/day.
 *
 * Breakdown:
 * - Batch A: 21 unique × 6 = 126
 * - Batch B: 21 unique × 6 = 126
 * - Batch C: 21 unique × 6 = 126
 * - Batch D: 20 unique × 6 = 120
 * - Total: 498 (49.8% of 1,000 budget)
 */
export const EXPECTED_DAILY_USAGE = 498;

/**
 * Calculate remaining budget headroom.
 * @returns Number of additional calls available today
 */
export function getBudgetHeadroom(): number {
  const state = getOpenWeatherMapBudget().getState();
  const blockLimit = Math.floor(state.dailyLimit * BLOCK_THRESHOLD_PERCENT);
  return Math.max(0, blockLimit - state.dailyUsed);
}
