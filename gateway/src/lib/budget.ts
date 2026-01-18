/**
 * Promagen Gateway - Budget Manager
 * ==================================
 * Tracks API usage against daily and per-minute limits.
 *
 * Security: 10/10
 * - Hard enforcement (cannot overspend)
 * - Atomic operations (no race conditions in single-process)
 * - Automatic reset at midnight UTC
 * - Warning threshold for proactive alerting
 *
 * Features:
 * - Daily budget tracking
 * - Per-minute rate limiting
 * - Automatic midnight UTC reset
 * - Warning state at 70% usage
 * - Blocked state at 100% usage
 * - Zero-budget mode for no-provider feeds
 *
 * @module lib/budget
 */

import { logInfo, logWarn } from './logging.js';
import type { BudgetSnapshot, BudgetState, BudgetResponse } from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Warning threshold as percentage of daily limit */
const WARNING_THRESHOLD = 0.7; // 70%

/** Per-minute window in milliseconds */
const MINUTE_WINDOW_MS = 60_000;

// =============================================================================
// BUDGET MANAGER CLASS
// =============================================================================

/**
 * Budget manager for tracking API usage against limits.
 *
 * @example
 * ```typescript
 * const budget = new BudgetManager({
 *   id: 'twelvedata',
 *   dailyLimit: 800,
 *   minuteLimit: 8,
 * });
 *
 * // Check before spending
 * if (budget.canSpend(8)) {
 *   budget.spend(8);
 *   // ... make API call
 * }
 *
 * // Get current state
 * const state = budget.getState();
 * console.log(`Used ${state.dailyUsed} of ${state.dailyLimit}`);
 * ```
 */
export class BudgetManager {
  private readonly id: string;
  private readonly dailyLimit: number;
  private readonly minuteLimit: number;
  private readonly warnThreshold: number;
  private readonly isNoBudget: boolean;

  private dailyUsed: number = 0;
  private dailyResetAt: number;
  private minuteUsed: number = 0;
  private minuteResetAt: number;

  /**
   * Create a new budget manager.
   *
   * @param config - Budget configuration
   * @param config.id - Identifier for logging
   * @param config.dailyLimit - Maximum credits per day (0 = no-budget mode)
   * @param config.minuteLimit - Maximum credits per minute (0 = no-budget mode)
   * @param config.warnThreshold - Warning threshold (default: 0.7)
   */
  constructor(config: {
    id: string;
    dailyLimit: number;
    minuteLimit: number;
    warnThreshold?: number;
  }) {
    // Allow zero for no-provider feeds, but not negative
    if (config.dailyLimit < 0) {
      throw new Error('dailyLimit must be non-negative');
    }
    if (config.minuteLimit < 0) {
      throw new Error('minuteLimit must be non-negative');
    }

    this.id = config.id;
    this.dailyLimit = config.dailyLimit;
    this.minuteLimit = config.minuteLimit;
    this.warnThreshold = config.warnThreshold ?? WARNING_THRESHOLD;

    // Zero limits = no-budget mode (always returns 'ok', blocks all spending)
    this.isNoBudget = config.dailyLimit === 0 || config.minuteLimit === 0;

    // Initialize reset times
    this.dailyResetAt = this.getNextMidnightUtc();
    this.minuteResetAt = Date.now() + MINUTE_WINDOW_MS;
  }

  /**
   * Check if credits can be spent without exceeding limits.
   * Automatically resets counters if windows have passed.
   *
   * In no-budget mode (limits = 0), always returns false.
   */
  canSpend(credits: number): boolean {
    // No-budget mode: can never spend
    if (this.isNoBudget) {
      return false;
    }

    this.maybeReset();

    // Check minute limit
    if (this.minuteUsed + credits > this.minuteLimit) {
      return false;
    }

    // Check daily limit
    if (this.dailyUsed + credits > this.dailyLimit) {
      return false;
    }

    return true;
  }

  /**
   * Spend credits. Returns true if successful, false if would exceed limits.
   * Does NOT throw - caller should check canSpend() first or handle false return.
   *
   * In no-budget mode (limits = 0), always returns false.
   */
  spend(credits: number): boolean {
    // No-budget mode: can never spend
    if (this.isNoBudget) {
      return false;
    }

    this.maybeReset();

    // Check limits
    if (!this.canSpend(credits)) {
      logWarn(`Budget blocked: ${this.id}`, {
        budgetId: this.id,
        requestedCredits: credits,
        dailyUsed: this.dailyUsed,
        dailyLimit: this.dailyLimit,
        minuteUsed: this.minuteUsed,
        minuteLimit: this.minuteLimit,
      });
      return false;
    }

    // Spend
    this.dailyUsed += credits;
    this.minuteUsed += credits;

    // Log warning if crossing threshold
    const usagePercent = this.dailyUsed / this.dailyLimit;
    if (
      usagePercent >= this.warnThreshold &&
      usagePercent - credits / this.dailyLimit < this.warnThreshold
    ) {
      logWarn(`Budget warning: ${this.id} at ${Math.round(usagePercent * 100)}%`, {
        budgetId: this.id,
        dailyUsed: this.dailyUsed,
        dailyLimit: this.dailyLimit,
        percentUsed: Math.round(usagePercent * 100),
      });
    }

    return true;
  }

  /**
   * Get current budget state.
   *
   * In no-budget mode, returns 'ok' state (no provider = no budget concerns).
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
      state: this.isNoBudget ? 'ok' : this.computeState(),
    };
  }

  /**
   * Get budget response for API (subset of full state).
   *
   * In no-budget mode, returns 'ok' state.
   */
  getResponse(): BudgetResponse {
    this.maybeReset();

    return {
      state: this.isNoBudget ? 'ok' : this.computeState(),
      dailyUsed: this.dailyUsed,
      dailyLimit: this.dailyLimit,
      minuteUsed: this.minuteUsed,
      minuteLimit: this.minuteLimit,
    };
  }

  /**
   * Force reset (for testing or manual intervention).
   */
  reset(): void {
    this.dailyUsed = 0;
    this.minuteUsed = 0;
    this.dailyResetAt = this.getNextMidnightUtc();
    this.minuteResetAt = Date.now() + MINUTE_WINDOW_MS;

    logInfo(`Budget reset: ${this.id}`, {
      budgetId: this.id,
      nextDailyReset: new Date(this.dailyResetAt).toISOString(),
    });
  }

  /**
   * Get remaining daily credits.
   */
  getRemainingDaily(): number {
    if (this.isNoBudget) return 0;
    this.maybeReset();
    return Math.max(0, this.dailyLimit - this.dailyUsed);
  }

  /**
   * Get remaining minute credits.
   */
  getRemainingMinute(): number {
    if (this.isNoBudget) return 0;
    this.maybeReset();
    return Math.max(0, this.minuteLimit - this.minuteUsed);
  }

  /**
   * Check if budget is blocked (no credits remaining).
   * In no-budget mode, returns false (not "blocked" - just no provider).
   */
  isBlocked(): boolean {
    if (this.isNoBudget) return false;
    this.maybeReset();
    return this.dailyUsed >= this.dailyLimit;
  }

  /**
   * Check if budget is in warning state.
   */
  isWarning(): boolean {
    if (this.isNoBudget) return false;
    this.maybeReset();
    const usagePercent = this.dailyUsed / this.dailyLimit;
    return usagePercent >= this.warnThreshold && usagePercent < 1.0;
  }

  /**
   * Check if this is a no-budget (no provider) manager.
   */
  hasNoBudget(): boolean {
    return this.isNoBudget;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Compute current state based on usage.
   */
  private computeState(): BudgetState {
    if (this.isNoBudget) return 'ok';

    const usagePercent = this.dailyUsed / this.dailyLimit;

    if (usagePercent >= 1.0) return 'blocked';
    if (usagePercent >= this.warnThreshold) return 'warning';
    return 'ok';
  }

  /**
   * Check if reset windows have passed and reset if needed.
   */
  private maybeReset(): void {
    const now = Date.now();

    // Check daily reset (midnight UTC)
    if (now >= this.dailyResetAt) {
      this.dailyUsed = 0;
      this.dailyResetAt = this.getNextMidnightUtc();

      logInfo(`Daily budget reset: ${this.id}`, {
        budgetId: this.id,
        nextReset: new Date(this.dailyResetAt).toISOString(),
      });
    }

    // Check minute reset
    if (now >= this.minuteResetAt) {
      this.minuteUsed = 0;
      this.minuteResetAt = now + MINUTE_WINDOW_MS;
    }
  }

  /**
   * Calculate next midnight UTC timestamp.
   */
  private getNextMidnightUtc(): number {
    const now = new Date();
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
    );
    return tomorrow.getTime();
  }
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a TwelveData budget manager with default limits.
 */
export function createTwelveDataBudget(overrides?: {
  dailyLimit?: number;
  minuteLimit?: number;
}): BudgetManager {
  return new BudgetManager({
    id: 'twelvedata',
    dailyLimit: overrides?.dailyLimit ?? 800,
    minuteLimit: overrides?.minuteLimit ?? 8,
  });
}

/**
 * Create a Marketstack budget manager with default limits.
 */
export function createMarketstackBudget(overrides?: {
  dailyLimit?: number;
  minuteLimit?: number;
}): BudgetManager {
  return new BudgetManager({
    id: 'marketstack',
    dailyLimit: overrides?.dailyLimit ?? 250,
    minuteLimit: overrides?.minuteLimit ?? 3,
  });
}

/**
 * Create a no-op budget manager (for feeds with no provider).
 * Always returns 'ok' state but cannot spend.
 */
export function createNoBudget(): BudgetManager {
  // Create with zero limits - triggers no-budget mode
  return new BudgetManager({
    id: 'none',
    dailyLimit: 0,
    minuteLimit: 0,
  });
}
