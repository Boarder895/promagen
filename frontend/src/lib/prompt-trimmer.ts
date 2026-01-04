// src/lib/prompt-trimmer.ts
// ============================================================================
// PROMPT TRIMMER
// ============================================================================
// Core logic for analyzing and optimizing prompt length.
// Provides secure, deterministic trimming based on category priority.
//
// Security:
// - No user-provided code execution
// - All inputs validated against whitelists
// - Deterministic output for auditability
// - Type-safe throughout
//
// Algorithm:
// 1. Calculate current length vs platform limits
// 2. If over ideal, identify excess
// 3. Trim lowest-priority categories first (TRIM_PRIORITY order)
// 4. Never touch protected categories (subject, style)
// 5. If still over after trimming, truncate with warning
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
// PROMPT TRIMMING
// ============================================================================

/**
 * Rebuild prompt from modified selections.
 * Preserves category order and comma separation.
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
 * Optimize prompt by trimming to platform limits.
 *
 * Algorithm:
 * 1. Check if trimming needed
 * 2. Parse current selections
 * 3. Remove categories in TRIM_PRIORITY order (lowest first)
 * 4. Stop when within target
 * 5. If still over, truncate with ellipsis
 *
 * @param originalPrompt - The original assembled prompt
 * @param platformId - Platform identifier
 * @param selections - Current category selections
 * @param platformFamily - 'midjourney' | 'other' for negative handling
 * @returns Optimized prompt with metadata
 */
export function optimizePrompt(
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

  // Extract negative section for Midjourney family
  const { negative } = platformFamily === 'midjourney'
    ? extractMidjourneyNegative(originalPrompt)
    : { negative: null };

  // Calculate target (accounting for negative section if present)
  const negativeLength = negative ? ` --no ${negative}`.length : 0;
  const targetPositiveLength = limit.idealMax - negativeLength;

  // Create working copy of selections
  const workingSelections: PromptSelections = { ...selections };
  const removedCategories: string[] = [];

  // Trim categories in priority order
  for (const category of TRIM_PRIORITY) {
    // Check current length
    const currentPrompt = rebuildPrompt(workingSelections, new Set(removedCategories));
    if (currentPrompt.length <= targetPositiveLength) {
      break; // Within target, stop trimming
    }

    // Skip if category not present
    const catKey = category as PromptCategory;
    if (!workingSelections[catKey] || workingSelections[catKey]!.length === 0) {
      continue;
    }

    // Remove this category
    removedCategories.push(category);
    delete workingSelections[catKey];
  }

  // Rebuild optimized prompt
  let optimizedPositive = rebuildPrompt(workingSelections, new Set(removedCategories));

  // If still over target, hard truncate with ellipsis
  if (optimizedPositive.length > targetPositiveLength) {
    const truncateAt = Math.max(0, targetPositiveLength - 3);
    // Find last comma before truncation point
    const lastComma = optimizedPositive.lastIndexOf(',', truncateAt);
    if (lastComma > truncateAt * 0.5) {
      optimizedPositive = optimizedPositive.slice(0, lastComma).trim();
    } else {
      optimizedPositive = optimizedPositive.slice(0, truncateAt).trim() + '...';
    }
  }

  // Reassemble with negative section
  const optimized = negative
    ? `${optimizedPositive} --no ${negative}`
    : optimizedPositive;

  const optimizedLength = optimized.length;
  const status = determineLengthStatus(optimizedLength, limit);

  return {
    original: originalPrompt,
    optimized,
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
};
