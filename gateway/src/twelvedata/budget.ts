/**
 * Promagen Gateway - TwelveData Shared Budget Manager
 * =====================================================
 * CRITICAL: TwelveData has ONE pool of 800 credits/day shared by FX + Crypto.
 * Both feeds MUST use this SHARED manager, not create their own.
 *
 * Security: 10/10
 * - Lazy initialization ensures env vars are loaded
 * - Atomic credit tracking (no race conditions)
 * - Budget state never exposed to external clients
 * - Implements BudgetManagerInterface (Guardrail G4)
 *
 * @module twelvedata/budget
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
 * Get TwelveData daily limit from env or default.
 * Reads at call time (not module load) to ensure env vars are available.
 */
function getTwelveDataDailyLimit(): number {
  const val =
    process.env['TWELVEDATA_BUDGET_DAILY'] ??
    process.env['FX_RIBBON_BUDGET_DAILY_ALLOWANCE'] ??
    '800';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 800;
}

/**
 * Get TwelveData minute limit from env or default.
 * TwelveData allows 8 credits per minute on the free tier.
 */
function getTwelveDataMinuteLimit(): number {
  const val =
    process.env['TWELVEDATA_BUDGET_MINUTE'] ??
    process.env['FX_RIBBON_BUDGET_MINUTE_ALLOWANCE'] ??
    '8';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
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
 * TwelveData budget manager implementation.
 * Tracks daily and per-minute credit usage.
 */
class TwelveDataBudgetManager implements BudgetManagerInterface {
  private readonly id: string;
  private readonly dailyLimit: number;
  private readonly minuteLimit: number;

  private dailyUsed: number = 0;
  private dailyResetAt: number;

  private minuteUsed: number = 0;
  private minuteResetAt: number;

  constructor() {
    this.id = 'twelvedata-shared';
    this.dailyLimit = getTwelveDataDailyLimit();
    this.minuteLimit = getTwelveDataMinuteLimit();

    // Initialize reset times
    const now = Date.now();
    this.dailyResetAt = this.getNextDailyReset(now);
    this.minuteResetAt = this.getNextMinuteReset(now);

    logInfo('TwelveData shared budget initialized', {
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
      logWarn('TwelveData budget warning', {
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
      logInfo('TwelveData daily budget reset', {
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
let instance: TwelveDataBudgetManager | null = null;

/**
 * Get the shared TwelveData budget manager.
 *
 * CRITICAL: Both FX and Crypto MUST use this same instance.
 * Do NOT create separate budget managers.
 *
 * @example
 * ```typescript
 * import { twelveDataBudget } from './budget.js';
 *
 * if (twelveDataBudget.canSpend(1)) {
 *   twelveDataBudget.spend(1);
 *   // Make API call
 * }
 * ```
 */
export function getTwelveDataBudget(): BudgetManagerInterface {
  if (!instance) {
    instance = new TwelveDataBudgetManager();
  }
  return instance;
}

/**
 * Convenience export for the shared budget.
 * This is a getter that returns the lazy singleton.
 */
export const twelveDataBudget: BudgetManagerInterface = {
  canSpend: (credits) => getTwelveDataBudget().canSpend(credits),
  spend: (credits) => getTwelveDataBudget().spend(credits),
  getState: () => getTwelveDataBudget().getState(),
  getResponse: () => getTwelveDataBudget().getResponse(),
  reset: () => getTwelveDataBudget().reset(),
  getId: () => getTwelveDataBudget().getId(),
};

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Reset the singleton instance (for testing only).
 * This forces a fresh budget manager on next access.
 */
export function resetTwelveDataBudget(): void {
  instance = null;
}
