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
 * Maximum prompt copies for anonymous users per day.
 * Just enough to experience the quality, tight enough to drive sign-ups.
 *
 * Security note: This is enforced client-side via localStorage.
 * Users can bypass by clearing storage or using incognito.
 * This is acceptable - it's a soft conversion gate, not a paywall.
 */
export const ANONYMOUS_FREE_LIMIT = 3;

/**
 * Maximum prompt copies per day for free authenticated users.
 * Enough to love the product, tight enough to drive upgrades.
 * Tier progression: Anonymous 3/day → Free 5/day → Paid unlimited
 */
export const FREE_DAILY_LIMIT = 5;

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

// ============================================================================
// PER-PLATFORM CATEGORY LIMITS (v3.0.0)
// ============================================================================
// Research-backed limits per platform. Each platform gets its own free/pro
// numbers based on its encoder architecture, token budget, and tested
// stacking behaviour. Falls back to tier-generic if platform not listed.
//
// Authority: docs/authority/optimal-prompt-stacking.md v2.0.0
// ============================================================================

interface PlatformLimits {
  free: Record<string, number>;
  pro: Record<string, number>;
}

/** Helper: build limits object from compact format */
function pl(
  s: number, a: number, st: number, e: number, co: number, ca: number,
  l: number, at: number, cl: number, m: number, f: number, n: number,
  // Pro values
  sP: number, aP: number, stP: number, eP: number, coP: number, caP: number,
  lP: number, atP: number, clP: number, mP: number, fP: number, nP: number,
): PlatformLimits {
  return {
    free:  { subject: s, action: a, style: st, environment: e, composition: co, camera: ca, lighting: l, atmosphere: at, colour: cl, materials: m, fidelity: f, negative: n },
    pro:   { subject: sP, action: aP, style: stP, environment: eP, composition: coP, camera: caP, lighting: lP, atmosphere: atP, colour: clP, materials: mP, fidelity: fP, negative: nP },
  };
}

//                                          FREE: s  a  st e  co ca l  at cl m  f  n   PRO: s  a  st e  co ca l  at cl m  f  n
export const PLATFORM_SPECIFIC_LIMITS: Record<string, PlatformLimits> = {
  // Tier 1 — CLIP-Based (unchanged — these use separate negative fields, no conversion pool)
  'stability':     pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 1, 1, 1, 2, 2, 1, 1, 2, 10),
  'leonardo':      pl(2, 1, 2, 1, 1, 1, 2, 2, 1, 2, 2, 5,   3, 1, 3, 2, 1, 2, 3, 2, 2, 3, 3, 8),
  'clipdrop':      pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 8),
  'nightcafe':     pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 8),
  'dreamstudio':   pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 1, 1, 1, 2, 2, 1, 1, 2, 10),
  'lexica':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4,   2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 6),
  'novelai':       pl(2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 5,   3, 1, 3, 2, 2, 1, 2, 2, 2, 2, 4, 10),
  'dreamlike':     pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 8),
  'getimg':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 8),
  'openart':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5,   2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 8),
  'playground':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4,   2, 1, 2, 2, 1, 1, 2, 2, 2, 2, 2, 6),
  'artguru':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5),
  'tensor-art':    pl(3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 3, 5,   5, 2, 3, 3, 2, 2, 2, 1, 2, 2, 4, 8),

  // Tier 2 — Midjourney Family
  // v3.1.0: Fidelity enabled (was 0/0). Parametric — all fit regardless of budget.
  'midjourney':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2,   3, 1, 2, 2, 1, 1, 2, 2, 2, 2, 3, 4),
  'bluewillow':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2,   2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 3),

  // Tier 3 — Natural Language
  // v3.1.0: Fidelity enabled on conversion platforms (was 0/0). Budget-gated.
  // v3.1.0: Negatives enabled on 'none' platforms (was 0/0). Conversion pool gives them a path.
  'openai':        pl(2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2,   3, 2, 2, 3, 1, 1, 2, 2, 2, 2, 1, 3),
  'adobe-firefly': pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2,   2, 1, 2, 2, 1, 1, 1, 2, 1, 2, 1, 3),
  'ideogram':      pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,   2, 1, 1, 2, 2, 1, 2, 2, 1, 2, 1, 5),
  'runway':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0,   2, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 0),
  'microsoft-designer': pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'bing':          pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'flux':          pl(2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 2, 3,   3, 2, 3, 3, 2, 2, 3, 3, 2, 3, 3, 5),
  'google-imagen': pl(2, 1, 2, 2, 1, 1, 2, 2, 1, 2, 1, 0,   3, 1, 3, 3, 1, 2, 3, 2, 2, 3, 2, 0),
  'imagine-meta':  pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'hotpot':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,   2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 5),
  'recraft':       pl(3, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 3,   4, 2, 1, 3, 2, 1, 2, 1, 2, 2, 2, 5),
  'kling':         pl(3, 1, 2, 2, 1, 1, 2, 1, 1, 1, 2, 2,   5, 2, 3, 3, 2, 2, 3, 2, 2, 1, 3, 3),
  'jasper-art':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'luma-ai':       pl(3, 1, 2, 2, 1, 1, 2, 1, 1, 1, 1, 2,   4, 2, 3, 3, 2, 2, 3, 2, 2, 2, 2, 3),

  // Tier 4 — Plain Language
  // v3.1.0: Negatives enabled on 'none' platforms (was 0/0). Gives conversion pool input.
  'canva':         pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'craiyon':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4),
  'deepai':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5),
  'pixlr':         pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'picwish':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'fotor':         pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4,   2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 2, 7),
  'visme':         pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'vistacreate':   pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'myedit':        pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'simplified':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4,   2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 2, 7),
  'freepik':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'picsart':       pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'photoleap':     pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'artbreeder':    pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,   2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5),
  '123rf':         pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
  'artistly':      pl(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2),
};

/**
 * Get category limits for a specific platform + user tier.
 * Checks per-platform overrides first, falls back to tier-generic.
 *
 * @param platformTier - Platform's compression tier (1-4)
 * @param userTier - User's subscription tier ('free' | 'paid')
 * @param platformId - Optional platform ID for per-platform lookup
 * @returns Category limits appropriate for platform + user combination
 */
export function getCategoryLimitsForPlatformTier(
  platformTier: CompressionTier,
  userTier: 'free' | 'paid',
  platformId?: string
): Record<string, number> {
  // Per-platform lookup (preferred)
  if (platformId) {
    const specific = PLATFORM_SPECIFIC_LIMITS[platformId];
    if (specific) {
      return { ...(userTier === 'paid' ? specific.pro : specific.free) };
    }
  }

  // Tier-generic fallback
  const validTier = ([1, 2, 3, 4] as const).includes(platformTier)
    ? platformTier
    : DEFAULT_PLATFORM_TIER;

  if (userTier === 'paid') {
    return { ...PLATFORM_TIER_LIMITS_PAID[validTier] };
  }
  return { ...PLATFORM_TIER_LIMITS[validTier] };
}

/**
 * Get the maximum possible selections for a category across all platforms.
 * Scans per-platform pro limits (the actual optimum per platform).
 * Useful for UI hints like "up to X selections on supported platforms".
 */
export function getMaxCategoryLimit(category: string): number {
  let max = 0;
  for (const limits of Object.values(PLATFORM_SPECIFIC_LIMITS)) {
    const limit = limits.pro[category] ?? 0;
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

// ============================================================================
// Part 7 Improvement 1: Budget-Aware Conversion Info
// ============================================================================
// Platforms where fidelity/negative selections enter the conversion pool
// instead of passing through verbatim. The assembler decides how many
// make it into the output based on the prompt budget.
//
// Used by Part 7 Improvement 2 (tooltip) to show "the assembler decides
// how many fit" instead of just "pick up to N".
// ============================================================================

/** Platforms where fidelity terms are converted (parametric or NL) */
const FIDELITY_CONVERSION_PLATFORMS = new Set([
  'midjourney', 'bluewillow', 'flux', 'recraft', 'luma-ai',
]);

/** Platforms where negative terms enter the conversion pool (negativeSupport = none | inline) */
const NEGATIVE_CONVERSION_PLATFORMS = new Set([
  // none: negatives converted to positives
  'openai', 'adobe-firefly', 'bing', 'microsoft-designer', 'imagine-meta',
  'canva', 'luma-ai', 'kling', 'jasper-art',
  // Tier 4 'none' platforms
  'craiyon', 'deepai', 'pixlr', 'picwish', 'fotor', 'visme', 'vistacreate',
  'myedit', 'simplified', 'freepik', 'picsart', 'photoleap', 'artbreeder',
  '123rf', 'artistly',
  // inline: negatives converted + --no for unknowns
  'midjourney', 'bluewillow',
  // hotpot has negativeSupport=none in platform-formats.json
  'hotpot',
]);

/**
 * Check if a category on a platform uses budget-aware conversion.
 *
 * @param category - 'fidelity' or 'negative'
 * @param platformId - Platform slug
 * @returns true if the assembler converts and budget-gates this category
 */
export function isBudgetAwareCategory(
  category: string,
  platformId: string,
): boolean {
  if (category === 'fidelity') return FIDELITY_CONVERSION_PLATFORMS.has(platformId);
  if (category === 'negative') return NEGATIVE_CONVERSION_PLATFORMS.has(platformId);
  return false;
}

/**
 * Check if fidelity conversions are parametric (free, always included) on this platform.
 * True for MJ family where fidelity → --quality/--stylize params.
 */
export function isFidelityParametric(platformId: string): boolean {
  return platformId === 'midjourney' || platformId === 'bluewillow';
}
