// src/lib/prompt-builder.ts
// Platform-optimized prompt assembler for AI image platforms
// Version 3.1.0 - Vocabulary loader integration for intelligent suggestions
// Features:
// - 12 categories support (added Fidelity)
// - Silent token/word limit optimization per platform
// - Keyword vs sentence mode formatting
// - Core category prioritization when trimming
// - Negative-to-positive conversion for natural language platforms
//   (e.g., "blurry" → "sharp focus", "noisy" → "pristine clarity")
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
  | 'midjourney'       // Midjourney, BlueWillow
  | 'stable-diffusion' // Stability, DreamStudio, Lexica, etc.
  | 'natural'          // DALL-E, Firefly, Bing, Canva, etc.
  | 'leonardo'         // Leonardo AI
  | 'flux'             // Flux/BFL
  | 'novelai'          // NovelAI (curly brace weighting)
  | 'ideogram';        // Ideogram

const PLATFORM_FAMILIES: Record<string, PlatformFamily> = {
  // Midjourney family
  'midjourney': 'midjourney',
  'bluewillow': 'midjourney',
  
  // Stable Diffusion family
  'stability': 'stable-diffusion',
  'dreamstudio': 'stable-diffusion',
  'lexica': 'stable-diffusion',
  'playground': 'stable-diffusion',
  'nightcafe': 'stable-diffusion',
  'getimg': 'stable-diffusion',
  'dreamlike': 'stable-diffusion',
  'openart': 'stable-diffusion',
  'artistly': 'natural',
  'clipdrop': 'stable-diffusion',
  
  // Leonardo family
  'leonardo': 'leonardo',
  
  // Flux family
  'flux': 'flux',
  
  // NovelAI family
  'novelai': 'novelai',
  
  // Ideogram family
  'ideogram': 'ideogram',
  
  // Natural language family (DALL-E style)
  'openai': 'natural',
  'adobe-firefly': 'natural',
  'bing': 'natural',
  'microsoft-designer': 'natural',
  'meta-imagine': 'natural',
  'canva': 'natural',
  'jasper-art': 'natural',
  'simplified': 'natural',
  'vistacreate': 'natural',
  'visme': 'natural',
  'fotor': 'natural',
  'hotpot': 'natural',
  'pixlr': 'natural',
  'picwish': 'natural',
  'craiyon': 'natural',
  'deepai': 'natural',
  'photoleap': 'natural',
  'picsart': 'natural',
  'i23rf': 'natural',
  'freepik': 'natural',
  'artguru': 'natural',
  'artbreeder': 'natural',
  'myedit': 'natural',
  'remove-bg': 'natural',
  'google-imagen': 'natural',
  'runway': 'natural',
};

function getPlatformFamily(platformId: string): PlatformFamily {
  return PLATFORM_FAMILIES[platformId] ?? 'natural';
}

// ============================================================================
// Quality Prefixes & Suffixes
// ============================================================================

const SD_QUALITY_PREFIX = ['masterpiece', 'best quality', 'highly detailed'];
const SD_QUALITY_NEGATIVE = ['worst quality', 'low quality', 'normal quality', 'lowres', 'bad anatomy', 'bad hands', 'error', 'missing fingers', 'extra digit', 'fewer digits', 'cropped', 'jpeg artifacts', 'signature', 'watermark', 'username', 'blurry'];

const LEONARDO_QUALITY_PREFIX = ['masterpiece', 'highly detailed', 'professional'];
const FLUX_QUALITY_SUFFIX = ['8K', 'ultra detailed', 'sharp focus'];

// ============================================================================
// Negative to Positive Conversion Map
// For natural language platforms that don't support separate negative prompts
// ============================================================================

const NEGATIVE_TO_POSITIVE: Record<string, string> = {
  // Quality issues → Quality enhancers
  'blurry': 'sharp focus',
  'low quality': 'high quality',
  'low resolution': 'high resolution',
  'pixelated': 'smooth details',
  'grainy': 'clean and smooth',
  'noisy': 'pristine clarity',
  'poorly drawn': 'well-rendered',
  
  // Exposure issues → Proper exposure
  'overexposed': 'balanced exposure',
  'underexposed': 'well-illuminated',
  'oversaturated': 'balanced colors',
  'washed out': 'vibrant rich tones',
  
  // Unwanted elements → Clean image
  'text': 'clean image',
  'watermark': 'unmarked',
  'signature': 'unsigned',
  'logo': 'logo-free',
  'border': 'borderless',
  'frame': 'full frame',
  
  // Composition issues → Good composition
  'cropped': 'complete composition',
  'out of frame': 'centered subject',
  'duplicate': 'unique composition',
  
  // Anatomy issues → Correct anatomy
  'deformed': 'well-formed',
  'distorted': 'correct proportions',
  'disfigured': 'natural appearance',
  'bad anatomy': 'anatomically correct',
  'extra limbs': 'normal anatomy',
  'extra fingers': 'correct hands',
  'mutated hands': 'well-defined hands',
  
  // Aesthetic issues → Positive aesthetics
  'ugly': 'beautiful',
  'morbid': 'pleasant mood',
  'mutilated': 'intact and whole',
};

/**
 * Convert negative terms to positive equivalents for natural language platforms
 * - Known terms: converted to positive (e.g., "blurry" → "sharp focus")
 * - Custom/unknown terms: kept with "without" prefix (e.g., "chromatic aberration" → "without chromatic aberration")
 */
function convertNegativesToPositives(negatives: string[]): { positives: string[]; withouts: string[] } {
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
  separator: string = ', '
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
// Assembly Strategies per Platform Family
// ============================================================================

/**
 * Midjourney-style assembly
 * Format: subject, action, style, environment --ar 16:9 --no blur
 */
function assembleMidjourney(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Subject first (most important)
  if (selections.subject?.length) {
    parts.push(...selections.subject);
  }
  
  // Action early
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style and mood early (MJ likes these prominent)
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting
  if (selections.lighting?.length) {
    parts.push(...selections.lighting);
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Camera details
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 40;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  let positive = trimmed.join(', ');
  
  // Add --no for negatives (MJ inline style)
  const negatives = selections.negative?.filter(Boolean) ?? [];
  if (negatives.length > 0) {
    positive += ` --no ${negatives.join(', ')}`;
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

/**
 * Stable Diffusion-style assembly
 * Format: masterpiece, best quality, subject, action, style, (lighting:1.2)
 * Separate negative with quality terms
 */
function assembleStableDiffusion(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Quality prefix (crucial for SD)
  parts.push(...SD_QUALITY_PREFIX);
  
  // Subject
  if (selections.subject?.length) {
    parts.push(...selections.subject);
  }
  
  // Action
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting with emphasis
  if (selections.lighting?.length) {
    parts.push(...selections.lighting.map(l => `(${l}:1.1)`));
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Camera
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 50;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  const positive = trimmed.join(', ');
  
  // Build comprehensive negative
  const userNegatives = selections.negative?.filter(Boolean) ?? [];
  const allNegatives = [...SD_QUALITY_NEGATIVE, ...userNegatives];
  const negative = allNegatives.join(', ');
  
  return {
    positive,
    negative,
    tips: platformFormat.tips,
    supportsNegative: true,
    negativeMode: 'separate',
    wasTrimmed,
  };
}

/**
 * Natural language assembly (DALL-E, Firefly, etc.)
 * Format: "A [subject] [action] in [environment] with [lighting], in a [style] style"
 */
function assembleNatural(selections: PromptSelections, platformId: string, platformFormat: PlatformFormat): AssembledPrompt {
  const sentences: string[] = [];
  
  // Build the main description
  let mainDesc = '';
  
  // Start with subject
  const subject = selections.subject?.[0];
  const action = selections.action?.[0];
  
  if (subject && action) {
    mainDesc = `${subject} ${action}`;
  } else if (subject) {
    mainDesc = subject;
  }
  
  // Add environment
  if (selections.environment?.length) {
    const envStr = selections.environment.join(' during ');
    if (mainDesc) {
      mainDesc += ` in ${envStr}`;
    } else {
      mainDesc = `Scene in ${envStr}`;
    }
  }
  
  if (mainDesc) {
    // Capitalize first letter for natural sentence
    mainDesc = mainDesc.charAt(0).toUpperCase() + mainDesc.slice(1);
    sentences.push(mainDesc);
  }
  
  // Add style as "in X style"
  if (selections.style?.length) {
    const styleStr = selections.style.join(' and ');
    sentences.push(`in ${styleStr} style`);
  }
  
  // Add lighting
  if (selections.lighting?.length) {
    const lightStr = selections.lighting.join(' and ');
    sentences.push(`with ${lightStr}`);
  }
  
  // Add atmosphere
  if (selections.atmosphere?.length) {
    const atmoStr = selections.atmosphere.join(' and ');
    sentences.push(`${atmoStr} atmosphere`);
  }
  
  // Add colour
  if (selections.colour?.length) {
    const colourStr = selections.colour.join(' and ');
    sentences.push(`${colourStr}`);
  }
  
  // Add materials
  if (selections.materials?.length) {
    const matStr = selections.materials.join(' and ');
    sentences.push(`featuring ${matStr}`);
  }
  
  // Add composition
  if (selections.composition?.length) {
    sentences.push(selections.composition.join(', '));
  }
  
  // Add camera details
  if (selections.camera?.length) {
    sentences.push(selections.camera.join(', '));
  }
  
  // Join into flowing sentence
  let positive = sentences.join(', ');
  
  // Handle negatives for natural language platforms
  // - Known terms: converted to positives (e.g., "blurry" → "sharp focus")
  // - Custom free text: uses "without X" (e.g., "chromatic aberration" → "without chromatic aberration")
  const negatives = selections.negative?.filter(Boolean) ?? [];
  if (negatives.length > 0) {
    const { positives, withouts } = convertNegativesToPositives(negatives);
    
    // Add converted positives
    if (positives.length > 0) {
      positive += `, ${positives.join(', ')}`;
    }
    
    // Add custom terms with "without"
    if (withouts.length > 0) {
      positive += `, without ${withouts.join(' or ')}`;
    }
  }
  
  // Trim to platform limit (word count for natural language)
  const limit = platformFormat.sweetSpot || 100;
  const words = positive.split(/\s+/);
  let wasTrimmed = false;
  if (words.length > limit) {
    positive = words.slice(0, limit).join(' ');
    wasTrimmed = true;
  }
  
  return {
    positive,
    negative: undefined,
    tips: platformFormat.tips,
    supportsNegative: true,  // Natural language platforms convert negatives to positive equivalents
    negativeMode: 'converted',  // Negatives are converted to positives (e.g., "blurry" → "sharp focus")
    wasTrimmed,
  };
}

/**
 * Leonardo assembly
 * Format: Keywords with optional weighting (concept::1.5)
 */
function assembleLeonardo(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Quality prefix
  parts.push(...LEONARDO_QUALITY_PREFIX);
  
  // Subject with optional weight
  if (selections.subject?.length) {
    parts.push(...selections.subject.map(s => `${s}::1.2`));
  }
  
  // Action
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting
  if (selections.lighting?.length) {
    parts.push(...selections.lighting);
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Camera
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 100;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  const positive = trimmed.join(', ');
  
  // Separate negative
  const userNegatives = selections.negative?.filter(Boolean) ?? [];
  const allNegatives = [...SD_QUALITY_NEGATIVE, ...userNegatives];
  const negative = allNegatives.join(', ');
  
  return {
    positive,
    negative,
    tips: platformFormat.tips,
    supportsNegative: true,
    negativeMode: 'separate',
    wasTrimmed,
  };
}

/**
 * Flux assembly
 * Format: Keywords with quality suffix
 */
function assembleFlux(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Subject
  if (selections.subject?.length) {
    parts.push(...selections.subject);
  }
  
  // Action
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting
  if (selections.lighting?.length) {
    parts.push(...selections.lighting);
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Camera
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Add quality suffix
  parts.push(...FLUX_QUALITY_SUFFIX);
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 120;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  const positive = trimmed.join(', ');
  
  // Separate negative
  const userNegatives = selections.negative?.filter(Boolean) ?? [];
  const allNegatives = [...SD_QUALITY_NEGATIVE, ...userNegatives];
  const negative = allNegatives.join(', ');
  
  return {
    positive,
    negative,
    tips: platformFormat.tips,
    supportsNegative: true,
    negativeMode: 'separate',
    wasTrimmed,
  };
}

/**
 * NovelAI assembly
 * Format: {{{emphasis}}}, subject, style
 */
function assembleNovelAI(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Quality with braces
  parts.push('{{{masterpiece}}}', '{{best quality}}');
  
  // Subject
  if (selections.subject?.length) {
    parts.push(...selections.subject);
  }
  
  // Action
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting
  if (selections.lighting?.length) {
    parts.push(...selections.lighting);
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Camera
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 80;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  const positive = trimmed.join(', ');
  
  // Separate negative
  const userNegatives = selections.negative?.filter(Boolean) ?? [];
  const allNegatives = [...SD_QUALITY_NEGATIVE, ...userNegatives];
  const negative = allNegatives.join(', ');
  
  return {
    positive,
    negative,
    tips: platformFormat.tips,
    supportsNegative: true,
    negativeMode: 'separate',
    wasTrimmed,
  };
}

/**
 * Ideogram assembly
 * Natural language, good with text, inline negatives
 */
function assembleIdeogram(selections: PromptSelections, platformFormat: PlatformFormat): AssembledPrompt {
  const parts: string[] = [];
  
  // Subject
  if (selections.subject?.length) {
    parts.push(...selections.subject);
  }
  
  // Action
  if (selections.action?.length) {
    parts.push(...selections.action);
  }
  
  // Style
  if (selections.style?.length) {
    parts.push(...selections.style);
  }
  
  // Environment
  if (selections.environment?.length) {
    parts.push(...selections.environment);
  }
  
  // Lighting
  if (selections.lighting?.length) {
    parts.push(...selections.lighting);
  }
  
  // Atmosphere
  if (selections.atmosphere?.length) {
    parts.push(...selections.atmosphere);
  }
  
  // Colour
  if (selections.colour?.length) {
    parts.push(...selections.colour);
  }
  
  // Materials
  if (selections.materials?.length) {
    parts.push(...selections.materials);
  }
  
  // Composition
  if (selections.composition?.length) {
    parts.push(...selections.composition);
  }
  
  // Camera
  if (selections.camera?.length) {
    parts.push(...selections.camera);
  }
  
  // Trim to platform limit
  const limit = platformFormat.sweetSpot || 100;
  const { trimmed, wasTrimmed } = trimPromptToLimit(parts, selections, limit);
  
  let positive = trimmed.join(', ');
  
  // Ideogram uses "without" for negatives
  const negatives = selections.negative?.filter(Boolean) ?? [];
  if (negatives.length > 0) {
    positive += `, without ${negatives.join(', ')}`;
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
  context?: VocabularyContext
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
  context?: VocabularyContext
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
  context: VocabularyContext
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
  searchQuery?: string
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
  query: string
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
 * Assemble a prompt from user selections for a specific platform
 * Routes to platform-specific assembly strategy
 */
export function assemblePrompt(
  platformId: string,
  selections: PromptSelections
): AssembledPrompt {
  // Check if we have any selections at all
  const hasSelections = Object.values(selections).some(arr => arr && arr.length > 0);
  if (!hasSelections) {
    return {
      positive: '',
      negative: undefined,
      tips: undefined,
      supportsNegative: true,
      negativeMode: 'none',
    };
  }
  
  const family = getPlatformFamily(platformId);
  const platformFormat = getPlatformFormat(platformId);
  
  switch (family) {
    case 'midjourney':
      return assembleMidjourney(selections, platformFormat);
    case 'stable-diffusion':
      return assembleStableDiffusion(selections, platformFormat);
    case 'leonardo':
      return assembleLeonardo(selections, platformFormat);
    case 'flux':
      return assembleFlux(selections, platformFormat);
    case 'novelai':
      return assembleNovelAI(selections, platformFormat);
    case 'ideogram':
      return assembleIdeogram(selections, platformFormat);
    case 'natural':
    default:
      return assembleNatural(selections, platformId, platformFormat);
  }
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
export function getPromptPreview(
  platformId: string,
  selections: PromptSelections
): string {
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
    'midjourney': 'Midjourney-style',
    'stable-diffusion': 'Stable Diffusion-style',
    'natural': 'Natural language',
    'leonardo': 'Leonardo AI',
    'flux': 'Flux',
    'novelai': 'NovelAI',
    'ideogram': 'Ideogram',
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
export function buildPrompt(
  providerId: string,
  input: BuildInput,
  website?: string
): Built {
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
