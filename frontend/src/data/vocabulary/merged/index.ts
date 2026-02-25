/**
 * Merged Vocabulary Layer
 * ========================
 * Curated phrases from weather, commodity, and shared vocabulary audits.
 * These APPEND to core prompt-builder options — core always appears first.
 *
 * 9 categories with merged data. 3 unchanged (camera, fidelity, negative).
 *
 * v1.1.0 — Added getSourceGroupedOptions() for Explore Drawer (Phase 3)
 *
 * @version 1.1.0
 * @updated 2026-02-25
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

// Curated source files — individual source breakdowns for Explore Drawer grouping
import curatedWeatherAtmosphere from './curated-weather-atmosphere.json';
import curatedWeatherEnvironment from './curated-weather-environment.json';
import curatedWeatherLighting from './curated-weather-lighting.json';
import curatedCommodityAction from './curated-commodity-action.json';
import curatedCommodityAtmosphere from './curated-commodity-atmosphere.json';
import curatedCommodityColour from './curated-commodity-colour.json';
import curatedCommodityEnvironment from './curated-commodity-environment.json';
import curatedCommodityLighting from './curated-commodity-lighting.json';
import curatedCommodityMaterials from './curated-commodity-materials.json';
import curatedCommoditySubject from './curated-commodity-subject.json';
import curatedSharedAtmosphere from './curated-shared-atmosphere.json';
import curatedSharedColour from './curated-shared-colour.json';
import curatedSharedComposition from './curated-shared-composition.json';
import curatedSharedLighting from './curated-shared-lighting.json';
import curatedSharedMaterials from './curated-shared-materials.json';
import curatedSharedStyle from './curated-shared-style.json';

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
// SOURCE-GROUPED OPTIONS (Phase 3 — Explore Drawer)
// ============================================================================

export interface SourceGroup {
  source: 'weather' | 'commodity' | 'shared';
  label: string;
  icon: string;
  terms: string[];
  count: number;
}

interface CuratedFile {
  options: string[];
  [key: string]: unknown;
}

/**
 * Map: category → source → curated file.
 * Only categories with curated data are present.
 */
const curatedSourceMap: Partial<
  Record<CategoryKey, Partial<Record<'weather' | 'commodity' | 'shared', CuratedFile>>>
> = {
  action: { commodity: curatedCommodityAction as CuratedFile },
  atmosphere: {
    weather: curatedWeatherAtmosphere as CuratedFile,
    commodity: curatedCommodityAtmosphere as CuratedFile,
    shared: curatedSharedAtmosphere as CuratedFile,
  },
  colour: {
    commodity: curatedCommodityColour as CuratedFile,
    shared: curatedSharedColour as CuratedFile,
  },
  composition: { shared: curatedSharedComposition as CuratedFile },
  environment: {
    weather: curatedWeatherEnvironment as CuratedFile,
    commodity: curatedCommodityEnvironment as CuratedFile,
  },
  lighting: {
    weather: curatedWeatherLighting as CuratedFile,
    commodity: curatedCommodityLighting as CuratedFile,
    shared: curatedSharedLighting as CuratedFile,
  },
  materials: {
    commodity: curatedCommodityMaterials as CuratedFile,
    shared: curatedSharedMaterials as CuratedFile,
  },
  style: { shared: curatedSharedStyle as CuratedFile },
  subject: { commodity: curatedCommoditySubject as CuratedFile },
};

const SOURCE_META: Record<'weather' | 'commodity' | 'shared', { label: string; icon: string }> = {
  weather: { label: 'Weather', icon: '🌤️' },
  commodity: { label: 'Commodity', icon: '📦' },
  shared: { label: 'Shared', icon: '🔗' },
};

/**
 * Get merged terms grouped by source for a category.
 * Returns only groups that have terms. Empty array for categories with no merged data.
 */
export function getSourceGroupedOptions(category: CategoryKey): SourceGroup[] {
  const sourceMap = curatedSourceMap[category];
  if (!sourceMap) return [];

  const groups: SourceGroup[] = [];
  for (const src of ['weather', 'commodity', 'shared'] as const) {
    const file = sourceMap[src];
    if (!file) continue;
    const terms = file.options.filter((t: string) => t !== '');
    if (terms.length > 0) {
      groups.push({
        source: src,
        label: SOURCE_META[src].label,
        icon: SOURCE_META[src].icon,
        terms,
        count: terms.length,
      });
    }
  }
  return groups;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { mergedDataMap };
export default mergedDataMap;
