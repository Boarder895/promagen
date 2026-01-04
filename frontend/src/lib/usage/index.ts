/**
 * @file src/lib/usage/index.ts
 * @description Public exports for usage tracking module
 */

// Constants
export {
  ANONYMOUS_FREE_LIMIT,
  FREE_DAILY_LIMIT,
  PAID_DAILY_LIMIT,
  USAGE_NAMESPACE,
  USAGE_KV_KEYS,
  USAGE_LOCAL_KEYS,
  FREE_CATEGORY_LIMITS,
  PAID_CATEGORY_LIMITS,
  getCategoryLimitsForTier,
} from './constants';

// Server-side storage (Vercel KV)
export {
  getDailyUsage,
  incrementDailyUsage,
  hasReachedDailyLimit,
  getUsageStatus,
  getTodayInTimezone,
  detectTimezone,
  type DailyUsage,
  type UsageStatus,
} from './storage';

// Client-side anonymous storage (localStorage)
export {
  getAnonymousCount,
  getAnonymousUsageState,
  isAnonymousAtLimit,
  incrementAnonymousCount,
  canAnonymousUsePrompt,
  resetAnonymousUsage,
  getAnonymousUsageDisplay,
  type AnonymousUsageState,
} from './anonymous-storage';
