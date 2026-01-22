// Types
export * from './types/prompt-intelligence';

// Hooks
export { usePromptIntelligence } from './hooks/use-prompt-intelligence';
export type { UsePromptIntelligenceOptions, UsePromptIntelligenceReturn } from './hooks/use-prompt-intelligence';

// Lib - Generators
export {
  generateAllTierPrompts,
  generatePromptForTier,
  getPromptPreview,
  generateTier1Prompt,
  generateTier2Prompt,
  generateTier3Prompt,
  generateTier4Prompt,
  NEGATIVE_CONVERSIONS,
  CATEGORY_WEIGHTS
} from './lib/prompt-builder/generators';

// Lib - Intelligence
export {
  detectConflicts,
  getConflictColor,
  getStyleSuggestions,
  getMarketMoodContext,
  getMoodIntensity,
  getPlatformHints,
  getWeatherSuggestions,
  CONFLICT_RULES,
  STYLE_FAMILIES,
  MARKET_MOODS
} from './lib/prompt-builder/intelligence';

// Components
export { FourTierPromptPreview } from './components/prompt-builder/four-tier-prompt-preview';
export { IntelligencePanel } from './components/prompt-builder/intelligence-panel';
export { PromptIntelligenceBuilder } from './components/prompt-builder/prompt-intelligence-builder';
