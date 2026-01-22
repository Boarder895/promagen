/**
 * Intelligence Layer
 * ==================
 * Cross-cutting intelligence data for smart prompt generation.
 * 
 * - conflicts.json: 85 conflict groups for incompatible terms
 * - families.json: 45 style families with related members
 * - semantic-tags.json: 180 categorization tags
 * - market-moods.json: 60 market-to-mood mappings (Promagen-specific)
 * - platform-hints.json: 15 AI platform syntax guides
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

import conflictsData from './conflicts.json';
import familiesData from './families.json';
import semanticTagsData from './semantic-tags.json';
import marketMoodsData from './market-moods.json';
import platformHintsData from './platform-hints.json';

// ============================================================================
// TYPES
// ============================================================================

export interface ConflictGroup {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  terms: string[];
  conflictsWith: string[];
  reason: string;
  exception?: string;
}

export interface StyleFamily {
  id: string;
  name: string;
  description: string;
  coreTraits: string[];
  members: string[];
  relatedFamilies: string[];
  bestWith: string[];
  avoidWith: string[];
}

export interface SemanticTag {
  id: string;
  label: string;
  keywords: string[];
}

export interface MarketState {
  label: string;
  description: string;
  indicators: string[];
  moodSuggestions: {
    primary: string[];
    secondary: string[];
    atmospheric: string[];
  };
  colorPalette: {
    dominant: string[];
    accent: string[];
    avoid: string[];
  };
  lightingSuggestions: string[];
  subjectSuggestions: string[];
  environmentSuggestions: string[];
}

export interface PlatformConfig {
  id: string;
  name: string;
  tier: 'free' | 'freemium' | 'paid';
  promptStyle: 'technical' | 'natural' | 'conversational' | 'simple' | 'mixed';
  syntax: {
    separator: string;
    weightingSyntax: string | null;
    weightingExample: string | null;
    negativePromptSupport: boolean;
    negativePrefix: string | null;
    maxLength: number | string;
    tokenBased: boolean;
  };
  bestPractices: string[];
  qualityBoosters?: string[];
  avoidTerms?: string[];
}

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Check if two terms conflict with each other
 */
export function checkConflict(term1: string, term2: string): ConflictGroup | null {
  const conflicts = conflictsData.conflictGroups as ConflictGroup[];
  const t1 = term1.toLowerCase();
  const t2 = term2.toLowerCase();
  
  for (const group of conflicts) {
    const inTerms = group.terms.some(t => t1.includes(t.toLowerCase()) || t.toLowerCase().includes(t1));
    const inConflicts = group.conflictsWith.some(t => t2.includes(t.toLowerCase()) || t.toLowerCase().includes(t2));
    
    if ((inTerms && inConflicts) || 
        (group.conflictsWith.some(t => t1.includes(t.toLowerCase())) && 
         group.terms.some(t => t2.includes(t.toLowerCase())))) {
      return group;
    }
  }
  
  return null;
}

/**
 * Check a list of terms for any conflicts
 */
export function findConflicts(terms: string[]): Array<{
  term1: string;
  term2: string;
  conflict: ConflictGroup;
}> {
  const results: Array<{ term1: string; term2: string; conflict: ConflictGroup }> = [];
  
  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const t1 = terms[i];
      const t2 = terms[j];
      if (!t1 || !t2) continue;
      const conflict = checkConflict(t1, t2);
      if (conflict) {
        results.push({ term1: t1, term2: t2, conflict });
      }
    }
  }
  
  return results;
}

/**
 * Get all conflicts for a single term
 */
export function getConflictsFor(term: string): string[] {
  const conflicts = conflictsData.conflictGroups as ConflictGroup[];
  const result: string[] = [];
  const t = term.toLowerCase();
  
  for (const group of conflicts) {
    if (group.terms.some(gt => t.includes(gt.toLowerCase()))) {
      result.push(...group.conflictsWith);
    }
    if (group.conflictsWith.some(gc => t.includes(gc.toLowerCase()))) {
      result.push(...group.terms);
    }
  }
  
  return [...new Set(result)];
}

// ============================================================================
// STYLE FAMILIES
// ============================================================================

/**
 * Get a style family by ID
 */
export function getFamily(familyId: string): StyleFamily | undefined {
  return (familiesData.families as StyleFamily[]).find(f => f.id === familyId);
}

/**
 * Find which family a style belongs to
 */
export function findFamilyFor(style: string): StyleFamily | undefined {
  const s = style.toLowerCase();
  return (familiesData.families as StyleFamily[]).find(f => 
    f.members.some(m => m.toLowerCase().includes(s) || s.includes(m.toLowerCase()))
  );
}

/**
 * Get related styles within the same family
 */
export function getRelatedStyles(style: string): string[] {
  const family = findFamilyFor(style);
  if (!family) return [];
  return family.members.filter(m => m.toLowerCase() !== style.toLowerCase());
}

/**
 * Get styles that work well with a given style
 */
export function getCompatibleStyles(style: string): string[] {
  const family = findFamilyFor(style);
  if (!family) return [];
  return family.bestWith;
}

/**
 * Get all family names
 */
export function getAllFamilies(): Array<{ id: string; name: string }> {
  return (familiesData.families as StyleFamily[]).map(f => ({ id: f.id, name: f.name }));
}

// ============================================================================
// SEMANTIC TAGS
// ============================================================================

/**
 * Get tags for a term
 */
export function getTagsFor(term: string): string[] {
  const mappings = semanticTagsData.termMappings as Array<{ term: string; tags: string[] }>;
  const mapping = mappings.find(m => m.term.toLowerCase() === term.toLowerCase());
  return mapping?.tags || [];
}

/**
 * Find terms by tag
 */
export function findByTag(tagId: string): string[] {
  const mappings = semanticTagsData.termMappings as Array<{ term: string; tags: string[] }>;
  return mappings.filter(m => m.tags.includes(tagId)).map(m => m.term);
}

/**
 * Get all tags in a category
 */
export function getTagCategory(categoryKey: string): SemanticTag[] {
  const categories = semanticTagsData.tagCategories as Record<string, { tags: SemanticTag[] }>;
  return categories[categoryKey]?.tags || [];
}

// ============================================================================
// MARKET MOODS (Promagen-specific)
// ============================================================================

/**
 * Get mood suggestions for a market state
 */
export function getMarketMood(state: string): MarketState | undefined {
  const states = marketMoodsData.marketStates as Record<string, MarketState>;
  return states[state];
}

/**
 * Get visual suggestions for percentage change
 */
export function getMoodForChange(percentChange: number): {
  intensityLevel: number;
  moodIntensifier: string[];
  visualIntensifier: string[];
} {
  const intensity = marketMoodsData.percentageChangeIntensity as Record<string, {
    range: string;
    intensityLevel: number;
    moodIntensifier: string[];
    visualIntensifier: string[];
  }>;
  
  const defaultMood = { intensityLevel: 0, moodIntensifier: [], visualIntensifier: [] };
  
  if (percentChange > 10) return intensity.massive_gain ?? defaultMood;
  if (percentChange > 5) return intensity.large_gain ?? defaultMood;
  if (percentChange > 2) return intensity.moderate_gain ?? defaultMood;
  if (percentChange > 0.5) return intensity.small_gain ?? defaultMood;
  if (percentChange > -0.5) return intensity.flat ?? defaultMood;
  if (percentChange > -2) return intensity.small_loss ?? defaultMood;
  if (percentChange > -5) return intensity.moderate_loss ?? defaultMood;
  if (percentChange > -10) return intensity.large_loss ?? defaultMood;
  return intensity.massive_loss ?? defaultMood;
}

/**
 * Get sector-specific aesthetic modifiers
 */
export function getSectorAesthetic(sector: string): {
  aestheticLean: string[];
  colorInfluence: string[];
  environmentInfluence: string[];
} | undefined {
  const sectors = marketMoodsData.sectorMoodModifiers as Record<string, {
    aestheticLean: string[];
    colorInfluence: string[];
    environmentInfluence: string[];
  }>;
  return sectors[sector];
}

/**
 * Get exchange session modifiers
 */
export function getSessionMood(session: string): {
  moodModifier: string[];
  lightingModifier: string[];
  colorModifier: string[];
} | undefined {
  const contexts = marketMoodsData.exchangeContextModifiers as Record<string, {
    moodModifier: string[];
    lightingModifier: string[];
    colorModifier: string[];
  }>;
  return contexts[session];
}

// ============================================================================
// PLATFORM HINTS
// ============================================================================

/**
 * Get platform configuration
 */
export function getPlatform(platformId: string): PlatformConfig | undefined {
  const platforms = platformHintsData.platforms as Record<string, PlatformConfig>;
  return platforms[platformId];
}

/**
 * Get all platforms for a tier
 */
export function getPlatformsByTier(tier: 'free' | 'freemium' | 'paid'): PlatformConfig[] {
  const platforms = platformHintsData.platforms as Record<string, PlatformConfig>;
  return Object.values(platforms).filter(p => p.tier === tier);
}

/**
 * Transform a prompt for a specific platform
 */
export function formatPromptForPlatform(prompt: string, platformId: string): string {
  const platform = getPlatform(platformId);
  if (!platform) return prompt;
  
  // Apply platform-specific transforms
  const transforms = (platform as any).termTransforms as Record<string, string> | undefined;
  if (transforms) {
    let result = prompt;
    for (const [from, to] of Object.entries(transforms)) {
      result = result.replace(new RegExp(from, 'gi'), to);
    }
    return result;
  }
  
  return prompt;
}

/**
 * Get tier optimization advice
 */
export function getTierOptimization(tier: 'free' | 'freemium' | 'paid'): {
  promptStrategy: string;
  lengthAdvice: string;
  recommendedTerms: string[];
  avoidTerms: string[];
} {
  const optimizations = platformHintsData.tierOptimization as Record<string, {
    promptStrategy: string;
    lengthAdvice: string;
    recommendedTerms: string[];
    avoidTerms: string[];
  }>;
  return optimizations[tier] ?? {
    promptStrategy: 'balanced',
    lengthAdvice: 'moderate length',
    recommendedTerms: [],
    avoidTerms: []
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const conflicts = conflictsData;
export const families = familiesData;
export const semanticTags = semanticTagsData;
export const marketMoods = marketMoodsData;
export const platformHints = platformHintsData;

export default {
  conflicts: conflictsData,
  families: familiesData,
  semanticTags: semanticTagsData,
  marketMoods: marketMoodsData,
  platformHints: platformHintsData,
  // Conflict detection
  checkConflict,
  findConflicts,
  getConflictsFor,
  // Style families
  getFamily,
  findFamilyFor,
  getRelatedStyles,
  getCompatibleStyles,
  getAllFamilies,
  // Semantic tags
  getTagsFor,
  findByTag,
  getTagCategory,
  // Market moods
  getMarketMood,
  getMoodForChange,
  getSectorAesthetic,
  getSessionMood,
  // Platform hints
  getPlatform,
  getPlatformsByTier,
  formatPromptForPlatform,
  getTierOptimization,
};
