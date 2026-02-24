/**
 * Merged Vocabulary Layer
 * ========================
 * Curated phrases from weather, commodity, and shared vocabulary audits.
 * These APPEND to core prompt-builder options — core always appears first.
 *
 * 9 categories with merged data. 3 unchanged (camera, fidelity, negative).
 *
 * @version 1.0.0
 * @updated 2026-02-24
 */

import type { CategoryKey } from '@/data/vocabulary/prompt-builder';

import actionMerged from './action-merged.json';
import atmosphereMerged from './atmosphere-merged.json';
import colourMerged from './colour-merged.json';
import compositionMerged from './composition-merged.json';
import environmentMerged from './environment-merged.json';
import lightingMerged from './lighting-merged.json';
import materialsMerged from './materials-merged.json';
import styleMerged from './style-merged.json';
import subjectMerged from './subject-merged.json';

// ============================================================================
// TYPES
// ============================================================================

interface MergedVocabularyFile {
  $schema: string;
  version: string;
  meta: {
    domain: string;
    category: string;
    label: string;
    description: string;
    totalOptions: number;
    sources: Array<{ source: string; rawCount: number }>;
    updated: string;
  };
  options: string[];
}

// ============================================================================
// MERGED DATA MAP
// ============================================================================

/**
 * Map of category → merged data.
 * Categories without merged data (camera, fidelity, negative) are absent.
 */
const mergedDataMap: Partial<Record<CategoryKey, MergedVocabularyFile>> = {
  action: actionMerged as MergedVocabularyFile,
  atmosphere: atmosphereMerged as MergedVocabularyFile,
  colour: colourMerged as MergedVocabularyFile,
  composition: compositionMerged as MergedVocabularyFile,
  environment: environmentMerged as MergedVocabularyFile,
  lighting: lightingMerged as MergedVocabularyFile,
  materials: materialsMerged as MergedVocabularyFile,
  style: styleMerged as MergedVocabularyFile,
  subject: subjectMerged as MergedVocabularyFile,
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get merged options for a category.
 * Returns [] for categories without merged data (camera, fidelity, negative).
 */
export function getMergedOptions(category: CategoryKey): string[] {
  const data = mergedDataMap[category];
  if (!data) return [];
  return data.options.filter((opt) => opt !== '');
}

/**
 * Get merged option count for a category.
 */
export function getMergedCount(category: CategoryKey): number {
  return getMergedOptions(category).length;
}

/**
 * Check if a category has merged data.
 */
export function hasMergedData(category: CategoryKey): boolean {
  return category in mergedDataMap;
}

/**
 * Get all categories that have merged data.
 */
export function getMergedCategories(): CategoryKey[] {
  return Object.keys(mergedDataMap) as CategoryKey[];
}

/**
 * Get merged vocabulary stats.
 */
export function getMergedStats(): {
  totalMergedPhrases: number;
  mergedCategories: number;
  perCategory: Partial<Record<CategoryKey, number>>;
} {
  const perCategory: Partial<Record<CategoryKey, number>> = {};
  let total = 0;

  for (const [cat, data] of Object.entries(mergedDataMap)) {
    const count = data?.options.filter((o) => o !== '').length ?? 0;
    perCategory[cat as CategoryKey] = count;
    total += count;
  }

  return {
    totalMergedPhrases: total,
    mergedCategories: Object.keys(mergedDataMap).length,
    perCategory,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { mergedDataMap };
export default mergedDataMap;
