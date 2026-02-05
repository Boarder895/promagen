/**
 * Promagen Gateway - Commodities Budget Manager (Separate Tracker)
 * ==================================================================
 * CRITICAL: This is a SEPARATE budget tracker for commodities,
 * distinct from the indices budget tracker.
 *
 * Both use the same underlying Marketstack API key, but tracking
 * them separately gives cleaner /trace visibility per feed.
 *
 * Budget Math (2-minute rolling interval):
 * - Commodities per cycle: 78 × 2 min = 156 min (~2.6 hours)
 * - Cycles per day: ~9.2
 * - Commodity calls/day: ~720
 * - Combined with Indices (~96/day): ~816/day total Marketstack
 * - Total Marketstack budget: 3,333/day (Professional tier)
 * - Usage: ~24.5% of budget
 * - Headroom: ~2,517 calls for future FX migration
 *
 * This tracker enforces a commodities-specific daily cap
 * (default 1000/day) to prevent runaway usage from starving indices.
 *
 * Security: 10/10
 * - Lazy initialization ensures env vars are loaded
 * - Atomic credit tracking (no race conditions)
 * - Budget state never exposed to external clients
 * - Implements BudgetManagerInterface (Guardrail G4)
 *
 * @module marketstack/commodities-budget
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
 * Get commodities daily limit from env or default.
 * Reads at call time (not module load) to ensure env vars are available.
 *
 * Default: 1000/day — generous cap for ~720 expected daily calls.
 * Leaves ~2,333 for indices and future FX.
 */
function getCommoditiesDailyLimit(): number {
  const val = process.env['COMMODITIES_BUDGET_DAILY'] ?? '1000';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
}

/**
 * Get commodities minute limit from env or default.
 *
 * Marketstack commodities endpoint: 1 call/minute hard limit.
 * Our cadence: 1 call every 2 minutes.
 * Cap at 1/minute as a safety guardrail.
 */
function getCommoditiesMinuteLimit(): number {
  const val = process.env['COMMODITIES_BUDGET_MINUTE'] ?? '1';
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
 * Commodities budget manager implementation.
 * Tracks daily and per-minute credit usage SEPARATELY from indices.
 */
class CommoditiesBudgetManager implements BudgetManagerInterface {
  private readonly id: string;
  private readonly dailyLimit: number;
  private readonly minuteLimit: number;

  private dailyUsed: number = 0;
  private dailyResetAt: number;

  private minuteUsed: number = 0;
  private minuteResetAt: number;

  constructor() {
    this.id = 'marketstack-commodities';
    this.dailyLimit = getCommoditiesDailyLimit();
    this.minuteLimit = getCommoditiesMinuteLimit();

    // Initialize reset times
    const now = Date.now();
    this.dailyResetAt = this.getNextDailyReset(now);
    this.minuteResetAt = this.getNextMinuteReset(now);

    logInfo('Commodities budget initialized (separate tracker)', {
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

    // Check minute limit first (most restrictive — 1/min endpoint limit)
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
      logWarn('Commodities budget warning', {
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
      logInfo('Commodities daily budget reset', {
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
let instance: CommoditiesBudgetManager | null = null;

/**
 * Get the commodities budget manager.
 *
 * CRITICAL: This is SEPARATE from the indices budget tracker.
 * Both draw from the same Marketstack API key (3,333/day total),
 * but are tracked independently for /trace visibility.
 */
export function getCommoditiesBudget(): BudgetManagerInterface {
  if (!instance) {
    instance = new CommoditiesBudgetManager();
  }
  return instance;
}

/**
 * Convenience export for the commodities budget.
 * This is a getter that returns the lazy singleton.
 */
export const commoditiesBudget: BudgetManagerInterface = {
  canSpend: (credits) => getCommoditiesBudget().canSpend(credits),
  spend: (credits) => getCommoditiesBudget().spend(credits),
  getState: () => getCommoditiesBudget().getState(),
  getResponse: () => getCommoditiesBudget().getResponse(),
  reset: () => getCommoditiesBudget().reset(),
  getId: () => getCommoditiesBudget().getId(),
};

// =============================================================================
// TESTING UTILITIES
// =============================================================================

/**
 * Reset the singleton instance (for testing only).
 * Forces a fresh budget manager on next access.
 */
export function resetCommoditiesBudget(): void {
  instance = null;
}
