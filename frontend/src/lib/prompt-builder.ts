// src/lib/prompt-builder.ts
// Platform-optimized prompt assembler for AI image platforms
// Version 4.1.0 - Tier-aware unified assembly with intent reordering
// Features:
// - 12 categories support (added Fidelity)
// - Unified tier-aware assembler replaces 7 family-specific functions
//   Tier 1 (CLIP): quality prefix → impact-priority keywords → weighted → separate negative
//   Tier 2 (Midjourney): impact-priority keywords → inline --no negatives
//   Tier 3 (Natural Language): config-ordered sentence clauses → convert negatives
//   Tier 4 (Plain Language): short comma lists, minimal output
// - Intent reordering: impactPriority config front-loads the categories each
//   platform weights most heavily (first 10-15 words for MJ, weighted tokens
//   at front for CLIP, subject-first clauses for NatLang)
// - All platform quirks driven by config (platform-formats.json), not hardcoded
// - Silent token/word limit optimization per platform
// - Negative-to-positive conversion for natural language platforms
// - supportsNativeNegative() for conditional free text in negative combobox
// - Vocabulary-driven options with intelligent context-aware suggestions

import type {
  PromptCategory,
  PromptSelections,
  AssembledPrompt,
  PlatformFormat,
  PlatformFormats,
  PromptOptions,
} from '@/types/prompt-builder';

import { getPlatformTierId } from '@/data/platform-tiers';
import type { PlatformTierId } from '@/data/platform-tiers';

import promptOptionsData from '@/data/providers/prompt-options.json';
import platformFormatsData from '@/data/providers/platform-formats.json';

// Vocabulary loader for enhanced options and intelligent suggestions
import {
  loadCategoryVocabulary,
  detectDominantFamily,
  getChipDisplayOptions,
  searchCategoryVocabulary,
  type VocabularyContext,
  type CategoryVocabulary,
  type CategoryKey,
} from '@/lib/vocabulary/vocabulary-loader';

// Type assertions for JSON imports
const promptOptions = promptOptionsData as PromptOptions;
const platformFormats = platformFormatsData as PlatformFormats;

// ============================================================================
// Enhanced Category Config Types (Vocabulary Integration)
// ============================================================================

/**
 * Enhanced category configuration with vocabulary-driven options
 */
export interface EnhancedCategoryConfig {
  /** Category label for display */
  label: string;
  /** Category description */
  description: string;
  /** Tooltip guidance text */
  tooltipGuidance: string;
  /** Top 100 options for dropdown display */
  options: string[];
  /** All available options for chip display */
  allOptions: string[];
  /** Context-aware suggestion pool */
  suggestions: string[];
  /** Total available terms in vocabulary */
  totalAvailable: number;
}

/**
 * Context for intelligent vocabulary loading
 * Re-exported from vocabulary-loader for convenience
 */
export type { VocabularyContext, CategoryVocabulary };

// ============================================================================
// Platform Family Definitions
// ============================================================================

type PlatformFamily =
  | 'midjourney' // Midjourney, BlueWillow
  | 'stable-diffusion' // Stability, DreamStudio, Lexica, etc.
  | 'natural' // DALL-E, Firefly, Bing, Canva, etc.
  | 'leonardo' // Leonardo AI
  | 'flux' // Flux/BFL
  | 'novelai' // NovelAI (curly brace weighting)
  | 'ideogram'; // Ideogram

const PLATFORM_FAMILIES: Record<string, PlatformFamily> = {
  // Midjourney family
  midjourney: 'midjourney',
  bluewillow: 'midjourney',

  // Stable Diffusion family
  stability: 'stable-diffusion',
  dreamstudio: 'stable-diffusion',
  lexica: 'stable-diffusion',
  playground: 'stable-diffusion',
  nightcafe: 'stable-diffusion',
  getimg: 'stable-diffusion',
  dreamlike: 'stable-diffusion',
  openart: 'stable-diffusion',
  artistly: 'natural',
  clipdrop: 'stable-diffusion',

  // Leonardo family
  leonardo: 'leonardo',

  // Flux family
  flux: 'flux',

  // NovelAI family
  novelai: 'novelai',

  // Ideogram family
  ideogram: 'ideogram',

  // Natural language family (DALL-E style)
  openai: 'natural',
  'adobe-firefly': 'natural',
  bing: 'natural',
  'microsoft-designer': 'natural',
  'imagine-meta': 'natural',
  canva: 'natural',
  'jasper-art': 'stable-diffusion',
  simplified: 'natural',
  vistacreate: 'natural',
  visme: 'natural',
  fotor: 'natural',
  hotpot: 'natural',
  pixlr: 'natural',
  picwish: 'natural',
  craiyon: 'natural',
  deepai: 'natural',
  photoleap: 'natural',
  picsart: 'natural',
  '123rf': 'natural',
  freepik: 'natural',
  artguru: 'stable-diffusion',
  artbreeder: 'natural',
  myedit: 'natural',
  'remove-bg': 'natural',
  'google-imagen': 'natural',
  runway: 'natural',
};

function getPlatformFamily(platformId: string): PlatformFamily {
  return PLATFORM_FAMILIES[platformId] ?? 'natural';
}

// ============================================================================
// Quality constants removed — now config-driven via platform-formats.json
// Each platform's qualityPrefix, qualitySuffix, qualityNegative, and
// weightedCategories are read from getPlatformFormat() at assembly time.
// ============================================================================

// ============================================================================
// Negative to Positive Conversion Map
// For natural language platforms that don't support separate negative prompts
// ============================================================================

const NEGATIVE_TO_POSITIVE: Record<string, string> = {
  // Quality issues → Quality enhancers
  blurry: 'sharp focus',
  'low quality': 'high quality',
  'low resolution': 'high resolution',
  pixelated: 'smooth details',
  grainy: 'clean and smooth',
  noisy: 'pristine clarity',
  'poorly drawn': 'well-rendered',

  // Exposure issues → Proper exposure
  overexposed: 'balanced exposure',
  underexposed: 'well-illuminated',
  oversaturated: 'balanced colors',
  'washed out': 'vibrant rich tones',

  // Unwanted elements → Clean image
  text: 'clean image',
  watermark: 'unmarked',
  signature: 'unsigned',
  logo: 'logo-free',
  border: 'borderless',
  frame: 'full frame',

  // Composition issues → Good composition
  cropped: 'complete composition',
  'out of frame': 'centered subject',
  duplicate: 'unique composition',

  // Anatomy issues → Correct anatomy
  deformed: 'well-formed',
  distorted: 'correct proportions',
  disfigured: 'natural appearance',
  'bad anatomy': 'anatomically correct',
  'extra limbs': 'normal anatomy',
  'extra fingers': 'correct hands',
  'mutated hands': 'well-defined hands',

  // Aesthetic issues → Positive aesthetics
  ugly: 'beautiful',
  morbid: 'pleasant mood',
  mutilated: 'intact and whole',
};

/**
 * Convert negative terms to positive equivalents for natural language platforms
 * - Known terms: converted to positive (e.g., "blurry" → "sharp focus")
 * - Custom/unknown terms: kept with "without" prefix (e.g., "chromatic aberration" → "without chromatic aberration")
 */
function convertNegativesToPositives(negatives: string[]): {
  positives: string[];
  withouts: string[];
} {
  const positives: string[] = [];
  const withouts: string[] = [];

  for (const neg of negatives) {
    const mapped = NEGATIVE_TO_POSITIVE[neg.toLowerCase()];
    if (mapped) {
      positives.push(mapped);
    } else {
      // Custom/unknown term - use "without" phrasing
      withouts.push(neg);
    }
  }

  return { positives, withouts };
}

// Core categories that should be prioritized when trimming
// const CORE_CATEGORIES: PromptCategory[] = ['subject', 'environment', 'lighting', 'style', 'colour', 'camera'];
// const OPTIONAL_CATEGORIES: PromptCategory[] = ['action', 'composition', 'materials', 'atmosphere'];

// ============================================================================
// Word/Token Counting Utilities
// ============================================================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// function estimateTokens(text: string): number {
//   // Rough estimation: ~4 chars per token on average
//   return Math.ceil(text.length / 4);
// }

// ============================================================================
// Prompt Trimming for Token Limits
// ============================================================================

function trimPromptToLimit(
  parts: string[],
  selections: PromptSelections,
  limit: number,
  separator: string = ', ',
): { trimmed: string[]; wasTrimmed: boolean } {
  const current = parts.join(separator);
  let wasTrimmed = false;

  // If within limit, return as-is
  if (countWords(current) <= limit) {
    return { trimmed: parts, wasTrimmed: false };
  }

  // Remove optional category content first
  const trimmedParts = [...parts];

  // Start trimming from the end (optional categories are usually last)
  while (countWords(trimmedParts.join(separator)) > limit && trimmedParts.length > 1) {
    trimmedParts.pop();
    wasTrimmed = true;
  }

  return { trimmed: trimmedParts, wasTrimmed };
}

// ============================================================================
// Unified Tier-Aware Assembly with Intent Reordering
// ============================================================================
// Replaces 7 separate family functions with a single assembler that reads
// tier + platform format config + impactPriority.
//
// Intent reordering: each platform has an impactPriority config — the categories
// that carry the most weight for that platform's model. These are front-loaded
// in the output so they land in the positions the platform pays most attention to:
//
//   Tier 1 (CLIP-Based):   Weighted categories promoted to early token positions
//                           where CLIP encoder attention is strongest
//   Tier 2 (Midjourney):   Subject + style + atmosphere front-loaded within the
//                           first 10-15 words where MJ's influence is highest
//   Tier 3 (Natural Lang): Config-driven clause order — impactPriority categories
//                           form the core sentence, remaining categories trail
//   Tier 4 (Plain Lang):   Subject + style front-loaded, everything else trimmed
//
// Platform-specific quirks (NovelAI braces, Leonardo ::, SD weighting) are
// driven by config fields: weightingSyntax, weightedCategories, qualityPrefix,
// qualitySuffix, qualityNegative, negativeSyntax, impactPriority.
// ============================================================================

/**
 * Apply weighting syntax to a term using the platform's config.
 * e.g., SD: "(term:1.1)", Leonardo: "term::1.2", NovelAI quality prefix already pre-formatted
 */
function applyWeight(term: string, weight: number, syntax: string | undefined): string {
  if (!syntax) return term;
  return syntax.replace('{term}', term).replace('{weight}', String(weight));
}

/**
 * Compute the effective category output order with intent reordering.
 *
 * Impact priority categories come first (in their impactPriority order),
 * followed by remaining categories from categoryOrder that weren't already
 * included. Negative is always excluded from positive output.
 *
 * Example for Midjourney:
 *   impactPriority = [subject, style, atmosphere, action]
 *   categoryOrder  = [subject, action, style, environment, lighting, atmosphere, ...]
 *   effective      = [subject, style, atmosphere, action, environment, lighting, ...]
 *                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *                     impact zone (first 10-15 words)
 */
function getEffectiveOrder(platformFormat: PlatformFormat): PromptCategory[] {
  const impact = platformFormat.impactPriority ?? [];
  const impactSet = new Set(impact);
  const order: PromptCategory[] = [...impact];

  // Append remaining categories from categoryOrder that aren't in impactPriority
  for (const cat of platformFormat.categoryOrder) {
    if (cat !== 'negative' && !impactSet.has(cat)) {
      order.push(cat);
    }
  }

  return order;
}

/**
 * Collect user selections in impact-priority order with per-category weighting.
 *
 * Two-pass collection:
 *   1. Impact priority categories first (in impactPriority order)
 *   2. Remaining categories from categoryOrder
 *
 * This ensures the most impactful terms land in early token positions where
 * CLIP-based models and Midjourney pay the most attention.
 */
function collectKeywordParts(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
): string[] {
  const parts: string[] = [];
  const weights = platformFormat.weightedCategories ?? {};
  const syntax = platformFormat.weightingSyntax;
  const effectiveOrder = getEffectiveOrder(platformFormat);

  for (const category of effectiveOrder) {
    const values = selections[category];
    if (!values?.length) continue;

    const weight = weights[category];
    if (weight && syntax) {
      parts.push(...values.map((v) => applyWeight(v, weight, syntax)));
    } else {
      parts.push(...values);
    }
  }

  return parts;
}

/**
 * Keyword-mode assembly (Tier 1 CLIP, Tier 2 Midjourney, and keyword-style platforms)
 *
 * Flow: qualityPrefix → impact-priority selections (weighted) → qualitySuffix → trim → negatives
 *
 * Intent reordering ensures the platform's impactPriority categories appear
 * immediately after qualityPrefix, placing them in the early token positions
 * where model attention is strongest.
 */
function assembleKeywords(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
): AssembledPrompt {
  const parts: string[] = [];

  // 1. Quality prefix from config (e.g., SD "masterpiece", NovelAI "{{{masterpiece}}}")
  if (platformFormat.qualityPrefix?.length) {
    parts.push(...platformFormat.qualityPrefix);
  }

  // 2. User selections in impact-priority order, with weighting
  parts.push(...collectKeywordParts(selections, platformFormat));

  // 3. Quality suffix from config (e.g., Flux "8K, ultra detailed")
  if (platformFormat.qualitySuffix?.length) {
    parts.push(...platformFormat.qualitySuffix);
  }

  // 4. Trim to sweet spot — trims from the back, preserving front-loaded impact terms
  const limit = platformFormat.sweetSpot || 80;
  const separator = platformFormat.separator || ', ';
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit, separator);

  let positive = trimmed.join(separator);

  // 5. Handle negatives based on platform config
  const userNegatives = selections.negative?.filter(Boolean) ?? [];

  if (platformFormat.negativeSupport === 'inline' && platformFormat.negativeSyntax) {
    // Inline negatives (e.g., MJ "--no blur, text" or Ideogram "without blur")
    if (userNegatives.length > 0) {
      const negStr = userNegatives.join(', ');
      const inlineNeg = platformFormat.negativeSyntax.replace('{negative}', negStr);
      positive += ` ${inlineNeg}`;
    }
    return {
      positive,
      negative: undefined,
      tips: platformFormat.tips,
      supportsNegative: true,
      negativeMode: 'inline',
      wasTrimmed,
    };
  }

  if (platformFormat.negativeSupport === 'separate') {
    // Separate negative field — prepend quality negatives from config
    const qualityNeg = platformFormat.qualityNegative ?? [];
    const allNegatives = [...qualityNeg, ...userNegatives];
    return {
      positive,
      negative: allNegatives.length > 0 ? allNegatives.join(', ') : undefined,
      tips: platformFormat.tips,
      supportsNegative: true,
      negativeMode: 'separate',
      wasTrimmed,
    };
  }

  // No negative support
  return {
    positive,
    negative: undefined,
    tips: platformFormat.tips,
    supportsNegative: false,
    negativeMode: 'none',
    wasTrimmed,
  };
}

// ============================================================================
// Natural Language Sentence Connectors
// ============================================================================
// Maps each category to its natural language connector when building sentences.
// The connector wraps the selected term(s) to form grammatically correct clauses.
//
// Subject and action are special — they form the core sentence nucleus and are
// always fused together ("A samurai warrior fighting" not "A samurai warrior, fighting").
// All other categories produce trailing clauses joined by commas.
// ============================================================================

interface SentenceConnector {
  prefix?: string; // Prepended before value(s) — e.g., "in " for environment
  suffix?: string; // Appended after value(s) — e.g., " style" for style
  joiner?: string; // Joins multiple values — defaults to " and "
}

const SENTENCE_CONNECTORS: Record<string, SentenceConnector> = {
  // Core nucleus — subject and action have no connectors (handled specially)
  subject: {},
  action: {},

  // Scene categories
  environment: { prefix: 'in ' },
  style: { prefix: 'in ', suffix: ' style' },
  lighting: { prefix: 'with ' },
  atmosphere: { suffix: ' atmosphere' },
  colour: {},
  materials: { prefix: 'featuring ' },
  composition: {},
  camera: {},
  fidelity: {},
};

/**
 * Build a sentence clause from a category's selections and its connector.
 */
function buildClause(category: PromptCategory, values: string[]): string {
  const connector = SENTENCE_CONNECTORS[category] ?? {};
  const joiner = connector.joiner ?? ' and ';
  const joined = values.join(joiner);
  const prefix = connector.prefix ?? '';
  const suffix = connector.suffix ?? '';
  return `${prefix}${joined}${suffix}`;
}

/**
 * Natural language assembly (Tier 3 — DALL-E, Firefly, Ideogram, etc.)
 *
 * Config-driven clause ordering: the sentence structure follows impactPriority +
 * categoryOrder from the platform config, not a hardcoded category sequence.
 *
 * Subject + action always form the core sentence nucleus (fused together),
 * then remaining categories are appended as clauses in the effective order
 * determined by impactPriority front-loading.
 *
 * Example (OpenAI, impactPriority=[subject, action, environment, style]):
 *   "A samurai warrior fighting in an ancient temple, in concept art style,
 *    with dramatic golden hour lighting, misty atmosphere"
 *
 * Example (Ideogram, impactPriority=[subject, action, style, environment]):
 *   "A samurai warrior fighting, in concept art style, in an ancient temple,
 *    with dramatic golden hour lighting"
 */
function assembleNaturalSentences(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
): AssembledPrompt {
  const effectiveOrder = getEffectiveOrder(platformFormat);

  // ── Core sentence nucleus: subject + action + first environment ──
  // These are always fused regardless of config order, because every
  // natural language prompt needs a grammatical subject
  let nucleus = '';
  const subject = selections.subject?.[0];
  const action = selections.action?.[0];

  if (subject && action) {
    nucleus = `${subject} ${action}`;
  } else if (subject) {
    nucleus = subject;
  }

  // Check if environment comes before style in effective order
  // If so, fuse it into the nucleus for a tighter core sentence
  const envIdx = effectiveOrder.indexOf('environment');
  const styleIdx = effectiveOrder.indexOf('style');
  const envIsEarly = envIdx !== -1 && (styleIdx === -1 || envIdx < styleIdx);

  if (envIsEarly && selections.environment?.length) {
    const envStr = selections.environment.join(' and ');
    if (nucleus) {
      nucleus += ` in ${envStr}`;
    } else {
      nucleus = `Scene in ${envStr}`;
    }
  }

  // Capitalize nucleus
  if (nucleus) {
    nucleus = nucleus.charAt(0).toUpperCase() + nucleus.slice(1);
  }

  // ── Build trailing clauses in effective order ──
  // Skip subject, action, and environment-if-fused (already in nucleus)
  const skipSet = new Set<PromptCategory>(['subject', 'action']);
  if (envIsEarly) skipSet.add('environment');

  const clauses: string[] = [];
  if (nucleus) clauses.push(nucleus);

  for (const category of effectiveOrder) {
    if (skipSet.has(category)) continue;
    const values = selections[category];
    if (!values?.length) continue;

    clauses.push(buildClause(category, values));
  }

  let positive = clauses.join(', ');

  // ── Handle negatives ──
  const negatives = selections.negative?.filter(Boolean) ?? [];

  if (platformFormat.negativeSupport === 'inline' && platformFormat.negativeSyntax) {
    if (negatives.length > 0) {
      const negStr = negatives.join(', ');
      const inlineNeg = platformFormat.negativeSyntax.replace('{negative}', negStr);
      positive += `, ${inlineNeg}`;
    }
    return trimAndReturn(positive, platformFormat, true, 'inline');
  }

  // Convert negatives to positive equivalents for natural language platforms
  if (negatives.length > 0) {
    const { positives, withouts } = convertNegativesToPositives(negatives);
    if (positives.length > 0) {
      positive += `, ${positives.join(', ')}`;
    }
    if (withouts.length > 0) {
      positive += `, without ${withouts.join(' or ')}`;
    }
  }

  return trimAndReturn(positive, platformFormat, true, 'converted');
}

/**
 * Plain language assembly (Tier 4 — Canva, Craiyon, PicsArt, etc.)
 *
 * Produces short, comma-separated keyword lists (5-15 words ideal).
 * Uses impact-priority ordering so subject + style land first,
 * with everything else appended if there's budget remaining.
 */
function assemblePlainLanguage(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
): AssembledPrompt {
  const parts: string[] = [];
  const effectiveOrder = getEffectiveOrder(platformFormat);

  // Collect selections in impact-priority order — flat keywords, no frills
  for (const category of effectiveOrder) {
    const values = selections[category];
    if (values?.length) {
      parts.push(...values);
    }
  }

  // Trim to sweet spot (typically 40-60 words for Tier 4)
  const limit = platformFormat.sweetSpot || 40;
  const separator = platformFormat.separator || ', ';
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit, separator);

  const positive = trimmed.join(separator);

  // Tier 4 platforms have no negative support — convert to positives
  const negatives = selections.negative?.filter(Boolean) ?? [];
  let finalPositive = positive;

  if (negatives.length > 0) {
    const { positives } = convertNegativesToPositives(negatives);
    if (positives.length > 0) {
      finalPositive += `${separator}${positives.join(separator)}`;
    }
  }

  return {
    positive: finalPositive,
    negative: undefined,
    tips: platformFormat.tips,
    supportsNegative: false,
    negativeMode: 'none',
    wasTrimmed,
  };
}

/**
 * Helper: trim natural language prompt to word limit and build AssembledPrompt
 */
function trimAndReturn(
  positive: string,
  platformFormat: PlatformFormat,
  supportsNegative: boolean,
  negativeMode: 'inline' | 'converted' | 'none',
): AssembledPrompt {
  const limit = platformFormat.sweetSpot || 100;
  const words = positive.split(/\s+/);
  let wasTrimmed = false;
  let trimmedPositive = positive;

  if (words.length > limit) {
    trimmedPositive = words.slice(0, limit).join(' ');
    wasTrimmed = true;
  }

  return {
    positive: trimmedPositive,
    negative: undefined,
    tips: platformFormat.tips,
    supportsNegative,
    negativeMode,
    wasTrimmed,
  };
}

/**
 * Unified tier-aware assembly router.
 * Reads the platform's tier + format config and delegates to the appropriate
 * assembly strategy. All platform quirks come from config, not hardcoded logic.
 *
 * Routing priority:
 *   1. Tier 4 → plain language (short comma lists, no frills)
 *   2. promptStyle "keywords" → keyword assembly (Tier 1 CLIP, Tier 2 MJ,
 *      and keyword-style Tier 3 platforms like Flux)
 *   3. Everything else → natural language sentences (Tier 3 default)
 */
function assembleTierAware(
  platformId: string,
  selections: PromptSelections,
  platformFormat: PlatformFormat,
): AssembledPrompt {
  const tierId: PlatformTierId | undefined = getPlatformTierId(platformId);

  // Tier 4: Plain language — short comma lists, no frills
  // Takes priority over promptStyle so Tier 4 keyword platforms (e.g., artistly)
  // still get simple output appropriate for their limited capabilities
  if (tierId === 4) {
    return assemblePlainLanguage(selections, platformFormat);
  }

  // Keyword-mode platforms: Tier 1 (CLIP), Tier 2 (MJ), and keyword-style
  // Tier 3 platforms (Flux) — promptStyle in config is the authority
  if (platformFormat.promptStyle === 'keywords') {
    return assembleKeywords(selections, platformFormat);
  }

  // Tier 3 and all other natural-language platforms: flowing sentences
  return assembleNaturalSentences(selections, platformFormat);
}

// ============================================================================
// Main Assembly Function
// ============================================================================

/**
 * Get the platform format configuration for a given provider
 */
export function getPlatformFormat(platformId: string): PlatformFormat {
  return platformFormats.platforms[platformId] ?? platformFormats._defaults;
}

/**
 * Get dropdown options for a category (top 100, vocabulary-driven)
 * @param category - The prompt category
 * @param context - Optional context for intelligent sorting
 */
export function getCategoryOptions(
  category: PromptCategory,
  context?: VocabularyContext,
): string[] {
  try {
    const vocab = loadCategoryVocabulary(category as CategoryKey, context);
    return vocab.dropdownOptions;
  } catch {
    // Fallback to legacy options if vocabulary fails
    return promptOptions.categories[category]?.options ?? [];
  }
}

/**
 * Get ALL available options for a category (for chip display)
 * @param category - The prompt category
 */
export function getAllCategoryOptions(category: PromptCategory): string[] {
  try {
    const vocab = loadCategoryVocabulary(category as CategoryKey);
    return vocab.allOptions;
  } catch {
    // Fallback to legacy options
    return promptOptions.categories[category]?.options ?? [];
  }
}

/**
 * Get category configuration (label, description, options, tooltipGuidance)
 * Returns legacy format for backward compatibility
 */
export function getCategoryConfig(category: PromptCategory) {
  return promptOptions.categories[category];
}

/**
 * Get enhanced category configuration with vocabulary-driven options
 * Includes: dropdown options (100), all options (~300), suggestions (20)
 *
 * @param category - The prompt category
 * @param context - Optional context for intelligent sorting
 *
 * @example
 * // Basic usage
 * const config = getEnhancedCategoryConfig('style');
 *
 * @example
 * // With intelligence context
 * const config = getEnhancedCategoryConfig('lighting', {
 *   selectedTerms: ['cyberpunk', 'neon'],
 *   dominantFamily: 'cyberpunk',
 *   marketMood: 'bullish'
 * });
 */
export function getEnhancedCategoryConfig(
  category: PromptCategory,
  context?: VocabularyContext,
): EnhancedCategoryConfig {
  const legacy = promptOptions.categories[category];

  try {
    const vocab = loadCategoryVocabulary(category as CategoryKey, context);

    return {
      label: vocab.meta.label || legacy?.label || category,
      description: vocab.meta.description || legacy?.description || '',
      tooltipGuidance: vocab.meta.tooltipGuidance || legacy?.tooltipGuidance || '',
      options: vocab.dropdownOptions,
      allOptions: vocab.allOptions,
      suggestions: vocab.suggestionPool,
      totalAvailable: vocab.meta.totalAvailable,
    };
  } catch {
    // Fallback to legacy config
    return {
      label: legacy?.label || category,
      description: legacy?.description || '',
      tooltipGuidance: legacy?.tooltipGuidance || '',
      options: legacy?.options ?? [],
      allOptions: legacy?.options ?? [],
      suggestions: (legacy?.options ?? []).slice(0, 20),
      totalAvailable: legacy?.options?.length ?? 0,
    };
  }
}

/**
 * Get context-aware suggestions for a category
 *
 * @param category - The prompt category
 * @param context - Context including selected terms and detected family
 */
export function getCategorySuggestions(
  category: PromptCategory,
  context: VocabularyContext,
): string[] {
  try {
    const vocab = loadCategoryVocabulary(category as CategoryKey, context);
    return vocab.suggestionPool;
  } catch {
    return [];
  }
}

/**
 * Get chips for free-text area (excludes selected, search-filtered)
 *
 * @param category - The prompt category
 * @param selectedTerms - Currently selected terms to exclude
 * @param searchQuery - Optional search filter
 */
export function getCategoryChips(
  category: PromptCategory,
  selectedTerms: string[],
  searchQuery?: string,
): string[] {
  try {
    return getChipDisplayOptions(category as CategoryKey, selectedTerms, searchQuery);
  } catch {
    return [];
  }
}

/**
 * Search within a category's vocabulary
 * Returns matches with type indicator (exact, startsWith, contains)
 */
export function searchCategoryOptions(
  category: PromptCategory,
  query: string,
): Array<{ term: string; matchType: 'exact' | 'startsWith' | 'contains' }> {
  try {
    return searchCategoryVocabulary(category as CategoryKey, query);
  } catch {
    return [];
  }
}

/**
 * Detect dominant style family from selected terms
 * Useful for context-aware suggestions
 */
export function detectStyleFamily(selectedTerms: string[]): string | null {
  try {
    return detectDominantFamily(selectedTerms);
  } catch {
    return null;
  }
}

/**
 * Get all category keys in display order
 */
export function getAllCategories(): PromptCategory[] {
  return Object.keys(promptOptions.categories) as PromptCategory[];
}

/**
 * Get categories in platform-specific order (excluding negative)
 */
export function getOrderedCategories(platformId: string): PromptCategory[] {
  const format = getPlatformFormat(platformId);
  return format.categoryOrder.filter((c) => c !== 'negative');
}

/**
 * Assemble a prompt from user selections for a specific platform.
 * Uses unified tier-aware assembly — reads tier + platform format config
 * to determine the correct assembly strategy.
 */
export function assemblePrompt(platformId: string, selections: PromptSelections): AssembledPrompt {
  // Check if we have any selections at all
  const hasSelections = Object.values(selections).some((arr) => arr && arr.length > 0);
  if (!hasSelections) {
    return {
      positive: '',
      negative: undefined,
      tips: undefined,
      supportsNegative: true,
      negativeMode: 'none',
    };
  }

  const platformFormat = getPlatformFormat(platformId);
  return assembleTierAware(platformId, selections, platformFormat);
}

/**
 * Format the assembled prompt for display/copy
 * Returns just the positive prompt - negative is handled separately by the platform
 */
export function formatPromptForCopy(assembled: AssembledPrompt): string {
  // Just return the positive prompt
  // For platforms with separate negative field, users paste negative separately
  // For platforms with inline negative (--no), it's already embedded in positive
  return assembled.positive;
}

/**
 * Get a preview of what the prompt will look like
 */
export function getPromptPreview(platformId: string, selections: PromptSelections): string {
  const assembled = assemblePrompt(platformId, selections);
  return formatPromptForCopy(assembled);
}

/**
 * Check if a platform supports negative prompts
 */
export function supportsNegativePrompts(platformId: string): boolean {
  const family = getPlatformFamily(platformId);
  return family !== 'natural';
}

/**
 * Check if platform supports native negative prompts (inline or separate field)
 * Used to determine if free text should be allowed in the negative combobox
 *
 * Platforms with native support (free text allowed):
 * - Inline: midjourney, bluewillow, ideogram (use --no or "without")
 * - Separate: stability, leonardo, flux, novelai, playground, nightcafe,
 *             lexica, openart, dreamstudio, getimg, dreamlike
 *
 * Platforms without native support (dropdown only, no free text):
 * - Converted: All natural language platforms (DALL-E, Firefly, Canva, etc.)
 */
export function supportsNativeNegative(platformId: string): boolean {
  const format = getPlatformFormat(platformId);
  return format.negativeSupport === 'inline' || format.negativeSupport === 'separate';
}

/**
 * Get platform tips for better prompting
 */
export function getPlatformTips(platformId: string): string | undefined {
  const assembled = assemblePrompt(platformId, {});
  return assembled.tips || getPlatformFormat(platformId).tips;
}

/**
 * Get example output for a platform
 */
export function getPlatformExample(platformId: string): string | undefined {
  return getPlatformFormat(platformId).exampleOutput;
}

/**
 * Get the platform family for display purposes
 */
export function getPlatformFamilyName(platformId: string): string {
  const family = getPlatformFamily(platformId);
  const names: Record<PlatformFamily, string> = {
    midjourney: 'Midjourney-style',
    'stable-diffusion': 'Stable Diffusion-style',
    natural: 'Natural language',
    leonardo: 'Leonardo AI',
    flux: 'Flux',
    novelai: 'NovelAI',
    ideogram: 'Ideogram',
  };
  return names[family];
}

// ============================================================================
// Legacy API compatibility layer
// ============================================================================

export type BuildInput = {
  idea: string;
  negative?: string;
  aspect?: string;
  seed?: string;
  styleTag?: string;
};

export type Built = { text: string; deepLink?: string };

/**
 * Legacy buildPrompt function for backward compatibility
 * @deprecated Use assemblePrompt instead
 */
export function buildPrompt(providerId: string, input: BuildInput, website?: string): Built {
  const { idea, negative } = input;

  const selections: PromptSelections = {
    subject: idea ? [idea.trim()] : [],
    negative: negative ? [negative] : [],
  };

  const assembled = assemblePrompt(providerId, selections);
  const text = formatPromptForCopy(assembled);

  return { text, deepLink: website };
}

// ============================================================================
// Exports for data access
// ============================================================================

export { promptOptions, platformFormats };
