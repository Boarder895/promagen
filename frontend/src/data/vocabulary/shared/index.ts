/**
 * Shared Vocabulary Layer
 * =======================
 * Reusable building blocks for prompt construction across all domains.
 * 
 * - adjectives.json: 420 descriptive words in 17 categories
 * - intensifiers.json: 220 intensity modifiers by strength/effect
 * - connectors.json: 280 linking phrases for seamless prompts
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

import adjectivesData from './adjectives.json';
import intensifiersData from './intensifiers.json';
import connectorsData from './connectors.json';

// ============================================================================
// TYPES
// ============================================================================

export type AdjectiveCategory = keyof typeof adjectivesData.categories;
export type IntensifierStrength = 'minimal' | 'slight' | 'moderate' | 'strong' | 'intense' | 'maximum';
export type IntensifierEffect = keyof typeof intensifiersData.byEffect;
export type ConnectorFunction = keyof typeof connectorsData.byFunction;

export interface IntensifierLevel {
  label: string;
  description: string;
  strengthValue: number;
  options: string[];
  usage: string;
}

export interface ConnectorCategory {
  label: string;
  description: string;
  options: string[];
  usage: string;
  example: string;
}

// ============================================================================
// ADJECTIVES
// ============================================================================

/**
 * Get adjectives by category
 */
export function getAdjectives(category: AdjectiveCategory): string[] {
  return adjectivesData.categories[category]?.options || [];
}

/**
 * Get all adjective categories
 */
export function getAdjectiveCategories(): Array<{ id: string; label: string; count: number }> {
  return Object.entries(adjectivesData.categories).map(([id, data]) => ({
    id,
    label: (data as any).label,
    count: (data as any).options.length
  }));
}

/**
 * Get random adjective from category
 */
export function getRandomAdjective(category?: AdjectiveCategory): string {
  if (category) {
    const options = getAdjectives(category);
    if (options.length === 0) return 'vivid';
    return options[Math.floor(Math.random() * options.length)] ?? 'vivid';
  }
  // Random from flat options
  const flat = adjectivesData.flatOptions;
  if (flat.length === 0) return 'vivid';
  return flat[Math.floor(Math.random() * flat.length)] ?? 'vivid';
}

/**
 * Get adjectives matching a search term
 */
export function searchAdjectives(query: string): string[] {
  const q = query.toLowerCase();
  const results: string[] = [];
  
  // Search categories
  for (const cat of Object.values(adjectivesData.categories)) {
    results.push(...(cat as any).options.filter((o: string) => o.includes(q)));
  }
  
  // Search flat list
  results.push(...adjectivesData.flatOptions.filter(o => o.includes(q)));
  
  return [...new Set(results)];
}

/**
 * Get adjectives for a mood/atmosphere
 */
export function getAdjectivesForMood(mood: 'positive' | 'negative' | 'neutral'): string[] {
  switch (mood) {
    case 'positive':
      return adjectivesData.categories.mood_positive?.options || [];
    case 'negative':
      return adjectivesData.categories.mood_negative?.options || [];
    case 'neutral':
      return adjectivesData.categories.mood_neutral?.options || [];
    default:
      return [];
  }
}

// ============================================================================
// INTENSIFIERS
// ============================================================================

/**
 * Get intensifiers by strength level
 */
export function getIntensifiers(strength: IntensifierStrength): string[] {
  return intensifiersData.byStrength[strength]?.options || [];
}

/**
 * Get intensifiers by effect type
 */
export function getIntensifiersByEffect(effect: IntensifierEffect): string[] {
  return intensifiersData.byEffect[effect]?.options || [];
}

/**
 * Get intensifier metadata
 */
export function getIntensifierLevel(strength: IntensifierStrength): IntensifierLevel | undefined {
  return intensifiersData.byStrength[strength] as IntensifierLevel;
}

/**
 * Get appropriate intensifier for a target strength (0.0 - 1.0)
 */
export function getIntensifierForStrength(targetStrength: number): string {
  const levels = Object.entries(intensifiersData.byStrength) as [IntensifierStrength, IntensifierLevel][];
  
  // Find closest match
  let closest: IntensifierLevel | null = null;
  let closestDiff = Infinity;
  
  for (const [, level] of levels) {
    const diff = Math.abs(level.strengthValue - targetStrength);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = level;
    }
  }
  
  if (closest) {
    const options = closest.options;
    if (options.length === 0) return 'very';
    return options[Math.floor(Math.random() * options.length)] ?? 'very';
  }
  
  return 'very';
}

/**
 * Get prompt-specific intensifiers
 */
export function getPromptIntensifiers(type: 'detail' | 'quality' | 'style' | 'realism' | 'artistic'): string[] {
  switch (type) {
    case 'detail':
      return intensifiersData.promptSpecific.detail_modifiers?.options || [];
    case 'quality':
      return intensifiersData.promptSpecific.quality_modifiers?.options || [];
    case 'style':
      return intensifiersData.promptSpecific.style_strength?.options || [];
    case 'realism':
      return intensifiersData.promptSpecific.realism_modifiers?.options || [];
    case 'artistic':
      return intensifiersData.promptSpecific.artistic_modifiers?.options || [];
    default:
      return [];
  }
}

/**
 * Get weighting guide for platform
 */
export function getWeightingGuide(platform: 'stableDiffusion' | 'midjourney'): Array<{
  intensifier: string;
  weight: string;
  example: string;
}> {
  return intensifiersData.weightingGuide[platform]?.examples || [];
}

// ============================================================================
// CONNECTORS
// ============================================================================

/**
 * Get connectors by function
 */
export function getConnectors(func: ConnectorFunction): string[] {
  return (connectorsData.byFunction[func] as ConnectorCategory)?.options || [];
}

/**
 * Get connector metadata
 */
export function getConnectorCategory(func: ConnectorFunction): ConnectorCategory | undefined {
  return connectorsData.byFunction[func] as ConnectorCategory;
}

/**
 * Get all connector functions
 */
export function getConnectorFunctions(): Array<{ id: string; label: string; count: number }> {
  return Object.entries(connectorsData.byFunction).map(([id, data]) => ({
    id,
    label: (data as any).label,
    count: (data as any).options.length
  }));
}

/**
 * Get random connector for a function
 */
export function getRandomConnector(func: ConnectorFunction): string {
  const options = getConnectors(func);
  if (options.length === 0) return 'with';
  return options[Math.floor(Math.random() * options.length)] ?? 'with';
}

/**
 * Get connectors optimized for a platform
 */
export function getConnectorsForPlatform(platform: 'stable_diffusion' | 'midjourney' | 'dalle'): {
  preferred: string[];
  avoid: string[];
} {
  return connectorsData.platformOptimized[platform] || { preferred: [], avoid: [] };
}

/**
 * Get prompt template
 */
export function getPromptTemplate(type: 'basic_portrait' | 'action_scene' | 'landscape' | 'concept_art' | 'stylized'): {
  template: string;
  example: string;
} | undefined {
  return connectorsData.promptTemplates[type];
}

/**
 * Get sentence starters
 */
export function getSentenceStarters(type: 'subject_first' | 'style_first' | 'medium_first' | 'mood_first'): string[] {
  return connectorsData.sentenceStarters[type] || [];
}

// ============================================================================
// PROMPT BUILDING HELPERS
// ============================================================================

/**
 * Build a phrase with intensifier + adjective
 */
export function buildIntensifiedAdjective(
  adjective: string,
  strength: IntensifierStrength = 'strong'
): string {
  const intensifier = getIntensifiers(strength)[Math.floor(Math.random() * getIntensifiers(strength).length)];
  return `${intensifier} ${adjective}`;
}

/**
 * Connect two elements with appropriate connector
 */
export function connectElements(
  element1: string,
  element2: string,
  connectionType: ConnectorFunction
): string {
  const connector = getRandomConnector(connectionType);
  return `${element1} ${connector} ${element2}`;
}

/**
 * Build a complete phrase: subject + connector + modifier
 */
export function buildPhrase(
  subject: string,
  connectionType: ConnectorFunction,
  modifier: string,
  intensify?: IntensifierStrength
): string {
  const connector = getRandomConnector(connectionType);
  const finalModifier = intensify 
    ? buildIntensifiedAdjective(modifier, intensify)
    : modifier;
  return `${subject} ${connector} ${finalModifier}`;
}

/**
 * Apply platform-specific formatting
 */
export function formatForPlatform(
  elements: string[],
  platform: 'stable-diffusion' | 'midjourney' | 'dall-e'
): string {
  switch (platform) {
    case 'stable-diffusion':
      return elements.join(', ');
    case 'midjourney':
      return elements.join(', ');
    case 'dall-e':
      return elements.join('. ') + '.';
    default:
      return elements.join(', ');
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

export function getSharedStats(): {
  adjectives: number;
  intensifiers: number;
  connectors: number;
  total: number;
} {
  const adjectiveCount = Object.values(adjectivesData.categories)
    .reduce((sum, cat) => sum + (cat as any).options.length, 0) + adjectivesData.flatOptions.length;
  
  const intensifierCount = 
    Object.values(intensifiersData.byStrength).reduce((sum, level) => sum + (level as any).options.length, 0) +
    Object.values(intensifiersData.byEffect).reduce((sum, eff) => sum + (eff as any).options.length, 0) +
    Object.values(intensifiersData.promptSpecific).reduce((sum, ps) => sum + (ps as any).options.length, 0);
  
  const connectorCount = Object.values(connectorsData.byFunction)
    .reduce((sum, cat) => sum + (cat as any).options.length, 0);
  
  return {
    adjectives: adjectiveCount,
    intensifiers: intensifierCount,
    connectors: connectorCount,
    total: adjectiveCount + intensifierCount + connectorCount
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const adjectives = adjectivesData;
export const intensifiers = intensifiersData;
export const connectors = connectorsData;

export default {
  adjectives: adjectivesData,
  intensifiers: intensifiersData,
  connectors: connectorsData,
  // Adjective functions
  getAdjectives,
  getAdjectiveCategories,
  getRandomAdjective,
  searchAdjectives,
  getAdjectivesForMood,
  // Intensifier functions
  getIntensifiers,
  getIntensifiersByEffect,
  getIntensifierLevel,
  getIntensifierForStrength,
  getPromptIntensifiers,
  getWeightingGuide,
  // Connector functions
  getConnectors,
  getConnectorCategory,
  getConnectorFunctions,
  getRandomConnector,
  getConnectorsForPlatform,
  getPromptTemplate,
  getSentenceStarters,
  // Building helpers
  buildIntensifiedAdjective,
  connectElements,
  buildPhrase,
  formatForPlatform,
  // Stats
  getSharedStats
};
