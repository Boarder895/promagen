/**
 * @file src/lib/usage/constants.ts
 * @description Configuration constants for prompt builder usage tracking
 *
 * v2.0.0 - Platform-Aware Category Limits
 * - Tier-based limits matrix (different platforms get different selection counts)
 * - Paid enhancement adds +1 to stackable categories
 * - Silent auto-trim when switching platforms
 *
 * Security:
 * - All limits are server-validated via usePromagenAuth
 * - Client-side limits are convenience only, not security boundaries
 * - Paid tier verified via Clerk publicMetadata (tamper-proof)
 *
 * Authority: docs/authority/paid_tier.md §3.2, §3.3
 */

import type { CompressionTier } from '@/types/compression';

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
// PLATFORM TIER-BASED CATEGORY LIMITS (v2.0.0)
// ============================================================================

/**
 * Category limit configuration per platform tier.
 *
 * Research-backed limits:
 * - Tier 1 (CLIP): High tolerance for stacking - CLIP tokenizes efficiently
 * - Tier 2 (MJ): Very high tolerance - Midjourney is built for stacked terms
 * - Tier 3 (NatLang): Medium tolerance - prefers conversational prompts
 * - Tier 4 (Plain): Low tolerance - simple prompts work best
 *
 * Categories that benefit from multiple selections:
 * - Style: Combine styles (oil painting + impressionist)
 * - Lighting: Multiple lights (rim light + soft diffused)
 * - Colour: Combine grading (teal and orange + high contrast)
 * - Atmosphere: Stack moods (foggy + mysterious)
 * - Materials: Combine textures (leather + worn)
 * - Fidelity: Stack quality (highly detailed + 8K)
 * - Negative: More exclusions = more control
 *
 * Categories that should stay at 1:
 * - Subject: One main subject = sharp focus
 * - Action: Can't be running AND sitting
 * - Environment: One setting (forest OR desert)
 * - Composition: One rule (rule of thirds OR centered)
 * - Camera: One lens/angle (35mm OR 85mm)
 */

/** Category limits for Tier 1 platforms (CLIP-based: Stability, Leonardo, etc.) */
export const TIER_1_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 2,
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 2,
  colour: 2,
  atmosphere: 2,
  materials: 2,
  fidelity: 2,
  negative: 5,
} as const;

/** Category limits for Tier 2 platforms (Midjourney family) */
export const TIER_2_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 3,        // MJ loves style stacking
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 3,     // MJ handles multiple light sources well
  colour: 2,
  atmosphere: 2,
  materials: 2,
  fidelity: 3,     // MJ responds well to quality stacking
  negative: 8,     // MJ --no can handle many terms
} as const;

/** Category limits for Tier 3 platforms (Natural language: DALL-E, Firefly, etc.) */
export const TIER_3_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 2,
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 2,
  colour: 1,       // NatLang prefers simpler colour descriptions
  atmosphere: 1,   // NatLang prefers single mood
  materials: 1,
  fidelity: 2,
  negative: 3,     // NatLang doesn't need many negatives
} as const;

/** Category limits for Tier 4 platforms (Plain language: Canva, Craiyon, etc.) */
export const TIER_4_CATEGORY_LIMITS: Record<string, number> = {
  subject: 1,
  action: 1,
  style: 1,        // Plain platforms work best with simple prompts
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 1,
  colour: 1,
  atmosphere: 1,
  materials: 1,
  fidelity: 1,
  negative: 2,     // Minimal negative support
} as const;

/**
 * Map platform tier to category limits (free users).
 */
export const PLATFORM_TIER_LIMITS: Record<CompressionTier, Record<string, number>> = {
  1: TIER_1_CATEGORY_LIMITS,
  2: TIER_2_CATEGORY_LIMITS,
  3: TIER_3_CATEGORY_LIMITS,
  4: TIER_4_CATEGORY_LIMITS,
} as const;

/**
 * Categories that get +1 bonus for paid users.
 * Only categories that benefit from stacking get the bonus.
 */
const PAID_BONUS_CATEGORIES = new Set([
  'style',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  'negative',
]);

/**
 * Generate paid tier limits from base limits.
 * Adds +1 to stackable categories.
 */
function generatePaidLimits(baseLimits: Record<string, number>): Record<string, number> {
  const paidLimits: Record<string, number> = {};
  for (const [category, limit] of Object.entries(baseLimits)) {
    paidLimits[category] = PAID_BONUS_CATEGORIES.has(category) ? limit + 1 : limit;
  }
  return paidLimits;
}

/**
 * Map platform tier to category limits (paid users).
 * Paid users get +1 on stackable categories.
 */
export const PLATFORM_TIER_LIMITS_PAID: Record<CompressionTier, Record<string, number>> = {
  1: generatePaidLimits(TIER_1_CATEGORY_LIMITS),
  2: generatePaidLimits(TIER_2_CATEGORY_LIMITS),
  3: generatePaidLimits(TIER_3_CATEGORY_LIMITS),
  4: generatePaidLimits(TIER_4_CATEGORY_LIMITS),
} as const;

// ============================================================================
// LEGACY CATEGORY LIMITS (for backward compatibility)
// ============================================================================

/**
 * Selection limits per category for free users.
 * @deprecated Use getCategoryLimitsForPlatformTier instead
 */
export const FREE_CATEGORY_LIMITS: Record<string, number> = TIER_3_CATEGORY_LIMITS;

/**
 * Selection limits per category for paid users.
 * @deprecated Use getCategoryLimitsForPlatformTier instead
 */
export const PAID_CATEGORY_LIMITS: Record<string, number> = generatePaidLimits(TIER_3_CATEGORY_LIMITS);

/**
 * Get selection limits based on user tier only (legacy).
 * @deprecated Use getCategoryLimitsForPlatformTier instead
 */
export function getCategoryLimitsForTier(tier: 'free' | 'paid'): Record<string, number> {
  return tier === 'paid' ? PAID_CATEGORY_LIMITS : FREE_CATEGORY_LIMITS;
}

// ============================================================================
// NEW: PLATFORM-AWARE CATEGORY LIMITS (v2.0.0)
// ============================================================================

/**
 * Default platform tier when platform is not found.
 * Tier 3 (Natural Language) is the safest default - works everywhere.
 */
export const DEFAULT_PLATFORM_TIER: CompressionTier = 3;

/**
 * Get category limits based on platform tier AND user tier.
 *
 * This is the primary function for determining selection limits.
 * It respects both the platform's capabilities and the user's subscription.
 *
 * @param platformTier - Platform's compression tier (1-4)
 * @param userTier - User's subscription tier ('free' | 'paid')
 * @returns Category limits appropriate for platform + user combination
 *
 * @example
 * // Midjourney (tier 2) + free user
 * getCategoryLimitsForPlatformTier(2, 'free')
 * // Returns: { style: 3, lighting: 3, ... }
 *
 * @example
 * // Canva (tier 4) + paid user
 * getCategoryLimitsForPlatformTier(4, 'paid')
 * // Returns: { style: 2, lighting: 2, ... } (base 1 + paid bonus 1)
 */
export function getCategoryLimitsForPlatformTier(
  platformTier: CompressionTier,
  userTier: 'free' | 'paid'
): Record<string, number> {
  // Validate tier is in range
  const validTier = ([1, 2, 3, 4] as const).includes(platformTier)
    ? platformTier
    : DEFAULT_PLATFORM_TIER;

  if (userTier === 'paid') {
    return { ...PLATFORM_TIER_LIMITS_PAID[validTier] };
  }
  return { ...PLATFORM_TIER_LIMITS[validTier] };
}

/**
 * Get the maximum possible selections for a category across all tiers.
 * Useful for UI hints like "up to X selections on supported platforms".
 */
export function getMaxCategoryLimit(category: string): number {
  let max = 0;
  for (const tierLimits of Object.values(PLATFORM_TIER_LIMITS_PAID)) {
    const limit = tierLimits[category] ?? 0;
    if (limit > max) max = limit;
  }
  return max;
}

/**
 * Check if a category supports multiple selections on any platform.
 */
export function categorySupportsMultipleSelections(category: string): boolean {
  return getMaxCategoryLimit(category) > 1;
}
