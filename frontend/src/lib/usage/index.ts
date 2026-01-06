/**
 * @file src/lib/usage/index.ts
 * @description Public exports for usage tracking module
 *
 * v2.0.0 - Added platform-aware category limits
 */

// Constants
export {
  ANONYMOUS_FREE_LIMIT,
  FREE_DAILY_LIMIT,
  PAID_DAILY_LIMIT,
  USAGE_NAMESPACE,
  USAGE_KV_KEYS,
  USAGE_LOCAL_KEYS,
  // Legacy (deprecated)
  FREE_CATEGORY_LIMITS,
  PAID_CATEGORY_LIMITS,
  getCategoryLimitsForTier,
  // NEW v2.0.0: Platform-aware limits
  TIER_1_CATEGORY_LIMITS,
  TIER_2_CATEGORY_LIMITS,
  TIER_3_CATEGORY_LIMITS,
  TIER_4_CATEGORY_LIMITS,
  PLATFORM_TIER_LIMITS,
  PLATFORM_TIER_LIMITS_PAID,
  DEFAULT_PLATFORM_TIER,
  getCategoryLimitsForPlatformTier,
  getMaxCategoryLimit,
  categorySupportsMultipleSelections,
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
