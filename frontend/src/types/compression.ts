// src/types/compression.ts
// ============================================================================
// COMPRESSION SYSTEM TYPES v2.0.0
// ============================================================================
// TypeScript types for the intelligent prompt compression feature.
// Provides type-safe access to compression dictionary and platform tiers.
//
// NEW in v2.0.0:
// - abbreviations: Platform-tier specific abbreviations (b&w, DoF, HDR, etc.)
// - redundantModifiers: Intensity words to strip (very detailed → detailed)
// - impliedTerms: Terms models assume by default (in focus, high resolution)
// - negativeConsolidation: Consolidate --no terms for MJ family
//
// Security:
// - All types are readonly to prevent runtime mutation
// - Strict typing prevents injection via unexpected fields
// - Validated at build time against JSON schema
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

/**
 * Compression tier based on platform architecture capabilities.
 * 
 * - Tier 1: FULL SHORTHAND (CLIP-based) - Supports weights, tags, all shorthand
 * - Tier 2: MIDJOURNEY FAMILY - MJ-specific weights (::), --ar, --no
 * - Tier 3: NATURAL LANGUAGE + UNIVERSAL - Universal abbrevs only (8K, HDR)
 * - Tier 4: PLAIN LANGUAGE ONLY - Synonyms and filler removal only
 */
export type CompressionTier = 1 | 2 | 3 | 4;

/**
 * Shorthand support level for platforms.
 */
export type ShorthandLevel = 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

/**
 * Categories in the compression dictionary.
 * NEW v2.0.0: abbreviations, redundantModifiers, impliedTerms, negativeConsolidation
 * NEW v2.1.0: progressiveShedding
 */
export type CompressionCategory =
  | 'fillers'
  | 'redundancy'
  | 'universal'
  | 'photography'
  | 'art'
  | 'phrases'
  | 'lighting'
  | 'style'
  | 'quality'
  | 'camera'
  | 'atmosphere'
  | 'environment'
  | 'materials'
  | 'subject'
  | 'action'
  | 'colour'
  | 'negativeToPositive'
  | 'sdWeighted'
  | 'midjourneySpecific'
  | 'booruTags'
  // NEW v2.0.0 categories
  | 'abbreviations'
  | 'redundantModifiers'
  | 'impliedTerms'
  | 'negativeConsolidation'
  // NEW v2.1.0 category
  | 'progressiveShedding';

/**
 * Action type for compression mappings.
 * - 'remove': Delete the match entirely
 * - 'replace': Substitute with a shorter equivalent
 * - 'trim': Reduce excessive modifiers (new in v2.0.0)
 */
export type CompressionAction = 'remove' | 'replace' | 'trim';

/**
 * Single filler term to remove (action: remove).
 */
export interface FillerEntry {
  readonly terms: readonly string[];
}

/**
 * Redundancy pattern (e.g., "red color" → "red").
 */
export interface RedundancyPattern {
  readonly match: string;
  readonly replace: string;
}

/**
 * Standard compression mapping (phrase → shorter).
 */
export interface CompressionMapping {
  readonly [phrase: string]: string;
}

/**
 * Category configuration in the dictionary.
 */
export interface CompressionCategoryConfig {
  readonly description: string;
  readonly action: CompressionAction;
  readonly tier: readonly CompressionTier[];
  readonly count: number;
  readonly note?: string;
}

/**
 * Filler category (special handling - removal only).
 */
export interface FillerCategory extends CompressionCategoryConfig {
  readonly action: 'remove';
  readonly terms: readonly string[];
}

/**
 * Redundancy category (pattern-based replacement).
 */
export interface RedundancyCategory extends CompressionCategoryConfig {
  readonly action: 'replace';
  readonly patterns: readonly RedundancyPattern[];
}

/**
 * Standard mapping category.
 */
export interface MappingCategory extends CompressionCategoryConfig {
  readonly action: 'replace';
  readonly mappings: CompressionMapping;
}

/**
 * Tier-specific abbreviations category (NEW v2.0.0).
 * Different tiers support different abbreviations.
 */
export interface AbbreviationsCategory {
  readonly description: string;
  readonly action: 'replace';
  readonly note?: string;
  readonly tier1: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly mappings: CompressionMapping;
  };
  readonly tier2: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly mappings: CompressionMapping;
  };
  readonly tier3: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly note?: string;
    readonly mappings: CompressionMapping;
  };
  readonly tier4: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly note?: string;
    readonly mappings: CompressionMapping;
  };
}

/**
 * Redundant modifiers category (NEW v2.0.0).
 * Pattern-based replacement for intensity words.
 */
export interface RedundantModifiersCategory {
  readonly description: string;
  readonly action: 'replace';
  readonly tier: readonly CompressionTier[];
  readonly note?: string;
  readonly count: number;
  readonly patterns: readonly RedundancyPattern[];
}

/**
 * Implied terms category (NEW v2.0.0).
 * Tier-specific terms that models assume by default.
 */
export interface ImpliedTermsCategory {
  readonly description: string;
  readonly action: 'remove';
  readonly note?: string;
  readonly tier1and2: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly terms: readonly string[];
    readonly exceptions: readonly string[];
  };
  readonly tier3and4: {
    readonly description: string;
    readonly platforms: readonly string[];
    readonly count: number;
    readonly note?: string;
    readonly terms: readonly string[];
    readonly exceptions: readonly string[];
  };
}

/**
 * Negative consolidation category (NEW v2.0.0).
 * Consolidate multiple --no terms for Midjourney family.
 */
export interface NegativeConsolidationCategory {
  readonly description: string;
  readonly action: 'replace';
  readonly tier: readonly CompressionTier[];
  readonly platforms: readonly string[];
  readonly count: number;
  readonly note?: string;
  readonly patterns: readonly RedundancyPattern[];
}

/**
 * Progressive shedding pattern configuration (NEW v2.1.0).
 */
export interface ProgressiveSheddingPattern {
  readonly type: 'triple_adjective' | 'mixed_priority' | 'all_low';
  readonly keep: 'last_high_value' | 'high_value_only' | 'most_specific_or_none';
}

/**
 * Progressive shedding category (NEW v2.1.0).
 * Removes low-value adjectives when multiple modifiers present.
 * Keeps most specific/impactful words (colors, materials, textures).
 */
export interface ProgressiveSheddingCategory {
  readonly description: string;
  readonly action: 'trim';
  readonly tier: readonly CompressionTier[];
  readonly note?: string;
  readonly maxAdjectivesPerPhrase: number;
  readonly lowValueAdjectives: readonly string[];
  readonly highValueAdjectives: readonly string[];
  readonly patterns: readonly ProgressiveSheddingPattern[];
}

/**
 * Full compression dictionary structure.
 */
export interface CompressionDictionary {
  readonly $schema?: string;
  readonly version: string;
  readonly lastUpdated: string;
  readonly totalMappings: number;
  readonly meta?: {
    readonly description?: string;
    readonly authorityDoc?: string;
    readonly researchSources?: readonly string[];
  };

  // Special categories
  readonly fillers: FillerCategory;
  readonly redundancy: RedundancyCategory;

  // Mapping categories
  readonly universal: MappingCategory;
  readonly photography: MappingCategory;
  readonly art: MappingCategory;
  readonly phrases: MappingCategory;
  readonly lighting: MappingCategory;
  readonly style: MappingCategory;
  readonly quality: MappingCategory;
  readonly camera: MappingCategory;
  readonly atmosphere: MappingCategory;
  readonly environment: MappingCategory;
  readonly materials: MappingCategory;
  readonly subject: MappingCategory;
  readonly action: MappingCategory;
  readonly colour: MappingCategory;

  // Platform-specific categories
  readonly negativeToPositive: MappingCategory;
  readonly sdWeighted: MappingCategory;
  readonly midjourneySpecific: MappingCategory;
  readonly booruTags: MappingCategory;

  // NEW v2.0.0 categories
  readonly abbreviations: AbbreviationsCategory;
  readonly redundantModifiers: RedundantModifiersCategory;
  readonly impliedTerms: ImpliedTermsCategory;
  readonly negativeConsolidation: NegativeConsolidationCategory;

  // NEW v2.1.0 category
  readonly progressiveShedding: ProgressiveSheddingCategory;
}

// ============================================================================
// PLATFORM SUPPORT TYPES
// ============================================================================

/**
 * Platform-specific configuration.
 */
export interface PlatformConfig {
  readonly tier: CompressionTier;
  readonly architecture: string;
  readonly shorthandLevel: ShorthandLevel;
  readonly negativeSupport: 'none' | 'separate' | 'inline';
  readonly negativeSyntax?: string;
  readonly tokenLimit?: number;
  readonly weightSyntax?: string;
  readonly notes?: string;
}

/**
 * Tier configuration with syntax features.
 */
export interface TierConfig {
  readonly name: string;
  readonly description: string;
  readonly architecture: string;
  readonly shorthandLevel: ShorthandLevel;
  readonly supports: readonly CompressionCategory[];
  readonly syntaxFeatures: {
    readonly weightBrackets: boolean;
    readonly weightSyntax: string | false;
    readonly negativeWeights: string | false;
    readonly tagFormat: 'comma-separated' | 'natural-language';
    readonly supportsNegativePrompt: boolean | 'varies';
    readonly negativeField: 'separate' | 'inline' | 'none' | 'varies';
    readonly negativeSyntax?: string;
  };
  readonly notSupported?: readonly CompressionCategory[];
  readonly platforms: readonly string[];
}

/**
 * Platform support matrix structure.
 */
export interface PlatformSupportMatrix {
  readonly $schema?: string;
  readonly version: string;
  readonly lastUpdated: string;
  readonly meta?: {
    readonly description?: string;
    readonly totalPlatforms?: number;
    readonly authorityDoc?: string;
  };
  readonly tiers: {
    readonly '1': TierConfig;
    readonly '2': TierConfig;
    readonly '3': TierConfig;
    readonly '4': TierConfig;
  };
  readonly platforms: {
    readonly [platformId: string]: PlatformConfig;
  };
  readonly compressionStrategies?: {
    readonly [tierKey: string]: {
      readonly order: readonly CompressionCategory[];
      readonly targetRange?: string;
      readonly weightSyntax?: string | null;
      readonly negativeHandling?: string;
    };
  };
}

// ============================================================================
// COMPRESSION RESULT TYPES
// ============================================================================

/**
 * Result from a single compression pass.
 */
export interface CompressionPassResult {
  readonly category: CompressionCategory | string;
  readonly matchesFound: number;
  readonly charsSaved: number;
  readonly replacements: readonly {
    readonly original: string;
    readonly replacement: string;
  }[];
}

/**
 * Full compression result with metrics.
 */
export interface CompressionResult {
  /** Original input prompt */
  readonly original: string;

  /** Compressed output prompt */
  readonly compressed: string;

  /** Original character count */
  readonly originalLength: number;

  /** Compressed character count */
  readonly compressedLength: number;

  /** Characters saved */
  readonly charsSaved: number;

  /** Compression ratio (compressed / original) */
  readonly compressionRatio: number;

  /** Percentage saved */
  readonly percentSaved: number;

  /** Platform tier used */
  readonly tier: CompressionTier;

  /** Platform ID used */
  readonly platformId: string;

  /** Whether target length was achieved */
  readonly targetAchieved: boolean;

  /** Target length (if specified) */
  readonly targetLength: number;

  /** Individual pass results */
  readonly passes: readonly CompressionPassResult[];

  /** Total replacements made */
  readonly totalReplacements: number;

  /** Processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * Compression analysis result (for UI display).
 */
export interface CompressionAnalysis {
  /** Platform tier */
  readonly tier: CompressionTier;

  /** Tier name (e.g., "Full Shorthand") */
  readonly tierName: string;

  /** Supported categories for this tier */
  readonly supportedCategories: readonly CompressionCategory[];

  /** Platform-specific notes */
  readonly platformNotes: string | null;

  /** Estimated savings percentage */
  readonly estimatedSavings: string;

  /** Recommended compression level */
  readonly recommendedLevel: 'light' | 'moderate' | 'aggressive';
}

// ============================================================================
// COMPRESSION OPTIONS
// ============================================================================

/**
 * Options for compression operations.
 */
export interface CompressionOptions {
  /** Target length to achieve (optional) */
  targetLength?: number;

  /** Categories to skip */
  skipCategories?: CompressionCategory[];

  /** Apply SD weight syntax conversion */
  applyWeights?: boolean;

  /** Apply Midjourney-specific syntax */
  applyMJSyntax?: boolean;

  /** Apply booru tag conversion */
  applyBooruTags?: boolean;

  /** Convert negatives to positive equivalents */
  convertNegatives?: boolean;

  /** NEW v2.0.0: Apply abbreviations */
  applyAbbreviations?: boolean;

  /** NEW v2.0.0: Strip redundant modifiers */
  stripRedundantModifiers?: boolean;

  /** NEW v2.0.0: Remove implied terms */
  removeImpliedTerms?: boolean;

  /** NEW v2.0.0: Consolidate negatives (MJ family) */
  consolidateNegatives?: boolean;

  /** NEW v2.1.0: Apply progressive word shedding */
  applyProgressiveShedding?: boolean;

  /** Enable aggressive mode (more aggressive shortening) */
  aggressive?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default compression options.
 */
export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  applyWeights: false,
  applyMJSyntax: false,
  applyBooruTags: false,
  convertNegatives: true,
  applyAbbreviations: true, // NEW v2.0.0: Enabled by default
  stripRedundantModifiers: true, // NEW v2.0.0: Enabled by default
  removeImpliedTerms: true, // NEW v2.0.0: Enabled by default
  consolidateNegatives: true, // NEW v2.0.0: Enabled by default
  applyProgressiveShedding: true, // NEW v2.1.0: Enabled by default
  aggressive: false,
};

/**
 * Compression category application order.
 * Order matters: early passes can affect later ones.
 * NEW v2.0.0: Added abbreviations, redundantModifiers, impliedTerms, negativeConsolidation
 * NEW v2.1.0: Added progressiveShedding
 */
export const COMPRESSION_ORDER: readonly CompressionCategory[] = [
  // Phase 1: Remove zero-value content
  'fillers',
  'redundantModifiers', // NEW v2.0.0
  'impliedTerms', // NEW v2.0.0
  'progressiveShedding', // NEW v2.1.0

  // Phase 2: Pattern-based replacements
  'redundancy',
  'abbreviations', // NEW v2.0.0

  // Phase 3: Category-specific shorthand
  'phrases',
  'universal',
  'photography',
  'art',
  'lighting',
  'style',
  'quality',
  'camera',
  'atmosphere',
  'environment',
  'materials',
  'subject',
  'action',
  'colour',

  // Phase 4: Platform-specific
  'negativeToPositive',
  'negativeConsolidation', // NEW v2.0.0
  'sdWeighted',
  'midjourneySpecific',
  'booruTags',
] as const;

/**
 * Tier display names.
 */
export const TIER_NAMES: Record<CompressionTier, string> = {
  1: 'Full Shorthand (CLIP-based)',
  2: 'Midjourney Family',
  3: 'Natural Language + Universal',
  4: 'Plain Language Only',
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CompressionTier.
 */
export function isValidCompressionTier(value: unknown): value is CompressionTier {
  return typeof value === 'number' && [1, 2, 3, 4].includes(value);
}

/**
 * Type guard for CompressionCategory.
 */
export function isValidCompressionCategory(value: unknown): value is CompressionCategory {
  const validCategories: readonly string[] = COMPRESSION_ORDER;
  return typeof value === 'string' && validCategories.includes(value);
}

/**
 * Type guard for FillerCategory.
 */
export function isFillerCategory(category: unknown): category is FillerCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as FillerCategory).action === 'remove' &&
    'terms' in category &&
    Array.isArray((category as FillerCategory).terms)
  );
}

/**
 * Type guard for RedundancyCategory.
 */
export function isRedundancyCategory(category: unknown): category is RedundancyCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as RedundancyCategory).action === 'replace' &&
    'patterns' in category &&
    Array.isArray((category as RedundancyCategory).patterns)
  );
}

/**
 * Type guard for MappingCategory.
 */
export function isMappingCategory(category: unknown): category is MappingCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as MappingCategory).action === 'replace' &&
    'mappings' in category &&
    typeof (category as MappingCategory).mappings === 'object'
  );
}

/**
 * Type guard for AbbreviationsCategory (NEW v2.0.0).
 */
export function isAbbreviationsCategory(category: unknown): category is AbbreviationsCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'tier1' in category &&
    'tier2' in category &&
    'tier3' in category &&
    'tier4' in category
  );
}

/**
 * Type guard for RedundantModifiersCategory (NEW v2.0.0).
 */
export function isRedundantModifiersCategory(
  category: unknown,
): category is RedundantModifiersCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as RedundantModifiersCategory).action === 'replace' &&
    'patterns' in category &&
    'tier' in category
  );
}

/**
 * Type guard for ImpliedTermsCategory (NEW v2.0.0).
 */
export function isImpliedTermsCategory(category: unknown): category is ImpliedTermsCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as ImpliedTermsCategory).action === 'remove' &&
    'tier1and2' in category &&
    'tier3and4' in category
  );
}

/**
 * Type guard for NegativeConsolidationCategory (NEW v2.0.0).
 */
export function isNegativeConsolidationCategory(
  category: unknown,
): category is NegativeConsolidationCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as NegativeConsolidationCategory).action === 'replace' &&
    'patterns' in category &&
    'platforms' in category
  );
}

/**
 * Type guard for ProgressiveSheddingCategory (NEW v2.1.0).
 */
export function isProgressiveSheddingCategory(
  category: unknown,
): category is ProgressiveSheddingCategory {
  return (
    typeof category === 'object' &&
    category !== null &&
    'action' in category &&
    (category as ProgressiveSheddingCategory).action === 'trim' &&
    'lowValueAdjectives' in category &&
    'highValueAdjectives' in category &&
    'maxAdjectivesPerPhrase' in category
  );
}

// ============================================================================
// All types exported inline via 'export interface/type' declarations above.
// ============================================================================
