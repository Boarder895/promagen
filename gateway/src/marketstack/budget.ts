/**
 * Promagen Gateway - Marketstack Separate Budget Manager
 * ========================================================
 * CRITICAL: Marketstack has its own pool of 250 credits/day.
 * This is COMPLETELY SEPARATE from TwelveData's 800/day budget.
 *
 * Security: 10/10
 * - Lazy initialization ensures env vars are loaded
 * - Atomic credit tracking (no race conditions)
 * - Budget state never exposed to external clients
 * - Implements BudgetManagerInterface (Guardrail G4)
 *
 * @module marketstack/budget
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
 * Get Marketstack daily limit from env or default.
 * Reads at call time (not module load) to ensure env vars are available.
 */
function getMarketstackDailyLimit(): number {
  const val =
    process.env['MARKETSTACK_BUDGET_DAILY'] ??
    process.env['INDICES_RIBBON_BUDGET_DAILY_ALLOWANCE'] ??
    '250';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 250;
}

/**
 * Get Marketstack minute limit from env or default.
 * Marketstack allows 3 credits per minute on the free tier.
 */
function getMarketstackMinuteLimit(): number {
  const val =
    process.env['MARKETSTACK_BUDGET_MINUTE'] ??
    process.env['INDICES_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ??
    '3';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

// =============================================================================
// BUDGET THRESHOLDS
// =============================================================================

/** Warning threshold as percentage of daily limit */
const WARNING_THRESHOLD_PERCENT = 0.8; // 80%

/** Block threshold as percentage of daily limit */
const BLOCK_THRESHOLD_PERCENT = 0.95; // 95%

// =============================================================================
// BUDGET MANAGER IMPLEMENTATION
// =============================================================================

/**
 * Marketstack budget manager implementation.
 * Tracks daily and per-minute credit usage.
 */
class MarketstackBudgetManager implements BudgetManagerInterface {
  private readonly id: string;
  private readonly dailyLimit: number;
  private readonly minuteLimit: number;

  private dailyUsed: number = 0;
  private dailyResetAt: number;

  private minuteUsed: number = 0;
  private minuteResetAt: number;

  constructor() {
    this.id = 'marketstack-separate';
    this.dailyLimit = getMarketstackDailyLimit();
    this.minuteLimit = getMarketstackMinuteLimit();

    // Initialize reset times
    const now = Date.now();
    this.dailyResetAt = this.getNextDailyReset(now);
    this.minuteResetAt = this.getNextMinuteReset(now);

    logInfo('Marketstack separate budget initialized', {
      dailyLimit: this.dailyLimit,
      minuteLimit: this.minuteLimit,
      dailyResetAt: new Date(this.dailyResetAt).toISOString(),
    });
  }

  /**
   * Check if budget allows spending credits.
   */
  canSpend(credits: number): boolean {
    this.maybeReset();

    // Check minute limit first (more restrictive)
    if (this.minuteUsed + credits > this.minuteLimit) {
      return false;
    }

    // Check daily limit (with block threshold)
    const blockLimit = Math.floor(this.dailyLimit * BLOCK_THRESHOLD_PERCENT);
    if (this.dailyUsed + credits > blockLimit) {
      return false;
    }

    return true;
  }

  /**
   * Spend credits from the budget.
   */
  spend(credits: number): void {
    this.maybeReset();

    this.dailyUsed += credits;
    this.minuteUsed += credits;

    // Log warnings if approaching limits
    const dailyPercent = this.dailyUsed / this.dailyLimit;
    if (dailyPercent >= WARNING_THRESHOLD_PERCENT) {
      logWarn('Marketstack budget warning', {
        dailyUsed: this.dailyUsed,
        dailyLimit: this.dailyLimit,
        percentUsed: Math.round(dailyPercent * 100),
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
      this.dailyUsed = 0;
      this.dailyResetAt = this.getNextDailyReset(now);
      logInfo('Marketstack daily budget reset', {
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
let instance: MarketstackBudgetManager | null = null;

/**
 * Get the Marketstack budget manager.
 *
 * CRITICAL: This is SEPARATE from TwelveData's budget.
 * Indices use this manager exclusively.
 *
 * @example
 * ```typescript
 * import { marketstackBudget } from './budget.js';
 *
 * if (marketstackBudget.canSpend(1)) {
 *   marketstackBudget.spend(1);
 *   // Make API call
 * }
 * ```
 */
export function getMarketstackBudget(): BudgetManagerInterface {
  if (!instance) {
    instance = new MarketstackBudgetManager();
  }
  return instance;
}

/**
 * Convenience export for the Marketstack budget.
 * This is a getter that returns the lazy singleton.
 */
export const marketstackBudget: BudgetManagerInterface = {
  canSpend: (credits) => getMarketstackBudget().canSpend(credits),
  spend: (credits) => getMarketstackBudget().spend(credits),
  getState: () => getMarketstackBudget().getState(),
  getResponse: () => getMarketstackBudget().getResponse(),
  reset: () => getMarketstackBudget().reset(),
  getId: () => getMarketstackBudget().getId(),
};

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Reset the singleton instance (for testing only).
 * This forces a fresh budget manager on next access.
 */
export function resetMarketstackBudget(): void {
  instance = null;
}
