// src/lib/prompt-trimmer.ts
// ============================================================================
// PROMPT TRIMMER (WITH COMPRESSION) v2.0.0
// ============================================================================
// Core logic for analyzing and optimizing prompt length.
// Now includes intelligent compression BEFORE trimming for maximum preservation.
//
// FIX v2.0.0:
// - applyCategoryTrimming now REMOVES text from prompt instead of rebuilding
// - Preserves composition pack content, AR parameters, and other injected text
// - Only removes the specific selection values from each category
//
// Algorithm:
// 1. Calculate current length vs platform limits
// 2. If over ideal, FIRST apply compression (synonym substitution)
// 3. If still over after compression, apply category trimming
// 4. Never touch protected categories (subject, style)
// 5. If still over after both passes, truncate with warning
//
// Security:
// - No user-provided code execution
// - All inputs validated against whitelists
// - Deterministic output for auditability
// - Type-safe throughout
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import type {
  PromptLimit,
  LengthStatus,
  PromptLengthAnalysis,
  OptimizedPrompt,
} from '@/types/prompt-limits';

import {
  DEFAULT_PROMPT_LIMIT,
  TRIM_PRIORITY,
  CATEGORY_SUGGESTIONS,
} from '@/types/prompt-limits';

import type { PromptSelections, PromptCategory } from '@/types/prompt-builder';
import { CATEGORY_ORDER } from '@/types/prompt-builder';

// Import compression engine
import { compressPrompt } from '@/lib/compress';
import type { CompressionResult, CompressionOptions } from '@/types/compression';

// Import prompt limits data
import promptLimitsData from '@/data/providers/prompt-limits.json';

// ============================================================================
// DATA ACCESS
// ============================================================================

/** Cache for loaded prompt limits */
const limitsCache: Map<string, PromptLimit> = new Map();

/**
 * Get prompt limits for a platform.
 * Returns DEFAULT_PROMPT_LIMIT for unknown platforms.
 *
 * @param platformId - Platform identifier (e.g., 'midjourney')
 * @returns PromptLimit configuration for the platform
 */
export function getPromptLimit(platformId: string): PromptLimit {
  // Validate input
  if (!platformId || typeof platformId !== 'string') {
    return DEFAULT_PROMPT_LIMIT;
  }

  // Normalize ID
  const normalizedId = platformId.toLowerCase().trim();

  // Check cache
  if (limitsCache.has(normalizedId)) {
    return limitsCache.get(normalizedId)!;
  }

  // Look up in data
  const providers = promptLimitsData.providers as Record<string, PromptLimit>;
  const limit = providers[normalizedId];

  if (limit) {
    limitsCache.set(normalizedId, limit);
    return limit;
  }

  // Return default for unknown platforms
  return DEFAULT_PROMPT_LIMIT;
}

/**
 * Check if a platform exists in the limits data.
 */
export function hasPromptLimit(platformId: string): boolean {
  if (!platformId || typeof platformId !== 'string') return false;
  const normalizedId = platformId.toLowerCase().trim();
  const providers = promptLimitsData.providers as Record<string, unknown>;
  return normalizedId in providers;
}

// ============================================================================
// LENGTH ANALYSIS
// ============================================================================

/**
 * Count approximate words in a string.
 * Uses simple whitespace splitting for consistency.
 */
function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Determine length status based on current length and limits.
 */
function determineLengthStatus(
  currentLength: number,
  limit: PromptLimit,
): LengthStatus {
  // Critical: exceeds hard max
  if (limit.maxChars !== null && currentLength > limit.maxChars) {
    return 'critical';
  }

  // Over: exceeds ideal but under max
  if (currentLength > limit.idealMax) {
    return 'over';
  }

  // Under: below ideal minimum
  if (currentLength < limit.idealMin) {
    return 'under';
  }

  // Optimal: within sweet spot
  return 'optimal';
}

/**
 * Suggest categories to add when prompt is under minimum.
 * Returns categories not yet present in selections.
 */
function suggestCategories(
  selections: PromptSelections,
  maxSuggestions: number = 3,
): string[] {
  const presentCategories = new Set(
    Object.keys(selections).filter((cat) => {
      const values = selections[cat as PromptCategory];
      return values && values.length > 0;
    }),
  );

  const suggestions: string[] = [];

  for (const { category, label } of CATEGORY_SUGGESTIONS) {
    if (!presentCategories.has(category) && suggestions.length < maxSuggestions) {
      suggestions.push(label);
    }
  }

  return suggestions;
}

/**
 * Analyze prompt length against platform limits.
 *
 * @param promptText - The current assembled prompt text
 * @param platformId - Platform identifier
 * @param selections - Current category selections (for suggestions)
 * @returns Detailed analysis of prompt length status
 */
export function analyzePromptLength(
  promptText: string,
  platformId: string,
  selections: PromptSelections = {},
): PromptLengthAnalysis {
  const limit = getPromptLimit(platformId);
  const currentLength = promptText?.length ?? 0;
  const currentWords = countWords(promptText ?? '');
  const status = determineLengthStatus(currentLength, limit);

  // Calculate excess/shortfall
  let excessChars = 0;
  let shortfall = 0;

  if (status === 'over' || status === 'critical') {
    // For trimming purposes, target the idealMax
    excessChars = currentLength - limit.idealMax;
  } else if (status === 'under') {
    shortfall = limit.idealMin - currentLength;
  }

  // Get suggestions if under minimum
  const suggestedCategories = status === 'under' ? suggestCategories(selections) : [];

  return {
    currentLength,
    currentWords,
    idealMax: limit.idealMax,
    idealMin: limit.idealMin,
    hardMax: limit.maxChars,
    status,
    needsTrimming: status === 'over' || status === 'critical',
    excessChars: Math.max(0, excessChars),
    shortfall: Math.max(0, shortfall),
    suggestedCategories,
  };
}

// ============================================================================
// TEXT-BASED TRIMMING HELPERS (NEW in v2.0.0)
// ============================================================================

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove a specific phrase from a prompt string.
 * Handles various comma/space patterns and cleans up formatting.
 *
 * @param prompt - The prompt string to modify
 * @param phrase - The phrase to remove
 * @returns The modified prompt with the phrase removed
 */
function removePhraseFromPrompt(prompt: string, phrase: string): string {
  if (!phrase || !prompt) return prompt;

  const escaped = escapeRegex(phrase);

  // Try different patterns to remove the phrase with surrounding punctuation
  const patterns = [
    // "phrase, " at start or middle
    new RegExp(`${escaped}\\s*,\\s*`, 'gi'),
    // ", phrase" at end or middle (not followed by more text that starts with comma)
    new RegExp(`,\\s*${escaped}(?=\\s*(?:,|$|\\s+--))`, 'gi'),
    // ", phrase" anywhere
    new RegExp(`,\\s*${escaped}(?![a-zA-Z])`, 'gi'),
    // Standalone phrase with word boundaries
    new RegExp(`\\b${escaped}\\b`, 'gi'),
  ];

  let result = prompt;

  for (const pattern of patterns) {
    const before = result;
    result = result.replace(pattern, '');
    if (result !== before) {
      // Successfully removed, clean up and return
      break;
    }
  }

  return result;
}

/**
 * Clean up prompt formatting after removals.
 * Fixes double commas, extra spaces, leading/trailing punctuation.
 */
function cleanupPromptFormatting(prompt: string): string {
  return prompt
    // Remove double/triple commas
    .replace(/,\s*,+/g, ',')
    // Remove leading comma
    .replace(/^\s*,\s*/, '')
    // Remove trailing comma (but not before --)
    .replace(/\s*,\s*$/, '')
    // Remove comma before --
    .replace(/\s*,\s*(--)/g, ' $1')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Clean up space before comma
    .replace(/\s+,/g, ',')
    // Ensure space after comma
    .replace(/,([^\s])/g, ', $1')
    .trim();
}

// ============================================================================
// PROMPT TRIMMING (CATEGORY REMOVAL) - FIXED v2.0.0
// ============================================================================

/**
 * Rebuild prompt from modified selections.
 * LEGACY: Kept for backward compatibility but not used by new trimming.
 */
function rebuildPrompt(
  selections: PromptSelections,
  removedCategories: Set<string>,
): string {
  const parts: string[] = [];

  for (const category of CATEGORY_ORDER) {
    // Skip removed categories
    if (removedCategories.has(category)) continue;

    // Skip negative (handled separately)
    if (category === 'negative') continue;

    const values = selections[category];
    if (values && values.length > 0) {
      parts.push(values.join(', '));
    }
  }

  return parts.join(', ');
}

/**
 * Handle Midjourney-family negative prompts (--no syntax).
 * Returns the negative section if present.
 */
function extractMidjourneyNegative(prompt: string): { positive: string; negative: string | null } {
  if (!prompt.includes(' --no ')) {
    return { positive: prompt, negative: null };
  }

  const parts = prompt.split(' --no ');
  return {
    positive: parts[0] ?? '',
    negative: parts.slice(1).join(' --no '), // Handle multiple --no (rare)
  };
}

/**
 * Extract AR parameter from prompt (e.g., "--ar 16:9").
 * Returns the parameter and the prompt without it.
 */
function extractARParameter(prompt: string): { promptWithoutAR: string; arParam: string | null } {
  // Match --ar X:Y or --aspect X:Y patterns
  const arPattern = /\s*(--(?:ar|aspect)\s+\d+:\d+)\s*/i;
  const match = prompt.match(arPattern);

  if (match && match[1]) {
    return {
      promptWithoutAR: prompt.replace(arPattern, ' ').trim(),
      arParam: match[1],
    };
  }

  return { promptWithoutAR: prompt, arParam: null };
}

/**
 * Apply category trimming to bring prompt within target.
 * FIXED v2.0.0: Now REMOVES text from prompt instead of rebuilding.
 * Preserves composition pack content, AR parameters, and other injected text.
 *
 * @param prompt - The full prompt string (including composition pack, etc.)
 * @param targetLength - Target character length
 * @param selections - Category selections (to know what text to look for)
 * @param platformFamily - 'midjourney' | 'other' for negative handling
 * @returns Trimmed prompt and list of removed categories
 */
function applyCategoryTrimming(
  prompt: string,
  targetLength: number,
  selections: PromptSelections,
  platformFamily: 'midjourney' | 'other',
): { trimmed: string; removedCategories: string[] } {
  // Extract negative section for Midjourney family (preserve it)
  const { positive, negative } = platformFamily === 'midjourney'
    ? extractMidjourneyNegative(prompt)
    : { positive: prompt, negative: null };

  // Extract AR parameter (preserve it)
  const { promptWithoutAR, arParam } = extractARParameter(positive);

  // Calculate target for positive section (accounting for negative + AR)
  const negativeLength = negative ? ` --no ${negative}`.length : 0;
  const arLength = arParam ? ` ${arParam}`.length : 0;
  const targetPositiveLength = targetLength - negativeLength - arLength;

  // If already within target, return as-is
  if (promptWithoutAR.length <= targetPositiveLength) {
    return { trimmed: prompt, removedCategories: [] };
  }

  // Work with the positive section, removing specific phrases
  let working = promptWithoutAR;
  const removedCategories: string[] = [];

  // Trim categories in priority order by REMOVING their text from the prompt
  for (const category of TRIM_PRIORITY) {
    // Check current length
    if (working.length <= targetPositiveLength) {
      break; // Within target, stop trimming
    }

    // Skip if category not present in selections
    const catKey = category as PromptCategory;
    const values = selections[catKey];
    if (!values || values.length === 0) {
      continue;
    }

    // Remove each value from the prompt string
    let categoryRemoved = false;
    const _workingBefore = working; // Debug: console.log(`Trimmed: ${_workingBefore.length} → ${working.length}`)

    for (const value of values) {
      const before = working;
      working = removePhraseFromPrompt(working, value);

      if (working !== before) {
        categoryRemoved = true;
      }
    }

    // Clean up formatting after removals
    if (categoryRemoved) {
      working = cleanupPromptFormatting(working);
      removedCategories.push(category);
    }
  }

  // Final cleanup
  working = cleanupPromptFormatting(working);

  // If still over target, hard truncate as last resort
  if (working.length > targetPositiveLength) {
    const truncateAt = Math.max(0, targetPositiveLength - 3);
    // Find last comma before truncation point
    const lastComma = working.lastIndexOf(',', truncateAt);
    if (lastComma > truncateAt * 0.5) {
      working = working.slice(0, lastComma).trim();
    } else {
      working = working.slice(0, truncateAt).trim() + '...';
    }
    working = cleanupPromptFormatting(working);
  }

  // Reassemble: positive + AR + negative
  let trimmed = working;
  if (arParam) {
    trimmed = `${trimmed} ${arParam}`;
  }
  if (negative) {
    trimmed = `${trimmed} --no ${negative}`;
  }

  return { trimmed, removedCategories };
}

// ============================================================================
// MAIN OPTIMIZATION FUNCTION (COMPRESSION + TRIMMING)
// ============================================================================

/**
 * Extended optimization result with compression metrics.
 */
export interface OptimizedPromptExtended extends OptimizedPrompt {
  /** Compression result (if compression was applied) */
  readonly compressionResult?: CompressionResult;

  /** Whether compression was applied */
  readonly wasCompressed: boolean;

  /** Characters saved by compression (before trimming) */
  readonly compressionCharsSaved: number;

  /** Characters saved by trimming (after compression) */
  readonly trimmingCharsSaved: number;
}

/**
 * Optimize prompt using compression FIRST, then trimming if needed.
 *
 * Algorithm:
 * 1. Check if optimization needed
 * 2. Apply compression (synonym substitution - preserves meaning)
 * 3. Check if within target after compression
 * 4. If still over, apply category trimming (removes content)
 * 5. Return optimized prompt with metrics
 *
 * @param originalPrompt - The original assembled prompt
 * @param platformId - Platform identifier
 * @param selections - Current category selections
 * @param platformFamily - 'midjourney' | 'other' for negative handling
 * @param compressionOptions - Options for compression pass
 * @returns Optimized prompt with metadata
 */
export function optimizePrompt(
  originalPrompt: string,
  platformId: string,
  selections: PromptSelections,
  platformFamily: 'midjourney' | 'other' = 'other',
  compressionOptions: CompressionOptions = {},
): OptimizedPromptExtended {
  // Handle empty input
  if (!originalPrompt || originalPrompt.trim().length === 0) {
    return {
      original: originalPrompt ?? '',
      optimized: originalPrompt ?? '',
      originalLength: 0,
      optimizedLength: 0,
      wasTrimmed: false,
      wasCompressed: false,
      compressionCharsSaved: 0,
      trimmingCharsSaved: 0,
      removedCategories: [],
      status: 'under',
    };
  }

  const limit = getPromptLimit(platformId);
  const originalLength = originalPrompt.length;

  // Check if optimization needed
  if (originalLength <= limit.idealMax) {
    const status = determineLengthStatus(originalLength, limit);
    return {
      original: originalPrompt,
      optimized: originalPrompt,
      originalLength,
      optimizedLength: originalLength,
      wasTrimmed: false,
      wasCompressed: false,
      compressionCharsSaved: 0,
      trimmingCharsSaved: 0,
      removedCategories: [],
      status,
    };
  }

  // =========================================================================
  // PHASE 1: COMPRESSION (preserves 100% semantic meaning)
  // =========================================================================

  const compressionResult = compressPrompt(originalPrompt, platformId, {
    ...compressionOptions,
    targetLength: limit.idealMax, // Target the ideal max, not middle
  });

  const workingPrompt = compressionResult.compressed;
  const compressionCharsSaved = compressionResult.charsSaved;

  // Check if compression alone achieved target
  if (workingPrompt.length <= limit.idealMax) {
    const status = determineLengthStatus(workingPrompt.length, limit);
    return {
      original: originalPrompt,
      optimized: workingPrompt,
      originalLength,
      optimizedLength: workingPrompt.length,
      wasTrimmed: false,
      wasCompressed: compressionCharsSaved > 0,
      compressionCharsSaved,
      trimmingCharsSaved: 0,
      removedCategories: [],
      status,
      compressionResult,
    };
  }

  // =========================================================================
  // PHASE 2: CATEGORY TRIMMING (removes content as last resort)
  // FIXED v2.0.0: Now uses text-based removal, not rebuild
  // =========================================================================

  const { trimmed, removedCategories } = applyCategoryTrimming(
    workingPrompt,
    limit.idealMax,
    selections,
    platformFamily,
  );

  const trimmingCharsSaved = workingPrompt.length - trimmed.length;
  const optimizedLength = trimmed.length;
  const status = determineLengthStatus(optimizedLength, limit);

  return {
    original: originalPrompt,
    optimized: trimmed,
    originalLength,
    optimizedLength,
    wasTrimmed: removedCategories.length > 0 || trimmingCharsSaved > 0,
    wasCompressed: compressionCharsSaved > 0,
    compressionCharsSaved,
    trimmingCharsSaved,
    removedCategories,
    status,
    compressionResult,
  };
}

/**
 * Legacy optimize function (without compression).
 * Maintained for backward compatibility.
 */
export function optimizePromptLegacy(
  originalPrompt: string,
  platformId: string,
  selections: PromptSelections,
  platformFamily: 'midjourney' | 'other' = 'other',
): OptimizedPrompt {
  // Handle empty input
  if (!originalPrompt || originalPrompt.trim().length === 0) {
    return {
      original: originalPrompt ?? '',
      optimized: originalPrompt ?? '',
      originalLength: 0,
      optimizedLength: 0,
      wasTrimmed: false,
      removedCategories: [],
      status: 'under',
    };
  }

  const limit = getPromptLimit(platformId);
  const originalLength = originalPrompt.length;

  // Check if optimization needed
  if (originalLength <= limit.idealMax) {
    const status = determineLengthStatus(originalLength, limit);
    return {
      original: originalPrompt,
      optimized: originalPrompt,
      originalLength,
      optimizedLength: originalLength,
      wasTrimmed: false,
      removedCategories: [],
      status,
    };
  }

  // Apply category trimming directly (no compression)
  const { trimmed, removedCategories } = applyCategoryTrimming(
    originalPrompt,
    limit.idealMax,
    selections,
    platformFamily,
  );

  const optimizedLength = trimmed.length;
  const status = determineLengthStatus(optimizedLength, limit);

  return {
    original: originalPrompt,
    optimized: trimmed,
    originalLength,
    optimizedLength,
    wasTrimmed: true,
    removedCategories,
    status,
  };
}

// ============================================================================
// TOOLTIP HELPERS
// ============================================================================

/**
 * Format character count for display.
 * e.g., "285" or "1.2K"
 */
export function formatCharCount(count: number): string {
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}K`;
}

/**
 * Get status icon for display.
 */
export function getStatusIcon(status: LengthStatus): string {
  switch (status) {
    case 'under':
      return '↑';
    case 'optimal':
      return '✓';
    case 'over':
      return '↓';
    case 'critical':
      return '⚠';
    default:
      return '?';
  }
}

/**
 * Get status color class for Tailwind.
 * Uses Core Colours (sky, emerald) and warning colors.
 */
export function getStatusColorClass(status: LengthStatus): string {
  switch (status) {
    case 'under':
      return 'text-sky-400'; // Core Colour - could add more
    case 'optimal':
      return 'text-emerald-400'; // Core Colour - within sweet spot
    case 'over':
      return 'text-amber-400'; // Warning - will be trimmed
    case 'critical':
      return 'text-rose-500'; // Critical - exceeds max
    default:
      return 'text-slate-400';
  }
}

/**
 * Get background color class for progress bar.
 */
export function getStatusBgClass(status: LengthStatus): string {
  switch (status) {
    case 'under':
      return 'bg-sky-400/20';
    case 'optimal':
      return 'bg-emerald-400/20';
    case 'over':
      return 'bg-amber-400/20';
    case 'critical':
      return 'bg-rose-500/20';
    default:
      return 'bg-slate-400/20';
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  countWords,
  determineLengthStatus,
  suggestCategories,
  rebuildPrompt,
  extractMidjourneyNegative,
  applyCategoryTrimming,
  // New v2.0.0 exports
  escapeRegex,
  removePhraseFromPrompt,
  cleanupPromptFormatting,
  extractARParameter,
};

// Re-export compression utilities
export {
  compressPrompt,
  getPlatformTier,
  analyzeCompression,
  supportsFullShorthand,
  supportsMidjourneySyntax,
} from '@/lib/compress';
