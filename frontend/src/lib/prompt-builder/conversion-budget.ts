// src/lib/prompt-builder/conversion-budget.ts
// Part 2 — Conversion Budget Calculator
// ============================================================================
//
// Calculates remaining word budget for conversion outputs AFTER the core
// prompt + qualityPrefix + qualitySuffix have been assembled.
//
// Data sources (in priority order):
//   1. Learned data — lookupBestOptimalChars() from Phase 7.9 compression
//      profiles. Converts chars → words (÷5 avg). Confidence-blended
//      between platform-specific and tier-level data automatically.
//   2. Static fallback — per-platform word ceilings from encoder research.
//      When no learned data exists (cold start), these are authoritative.
//
// Gap 2 fix: qualityPrefix + qualitySuffix word counts are subtracted from
// the budget. This happens AFTER the existing dedup step, so duplicates
// between qualitySuffix and user fidelity aren't double-counted.
//
// Authority: budget-aware-conversion-build-plan.md §Part 2
// Created: 2026-03-19
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

import type { CompressionLookup } from '@/lib/learning/compression-lookup';
import {
  lookupBestOptimalChars,
  lookupPlatformOptimalLength,
  lookupOptimalLength,
} from '@/lib/learning/compression-lookup';
import { getPlatformTierId } from '@/data/platform-tiers';
import type { PlatformTierId } from '@/data/platform-tiers';
// NOTE: No import from '@/lib/prompt-builder' — would create circular dependency.
// CLIP token counting is done by the caller and passed in as a parameter.

// ============================================================================
// Types
// ============================================================================

export interface ConversionBudget {
  /** Total word ceiling for the entire prompt on this platform */
  ceiling: number;
  /** Words already consumed by core prompt + qualityPrefix + qualitySuffix */
  consumed: number;
  /** Words remaining for conversion outputs (floored at 0) */
  remaining: number;
  /** Always 'words' — all platforms normalised to word count */
  unit: 'words';
  /** Where the ceiling value came from */
  source: 'learned' | 'static';

  // ── Improvement 1: Diminishing Returns Zone ──
  /**
   * Word count where outcome drops >15% from peak (from learned data).
   * null = no learned data available, use hard ceiling only.
   *
   * Conversions that push past `ceiling` but stay below `diminishingReturnsAt`
   * are not hard-blocked — the scorer applies a reduced score instead.
   * This creates a "soft zone" between optimal and wasteful.
   */
  diminishingReturnsAt: number | null;

  // ── Improvement 2: CLIP Token Budget (Tier 1 only) ──
  /**
   * For Tier 1 (CLIP-based) platforms only: budget measured in exact
   * CLIP BPE tokens using estimateClipTokens(). More accurate than the
   * ÷1.3 word approximation because CLIP's BPE tokenizer splits
   * hyphenated words and punctuation differently.
   *
   * null = not a Tier 1 platform (use word budget instead).
   * The scorer checks BOTH word budget and clip token budget for Tier 1.
   */
  clipTokenBudget: {
    ceiling: number;
    consumed: number;
    remaining: number;
  } | null;
}

// ============================================================================
// Static Fallback Ceilings (words)
// ============================================================================
// Source: encoder architecture research in optimal-prompt-stacking.md
//
// CLIP-based (Tier 1): 77 tokens ÷ 1.3 ≈ 59 words (but some allow 150–200
// tokens via prompt chunking). Per-platform values from API docs.
//
// MJ (Tier 2): Research says "target 15–30 words" for best results.
//
// Natural Language (Tier 3): T5/LLM encoders handle longer prompts.
// Per-platform values from official documentation.
//
// Plain Language (Tier 4): Short prompts work best. 20–40 words.
// ============================================================================

const STATIC_CEILINGS: Record<string, number> = {
  // ── Tier 2: Midjourney Family ──
  midjourney: 30,
  bluewillow: 30,

  // ── Tier 1: CLIP-Based ──
  leonardo: 154, // 200 tokens ÷ 1.3
  stability: 59, // 77 CLIP tokens ÷ 1.3
  dreamstudio: 59,
  lexica: 59,
  playground: 59,
  dreamlike: 59,
  clipdrop: 59,
  artguru: 59,
  novelai: 59,

  // ── Tier 3: Natural Language ──
  flux: 80, // BFL recommendation: "30–80 words"
  openai: 160, // 800 chars ÷ 5
  'adobe-firefly': 120, // 300 tokens, but more concise = better
  bing: 100, // DALL-E 3 backend, but Bing truncates earlier
  'microsoft-designer': 100, // Same DALL-E 3 backend as Bing
  'imagine-meta': 60, // Meta's Imagine: shorter = better
  recraft: 154, // 200 tokens ÷ 1.3
  'luma-ai': 231, // 300 tokens ÷ 1.3
  kling: 100, // Moderate-length NL prompts
  'google-imagen': 120, // Google's Imagen: moderate length
  ideogram: 100, // Moderate NL encoder
  runway: 100, // Video: shorter scene descriptions
  hotpot: 60, // Basic NL platform
  'jasper-art': 60, // DALL-E 2 backend: shorter

  // ── Tier 4: Plain Language ──
  canva: 30, // "20–30 words max"
  craiyon: 30,
  deepai: 30,
  fotor: 30,
  picsart: 30,
  pixlr: 30,
  simplified: 30,
  visme: 30,
  vistacreate: 30,
  artbreeder: 20, // Very short
  artistly: 30,
  photoleap: 30,
  picwish: 30,
  myedit: 30,
  '123rf': 40,
};

/** Default ceiling when a platform isn't in STATIC_CEILINGS */
const DEFAULT_CEILING_WORDS = 60;

/** Average characters per word (for converting learned chars → words) */
const CHARS_PER_WORD = 5;

// ============================================================================
// Budget Calculator
// ============================================================================

/**
 * Calculate the remaining word budget available for conversion outputs.
 *
 * @param corePromptWordCount      - Words in the assembled core prompt
 *                                   (subject → materials, 10 categories)
 * @param qualityPrefixWordCount   - Words in qualityPrefix (after dedup)
 * @param qualitySuffixWordCount   - Words in qualitySuffix (after dedup)
 * @param platformId               - Platform slug (e.g., "midjourney", "flux")
 * @param compressionLookup        - Pre-built compression lookup (null = no learned data)
 * @param clipTokensConsumed       - Pre-computed CLIP BPE token count of the core prompt
 *                                   (from estimateClipTokens in prompt-builder.ts).
 *                                   Pass null for non-Tier-1 platforms or when unavailable.
 *                                   Avoids circular dependency with prompt-builder.ts.
 * @returns ConversionBudget with ceiling, consumed, remaining, source,
 *          diminishingReturnsAt, and clipTokenBudget
 */
export function getConversionBudget(
  corePromptWordCount: number,
  qualityPrefixWordCount: number,
  qualitySuffixWordCount: number,
  platformId: string,
  compressionLookup: CompressionLookup | null = null,
  clipTokensConsumed: number | null = null,
): ConversionBudget {
  // 1. Resolve ceiling + diminishing returns from learned/static data
  const resolved = resolveCeiling(platformId, compressionLookup);

  // 2. Gap 2: Budget includes ALL pre-conversion prompt content
  const consumed =
    corePromptWordCount + qualityPrefixWordCount + qualitySuffixWordCount;

  // 3. Remaining budget floored at 0 — never negative
  const remaining = Math.max(0, resolved.ceiling - consumed);

  // 4. Improvement 2: CLIP token budget for Tier 1 platforms
  const tier = getPlatformTierId(platformId);
  let clipTokenBudget: ConversionBudget['clipTokenBudget'] = null;

  if (tier === 1 && clipTokensConsumed !== null) {
    const clipCeiling = STATIC_CLIP_TOKEN_CEILINGS[platformId] ?? DEFAULT_CLIP_TOKEN_CEILING;
    clipTokenBudget = {
      ceiling: clipCeiling,
      consumed: clipTokensConsumed,
      remaining: Math.max(0, clipCeiling - clipTokensConsumed),
    };
  }

  return {
    ceiling: resolved.ceiling,
    consumed,
    remaining,
    unit: 'words',
    source: resolved.source,
    diminishingReturnsAt: resolved.diminishingReturnsAt,
    clipTokenBudget,
  };
}

// ============================================================================
// Ceiling Resolution
// ============================================================================

/**
 * Resolve the word ceiling for a platform, preferring learned data.
 *
 * Priority:
 *   1. lookupBestOptimalChars() → chars ÷ 5 → words (confidence-blended)
 *   2. STATIC_CEILINGS[platformId]
 *   3. DEFAULT_CEILING_WORDS (60)
 *
 * Also resolves diminishingReturnsAt from learned data when available.
 */
function resolveCeiling(
  platformId: string,
  compressionLookup: CompressionLookup | null,
): { ceiling: number; source: 'learned' | 'static'; diminishingReturnsAt: number | null } {
  // Try learned data first
  if (compressionLookup) {
    const tier = getPlatformTierId(platformId);
    if (tier !== undefined) {
      const learnedChars = lookupBestOptimalChars(
        compressionLookup,
        tier,
        platformId,
      );
      if (learnedChars !== null && learnedChars > 0) {
        // Improvement 1: Also extract diminishingReturnsAt from learned data
        const drAt = resolveDiminishingReturns(
          compressionLookup,
          tier,
          platformId,
        );

        return {
          ceiling: Math.round(learnedChars / CHARS_PER_WORD),
          source: 'learned',
          diminishingReturnsAt: drAt,
        };
      }
    }
  }

  // Static fallback — no diminishing returns data without learned profiles
  const staticCeiling = STATIC_CEILINGS[platformId] ?? DEFAULT_CEILING_WORDS;
  return { ceiling: staticCeiling, source: 'static', diminishingReturnsAt: null };
}

/**
 * Improvement 1: Extract the diminishing returns threshold from learned data.
 *
 * Tries platform-specific first, falls back to tier-level.
 * Converts chars → words (÷5) same as the ceiling.
 *
 * @returns Word count at diminishing returns, or null if no data
 */
function resolveDiminishingReturns(
  compressionLookup: CompressionLookup,
  tier: PlatformTierId,
  platformId: string,
): number | null {
  // Try platform-specific diminishing returns
  const platformProfile = lookupPlatformOptimalLength(
    compressionLookup,
    tier,
    platformId,
  );
  if (platformProfile?.diminishingReturnsAt) {
    return Math.round(platformProfile.diminishingReturnsAt / CHARS_PER_WORD);
  }

  // Fall back to tier-level diminishing returns
  const tierProfile = lookupOptimalLength(compressionLookup, tier);
  if (tierProfile?.diminishingReturnsAt) {
    return Math.round(tierProfile.diminishingReturnsAt / CHARS_PER_WORD);
  }

  return null;
}

// ============================================================================
// Improvement 2: CLIP Token Ceilings (Tier 1 only)
// ============================================================================
// Exact CLIP BPE token limits from platform API documentation.
// Used alongside the word budget for double-checking on Tier 1 platforms.
// estimateClipTokens() from prompt-builder.ts provides the consumed count.
// ============================================================================

const STATIC_CLIP_TOKEN_CEILINGS: Record<string, number> = {
  stability: 77,
  dreamstudio: 77,
  lexica: 77,
  playground: 77,
  dreamlike: 77,
  clipdrop: 77,
  artguru: 77,
  novelai: 77,
  leonardo: 200, // Leonardo allows extended prompt via chunking
};

/** Default CLIP token ceiling for unknown Tier 1 platforms */
const DEFAULT_CLIP_TOKEN_CEILING = 77;

// ============================================================================
// Utility Exports (for testing + Part 5 integration)
// ============================================================================

/**
 * Get the static ceiling for a platform (ignoring learned data).
 * Used by tests and the transparency panel to show the baseline.
 */
export function getStaticCeiling(platformId: string): number {
  return STATIC_CEILINGS[platformId] ?? DEFAULT_CEILING_WORDS;
}

/**
 * Get the tier for a platform. Exposed for Part 5 integration
 * where the tier is needed alongside the budget.
 */
export function getPlatformTier(platformId: string): PlatformTierId | undefined {
  return getPlatformTierId(platformId);
}

/**
 * Count words in a string. Matches the assembler's word counting logic.
 * Exported so Part 5 can measure qualityPrefix/qualitySuffix consistently.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Count total words across an array of strings (e.g., qualityPrefix[]).
 */
export function countWordsInArray(terms: string[] | undefined): number {
  if (!terms?.length) return 0;
  return terms.reduce((sum, term) => sum + countWords(term), 0);
}

/**
 * Get the static CLIP token ceiling for a Tier 1 platform.
 * Returns null for non-Tier-1 platforms.
 */
export function getClipTokenCeiling(platformId: string): number | null {
  const tier = getPlatformTierId(platformId);
  if (tier !== 1) return null;
  return STATIC_CLIP_TOKEN_CEILINGS[platformId] ?? DEFAULT_CLIP_TOKEN_CEILING;
}
