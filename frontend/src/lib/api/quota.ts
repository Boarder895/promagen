import type { ProviderQuota } from './api.providers.catalog.schema';

/**
 * Default safety factor used when deriving “safe” daily budgets
 * from provider quotas. This matches the API brain design notes.
 */
export const DEFAULT_SAFETY_FACTOR = 0.7;

export interface SafeDailyBudgetResult {
  /**
   * Raw daily limit taken directly from per_day.max_calls, or null
   * if that value is zero / not meaningful.
   */
  maxPerDayFromDay: number | null;
  /**
   * Derived daily limit from per_month.max_calls (floor(max/31)),
   * or null if per_month is not configured.
   */
  maxPerDayFromMonth: number | null;
  /**
   * Final “safe” daily budget, after applying the safety factor and
   * flooring the result to a whole number.
   */
  safePerDay: number;
}

/**
 * Normalise a raw max_calls value (which may be 0) into either a
 * positive integer or null.
 */
function normaliseMaxCalls(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  if (value <= 0) {
    return null;
  }

  return Math.floor(value);
}

/**
 * Compute a safe daily budget from a ProviderQuota, following the rules
 * described in the API brain:
 *
 * 1. Prefer per_day.max_calls if present and > 0.
 * 2. Otherwise derive max_per_day_from_month = floor(max_month / 31).
 * 3. Apply a safety factor s (default 0.7):
 *      safe_per_day = floor(max_per_day_base * s)
 *
 * The result exposes both the source values and the final safePerDay.
 */
export function computeSafeDailyBudgetFromQuota(
  quota: ProviderQuota,
  safetyFactor: number = DEFAULT_SAFETY_FACTOR,
): SafeDailyBudgetResult {
  const fromDay = normaliseMaxCalls(quota.per_day.max_calls);
  const fromMonthRaw = normaliseMaxCalls(quota.per_month.max_calls);

  let maxPerDayFromMonth: number | null = null;

  if (fromMonthRaw !== null) {
    const derived = Math.floor(fromMonthRaw / 31);
    maxPerDayFromMonth = derived > 0 ? derived : null;
  }

  let maxPerDayBase: number;

  if (fromDay !== null) {
    maxPerDayBase = fromDay;
  } else if (maxPerDayFromMonth !== null) {
    maxPerDayBase = maxPerDayFromMonth;
  } else {
    maxPerDayBase = 0;
  }

  const safePerDay = Math.floor(maxPerDayBase * safetyFactor);

  return {
    maxPerDayFromDay: fromDay,
    maxPerDayFromMonth,
    safePerDay,
  };
}
