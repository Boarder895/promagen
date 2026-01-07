// src/lib/prompt-intelligence/coherent-randomise.ts
// ============================================================================
// COHERENT RANDOMISE
// ============================================================================
// Generates thematically coherent prompts using style families.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import { getCategoryConfig, getAllCategories } from '@/lib/prompt-builder';
import { getFamilies, getSemanticTag } from './index';
import type { StyleFamily, SemanticMood } from './types';

// ============================================================================
// Types
// ============================================================================

export interface CoherentRandomiseOptions {
  /** If user typed a subject, preserve it */
  preserveSubject?: string;
  /** Specific family to use (random if not provided) */
  targetFamily?: string;
  /** Category limits per platform */
  categoryLimits?: Partial<Record<PromptCategory, number>>;
}

export interface CoherentRandomiseResult {
  /** Selections per category */
  selections: Record<PromptCategory, string[]>;
  /** Custom values per category (preserved subject) */
  customValues: Record<PromptCategory, string>;
  /** The family used for generation */
  family: string;
  /** Family display name */
  familyDisplayName: string;
  /** Whether user's subject was preserved */
  subjectPreserved: boolean;
  /** Overall mood of the generated prompt */
  mood: SemanticMood;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Pick random item from array.
 */
function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick multiple random items from array (no duplicates).
 */
function pickMultipleRandom<T>(arr: T[], count: number): T[] {
  if (arr.length === 0) return [];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Check if an option belongs to a family.
 */
function optionBelongsToFamily(option: string, family: StyleFamily): boolean {
  const lowerOption = option.toLowerCase();
  
  // Direct member check
  if (family.members.some(m => m.toLowerCase() === lowerOption)) return true;
  
  // Check via semantic tag
  const tag = getSemanticTag(option);
  if (tag?.families) {
    // Check if any of the option's families match the family or its related families
    return tag.families.some(f => 
      family.related.includes(f) || 
      family.members.some(m => m.toLowerCase().includes(f.toLowerCase()))
    );
  }
  
  return false;
}

/**
 * Get options for a category that match a family.
 */
function getMatchingOptions(category: PromptCategory, family: StyleFamily): string[] {
  const config = getCategoryConfig(category);
  if (!config) return [];
  
  const matching: string[] = [];
  
  for (const option of config.options) {
    if (!option.trim()) continue;
    
    if (optionBelongsToFamily(option, family)) {
      matching.push(option);
    }
  }
  
  return matching;
}

/**
 * Get fallback options for a category (mood-compatible).
 */
function getFallbackOptions(category: PromptCategory, mood: SemanticMood): string[] {
  const config = getCategoryConfig(category);
  if (!config) return [];
  
  const fallbacks: string[] = [];
  
  for (const option of config.options) {
    if (!option.trim()) continue;
    
    const tag = getSemanticTag(option);
    // Include if mood matches or no mood specified or neutral
    if (!tag?.mood || tag.mood === mood || tag.mood === 'neutral') {
      fallbacks.push(option);
    }
  }
  
  // If no mood-compatible options, return all valid options
  return fallbacks.length > 0 ? fallbacks : config.options.filter(o => o.trim());
}

/**
 * Find options matching suggestions from family.
 */
function findMatchingSuggestions(
  category: PromptCategory,
  suggestions: string[]
): string[] {
  const config = getCategoryConfig(category);
  if (!config) return [];
  
  const matching: string[] = [];
  
  for (const option of config.options) {
    if (!option.trim()) continue;
    const lower = option.toLowerCase();
    
    // Check if option matches any suggestion
    if (suggestions.some(s => lower.includes(s.toLowerCase()) || s.toLowerCase().includes(lower))) {
      matching.push(option);
    }
  }
  
  return matching;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a coherent randomised prompt based on a style family.
 */
export function generateCoherentPrompt(
  options: CoherentRandomiseOptions = {}
): CoherentRandomiseResult {
  const {
    preserveSubject,
    targetFamily,
    categoryLimits = {},
  } = options;
  
  const familiesData = getFamilies();
  const familyIds = Object.keys(familiesData.families);
  
  // Select family - ensure we always have a valid one
  let familyId = targetFamily;
  if (!familyId || !familiesData.families[familyId]) {
    familyId = pickRandom(familyIds) ?? 'cinematic';
  }
  
  // Get family with fallback - TypeScript needs explicit assertion here
  const family = familiesData.families[familyId];
  
  // Safety check - if still no family, use first available or default
  if (!family) {
    // Return a basic result with neutral mood
    const allCategories = getAllCategories();
    const emptySelections: Record<PromptCategory, string[]> = {} as Record<PromptCategory, string[]>;
    const emptyCustomValues: Record<PromptCategory, string> = {} as Record<PromptCategory, string>;
    for (const cat of allCategories) {
      emptySelections[cat] = [];
      emptyCustomValues[cat] = '';
    }
    return {
      selections: emptySelections,
      customValues: emptyCustomValues,
      family: 'unknown',
      familyDisplayName: 'Unknown',
      subjectPreserved: false,
      mood: 'neutral' as SemanticMood,
    };
  }
  
  const mood = family.mood;
  
  // Initialize result
  const selections: Record<PromptCategory, string[]> = {} as Record<PromptCategory, string[]>;
  const customValues: Record<PromptCategory, string> = {} as Record<PromptCategory, string>;
  
  // Initialize all categories
  const allCategories = getAllCategories();
  for (const cat of allCategories) {
    selections[cat] = [];
    customValues[cat] = '';
  }
  
  // Handle subject
  let subjectPreserved = false;
  if (preserveSubject?.trim()) {
    customValues.subject = preserveSubject.trim();
    subjectPreserved = true;
  } else {
    // Pick a subject from family members or mood-compatible subjects
    const subjectConfig = getCategoryConfig('subject');
    if (subjectConfig) {
      const matchingSubjects = getMatchingOptions('subject', family);
      const subject = pickRandom(
        matchingSubjects.length > 0 
          ? matchingSubjects 
          : subjectConfig.options.filter(o => o.trim())
      );
      if (subject) {
        selections.subject = [subject];
      }
    }
  }
  
  // Style category - prioritize family members
  const styleLimit = categoryLimits.style ?? 1;
  const styleMatches = getMatchingOptions('style', family);
  if (styleMatches.length > 0) {
    selections.style = pickMultipleRandom(styleMatches, styleLimit);
  } else {
    const fallback = getFallbackOptions('style', mood);
    selections.style = pickMultipleRandom(fallback, styleLimit);
  }
  
  // Colour - use family suggestions first
  const colourLimit = categoryLimits.colour ?? 1;
  if (family.suggestedColours && family.suggestedColours.length > 0) {
    const matching = findMatchingSuggestions('colour', family.suggestedColours);
    if (matching.length > 0) {
      selections.colour = pickMultipleRandom(matching, colourLimit);
    } else {
      // Use suggestions directly as they might be valid
      selections.colour = pickMultipleRandom(family.suggestedColours, colourLimit);
    }
  }
  if (selections.colour.length === 0) {
    const fallback = getFallbackOptions('colour', mood);
    selections.colour = pickMultipleRandom(fallback, colourLimit);
  }
  
  // Lighting - use family suggestions first
  const lightingLimit = categoryLimits.lighting ?? 1;
  if (family.suggestedLighting && family.suggestedLighting.length > 0) {
    const matching = findMatchingSuggestions('lighting', family.suggestedLighting);
    if (matching.length > 0) {
      selections.lighting = pickMultipleRandom(matching, lightingLimit);
    } else {
      selections.lighting = pickMultipleRandom(family.suggestedLighting, lightingLimit);
    }
  }
  if (selections.lighting.length === 0) {
    const fallback = getFallbackOptions('lighting', mood);
    selections.lighting = pickMultipleRandom(fallback, lightingLimit);
  }
  
  // Atmosphere - use family suggestions first
  const atmosphereLimit = categoryLimits.atmosphere ?? 1;
  if (family.suggestedAtmosphere && family.suggestedAtmosphere.length > 0) {
    const matching = findMatchingSuggestions('atmosphere', family.suggestedAtmosphere);
    if (matching.length > 0) {
      selections.atmosphere = pickMultipleRandom(matching, atmosphereLimit);
    } else {
      selections.atmosphere = pickMultipleRandom(family.suggestedAtmosphere, atmosphereLimit);
    }
  }
  if (selections.atmosphere.length === 0) {
    const fallback = getFallbackOptions('atmosphere', mood);
    selections.atmosphere = pickMultipleRandom(fallback, atmosphereLimit);
  }
  
  // Environment - match family
  const envLimit = categoryLimits.environment ?? 1;
  const envMatches = getMatchingOptions('environment', family);
  if (envMatches.length > 0) {
    selections.environment = pickMultipleRandom(envMatches, envLimit);
  } else {
    const fallback = getFallbackOptions('environment', mood);
    selections.environment = pickMultipleRandom(fallback, envLimit);
  }
  
  // Action - any that match mood
  const actionLimit = categoryLimits.action ?? 1;
  const actionFallback = getFallbackOptions('action', mood);
  selections.action = pickMultipleRandom(actionFallback, actionLimit);
  
  // Camera - any
  const cameraLimit = categoryLimits.camera ?? 1;
  const cameraConfig = getCategoryConfig('camera');
  if (cameraConfig) {
    selections.camera = pickMultipleRandom(
      cameraConfig.options.filter(o => o.trim()),
      cameraLimit
    );
  }
  
  // Composition - any
  const compositionLimit = categoryLimits.composition ?? 1;
  const compositionConfig = getCategoryConfig('composition');
  if (compositionConfig) {
    selections.composition = pickMultipleRandom(
      compositionConfig.options.filter(o => o.trim()),
      compositionLimit
    );
  }
  
  // Materials - match family mood
  const materialsLimit = categoryLimits.materials ?? 1;
  const materialsFallback = getFallbackOptions('materials', mood);
  if (materialsFallback.length > 0) {
    selections.materials = pickMultipleRandom(materialsFallback, materialsLimit);
  }
  
  // Fidelity - any quality terms
  const fidelityLimit = categoryLimits.fidelity ?? 1;
  const fidelityConfig = getCategoryConfig('fidelity');
  if (fidelityConfig) {
    selections.fidelity = pickMultipleRandom(
      fidelityConfig.options.filter(o => o.trim()),
      fidelityLimit
    );
  }
  
  // Negative - pick a few common ones
  const negativeConfig = getCategoryConfig('negative');
  if (negativeConfig) {
    const commonNegatives = negativeConfig.options.filter(opt => {
      const lower = opt.toLowerCase();
      return lower.includes('blur') || 
             lower.includes('low quality') || 
             lower.includes('distort') ||
             lower.includes('bad') ||
             lower.includes('ugly') ||
             lower.includes('deformed');
    });
    const negCount = Math.floor(Math.random() * 2) + 2; // 2-3 negatives
    selections.negative = pickMultipleRandom(
      commonNegatives.length > 0 ? commonNegatives : negativeConfig.options.filter(o => o.trim()),
      negCount
    );
  }
  
  return {
    selections,
    customValues,
    family: familyId,
    familyDisplayName: family.displayName,
    subjectPreserved,
    mood,
  };
}

/**
 * Get list of all available family IDs.
 */
export function getAvailableFamilies(): Array<{ id: string; displayName: string; mood: SemanticMood }> {
  const familiesData = getFamilies();
  return Object.entries(familiesData.families).map(([id, family]) => ({
    id,
    displayName: family.displayName,
    mood: family.mood,
  }));
}
