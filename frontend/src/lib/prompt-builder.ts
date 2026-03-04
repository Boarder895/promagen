// src/lib/prompt-builder.ts
// Platform-optimized prompt assembler for AI image platforms
// Version 5.0.0 - 3-stage pipeline: Static → Dynamic → Optimize
// Changelog:
//   5.0.0 - 3-stage pipeline architecture:
//           Stage 1 (Static): assembleStatic() — raw comma join, no intelligence
//           Stage 2 (Dynamic): assemblePrompt(skipTrim) — platform formatting, no trimming
//           Stage 3 (Optimize): optimizer pipeline — trims dynamic output to sweet spot
//           AssemblyOptions.skipTrim threads through all sub-assemblers
//   4.2.0 - Rich phrase detection (>4 words bypass weight wrapping + connectors)
//           Smart trim: metadata categories drop before core scene categories
//           Plain language: rich phrases simplified to first N words
//   4.1.0 - Tier-aware unified assembly with intent reordering
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

import { CATEGORY_ORDER } from '@/types/prompt-builder';

// ============================================================================
// ASSEMBLY OPTIONS — 3-Stage Pipeline Control
// ============================================================================
// Stage 1 (Static):  assembleStatic()        — raw comma join, no intelligence
// Stage 2 (Dynamic): assemblePrompt(skipTrim) — platform formatting, no trimming
// Stage 3 (Optimize): optimizer pipeline      — trims dynamic output to sweet spot
// ============================================================================

export interface AssemblyOptions {
  /**
   * When true, skip trimming to the platform's sweet-spot word/token limit.
   * Used by Dynamic mode (Stage 2) so the assembler formats the prompt
   * with full platform intelligence (weights, reordering, quality tags,
   * connectors) but leaves the length untouched for the optimizer (Stage 3).
   */
  skipTrim?: boolean;
}

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

  // Unwanted elements → Clean image (singular + plural forms)
  text: 'clean image',
  watermark: 'unmarked',
  watermarks: 'unmarked',
  signature: 'unsigned',
  signatures: 'unsigned',
  logo: 'logo-free',
  logos: 'logo-free',
  border: 'borderless',
  frame: 'full frame',

  // People / crowd control (weather scenes are often empty)
  people: 'empty scene',
  person: 'empty scene',
  crowd: 'empty scene',
  crowds: 'empty scene',

  // Style / medium exclusions → Positive style affirmation
  cartoon: 'realistic rendering',
  cartoonish: 'realistic rendering',
  anime: 'photographic realism',
  illustration: 'photographic',
  sketch: 'detailed rendering',
  '3d render': 'photographic',
  'cgi look': 'natural look',

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
// Rich Phrase Detection (Phase A — Unified Brain)
// ============================================================================
// Weather intelligence produces multi-word physics-computed phrases like
// "Cool white moonlight competing with focused accent lighting".
// These need different treatment than simple dropdown terms like "moonlight".
//
// Threshold: >4 words = rich phrase. This covers:
//   - 1 word:  "moonlight"                     → dropdown term (no change)
//   - 2 words: "golden hour"                   → dropdown term (no change)
//   - 3 words: "low angle shot"                → dropdown term (no change)
//   - 4 words: "warm golden hour light"        → dropdown term (no change)
//   - 5+ words: "Cool white moonlight competing with..." → rich phrase (new path)
// ============================================================================

const RICH_PHRASE_THRESHOLD = 4;

/**
 * Detect if a term is a rich phrase (>4 words) vs a simple dropdown term.
 * Rich phrases bypass weight wrapping and connector prefixing.
 */
function isRichPhrase(term: string): boolean {
  return countWords(term) > RICH_PHRASE_THRESHOLD;
}

/**
 * Simplify a rich phrase for Tier 4 (plain language) by extracting the first
 * N key words. Drops modifiers and prepositions to fit tight token budgets.
 *
 * "Cool white moonlight competing with focused accent lighting" →
 * "cool white moonlight" (first 3 content words)
 */
function simplifyRichPhrase(phrase: string, maxWords: number = 3): string {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return phrase;
  return words.slice(0, maxWords).join(' ');
}

// ============================================================================
// Smart Trim Category Priority (Phase A — Unified Brain)
// ============================================================================
// When trimming to token budget, drop metadata/optional categories FIRST,
// preserving the core scene identity. This prevents rich weather phrases
// from crowding out subject + lighting.

/** Categories that define the scene identity — trimmed LAST */
const TRIM_PRIORITY_CORE: PromptCategory[] = [
  'subject',
  'lighting',
  'environment',
  'style',
  'camera',
];

/** Categories that enhance but don't define — trimmed FIRST */
const TRIM_PRIORITY_METADATA: PromptCategory[] = [
  'fidelity',
  'materials',
  'composition',
  'colour',
  'atmosphere',
  'action',
];

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
 *
 * Rich phrase handling (v4.2.0):
 *   - Short terms (≤4 words): weighted per config as before
 *   - Rich phrases (>4 words): inserted as-is without weight wrapping.
 *     Wrapping "(Cool white moonlight competing with focused accent lighting:1.3)"
 *     puts too much text in one weight group, confusing CLIP attention.
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
      // Apply weight only to short terms; rich phrases pass through unweighted
      parts.push(...values.map((v) => (isRichPhrase(v) ? v : applyWeight(v, weight, syntax))));
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

// ── Upgrade 2 (v11.1.0): CLIP Syntax Sanitiser ─────────────────────────────
//
// CLIP tokenisers (Stable Diffusion, Leonardo, ComfyUI, Flux) and Midjourney
// split on commas. Periods inside tokens confuse tokenisers and can deweight
// everything after them. This sanitiser runs on all keyword-mode output.
//
// Fixes:
//   "Natural daylight. Lumpy stratocumulus layer..."
//     → "Natural daylight, lumpy stratocumulus layer..."
//   "midground tack-sharp."
//     → "midground tack-sharp"
//
// Safe: preserves decimals (f/1.4, 0.5), ellipsis (...), abbreviations.
// ─────────────────────────────────────────────────────────────────────────────
// ── Improvement 5 (v11.1.1): CLIP Token Estimator ──────────────────────────
//
// CLIP uses BPE tokenisation. Approximate mapping:
//   - Common English words → 1 token each
//   - Compound/rare words → 2+ tokens
//   - Punctuation (commas, colons) → 1 token each
//   - Numbers → 1-2 tokens
//
// CLIP encoding window: 77 tokens (SD 1.5/SDXL). SDXL uses two encoders
// but the main CLIP-L still processes 77. Tokens beyond 77 get weaker
// attention (some implementations use BREAK for multi-pass encoding).
//
// Estimation: split on whitespace + punctuation, count. Roughly 1.3 words
// per token, but commas and weight syntax add tokens too.
// ────────────────────────────────────────────────────────────────────────────
function estimateClipTokens(text: string): number {
  if (!text.trim()) return 0;

  // Strip weight syntax that tokeniser ignores: (term:1.2) → term, {{{term}}} → term
  const cleaned = text
    .replace(/\({2,}([^)]+?)(?::[0-9.]+)?\){2,}/g, '$1') // ((term:1.2)) → term
    .replace(/\(([^)]+?):[0-9.]+\)/g, '$1') // (term:1.2) → term
    .replace(/\{+([^}]+?)\}+/g, '$1') // {{{term}}} → term
    .replace(/::[0-9.]+/g, ''); // term::1.2 → term

  // Split into BPE-like tokens: words + punctuation + numbers
  const tokens = cleaned.match(/[a-zA-Z]+(?:[-'][a-zA-Z]+)*|[0-9]+(?:\.[0-9]+)?|[,.:;!?()]/g);
  return tokens?.length ?? 0;
}

function sanitiseClipTokens(text: string): string {
  let out = text;

  // 0. Strip periods at end of a token before comma separator
  //    "overhead., Southerly" → "overhead, Southerly"
  //    Safe: preserves "f/1.4," because a digit precedes the period.
  out = out.replace(/([a-zA-Z])\.\s*,/g, '$1,');

  // 1. Replace sentence-ending periods followed by space+letter with ", "
  //    "Natural daylight. Lumpy" → "Natural daylight, lumpy"
  //    Safe: won't match decimals (1.4) or ellipsis (...) because they lack
  //    the space+letter pattern.
  out = out.replace(/\.(\s+)([A-Za-z])/g, (_match, _space, firstChar: string) => {
    return `, ${firstChar.toLowerCase()}`;
  });

  // 2. Strip any trailing period (with optional whitespace)
  out = out.replace(/\.\s*$/, '');

  // 3. Collapse double commas, leading/trailing commas, double spaces
  out = out.replace(/,\s*,/g, ',');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/^,\s*/, '');
  out = out.replace(/,\s*$/, '');

  return out.trim();
}

function assembleKeywords(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
  options?: AssemblyOptions,
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

  // 4. Trim to sweet spot — SKIPPED when skipTrim is true (Stage 2 Dynamic mode).
  //    Dynamic mode formats with full platform intelligence but leaves length
  //    untouched for the optimizer (Stage 3) to handle.
  const separator = platformFormat.separator || ', ';
  let trimmed: string[];
  let wasTrimmed = false;

  if (options?.skipTrim) {
    trimmed = parts;
  } else {
    const limit = platformFormat.sweetSpot || 80;
    const result = trimPromptToLimit(parts, selections, limit, separator);
    trimmed = result.trimmed;
    wasTrimmed = result.wasTrimmed;
  }

  let positive = trimmed.join(separator);

  // Upgrade 2: Sanitise CLIP syntax — strip stray periods from natural-language
  // customValues that survive into keyword-mode output.
  positive = sanitiseClipTokens(positive);

  // 5. Handle negatives based on platform config
  const userNegatives = selections.negative?.filter(Boolean) ?? [];

  if (platformFormat.negativeSupport === 'inline' && platformFormat.negativeSyntax) {
    // v5.1.0: Merge config-level qualityNegative with user negatives (deduped).
    // qualityNegative provides baseline artifact prevention (blurry, bad anatomy, etc.)
    // even when the user hasn't added any negatives. User negatives override/extend.
    const qualityNeg = platformFormat.qualityNegative ?? [];
    const seenNeg = new Set<string>();
    const allNegatives: string[] = [];
    for (const term of [...userNegatives, ...qualityNeg]) {
      const key = term.toLowerCase().trim();
      if (key && !seenNeg.has(key)) {
        seenNeg.add(key);
        allNegatives.push(term);
      }
    }

    // v3.3.0: Convert known negatives to positive reinforcement terms first,
    // then inline remaining unconverted terms with the platform's syntax.
    if (allNegatives.length > 0) {
      const { positives, withouts } = convertNegativesToPositives(allNegatives);
      // Deduplicate positive reinforcement against existing positive content
      // (qualitySuffix may already include "sharp focus" or "high quality")
      const existingLower = positive.toLowerCase();
      const dedupedPositives = positives.filter((term) => !existingLower.includes(term.toLowerCase()));
      if (dedupedPositives.length > 0) {
        positive += `${separator}${dedupedPositives.join(separator)}`;
      }
      if (withouts.length > 0) {
        const negStr = withouts.join(', ');
        const inlineNeg = platformFormat.negativeSyntax.replace('{negative}', negStr);
        positive += ` ${inlineNeg}`;
      }
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
    // v3.3.0: Convert known negatives to positive reinforcement terms and
    // append to positive prompt. The negatives still go to the separate field
    // so the model avoids them AND the positive prompt reinforces what to include.
    // v3.4.0: Deduplicate against existing positive content — qualitySuffix
    // may already include terms like "sharp focus" that neg-to-pos also produces.
    const { positives: negPos } = convertNegativesToPositives(userNegatives);
    const existingLower = positive.toLowerCase();
    const dedupedNegPos = negPos.filter((term) => !existingLower.includes(term.toLowerCase()));
    if (dedupedNegPos.length > 0) {
      positive += `${separator}${dedupedNegPos.join(separator)}`;
    }

    // Separate negative field — prepend quality negatives from config.
    // Fix: Deduplicate — qualityNeg may overlap with weather-generated user negatives
    // (e.g., "blurry" appears in both qualityNegative config and buildNegativeTerms()).
    const qualityNeg = platformFormat.qualityNegative ?? [];
    const seenNeg = new Set<string>();
    const allNegatives: string[] = [];
    for (const term of [...qualityNeg, ...userNegatives]) {
      const key = term.toLowerCase().trim();
      if (key && !seenNeg.has(key)) {
        seenNeg.add(key);
        allNegatives.push(term);
      }
    }
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
  // v3.5.1: Removed " style" suffix — "photorealistic" is cleaner and more
  // CLIP-efficient than "in photorealistic style". Suffix dilutes attention
  // without changing what the AI generates. Closes flux parity 95.5% → 100%.
  style: { prefix: 'in ' },
  lighting: { prefix: 'with ' },
  // v3.5.1: Removed " atmosphere" suffix, switched joiner to comma.
  // "mysterious" is more prompt-efficient than "mysterious atmosphere".
  // Comma joiner ("haze, urban glow") is standard prompt syntax vs "and".
  atmosphere: { joiner: ', ' },
  colour: {},
  materials: {}, // v3.4.0: removed "featuring" prefix — materials terms are self-describing
  composition: {},
  camera: {},
  fidelity: {},
};

/**
 * Build a sentence clause from a category's selections and its connector.
 *
 * Rich phrase handling (v4.2.0):
 *   - Short terms: wrapped with prefix/suffix connectors as before
 *     "moonlight" → "with moonlight"
 *   - Rich phrases (>4 words): inserted as standalone clauses, no connector
 *     "Cool white moonlight competing with focused accent lighting"
 *     NOT "with Cool white moonlight competing with focused accent lighting"
 */
function buildClause(category: PromptCategory, values: string[]): string {
  const connector = SENTENCE_CONNECTORS[category] ?? {};
  const joiner = connector.joiner ?? ' and ';

  // Separate rich phrases from short terms
  const shortTerms: string[] = [];
  const richPhrases: string[] = [];

  for (const v of values) {
    if (isRichPhrase(v)) {
      richPhrases.push(v);
    } else {
      shortTerms.push(v);
    }
  }

  const parts: string[] = [];

  // Short terms get normal connector treatment
  if (shortTerms.length > 0) {
    const joined = shortTerms.join(joiner);
    const prefix = connector.prefix ?? '';
    const suffix = connector.suffix ?? '';
    parts.push(`${prefix}${joined}${suffix}`);
  }

  // Rich phrases become standalone clauses (no connector)
  parts.push(...richPhrases);

  return parts.join(', ');
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
  options?: AssemblyOptions,
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
    // Split environment terms: short terms get "in" prefix, rich phrases stand alone
    const shortEnvs: string[] = [];
    const richEnvs: string[] = [];
    for (const env of selections.environment) {
      if (isRichPhrase(env)) {
        richEnvs.push(env);
      } else {
        shortEnvs.push(env);
      }
    }

    // Fuse short terms into nucleus with "in" prefix (existing behaviour)
    if (shortEnvs.length > 0) {
      const shortStr = shortEnvs.join(' and ');
      if (nucleus) {
        nucleus += ` in ${shortStr}`;
      } else {
        nucleus = `Scene in ${shortStr}`;
      }
    }

    // Rich phrases appended as standalone clauses (no "in" prefix)
    if (richEnvs.length > 0) {
      if (nucleus) {
        nucleus += `, ${richEnvs.join(', ')}`;
      } else {
        nucleus = richEnvs.join(', ');
      }
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
      // v3.3.0: Convert known negatives to positive reinforcement terms first
      // (e.g. "blurry" → "sharp focus"), then inline remaining unconverted
      // terms. This matches the conversion path and ensures consistent
      // quality terms across all Tier 3 natural-language platforms.
      const { positives, withouts } = convertNegativesToPositives(negatives);
      if (positives.length > 0) {
        positive += `, ${positives.join(', ')}`;
      }
      if (withouts.length > 0) {
        const negStr = withouts.join(', ');
        const inlineNeg = platformFormat.negativeSyntax.replace('{negative}', negStr);
        positive += `, ${inlineNeg}`;
      }
    }
    return trimAndReturn(positive, platformFormat, true, 'inline', options);
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

  return trimAndReturn(positive, platformFormat, true, 'converted', options);
}

/**
 * Plain language assembly (Tier 4 — Canva, Craiyon, PicsArt, etc.)
 *
 * Produces short, comma-separated keyword lists (5-15 words ideal).
 * Uses impact-priority ordering so subject + style land first,
 * with everything else appended if there's budget remaining.
 *
 * Rich phrase handling (v4.2.0):
 *   - Rich phrases (>4 words) are simplified to their first 3 content words
 *     to fit Tier 4's tight token budget (40-60 words).
 *   - "Cool white moonlight competing with focused accent lighting"
 *     → "cool white moonlight"
 */
function assemblePlainLanguage(
  selections: PromptSelections,
  platformFormat: PlatformFormat,
  options?: AssemblyOptions,
): AssembledPrompt {
  const parts: string[] = [];
  const effectiveOrder = getEffectiveOrder(platformFormat);

  // Collect selections in impact-priority order — flat keywords, no frills
  // Rich phrases get simplified to fit the tight budget
  for (const category of effectiveOrder) {
    const values = selections[category];
    if (values?.length) {
      parts.push(...values.map((v) => (isRichPhrase(v) ? simplifyRichPhrase(v, 3) : v)));
    }
  }

  // Trim to sweet spot (typically 40-60 words for Tier 4)
  // SKIPPED when skipTrim is true (Stage 2 Dynamic mode).
  const separator = platformFormat.separator || ', ';
  let trimmed: string[];
  let wasTrimmed = false;

  if (options?.skipTrim) {
    trimmed = parts;
  } else {
    const limit = platformFormat.sweetSpot || 40;
    const result = trimPromptToLimit(parts, selections, limit, separator);
    trimmed = result.trimmed;
    wasTrimmed = result.wasTrimmed;
  }

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
  options?: AssemblyOptions,
): AssembledPrompt {
  let wasTrimmed = false;
  let trimmedPositive = positive;

  // SKIPPED when skipTrim is true (Stage 2 Dynamic mode).
  if (!options?.skipTrim) {
    const limit = platformFormat.sweetSpot || 100;
    const words = positive.split(/\s+/);

    if (words.length > limit) {
      trimmedPositive = words.slice(0, limit).join(' ');
      wasTrimmed = true;
    }
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
// ── Upgrade 3 (v11.1.0): Assembly-Level Deduplication ───────────────────────
//
// When a category has multiple values and one is a case-insensitive substring
// of another LONGER value, the shorter one is redundant. Drop it.
//
// Runs at the assembly entry point so BOTH the generator path
// (selectionsFromMap → assemblePrompt) and the builder UI path
// (UI state → assemblePrompt) get identical dedup. Single canonical assembly.
//
// Example:
//   lighting: ["natural daylight", "Natural daylight, low rolling stratocumulus..."]
//   → ["Natural daylight, low rolling stratocumulus..."]
//
//   composition: ["street photography", "street-level photography"]
//   → both kept ("street photography" ≠ substring of "street-level photography")
// ─────────────────────────────────────────────────────────────────────────────
function deduplicateWithinCategories(selections: PromptSelections): PromptSelections {
  const result: PromptSelections = {};

  for (const [category, values] of Object.entries(selections)) {
    if (!values || values.length <= 1) {
      result[category as PromptCategory] = values;
      continue;
    }

    const kept: string[] = [];
    for (let i = 0; i < values.length; i++) {
      const valLower = values[i]!.toLowerCase();
      let isRedundant = false;

      for (let j = 0; j < values.length; j++) {
        if (i === j) continue;
        const otherLower = values[j]!.toLowerCase();
        // Drop this value if a LONGER value in the same category contains it
        if (otherLower.length > valLower.length && otherLower.includes(valLower)) {
          isRedundant = true;
          break;
        }
      }

      if (!isRedundant) {
        kept.push(values[i]!);
      }
    }

    result[category as PromptCategory] = kept.length > 0 ? kept : values;
  }

  return result;
}

// ── Improvement 1 (v11.1.1): Cross-category deduplication ──────────────────
//
// After within-category dedup, scan ALL categories for exact duplicate terms.
// If the same term (case-insensitive, trimmed) appears in multiple categories,
// keep it only in the FIRST category per the effective output order.
//
// Example: "photorealistic" in style AND lighting → keep only in style (earlier)
// Example: "mysterious" in atmosphere AND mood → keep only in atmosphere (earlier)
//
// Rich phrases (>4 words) are compared as-is. Short terms are normalised.
// This does NOT compare substrings across categories — "street" in composition
// is NOT deduped against "street-level" in a different category.
// ────────────────────────────────────────────────────────────────────────────
function deduplicateAcrossCategories(
  selections: PromptSelections,
  effectiveOrder: PromptCategory[],
): PromptSelections {
  // Track which normalised terms have been claimed by which category
  const claimed = new Map<string, PromptCategory>();
  const result: PromptSelections = {};

  for (const category of effectiveOrder) {
    const values = selections[category];
    if (!values?.length) continue;

    const kept: string[] = [];
    for (const term of values) {
      const norm = term.toLowerCase().trim();
      if (!norm) continue;

      const owner = claimed.get(norm);
      if (owner && owner !== category) {
        // This exact term already appeared in a higher-priority category — skip
        continue;
      }

      claimed.set(norm, category);
      kept.push(term);
    }

    if (kept.length > 0) {
      result[category] = kept;
    }
  }

  // Preserve negative (not part of effective order)
  if (selections.negative?.length) {
    result.negative = [...selections.negative];
  }

  return result;
}

function assembleTierAware(
  platformId: string,
  selections: PromptSelections,
  platformFormat: PlatformFormat,
  weightOverrides?: Partial<Record<PromptCategory, number>>,
  options?: AssemblyOptions,
): AssembledPrompt {
  // Upgrade 3: Deduplicate within each category before assembly.
  // Both the generator and builder UI call assemblePrompt(), so placing
  // dedup here guarantees identical output — Single Canonical Assembly.
  const deduped = deduplicateWithinCategories(selections);

  // Improvement 1: Deduplicate across categories — same term in two
  // categories → keep only in the first one per effective output order.
  const effectiveOrder = getEffectiveOrder(platformFormat);
  const crossDeduped = deduplicateAcrossCategories(deduped, effectiveOrder);

  const tierId: PlatformTierId | undefined = getPlatformTierId(platformId);

  // Improvement 2: Merge weather intelligence weight overrides with platform defaults.
  // Platform's own weightedCategories take precedence; weather fills the rest.
  const mergedFormat = weightOverrides
    ? {
        ...platformFormat,
        weightedCategories: {
          ...(weightOverrides as Record<string, number>),
          ...platformFormat.weightedCategories, // platform wins on conflicts
        },
      }
    : platformFormat;

  // Tier 4: Plain language — short comma lists, no frills
  let result: AssembledPrompt;
  if (tierId === 4) {
    result = assemblePlainLanguage(crossDeduped, mergedFormat, options);
  } else if (mergedFormat.promptStyle === 'keywords') {
    // Keyword-mode platforms: Tier 1 (CLIP), Tier 2 (MJ), and keyword-style
    result = assembleKeywords(crossDeduped, mergedFormat, options);
  } else {
    // Tier 3 and all other natural-language platforms: flowing sentences
    result = assembleNaturalSentences(crossDeduped, mergedFormat, options);
  }

  // Improvement 5: Token estimation — helps users know when they're over CLIP limits.
  // Computed for ALL tiers (useful even for NatLang to show prompt complexity).
  result.estimatedTokens = estimateClipTokens(result.positive);
  result.tokenLimit = mergedFormat.tokenLimit ?? undefined;

  return result;
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
 *
 * @param platformId - Target platform identifier
 * @param selections - User's category selections
 * @param weightOverrides - Optional weather intelligence weight overrides
 * @param options - Assembly options (e.g., skipTrim for Stage 2 Dynamic mode)
 */
export function assemblePrompt(
  platformId: string,
  selections: PromptSelections,
  weightOverrides?: Partial<Record<PromptCategory, number>>,
  options?: AssemblyOptions,
): AssembledPrompt {
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
  return assembleTierAware(platformId, selections, platformFormat, weightOverrides, options);
}

// ============================================================================
// Stage 1: Static Assembly (Raw User Selections)
// ============================================================================
// Produces a literal dump of user selections in CATEGORY_ORDER.
// No reordering, no weights, no quality tags, no sentence connectors,
// no deduplication, no trimming. What you pick is what you get.
//
// Negative handling is minimal but correct:
//   - Separate-field platforms: negatives populate the separate field
//   - Inline-negative platforms (--no): syntax applied for correct parsing
//   - No-support platforms: negatives converted to positive equivalents
//
// This gives power users full control and provides a visible baseline
// for comparison when switching to Dynamic mode.
// ============================================================================

/**
 * Assemble a raw static prompt from user selections.
 * Stage 1 of the 3-stage pipeline: no intelligence, no formatting.
 *
 * @param platformId - Target platform (used only for negative handling)
 * @param selections - User's category selections
 */
export function assembleStatic(
  platformId: string,
  selections: PromptSelections,
): AssembledPrompt {
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

  // Collect all positive selections in canonical CATEGORY_ORDER — raw, no reordering
  const parts: string[] = [];
  for (const category of CATEGORY_ORDER) {
    if (category === 'negative') continue; // handled separately below
    const values = selections[category];
    if (values?.length) {
      parts.push(...values);
    }
  }

  const separator = platformFormat.separator || ', ';
  let positive = parts.join(separator);

  // Handle negatives with minimal platform-correct syntax
  const userNegatives = selections.negative?.filter(Boolean) ?? [];

  if (platformFormat.negativeSupport === 'inline' && platformFormat.negativeSyntax) {
    // Inline platforms (e.g., Midjourney --no): apply syntax so terms actually work
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
    };
  }

  if (platformFormat.negativeSupport === 'separate') {
    // Separate-field platforms: raw negatives go to separate field (no quality negatives)
    return {
      positive,
      negative: userNegatives.length > 0 ? userNegatives.join(', ') : undefined,
      tips: platformFormat.tips,
      supportsNegative: true,
      negativeMode: 'separate',
    };
  }

  // No negative support — convert to "without X" for minimal correctness
  if (userNegatives.length > 0) {
    positive += `${separator}without ${userNegatives.join(' or ')}`;
  }

  return {
    positive,
    negative: undefined,
    tips: platformFormat.tips,
    supportsNegative: false,
    negativeMode: 'none',
  };
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

// ============================================================================
// Exports for unified brain integration (Phase A utilities)
// ============================================================================

export {
  isRichPhrase,
  simplifyRichPhrase,
  sanitiseClipTokens,
  deduplicateWithinCategories,
  deduplicateAcrossCategories,
  estimateClipTokens,
  RICH_PHRASE_THRESHOLD,
  TRIM_PRIORITY_CORE,
  TRIM_PRIORITY_METADATA,
};

// ============================================================================
// Phase C — Unified Brain: Category Map → Prompt Selections
// ============================================================================

import type { WeatherCategoryMap } from '@/types/prompt-builder';

/**
 * Reference platform IDs for each tier — used when the assembler needs a
 * concrete platform to look up format config, but the caller only has a tier.
 *
 * These are the "most representative" platform for each tier's assembly style.
 * The assembler reads token limits, weight syntax, category ordering, and
 * negative handling from the platform format config.
 */
const TIER_REF_PLATFORM: Record<1 | 2 | 3 | 4, string> = {
  1: 'leonardo', // Tier 1 CLIP: representative for weighted keyword stacking
  2: 'midjourney', // Tier 2 MJ: only Midjourney uses :: multi-prompt syntax
  3: 'openai', // Tier 3 NL: representative for natural language sentence flow
  4: 'canva', // Tier 4 Plain: representative for short comma lists
};

/**
 * Convert a tier number (1–4) to a reference platform ID for assembly.
 *
 * The weather generator works with tiers, not specific platforms. When
 * delegating text assembly to `assemblePrompt()`, we need a concrete
 * platform ID to look up format config. This function returns the
 * canonical reference platform for each tier.
 *
 * @param tier - Prompt tier (1–4)
 * @returns Platform ID string (e.g. 'leonardo', 'midjourney', 'openai', 'canva')
 */
export function tierToRefPlatform(tier: 1 | 2 | 3 | 4): string {
  return TIER_REF_PLATFORM[tier] ?? TIER_REF_PLATFORM[3];
}

/**
 * Merge a `WeatherCategoryMap` into `PromptSelections` for `assemblePrompt()`.
 *
 * For each category, the result array contains:
 *   1. All dropdown `selections` (vocabulary-matched terms)
 *   2. The `customValues` rich phrase (if present, appended at end)
 *
 * The assembler already handles rich phrases (>4 words) differently from
 * dropdown terms (Phase A enhancement), so the merge is straightforward.
 *
 * **Upgrade 1 (v11.1.0):** When a customValue *contains* a selection term
 * (case-insensitive substring match), the selection is redundant and is dropped.
 * The customValue is always the richer physics-computed phrase — keeping both
 * produced duplicates like "bright daylight, Bright daylight with passing
 * cumulus cloud shadows" and "street-level documentary, street-level documentary
 * shot". Now only the richer phrase survives.
 *
 * Negative terms are mapped to the 'negative' category key.
 *
 * @param map - Weather category map from `buildWeatherCategoryMap()`
 * @returns PromptSelections ready for `assemblePrompt()`
 */
export function selectionsFromMap(map: WeatherCategoryMap): PromptSelections {
  const result: PromptSelections = {};

  // Merge selections + customValues per category
  const allCategories = new Set([
    ...Object.keys(map.selections ?? {}),
    ...Object.keys(map.customValues ?? {}),
  ]) as Set<PromptCategory>;

  for (const category of allCategories) {
    const selected = map.selections?.[category] ?? [];
    const custom = map.customValues?.[category];
    const customTrimmed = custom?.trim() ?? '';

    // Upgrade 1: When a customValue contains a selection term (case-insensitive),
    // the selection is redundant — the customValue is the richer phrase.
    // Example: selection "moonlight" + customValue "Cool white moonlight competing..."
    //   → drop "moonlight", keep only the rich phrase.
    // But if a selection is NOT contained in the customValue, keep it — it's
    // an independent vocabulary term (e.g. atmosphere: ["contemplative"]).
    let filtered: string[];
    if (customTrimmed) {
      const customLower = customTrimmed.toLowerCase();
      filtered = selected.filter((term) => !customLower.includes(term.toLowerCase()));
    } else {
      filtered = [...selected];
    }

    const merged = [...filtered];
    if (customTrimmed) {
      merged.push(customTrimmed);
    }
    if (merged.length > 0) {
      result[category] = merged;
    }
  }

  // Negative terms → 'negative' category
  if (map.negative && map.negative.length > 0) {
    result.negative = [...map.negative];
  }

  return result;
}
