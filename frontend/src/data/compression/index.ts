// src/data/compression/index.ts
// ============================================================================
// COMPRESSION DATA EXPORTS v2.1.0
// ============================================================================
// Centralized exports for compression dictionary and platform support matrix.
//
// NEW in v2.0.0:
// - abbreviations: Tier-specific abbreviation mappings
// - redundantModifiers: Pattern-based intensity modifier stripping
// - impliedTerms: Tier-specific implied term removal
// - negativeConsolidation: MJ family negative consolidation
//
// NEW in v2.1.0:
// - progressiveShedding: Remove low-value adjectives when multiple present
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import compressionDictionaryData from './compression-dictionary.json';
import platformSupportData from './platform-support.json';

import type {
  CompressionDictionary,
  PlatformSupportMatrix,
  CompressionTier,
  PlatformConfig,
  TierConfig,
  MappingCategory,
  AbbreviationsCategory,
  RedundantModifiersCategory,
  ImpliedTermsCategory,
  NegativeConsolidationCategory,
  ProgressiveSheddingCategory,
} from '@/types/compression';

// Type assertions
export const compressionDictionary = compressionDictionaryData as unknown as CompressionDictionary;
export const platformSupport = platformSupportData as unknown as PlatformSupportMatrix;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get total mapping count from dictionary.
 */
export function getTotalMappings(): number {
  return compressionDictionary.totalMappings;
}

/**
 * Get dictionary version.
 */
export function getDictionaryVersion(): string {
  return compressionDictionary.version;
}

/**
 * Get platform support version.
 */
export function getPlatformSupportVersion(): string {
  return platformSupport.version;
}

/**
 * Get all platform IDs.
 */
export function getAllPlatformIds(): string[] {
  return Object.keys(platformSupport.platforms);
}

/**
 * Get platforms by tier.
 */
export function getPlatformsByTier(tier: CompressionTier): string[] {
  return Object.entries(platformSupport.platforms)
    .filter(([, config]) => config.tier === tier)
    .map(([id]) => id);
}

/**
 * Get tier configuration.
 */
export function getTierConfig(tier: CompressionTier): TierConfig {
  const tierKey = String(tier) as '1' | '2' | '3' | '4';
  return platformSupport.tiers[tierKey];
}

/**
 * Get platform configuration.
 */
export function getPlatformConfiguration(platformId: string): PlatformConfig | undefined {
  const normalizedId = platformId.toLowerCase().trim();
  return platformSupport.platforms[normalizedId];
}

/**
 * Get category count for a specific category.
 */
export function getCategoryCount(categoryName: keyof CompressionDictionary): number {
  const cat = compressionDictionary[categoryName];
  // Type guard: check if cat is an object with a count property
  if (cat && typeof cat === 'object' && 'count' in cat) {
    const catWithCount = cat as MappingCategory;
    return catWithCount.count;
  }
  return 0;
}

/**
 * Get all filler terms.
 */
export function getFillerTerms(): readonly string[] {
  return compressionDictionary.fillers.terms;
}

/**
 * Get all redundancy patterns.
 */
export function getRedundancyPatterns(): readonly { match: string; replace: string }[] {
  return compressionDictionary.redundancy.patterns;
}

// ============================================================================
// NEW v2.0.0: ABBREVIATION FUNCTIONS
// ============================================================================

/**
 * Get abbreviation mappings for a specific tier.
 */
export function getAbbreviationsForTier(tier: CompressionTier): Record<string, string> {
  const abbrevs = compressionDictionary.abbreviations as AbbreviationsCategory;
  if (!abbrevs) return {};

  switch (tier) {
    case 1:
      return { ...(abbrevs.tier1?.mappings ?? {}) };
    case 2:
      return { ...(abbrevs.tier2?.mappings ?? {}) };
    case 3:
      return { ...(abbrevs.tier3?.mappings ?? {}) };
    case 4:
      return { ...(abbrevs.tier4?.mappings ?? {}) };
    default:
      return {};
  }
}

/**
 * Get abbreviation count for a tier.
 */
export function getAbbreviationCount(tier: CompressionTier): number {
  const abbrevs = compressionDictionary.abbreviations as AbbreviationsCategory;
  if (!abbrevs) return 0;

  switch (tier) {
    case 1:
      return abbrevs.tier1?.count ?? 0;
    case 2:
      return abbrevs.tier2?.count ?? 0;
    case 3:
      return abbrevs.tier3?.count ?? 0;
    case 4:
      return abbrevs.tier4?.count ?? 0;
    default:
      return 0;
  }
}

// ============================================================================
// NEW v2.0.0: REDUNDANT MODIFIERS FUNCTIONS
// ============================================================================

/**
 * Get redundant modifier patterns.
 */
export function getRedundantModifierPatterns(): readonly { match: string; replace: string }[] {
  const modifiers = compressionDictionary.redundantModifiers as RedundantModifiersCategory;
  return modifiers?.patterns ?? [];
}

/**
 * Get redundant modifier count.
 */
export function getRedundantModifierCount(): number {
  const modifiers = compressionDictionary.redundantModifiers as RedundantModifiersCategory;
  return modifiers?.count ?? 0;
}

// ============================================================================
// NEW v2.0.0: IMPLIED TERMS FUNCTIONS
// ============================================================================

/**
 * Get implied terms for a tier group.
 */
export function getImpliedTermsForTier(tier: CompressionTier): {
  terms: readonly string[];
  exceptions: readonly string[];
} {
  const implied = compressionDictionary.impliedTerms as ImpliedTermsCategory;
  if (!implied) return { terms: [], exceptions: [] };

  if (tier === 1 || tier === 2) {
    return {
      terms: implied.tier1and2?.terms ?? [],
      exceptions: implied.tier1and2?.exceptions ?? [],
    };
  }

  return {
    terms: implied.tier3and4?.terms ?? [],
    exceptions: implied.tier3and4?.exceptions ?? [],
  };
}

/**
 * Get implied term count for a tier group.
 */
export function getImpliedTermCount(tier: CompressionTier): number {
  const implied = compressionDictionary.impliedTerms as ImpliedTermsCategory;
  if (!implied) return 0;

  if (tier === 1 || tier === 2) {
    return implied.tier1and2?.count ?? 0;
  }

  return implied.tier3and4?.count ?? 0;
}

// ============================================================================
// NEW v2.0.0: NEGATIVE CONSOLIDATION FUNCTIONS
// ============================================================================

/**
 * Get negative consolidation patterns.
 * Only applicable for Midjourney family (tier 2).
 */
export function getNegativeConsolidationPatterns(): readonly { match: string; replace: string }[] {
  const consolidation = compressionDictionary.negativeConsolidation as NegativeConsolidationCategory;
  return consolidation?.patterns ?? [];
}

/**
 * Check if platform supports negative consolidation.
 */
export function supportsNegativeConsolidation(platformId: string): boolean {
  const config = getPlatformConfiguration(platformId);
  if (!config) return false;

  const consolidation = compressionDictionary.negativeConsolidation as NegativeConsolidationCategory;
  if (!consolidation?.platforms) return false;

  return consolidation.platforms.includes(platformId.toLowerCase());
}

// ============================================================================
// NEW v2.1.0: PROGRESSIVE SHEDDING FUNCTIONS
// ============================================================================

/**
 * Get low-value adjectives list.
 */
export function getLowValueAdjectives(): readonly string[] {
  const shedding = compressionDictionary.progressiveShedding as ProgressiveSheddingCategory;
  return shedding?.lowValueAdjectives ?? [];
}

/**
 * Get high-value adjectives list.
 */
export function getHighValueAdjectives(): readonly string[] {
  const shedding = compressionDictionary.progressiveShedding as ProgressiveSheddingCategory;
  return shedding?.highValueAdjectives ?? [];
}

/**
 * Get max adjectives per phrase limit.
 */
export function getMaxAdjectivesPerPhrase(): number {
  const shedding = compressionDictionary.progressiveShedding as ProgressiveSheddingCategory;
  return shedding?.maxAdjectivesPerPhrase ?? 2;
}

/**
 * Check if a word is a low-value adjective.
 */
export function isLowValueAdjective(word: string): boolean {
  const lowValue = getLowValueAdjectives();
  return lowValue.includes(word.toLowerCase());
}

/**
 * Check if a word is a high-value adjective.
 */
export function isHighValueAdjective(word: string): boolean {
  const highValue = getHighValueAdjectives();
  return highValue.includes(word.toLowerCase());
}

// ============================================================================
// SHORTHAND LEVEL FUNCTIONS
// ============================================================================

/**
 * Check if a platform supports a specific shorthand level.
 */
export function hasShorthandLevel(
  platformId: string,
  minLevel: 'FULL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL',
): boolean {
  const config = getPlatformConfiguration(platformId);
  if (!config) return false;

  const levels = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH', 'FULL'];
  const platformLevelIndex = levels.indexOf(config.shorthandLevel);
  const minLevelIndex = levels.indexOf(minLevel);

  return platformLevelIndex >= minLevelIndex;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get compression statistics.
 */
export function getCompressionStats(): {
  totalMappings: number;
  categories: number;
  platforms: number;
  tiers: number;
  fillerTerms: number;
  redundancyPatterns: number;
  abbreviationsTier1: number;
  abbreviationsTier2: number;
  abbreviationsTier3: number;
  abbreviationsTier4: number;
  redundantModifiers: number;
  impliedTermsTier1and2: number;
  impliedTermsTier3and4: number;
  negativeConsolidation: number;
  lowValueAdjectives: number;
  highValueAdjectives: number;
} {
  return {
    totalMappings: compressionDictionary.totalMappings,
    categories: 25, // Updated: 20 + 4 v2.0.0 + 1 v2.1.0
    platforms: Object.keys(platformSupport.platforms).length,
    tiers: 4,
    fillerTerms: compressionDictionary.fillers.terms.length,
    redundancyPatterns: compressionDictionary.redundancy.patterns.length,
    abbreviationsTier1: getAbbreviationCount(1),
    abbreviationsTier2: getAbbreviationCount(2),
    abbreviationsTier3: getAbbreviationCount(3),
    abbreviationsTier4: getAbbreviationCount(4),
    redundantModifiers: getRedundantModifierCount(),
    impliedTermsTier1and2: getImpliedTermCount(1),
    impliedTermsTier3and4: getImpliedTermCount(3),
    negativeConsolidation: getNegativeConsolidationPatterns().length,
    lowValueAdjectives: getLowValueAdjectives().length,
    highValueAdjectives: getHighValueAdjectives().length,
  };
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export default {
  dictionary: compressionDictionary,
  platforms: platformSupport,
};
