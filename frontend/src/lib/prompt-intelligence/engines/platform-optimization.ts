// src/lib/prompt-intelligence/engines/platform-optimization.ts
// ============================================================================
// PLATFORM OPTIMIZATION ENGINE
// ============================================================================
// Formats prompts for specific AI platform syntax and preferences.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { PlatformHint } from '../types';
import { getPlatformHint, getSemanticTag } from '../index';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for prompt formatting.
 */
export interface FormatPromptInput {
  /** Selections by category */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Custom values by category */
  customValues?: Partial<Record<PromptCategory, string>>;
  
  /** Negative terms */
  negatives?: string[];
  
  /** Platform ID to format for */
  platformId: string;
  
  /** Optional maximum character limit */
  maxChars?: number;
}

/**
 * Result of prompt formatting.
 */
export interface FormatPromptResult {
  /** The formatted positive prompt */
  positivePrompt: string;
  
  /** The formatted negative prompt (if separate) */
  negativePrompt: string | null;
  
  /** Whether the prompt was trimmed to fit limits */
  wasTrimmed: boolean;
  
  /** Character count of positive prompt */
  charCount: number;
  
  /** Platform-specific hints for the user */
  platformHints: string[];
  
  /** The platform configuration used */
  platformConfig: PlatformHint | null;
}

/**
 * Input for smart trimming.
 */
export interface SmartTrimInput {
  /** Terms to potentially trim */
  terms: string[];
  
  /** Category of these terms */
  category: PromptCategory;
  
  /** Maximum characters allowed */
  maxChars: number;
  
  /** Platform ID for trim priority */
  platformId?: string;
  
  /** Whether to preserve high-value terms */
  preserveHighValue?: boolean;
}

/**
 * Result of smart trimming (engine-specific).
 * Note: Different from SmartTrimResult in types.ts which is for full prompt trimming.
 */
export interface PromptTrimResult {
  /** Remaining terms after trimming */
  terms: string[];
  
  /** Terms that were removed */
  removed: string[];
  
  /** Whether any trimming occurred */
  wasTrimmed: boolean;
  
  /** Final character count */
  charCount: number;
}

/**
 * Platform formatting options.
 */
export interface PlatformFormattingOptions {
  /** Whether to use weights */
  useWeights?: boolean;
  
  /** Default weight for important terms */
  defaultWeight?: number;
  
  /** Whether to convert to natural language */
  naturalLanguage?: boolean;
  
  /** Term separator */
  separator?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default category order for prompt assembly.
 * Subject first, then descriptive terms, then technical.
 */
const DEFAULT_CATEGORY_ORDER: PromptCategory[] = [
  'subject',
  'action',
  'environment',
  'style',
  'lighting',
  'atmosphere',
  'colour',
  'materials',
  'composition',
  'camera',
  'fidelity',
];

/**
 * Categories to trim first when over limit (least impactful first).
 */
const DEFAULT_TRIM_PRIORITY: PromptCategory[] = [
  'fidelity',
  'camera',
  'materials',
  'composition',
  'atmosphere',
  'colour',
  'lighting',
  'environment',
  'action',
  'style',
  'subject', // Never trim subject if possible
];

/**
 * Platform-specific character limits.
 */
const PLATFORM_LIMITS: Record<string, number> = {
  'midjourney': 6000,
  'dalle': 4000,
  'stability': 2000,
  'flux': 2000,
  'ideogram': 1000,
  'leonardo': 1000,
  'default': 2000,
};

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format a term with platform-specific weight.
 */
function formatTermWithWeight(
  term: string,
  weight: number,
  platformHint: PlatformHint | undefined
): string {
  if (weight === 1.0 || !platformHint?.weightSyntax) {
    return term;
  }
  
  const syntax = platformHint.weightSyntax;
  
  // Midjourney style: term::1.5
  if (syntax.includes('::')) {
    return `${term}::${weight.toFixed(1)}`;
  }
  
  // SD style: (term:1.5)
  if (syntax.includes('(') && syntax.includes(':')) {
    return `(${term}:${weight.toFixed(1)})`;
  }
  
  // Default: just append
  return `${term}${syntax.replace('{weight}', weight.toFixed(1))}`;
}

/**
 * Convert keyword-style terms to natural language.
 */
function toNaturalLanguage(terms: string[]): string {
  if (terms.length === 0) return '';
  if (terms.length === 1) return terms[0] ?? '';
  
  // Group similar terms
  const result: string[] = [];
  
  for (const term of terms) {
    result.push(term);
  }
  
  // Join with commas and 'and' for last
  if (result.length === 2) {
    return `${result[0]} and ${result[1]}`;
  }
  
  const last = result.pop();
  return `${result.join(', ')}, and ${last}`;
}

/**
 * Format negative terms for a platform.
 */
function formatNegatives(
  negatives: string[],
  platformHint: PlatformHint | undefined
): { inline: string | null; separate: string | null } {
  if (negatives.length === 0) {
    return { inline: null, separate: null };
  }
  
  const negativeText = negatives.join(', ');
  
  // Platform uses separate negative field
  if (platformHint?.separateNegative) {
    return { inline: null, separate: negativeText };
  }
  
  // Platform uses inline negative syntax (like --no for Midjourney)
  if (platformHint?.negativeSyntax) {
    const syntax = platformHint.negativeSyntax;
    
    // Midjourney --no style
    if (syntax === '--no') {
      return { inline: `--no ${negatives.join(', ')}`, separate: null };
    }
    
    // Other inline styles
    return { inline: `${syntax} ${negativeText}`, separate: null };
  }
  
  // Default: use separate field
  return { inline: null, separate: negativeText };
}

/**
 * Get term priority score for trimming (higher = keep longer).
 */
function getTermPriority(term: string, category: PromptCategory): number {
  let score = 50; // Base score
  
  // Subject terms are most important
  if (category === 'subject') {
    score += 100;
  }
  
  // Style terms are important
  if (category === 'style') {
    score += 50;
  }
  
  // Check semantic tag for importance hints
  const tag = getSemanticTag(term);
  if (tag) {
    // Terms with many family associations are more important
    score += tag.families.length * 5;
    
    // Terms with suggestions are more impactful
    if (tag.suggests) {
      score += Object.keys(tag.suggests).length * 10;
    }
  }
  
  // Longer terms often have more specificity
  score += Math.min(term.length, 30);
  
  return score;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Format a prompt for a specific platform.
 * 
 * @example
 * ```ts
 * const result = formatPromptForPlatform({
 *   selections: {
 *     subject: ['cyberpunk warrior'],
 *     style: ['neon noir', 'cinematic'],
 *     lighting: ['neon lights'],
 *   },
 *   negatives: ['blurry', 'low quality'],
 *   platformId: 'midjourney',
 * });
 * 
 * console.log(result.positivePrompt);
 * // "cyberpunk warrior, neon noir, cinematic, neon lights --no blurry, low quality"
 * ```
 */
export function formatPromptForPlatform(input: FormatPromptInput): FormatPromptResult {
  const {
    selections,
    customValues = {},
    negatives = [],
    platformId,
    maxChars,
  } = input;
  
  const platformHint = getPlatformHint(platformId);
  const defaultLimit = PLATFORM_LIMITS['default'] ?? 2000;
  const charLimit = maxChars ?? PLATFORM_LIMITS[platformId] ?? defaultLimit;
  
  // Determine category order based on platform preferences
  const categoryOrder = [...DEFAULT_CATEGORY_ORDER];
  
  // Collect all terms in order
  const allTerms: string[] = [];
  
  // Add custom subject first if present
  if (customValues.subject) {
    allTerms.push(customValues.subject);
  }
  
  // Add terms by category order
  for (const category of categoryOrder) {
    const terms = selections[category] ?? [];
    
    // Add custom value for this category (if not subject, already added)
    if (category !== 'subject' && customValues[category]) {
      allTerms.push(customValues[category]!);
    }
    
    // Add selected terms
    allTerms.push(...terms);
  }
  
  // Format terms based on platform preferences
  let formattedTerms: string[];
  
  if (platformHint?.prefersNaturalLanguage) {
    // Convert to natural language style
    formattedTerms = [toNaturalLanguage(allTerms)];
  } else {
    // Keep as comma-separated keywords
    formattedTerms = allTerms;
  }
  
  // Join terms
  const separator = platformHint?.prefersNaturalLanguage ? ' ' : ', ';
  let positivePrompt = formattedTerms.join(separator);
  
  // Format negatives
  const negativeFormat = formatNegatives(negatives, platformHint);
  
  // Add inline negatives if applicable
  if (negativeFormat.inline) {
    positivePrompt = `${positivePrompt} ${negativeFormat.inline}`;
  }
  
  // Check character limit and trim if needed
  let wasTrimmed = false;
  if (positivePrompt.length > charLimit) {
    // Need to trim
    const trimResult = smartTrimPrompt({
      terms: allTerms,
      category: 'style', // Generic category for mixed terms
      maxChars: charLimit - (negativeFormat.inline?.length ?? 0) - 10,
      platformId,
      preserveHighValue: true,
    });
    
    positivePrompt = trimResult.terms.join(separator);
    if (negativeFormat.inline) {
      positivePrompt = `${positivePrompt} ${negativeFormat.inline}`;
    }
    wasTrimmed = trimResult.wasTrimmed;
  }
  
  return {
    positivePrompt,
    negativePrompt: negativeFormat.separate,
    wasTrimmed,
    charCount: positivePrompt.length,
    platformHints: platformHint?.hints ?? [],
    platformConfig: platformHint ?? null,
  };
}

/**
 * Smart trim terms to fit within character limit.
 * Preserves most important terms based on semantic analysis.
 */
export function smartTrimPrompt(input: SmartTrimInput): PromptTrimResult {
  const {
    terms,
    category,
    maxChars,
  } = input;
  
  if (terms.length === 0) {
    return { terms: [], removed: [], wasTrimmed: false, charCount: 0 };
  }
  
  // Calculate current length
  const separator = ', ';
  const currentText = terms.join(separator);
  
  if (currentText.length <= maxChars) {
    return { 
      terms: [...terms], 
      removed: [], 
      wasTrimmed: false, 
      charCount: currentText.length 
    };
  }
  
  // Need to trim - sort terms by priority
  const scoredTerms = terms.map((term, index) => ({
    term,
    index,
    priority: getTermPriority(term, category),
  }));
  
  // Sort by priority (highest first = keep)
  scoredTerms.sort((a, b) => b.priority - a.priority);
  
  // Keep terms until we exceed limit
  const keptTerms: string[] = [];
  const removedTerms: string[] = [];
  let currentLength = 0;
  
  for (const { term } of scoredTerms) {
    const addLength = currentLength === 0 
      ? term.length 
      : term.length + separator.length;
    
    if (currentLength + addLength <= maxChars) {
      keptTerms.push(term);
      currentLength += addLength;
    } else {
      removedTerms.push(term);
    }
  }
  
  // Restore original order for kept terms
  const originalOrder = terms.filter(t => keptTerms.includes(t));
  
  return {
    terms: originalOrder,
    removed: removedTerms,
    wasTrimmed: removedTerms.length > 0,
    charCount: originalOrder.join(separator).length,
  };
}

/**
 * Get the recommended category order for a platform.
 */
export function getCategoryOrder(platformId: string): PromptCategory[] {
  const platformHint = getPlatformHint(platformId);
  
  if (platformHint?.prefersEarlierTokens) {
    // Subject and style should be first
    return [...DEFAULT_CATEGORY_ORDER];
  }
  
  // Default order
  return [...DEFAULT_CATEGORY_ORDER];
}

/**
 * Get the trim priority order for a platform.
 */
export function getTrimPriority(platformId: string): PromptCategory[] {
  const platformHint = getPlatformHint(platformId);
  
  if (platformHint?.trimPriority) {
    return [...platformHint.trimPriority];
  }
  
  return [...DEFAULT_TRIM_PRIORITY];
}

/**
 * Get the character limit for a platform.
 */
export function getPlatformCharLimit(platformId: string): number {
  const defaultLimit = PLATFORM_LIMITS['default'] ?? 2000;
  return PLATFORM_LIMITS[platformId] ?? defaultLimit;
}

/**
 * Check if a platform supports weights.
 */
export function platformSupportsWeights(platformId: string): boolean {
  const platformHint = getPlatformHint(platformId);
  return Boolean(platformHint?.weightSyntax);
}

/**
 * Check if a platform uses separate negative prompt.
 */
export function platformUsesSeparateNegative(platformId: string): boolean {
  const platformHint = getPlatformHint(platformId);
  return Boolean(platformHint?.separateNegative);
}

/**
 * Format a term with weight for a specific platform.
 */
export function formatWithWeight(
  term: string,
  weight: number,
  platformId: string
): string {
  const platformHint = getPlatformHint(platformId);
  return formatTermWithWeight(term, weight, platformHint);
}

/**
 * Get platform-specific formatting recommendations.
 */
export function getPlatformRecommendations(platformId: string): {
  maxChars: number;
  supportsWeights: boolean;
  separateNegative: boolean;
  prefersNaturalLanguage: boolean;
  prefersKeywords: boolean;
  hints: string[];
} {
  const platformHint = getPlatformHint(platformId);
  const defaultLimit = PLATFORM_LIMITS['default'] ?? 2000;
  
  return {
    maxChars: PLATFORM_LIMITS[platformId] ?? defaultLimit,
    supportsWeights: Boolean(platformHint?.weightSyntax),
    separateNegative: Boolean(platformHint?.separateNegative),
    prefersNaturalLanguage: Boolean(platformHint?.prefersNaturalLanguage),
    prefersKeywords: Boolean(platformHint?.prefersKeywords),
    hints: platformHint?.hints ?? [],
  };
}

/**
 * Estimate token count for a prompt (rough approximation).
 * Most AI models use ~4 characters per token on average.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format a complete prompt with all components.
 */
export function formatCompletePrompt(input: {
  subject: string;
  selections: Partial<Record<PromptCategory, string[]>>;
  negatives: string[];
  platformId: string;
  options?: PlatformFormattingOptions;
}): FormatPromptResult {
  const { subject, selections, negatives, platformId } = input;
  
  // Add subject to selections
  const fullSelections: Partial<Record<PromptCategory, string[]>> = {
    ...selections,
  };
  
  return formatPromptForPlatform({
    selections: fullSelections,
    customValues: { subject },
    negatives,
    platformId,
  });
}
