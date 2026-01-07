// src/hooks/prompt-intelligence/index.ts
// ============================================================================
// PROMPT INTELLIGENCE HOOKS - Barrel Export
// ============================================================================
// React hooks for prompt intelligence integration.
// ============================================================================

export {
  usePromptAnalysis,
  type UsePromptAnalysisOptions,
  type UsePromptAnalysisResult,
} from './use-prompt-analysis';

export {
  useSmartSuggestions,
  type UseSmartSuggestionsOptions,
  type UseSmartSuggestionsResult,
} from './use-smart-suggestions';

export {
  useConflictDetection,
  type UseConflictDetectionOptions,
  type UseConflictDetectionResult,
} from './use-conflict-detection';

export {
  useMarketMood,
  type UseMarketMoodOptions,
  type UseMarketMoodResult,
} from './use-market-mood';

export {
  useSmartReorder,
  type ScoredOption,
  type UseSmartReorderOptions,
  type UseSmartReorderResult,
} from './use-smart-reorder';
