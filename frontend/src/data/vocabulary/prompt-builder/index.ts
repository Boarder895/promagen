/**
 * Prompt Builder Vocabulary Layer
 * ================================
 * Centralized vocabulary for AI prompt generation.
 * 
 * 12 categories × 300 options each = 3,600 total terms
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

// Import all vocabulary JSON files
import subjectData from './subject.json';
import actionData from './action.json';
import styleData from './style.json';
import environmentData from './environment.json';
import compositionData from './composition.json';
import cameraData from './camera.json';
import lightingData from './lighting.json';
import atmosphereData from './atmosphere.json';
import colourData from './colour.json';
import materialsData from './materials.json';
import fidelityData from './fidelity.json';
import negativeData from './negative.json';

// ============================================================================
// TYPES
// ============================================================================

export interface VocabularyCategory {
  meta: {
    domain: string;
    category: string;
    label: string;
    description: string;
    tooltipGuidance: string;
    totalOptions: number;
    updated: string;
  };
  options: string[];
  subcategories: Record<string, string[]>;
}

export interface PromptBuilderVocabulary {
  subject: VocabularyCategory;
  action: VocabularyCategory;
  style: VocabularyCategory;
  environment: VocabularyCategory;
  composition: VocabularyCategory;
  camera: VocabularyCategory;
  lighting: VocabularyCategory;
  atmosphere: VocabularyCategory;
  colour: VocabularyCategory;
  materials: VocabularyCategory;
  fidelity: VocabularyCategory;
  negative: VocabularyCategory;
}

export type CategoryKey = keyof PromptBuilderVocabulary;

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  description: string;
  tooltipGuidance: string;
  totalOptions: number;
}

// ============================================================================
// VOCABULARY DATA
// ============================================================================

export const vocabulary: PromptBuilderVocabulary = {
  subject: subjectData as VocabularyCategory,
  action: actionData as VocabularyCategory,
  style: styleData as VocabularyCategory,
  environment: environmentData as VocabularyCategory,
  composition: compositionData as VocabularyCategory,
  camera: cameraData as VocabularyCategory,
  lighting: lightingData as VocabularyCategory,
  atmosphere: atmosphereData as VocabularyCategory,
  colour: colourData as VocabularyCategory,
  materials: materialsData as VocabularyCategory,
  fidelity: fidelityData as VocabularyCategory,
  negative: negativeData as VocabularyCategory,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all options for a category (excludes empty string)
 */
export function getOptions(category: CategoryKey): string[] {
  return vocabulary[category].options.filter((opt) => opt !== '');
}

/**
 * Get options count for a category
 */
export function getOptionsCount(category: CategoryKey): number {
  return getOptions(category).length;
}

/**
 * Get random option from a category
 */
export function getRandomOption(category: CategoryKey, seed?: number): string {
  const options = getOptions(category);
  if (options.length === 0) return '';
  const index = seed !== undefined 
    ? Math.abs(seed) % options.length 
    : Math.floor(Math.random() * options.length);
  return options[index] ?? '';
}

/**
 * Get multiple random options from a category (no duplicates)
 */
export function getRandomOptions(
  category: CategoryKey, 
  count: number, 
  seed?: number
): string[] {
  const options = getOptions(category);
  const result: string[] = [];
  const usedIndices = new Set<number>();
  
  let currentSeed = seed ?? Math.floor(Math.random() * 1000000);
  
  while (result.length < count && result.length < options.length) {
    const index = Math.abs(currentSeed) % options.length;
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      const opt = options[index];
      if (opt) result.push(opt);
    }
    currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648; // LCG
  }
  
  return result;
}

/**
 * Get subcategory options
 */
export function getSubcategoryOptions(
  category: CategoryKey,
  subcategory: string
): string[] {
  return vocabulary[category].subcategories[subcategory] || [];
}

/**
 * Get all subcategory names for a category
 */
export function getSubcategories(category: CategoryKey): string[] {
  return Object.keys(vocabulary[category].subcategories);
}

/**
 * Search options across all categories
 */
export function searchOptions(query: string): Array<{
  category: CategoryKey;
  option: string;
}> {
  const results: Array<{ category: CategoryKey; option: string }> = [];
  const lowerQuery = query.toLowerCase();
  
  for (const [key, data] of Object.entries(vocabulary)) {
    for (const option of data.options) {
      if (option && option.toLowerCase().includes(lowerQuery)) {
        results.push({ category: key as CategoryKey, option });
      }
    }
  }
  
  return results;
}

/**
 * Get category metadata
 */
export function getCategoryMeta(category: CategoryKey): CategoryMeta {
  const meta = vocabulary[category].meta;
  return {
    key: category,
    label: meta.label,
    description: meta.description,
    tooltipGuidance: meta.tooltipGuidance,
    totalOptions: meta.totalOptions,
  };
}

/**
 * Get all category metadata
 */
export function getAllCategoryMeta(): CategoryMeta[] {
  return (Object.keys(vocabulary) as CategoryKey[]).map(getCategoryMeta);
}

/**
 * Get vocabulary statistics
 */
export function getVocabularyStats(): {
  totalCategories: number;
  totalOptions: number;
  categoryCounts: Record<CategoryKey, number>;
} {
  const categoryCounts = {} as Record<CategoryKey, number>;
  let totalOptions = 0;
  
  for (const key of Object.keys(vocabulary) as CategoryKey[]) {
    const count = getOptionsCount(key);
    categoryCounts[key] = count;
    totalOptions += count;
  }
  
  return {
    totalCategories: Object.keys(vocabulary).length,
    totalOptions,
    categoryCounts,
  };
}

// ============================================================================
// PROMPT GENERATION UTILITIES
// ============================================================================

export interface PromptSelections {
  subject?: string;
  action?: string;
  style?: string;
  environment?: string;
  composition?: string;
  camera?: string;
  lighting?: string;
  atmosphere?: string;
  colour?: string;
  materials?: string;
  fidelity?: string;
  negative?: string[];
}

/**
 * Build a positive prompt from selections
 */
export function buildPositivePrompt(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Order matters for prompt effectiveness
  const order: (keyof Omit<PromptSelections, 'negative'>)[] = [
    'subject',
    'action',
    'environment',
    'style',
    'composition',
    'camera',
    'lighting',
    'atmosphere',
    'colour',
    'materials',
    'fidelity',
  ];
  
  for (const key of order) {
    const value = selections[key];
    if (value && typeof value === 'string' && value.trim()) {
      parts.push(value.trim());
    }
  }
  
  return parts.join(', ');
}

/**
 * Build a negative prompt from selections
 */
export function buildNegativePrompt(negatives: string[]): string {
  return negatives.filter((n) => n && n.trim()).join(', ');
}

/**
 * Generate random prompt with specified categories
 */
export function generateRandomPrompt(
  categories: CategoryKey[] = ['subject', 'style', 'lighting', 'fidelity'],
  seed?: number
): PromptSelections {
  const selections: PromptSelections = {};
  let currentSeed = seed ?? Math.floor(Math.random() * 1000000);
  
  for (const category of categories) {
    if (category === 'negative') {
      selections.negative = getRandomOptions('negative', 3, currentSeed);
    } else {
      (selections as Record<string, string>)[category] = getRandomOption(
        category,
        currentSeed
      );
    }
    currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
  }
  
  return selections;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Default export: full vocabulary object
export default vocabulary;

// Named exports for direct category access
export {
  subjectData as subjectVocabulary,
  actionData as actionVocabulary,
  styleData as styleVocabulary,
  environmentData as environmentVocabulary,
  compositionData as compositionVocabulary,
  cameraData as cameraVocabulary,
  lightingData as lightingVocabulary,
  atmosphereData as atmosphereVocabulary,
  colourData as colourVocabulary,
  materialsData as materialsVocabulary,
  fidelityData as fidelityVocabulary,
  negativeData as negativeVocabulary,
};
