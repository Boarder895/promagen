// src/lib/prompt-intelligence/index.ts
// ============================================================================
// PROMPT INTELLIGENCE - Public API
// ============================================================================
// Single import point for all prompt intelligence functionality.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

// Re-export all types
export type {
  // Semantic Tags
  SemanticMood,
  SemanticEra,
  TimeOfDay,
  SemanticTag,
  SemanticTagsData,
  
  // Style Families
  StyleFamily,
  FamiliesData,
  
  // Conflicts
  ConflictSeverity,
  ConflictDefinition,
  ConflictsData,
  DetectedConflict,
  
  // Scoring
  ScoredOption,
  PromptContext,
  
  // Market Mood
  MarketStateType,
  MarketState,
  MarketMoodBoost,
  MarketMoodsData,
  
  // Platform Hints
  PlatformHint,
  PlatformHintsData,
  
  // Prompt DNA
  CategoryFillStatus,
  CategoryCoherenceStatus,
  PromptDNA,
  
  // Suggestions
  SuggestedOption,
  
  // API Options/Results
  ReorderOptions,
  ReorderResult,
  SmartTrimOptions,
  SmartTrimResult,
  RandomiseOptions,
  RandomiseResult,
} from './types';

// ============================================================================
// Data Imports (JSON files)
// ============================================================================
// These will be loaded client-side for instant scoring

import familiesData from '@/data/prompt-intelligence/families.json';
import conflictsData from '@/data/prompt-intelligence/conflicts.json';
import marketMoodsData from '@/data/prompt-intelligence/market-moods.json';
import platformHintsData from '@/data/prompt-intelligence/platform-hints.json';
import semanticTagsData from '@/data/prompt-intelligence/semantic-tags.json';

import type { 
  FamiliesData, 
  ConflictsData,
  MarketMoodsData,
  PlatformHintsData,
  SemanticTagsData,
  SemanticTag,
  MarketStateType,
  PlatformHint,
} from './types';

// Import reorderByRelevance for local use in smartTrimAssembledPrompt
import { reorderByRelevance as _reorderByRelevance } from './engines';

// ============================================================================
// Family Functions
// ============================================================================

/**
 * Get all style families.
 * @returns The families data object
 */
export function getFamilies(): FamiliesData {
  return familiesData as FamiliesData;
}

/**
 * Get a specific style family by ID.
 * @param familyId - The family identifier (e.g., 'sci-fi', 'retro')
 * @returns The family definition or undefined
 */
export function getFamily(familyId: string) {
  const data = familiesData as FamiliesData;
  return data.families[familyId];
}

/**
 * Get all family IDs.
 * @returns Array of family identifiers
 */
export function getFamilyIds(): string[] {
  const data = familiesData as FamiliesData;
  return Object.keys(data.families);
}

// ============================================================================
// Conflict Functions
// ============================================================================

/**
 * Get all conflict definitions.
 * @returns The conflicts data object
 */
export function getConflicts(): ConflictsData {
  return conflictsData as ConflictsData;
}

// ============================================================================
// Market Mood Functions
// ============================================================================

/**
 * Get all market mood definitions.
 * @returns The market moods data object
 */
export function getMarketMoods(): MarketMoodsData {
  return marketMoodsData as MarketMoodsData;
}

/**
 * Get a specific market mood boost configuration.
 * @param moodType - The market state type
 * @returns The mood boost config or undefined
 */
export function getMarketMood(moodType: MarketStateType) {
  const data = marketMoodsData as MarketMoodsData;
  return data.moods[moodType];
}

/**
 * Get all market mood types.
 * @returns Array of market state types
 */
export function getMarketMoodTypes(): MarketStateType[] {
  const data = marketMoodsData as MarketMoodsData;
  return Object.keys(data.moods) as MarketStateType[];
}

// ============================================================================
// Platform Hints Functions
// ============================================================================

/**
 * Get all platform hints.
 * @returns The platform hints data object
 */
export function getPlatformHints(): PlatformHintsData {
  return platformHintsData as PlatformHintsData;
}

/**
 * Get platform-specific hints for a provider.
 * @param platformId - The provider/platform ID (e.g., 'midjourney', 'stability')
 * @returns The platform hint config or undefined
 */
export function getPlatformHint(platformId: string): PlatformHint | undefined {
  const data = platformHintsData as PlatformHintsData;
  return data.platforms[platformId];
}

/**
 * Get all platform IDs that have hints configured.
 * @returns Array of platform identifiers
 */
export function getPlatformIds(): string[] {
  const data = platformHintsData as PlatformHintsData;
  return Object.keys(data.platforms);
}

// ============================================================================
// Semantic Tags Functions
// ============================================================================

/**
 * Get all semantic tags.
 * @returns The semantic tags data object
 */
export function getSemanticTags(): SemanticTagsData {
  return semanticTagsData as SemanticTagsData;
}

/**
 * Get semantic tag for a specific option.
 * @param option - The prompt option (e.g., 'cyberpunk', 'golden hour')
 * @returns The semantic tag or undefined if not tagged
 */
export function getSemanticTag(option: string): SemanticTag | undefined {
  const data = semanticTagsData as SemanticTagsData;
  return data.options[option];
}

/**
 * Get all tagged option names.
 * @returns Array of tagged option strings
 */
export function getTaggedOptions(): string[] {
  const data = semanticTagsData as SemanticTagsData;
  return Object.keys(data.options);
}

/**
 * Check if an option has semantic tags.
 * @param option - The prompt option to check
 * @returns True if the option is tagged
 */
export function hasSemanticTag(option: string): boolean {
  const data = semanticTagsData as SemanticTagsData;
  return option in data.options;
}

/**
 * Get coverage statistics for semantic tags.
 * @returns Object with total and tagged counts
 */
export function getTagCoverage(): { total: number; tagged: number; categories: string[] } {
  const data = semanticTagsData as SemanticTagsData;
  return data.coverage;
}

// ============================================================================
// Placeholder exports for modules to be built in Phase 2
// These will be replaced with actual implementations
// ============================================================================

/**
 * Parse user text to extract semantic context.
 * @placeholder - Full implementation in Phase 2
 */
export function parseUserText(text: string): string[] {
  // Simple word extraction for now
  // Full implementation will do semantic analysis
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2);
}

/**
 * Check if Prompt Intelligence data is loaded.
 * Useful for loading states.
 */
export function isDataLoaded(): boolean {
  return Boolean(familiesData) && Boolean(conflictsData);
}

/**
 * Get the version of the Prompt Intelligence data.
 */
export function getDataVersion(): { families: string; conflicts: string } {
  const families = familiesData as FamiliesData;
  const conflicts = conflictsData as ConflictsData;
  return {
    families: families.version,
    conflicts: conflicts.version,
  };
}

// ============================================================================
// Processing Engines (Phase 2)
// ============================================================================

export {
  // Conflict Detection Engine
  detectConflicts,
  hasHardConflicts,
  getCategoryConflictCount,
  wouldCreateConflict,
  type ConflictDetectionInput,
  type ConflictDetectionResult,
  
  // Suggestion Engine
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
  
  // Market Mood Engine
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
  
  // Platform Optimization Engine
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
  
  // Integration Layer
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
} from './engines';

// ============================================================================
// Coherent Randomise
// ============================================================================

export {
  generateCoherentPrompt,
  getAvailableFamilies,
  type CoherentRandomiseOptions,
  type CoherentRandomiseResult,
} from './coherent-randomise';

// ============================================================================
// Combine Engine (merge similar terms)
// ============================================================================

export {
  combineTermsInCategory,
  combineAllTerms,
  detectRedundantModifiers,
  suggestConsolidations,
  hasRedundantTerms,
  type CombineOptions,
  type CombineResult,
  type ConsolidationSuggestion,
} from './combine';

// ============================================================================
// Smart Trim Assembled Prompt (Full Prompt Trimming)
// ============================================================================

import type { PromptSelections, PromptCategory } from '@/types/prompt-builder';

/**
 * Input for smart trimming an assembled prompt.
 */
export interface SmartTrimAssembledInput {
  /** The assembled prompt text */
  promptText: string;
  /** Current category selections */
  selections: PromptSelections;
  /** Platform ID for context */
  platformId: string;
  /** Target character length */
  targetLength: number;
  /** Whether to always preserve subject (default: true) */
  preserveSubject?: boolean;
}

/**
 * Result of smart trimming an assembled prompt.
 */
export interface SmartTrimAssembledResult {
  /** The trimmed prompt text */
  optimized: string;
  /** Whether any trimming occurred */
  wasTrimmed: boolean;
  /** Terms that were removed */
  removedTerms: Array<{ term: string; category: PromptCategory; score: number }>;
  /** Original length */
  originalLength: number;
  /** New length */
  optimizedLength: number;
}

/**
 * Smart trim an assembled prompt by removing lowest-relevance terms first.
 * Uses semantic scoring to decide which terms to remove.
 * 
 * Algorithm:
 * 1. Extract all terms from selections
 * 2. Score each term by semantic relevance to context
 * 3. Sort by score (lowest first = remove first)
 * 4. Remove terms until within target length
 * 5. Rebuild prompt without removed terms
 */
export function smartTrimAssembledPrompt(input: SmartTrimAssembledInput): SmartTrimAssembledResult {
  const {
    promptText,
    selections,
    targetLength,
    preserveSubject = true,
  } = input;
  
  // If already within target, return original
  if (promptText.length <= targetLength) {
    return {
      optimized: promptText,
      wasTrimmed: false,
      removedTerms: [],
      originalLength: promptText.length,
      optimizedLength: promptText.length,
    };
  }
  
  // Get all terms with their categories
  const allTerms: Array<{ term: string; category: PromptCategory }> = [];
  for (const [category, terms] of Object.entries(selections)) {
    if (terms && Array.isArray(terms)) {
      for (const term of terms) {
        allTerms.push({ term, category: category as PromptCategory });
      }
    }
  }
  
  // Score each term by relevance
  const scoredTerms = allTerms.map(({ term, category }) => {
    // Protect subject if requested
    if (preserveSubject && category === 'subject') {
      return { term, category, score: 1000 }; // Very high score = keep
    }
    
    // Score by relevance using existing scoring
    const scored = _reorderByRelevance([term], category, selections, false, null);
    const score = scored[0]?.score ?? 50;
    
    return { term, category, score };
  });
  
  // Sort by score ASCENDING (lowest scores = remove first)
  scoredTerms.sort((a, b) => a.score - b.score);
  
  // Remove terms until within target
  let workingPrompt = promptText;
  const removedTerms: Array<{ term: string; category: PromptCategory; score: number }> = [];
  
  for (const { term, category, score } of scoredTerms) {
    if (workingPrompt.length <= targetLength) break;
    if (score >= 1000) continue; // Protected
    
    // Remove this term from the prompt
    const termPattern = new RegExp(
      `(^|,\\s*)${escapeRegexChars(term)}(\\s*,|$)`,
      'gi'
    );
    
    const newPrompt = workingPrompt
      .replace(termPattern, '$1')
      .replace(/,\s*,/g, ',') // Clean double commas
      .replace(/^\s*,\s*/, '') // Clean leading comma
      .replace(/\s*,\s*$/, '') // Clean trailing comma
      .trim();
    
    // Only count as removed if prompt actually changed
    if (newPrompt !== workingPrompt) {
      workingPrompt = newPrompt;
      removedTerms.push({ term, category, score });
    }
  }
  
  return {
    optimized: workingPrompt,
    wasTrimmed: removedTerms.length > 0,
    removedTerms,
    originalLength: promptText.length,
    optimizedLength: workingPrompt.length,
  };
}

/**
 * Escape special regex characters.
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
