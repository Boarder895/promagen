/**
 * @file src/lib/usage/constants.ts
 * @description Configuration constants for prompt builder usage tracking
 *
 * Authority: docs/authority/paid_tier.md §3.2, §3.3
 */

// ============================================================================
// USAGE LIMITS
// ============================================================================

/**
 * Maximum prompt copies for anonymous users (cumulative, not daily).
 * Low enough to drive sign-ups, high enough to demonstrate value.
 *
 * Security note: This is enforced client-side via localStorage.
 * Users can bypass by clearing storage or using incognito.
 * This is acceptable - it's a soft conversion gate, not a paywall.
 */
export const ANONYMOUS_FREE_LIMIT = 5;

/**
 * Maximum prompt copies per day for free authenticated users.
 * Generous enough for experimentation, restrictive enough to drive conversions.
 */
export const FREE_DAILY_LIMIT = 30;

/**
 * Paid users have unlimited daily prompt copies.
 * Represented as null in the limit field.
 */
export const PAID_DAILY_LIMIT = null;

// ============================================================================
// KV STORAGE KEYS
// ============================================================================

/**
 * KV namespace for usage data.
 */
export const USAGE_NAMESPACE = 'promagen:usage';

/**
 * KV key patterns for usage tracking.
 */
export const USAGE_KV_KEYS = {
  /** Daily usage counter for a user */
  dailyUsage: (userId: string, date: string) => `${USAGE_NAMESPACE}:daily:${userId}:${date}`,
} as const;

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

/**
 * LocalStorage key patterns for client-side tracking.
 */
export const USAGE_LOCAL_KEYS = {
  /** Anonymous user usage data */
  anonymous: 'promagen:anonymous:usage',
} as const;

// ============================================================================
// CATEGORY LIMITS BY TIER
// ============================================================================

/**
 * Selection limits per category for free users.
 * All categories have limit 1 except negative (5).
 */
export const FREE_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 1,
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 1,
  colour: 1,
  atmosphere: 1,
  materials: 1,
  fidelity: 1,
  negative: 5,
} as const;

/**
 * Selection limits per category for paid users.
 * Style, Lighting, and Fidelity get 2 selections.
 */
export const PAID_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 2,        // Paid enhancement
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 2,     // Paid enhancement
  colour: 1,
  atmosphere: 1,
  materials: 1,
  fidelity: 2,     // Paid enhancement
  negative: 5,
} as const;

/**
 * Get selection limits based on user tier.
 */
export function getCategoryLimitsForTier(tier: 'free' | 'paid'): Record<string, number> {
  return tier === 'paid' ? PAID_CATEGORY_LIMITS : FREE_CATEGORY_LIMITS;
}
