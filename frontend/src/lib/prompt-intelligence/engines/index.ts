// src/lib/prompt-intelligence/engines/index.ts
// ============================================================================
// PROMPT INTELLIGENCE - Processing Engines
// ============================================================================
// Phase 2: Runtime processing engines that use the foundation data.
// ============================================================================

// Conflict Detection Engine
export {
  detectConflicts,
  hasHardConflicts,
  getCategoryConflictCount,
  wouldCreateConflict,
  type ConflictDetectionInput,
  type ConflictDetectionResult,
} from './conflict-detection';

// Suggestion Engine
export {
  buildContext,
  scoreOptions,
  reorderByRelevance,
  getSuggestions,
  getSuggestionsForCategory,
  getAutoCompleteSuggestions,
  type BuildContextInput,
  type ScoreOptionsInput,
  type GetSuggestionsInput,
  type GetSuggestionsResult,
} from './suggestion-engine';

// Market Mood Engine
export {
  detectMarketState,
  applyMarketMoodBoosts,
  getMarketMoodSuggestions,
  shouldShowMarketMood,
  getMarketMoodTheme,
  getMarketMoodIcon,
  type MarketDataInput,
  type MarketStateResult,
  type MarketMoodBoostResult,
  type FXPairData,
  type ExchangeData,
  type CommodityData,
  type CryptoData,
} from './market-mood-engine';

// Platform Optimization Engine
export {
  formatPromptForPlatform,
  smartTrimPrompt,
  getCategoryOrder,
  getTrimPriority,
  getPlatformCharLimit,
  platformSupportsWeights,
  platformUsesSeparateNegative,
  formatWithWeight,
  getPlatformRecommendations,
  estimateTokenCount,
  formatCompletePrompt,
  type FormatPromptInput,
  type FormatPromptResult,
  type SmartTrimInput,
  type PromptTrimResult,
  type PlatformFormattingOptions,
} from './platform-optimization';

// Integration Layer
export {
  analyzePrompt,
  quickConflictCheck,
  getOrderedOptions,
  getTopSuggestions,
  formatAndTrim,
  getMarketMoodUI,
  previewTermAddition,
  type PromptState,
  type MarketContext,
  type PromptAnalysis,
  type PromptSummary,
  type ReorderOptionsInput,
} from './integration';
