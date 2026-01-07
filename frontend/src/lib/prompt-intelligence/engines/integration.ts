// src/lib/prompt-intelligence/engines/integration.ts
// ============================================================================
// PROMPT INTELLIGENCE INTEGRATION
// ============================================================================
// High-level API combining all engines for easy consumption by UI components.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { 
  MarketState,
  PromptDNA,
  CategoryFillStatus,
  CategoryCoherenceStatus,
  DetectedConflict,
  SuggestedOption,
  SemanticMood,
} from '../types';

import { 
  detectConflicts,
  type ConflictDetectionResult,
} from './conflict-detection';

import {
  getSuggestions,
  reorderByRelevance,
  type GetSuggestionsResult,
} from './suggestion-engine';

import {
  detectMarketState,
  getMarketMoodSuggestions,
  shouldShowMarketMood,
  getMarketMoodTheme,
  getMarketMoodIcon,
  type MarketDataInput,
} from './market-mood-engine';

import {
  formatPromptForPlatform,
  smartTrimPrompt,
  getPlatformRecommendations,
  estimateTokenCount,
  type FormatPromptResult,
  type PromptTrimResult,
} from './platform-optimization';

import { getFamilies, getSemanticTag } from '../index';

// ============================================================================
// Types
// ============================================================================

/**
 * Complete prompt state for analysis.
 */
export interface PromptState {
  /** Subject text (typed by user) */
  subject: string;
  
  /** Selected options by category */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Custom typed values by category */
  customValues?: Partial<Record<PromptCategory, string>>;
  
  /** Selected negative terms */
  negatives: string[];
  
  /** Target platform ID */
  platformId: string;
}

/**
 * Market context for prompt intelligence.
 */
export interface MarketContext {
  /** Whether market mood feature is enabled */
  enabled: boolean;
  
  /** Live market data (FX pairs, exchanges, etc.) */
  data?: MarketDataInput;
}

/**
 * Complete analysis result from prompt intelligence.
 */
export interface PromptAnalysis {
  /** The prompt DNA breakdown */
  dna: PromptDNA;
  
  /** Detected conflicts */
  conflicts: ConflictDetectionResult;
  
  /** Context-aware suggestions */
  suggestions: GetSuggestionsResult;
  
  /** Market mood suggestions (if enabled) */
  marketSuggestions: SuggestedOption[];
  
  /** Formatted prompt for the platform */
  formatted: FormatPromptResult;
  
  /** Overall health score (0-100) */
  healthScore: number;
  
  /** Quick summary for UI badges */
  summary: PromptSummary;
}

/**
 * Quick summary for UI display.
 */
export interface PromptSummary {
  /** Number of filled categories */
  filledCategories: number;
  
  /** Total categories available */
  totalCategories: number;
  
  /** Fill percentage */
  fillPercent: number;
  
  /** Number of conflicts */
  conflictCount: number;
  
  /** Has hard conflicts */
  hasHardConflicts: boolean;
  
  /** Dominant style family (if detected) */
  dominantFamily: string | null;
  
  /** Estimated token count */
  tokenEstimate: number;
  
  /** Whether near platform limit */
  nearLimit: boolean;
  
  /** Market mood state (if active) */
  marketMood: {
    active: boolean;
    type: string;
    description: string;
  } | null;
}

/**
 * Options for category reordering.
 */
export interface ReorderOptionsInput {
  /** Options to reorder */
  options: string[];
  
  /** Category these options belong to */
  category: PromptCategory;
  
  /** Current selections */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Market context */
  market?: MarketContext;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LIST: PromptCategory[] = [
  'style', 'lighting', 'colour', 'atmosphere', 'environment',
  'action', 'composition', 'camera', 'materials', 'fidelity',
];

// ============================================================================
// DNA Analysis
// ============================================================================

/**
 * Build prompt DNA from current state.
 */
function buildPromptDNA(
  state: PromptState,
  conflicts: ConflictDetectionResult
): PromptDNA {
  const { selections } = state;
  
  // Calculate fill status for each category
  const categoryFill: Record<PromptCategory, CategoryFillStatus> = {} as Record<PromptCategory, CategoryFillStatus>;
  const categoryCoherence: Record<PromptCategory, CategoryCoherenceStatus> = {} as Record<PromptCategory, CategoryCoherenceStatus>;
  let filledCount = 0;
  
  for (const category of CATEGORY_LIST) {
    const selected = selections[category] ?? [];
    const count = selected.length;
    
    // Fill status: 'filled' or 'empty'
    categoryFill[category] = count > 0 ? 'filled' : 'empty';
    if (count > 0) filledCount++;
    
    // Coherence status - check if category has conflicts
    const hasConflictInCategory = conflicts.conflicts.some(
      c => c.categories.includes(category)
    );
    categoryCoherence[category] = hasConflictInCategory ? 'conflict' : (count > 0 ? 'coherent' : 'neutral');
  }
  
  // Also add negative category
  categoryFill['negative'] = state.negatives.length > 0 ? 'filled' : 'empty';
  categoryCoherence['negative'] = 'neutral';
  
  // Get active families from selections
  const familyCounts = new Map<string, number>();
  const moodCounts = new Map<SemanticMood, number>();
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.families) {
        for (const family of tag.families) {
          familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
        }
      }
      if (tag?.mood) {
        moodCounts.set(tag.mood, (moodCounts.get(tag.mood) || 0) + 1);
      }
    }
  }
  
  // Find dominant family
  let dominantFamily: string | null = null;
  let maxFamilyCount = 0;
  for (const [family, count] of familyCounts) {
    if (count > maxFamilyCount) {
      maxFamilyCount = count;
      dominantFamily = family;
    }
  }
  
  // Find dominant mood
  let dominantMood: SemanticMood | null = null;
  let maxMoodCount = 0;
  for (const [mood, count] of moodCounts) {
    if (count > maxMoodCount && mood !== 'neutral') {
      maxMoodCount = count;
      dominantMood = mood;
    }
  }
  
  // Calculate coherence score
  const families = getFamilies();
  let coherenceScore = 100;
  const activeFamilies = [...familyCounts.keys()];
  
  // Check for opposing families
  for (const family of activeFamilies) {
    const familyData = families.families[family];
    if (familyData?.opposes) {
      for (const opposed of familyData.opposes) {
        if (activeFamilies.includes(opposed)) {
          coherenceScore -= 15; // Penalty for opposing families
        }
      }
    }
  }
  
  // Penalty for conflicts
  coherenceScore -= conflicts.hardCount * 20;
  coherenceScore -= conflicts.softCount * 5;
  
  coherenceScore = Math.max(0, Math.min(100, coherenceScore));
  
  return {
    coherenceScore,
    categoryFill,
    categoryCoherence,
    conflicts: conflicts.conflicts,
    dominantFamily,
    dominantMood,
    filledCount,
    totalCategories: CATEGORY_LIST.length,
  };
}

/**
 * Calculate overall health score.
 */
function calculateHealthScore(
  dna: PromptDNA, 
  hasSubject: boolean
): number {
  let score = 50; // Base score
  
  // Subject bonus
  if (hasSubject) {
    score += 20;
  }
  
  // Fill bonus (more categories = better)
  score += Math.floor((dna.filledCount / dna.totalCategories) * 15);
  
  // Coherence contribution
  score += Math.floor(dna.coherenceScore * 0.15);
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Main Integration Functions
// ============================================================================

/**
 * Perform complete prompt analysis.
 * This is the main entry point for UI components.
 * 
 * @example
 * ```ts
 * const analysis = analyzePrompt({
 *   subject: 'a cyberpunk warrior',
 *   selections: { style: ['cyberpunk', 'neon noir'] },
 *   negatives: ['blurry'],
 *   platformId: 'midjourney',
 * });
 * 
 * if (analysis.conflicts.hasHardConflicts) {
 *   showWarning(analysis.conflicts.conflicts[0].reason);
 * }
 * ```
 */
export function analyzePrompt(
  state: PromptState,
  market?: MarketContext
): PromptAnalysis {
  const { selections, customValues, negatives, platformId } = state;
  
  // Detect conflicts first (needed for DNA)
  const conflicts = detectConflicts({
    selections,
    customValues,
    includeSoftConflicts: true,
  });
  
  // Build DNA
  const dna = buildPromptDNA(state, conflicts);
  
  // Build context for suggestions
  const marketState = market?.enabled && market.data 
    ? detectMarketState(market.data).state 
    : null;
  
  // Get suggestions
  const suggestions = getSuggestions({
    selections,
    customSubject: state.subject,
    maxPerCategory: 5,
    marketMoodEnabled: Boolean(market?.enabled),
    marketState,
    minScore: 55,
  });
  
  // Get market suggestions
  const marketSuggestions: SuggestedOption[] = marketState && shouldShowMarketMood(marketState)
    ? getMarketMoodSuggestions(marketState, { maxPerCategory: 3 })
    : [];
  
  // Format prompt
  const formatted = formatPromptForPlatform({
    selections,
    customValues: { ...customValues, subject: state.subject },
    negatives,
    platformId,
  });
  
  // Calculate health score
  const hasSubject = state.subject.trim().length > 0;
  const healthScore = calculateHealthScore(dna, hasSubject);
  
  // Build summary
  const platformRecs = getPlatformRecommendations(platformId);
  const tokenEstimate = estimateTokenCount(formatted.positivePrompt);
  
  const summary: PromptSummary = {
    filledCategories: dna.filledCount,
    totalCategories: dna.totalCategories,
    fillPercent: Math.round((dna.filledCount / dna.totalCategories) * 100),
    conflictCount: conflicts.conflicts.length,
    hasHardConflicts: conflicts.hasHardConflicts,
    dominantFamily: dna.dominantFamily,
    tokenEstimate,
    nearLimit: formatted.charCount > platformRecs.maxChars * 0.8,
    marketMood: marketState && shouldShowMarketMood(marketState) ? {
      active: true,
      type: marketState.type,
      description: getMarketMoodDescription(marketState),
    } : null,
  };
  
  return {
    dna,
    conflicts,
    suggestions,
    marketSuggestions,
    formatted,
    healthScore,
    summary,
  };
}

/**
 * Get human-readable market mood description.
 */
function getMarketMoodDescription(state: MarketState): string {
  const descriptions: Record<string, string> = {
    'market_opening': 'Market opening',
    'market_closing': 'Market closing',
    'high_volatility': 'High volatility',
    'low_volatility': 'Calm markets',
    'currency_strength_usd': 'USD strength',
    'currency_strength_gbp': 'GBP strength',
    'currency_strength_eur': 'EUR strength',
    'gold_rising': 'Gold rising',
    'gold_falling': 'Gold falling',
    'crypto_pumping': 'Crypto pumping',
    'neutral': 'Normal',
  };
  
  return descriptions[state.type] || state.type;
}

/**
 * Quick conflict check (lighter weight than full analysis).
 */
export function quickConflictCheck(
  selections: Partial<Record<PromptCategory, string[]>>
): { hasConflicts: boolean; hardCount: number; firstConflict: DetectedConflict | null } {
  const result = detectConflicts({ selections, includeSoftConflicts: false });
  
  return {
    hasConflicts: result.hasConflicts,
    hardCount: result.hardCount,
    firstConflict: result.conflicts[0] ?? null,
  };
}

/**
 * Get smart-ordered options for a category dropdown.
 */
export function getOrderedOptions(input: ReorderOptionsInput): Array<{
  option: string;
  score: number;
  isRecommended: boolean;
}> {
  const { options, category, selections, market } = input;
  
  const marketState = market?.enabled && market?.data
    ? detectMarketState(market.data).state
    : null;
  
  const scored = reorderByRelevance(
    options,
    category,
    selections,
    Boolean(market?.enabled),
    marketState
  );
  
  return scored.map(s => ({
    option: s.option,
    score: s.score,
    isRecommended: s.score >= 65,
  }));
}

/**
 * Get top suggestions for quick access UI.
 */
export function getTopSuggestions(
  selections: Partial<Record<PromptCategory, string[]>>,
  options?: { 
    maxTotal?: number;
    market?: MarketContext;
  }
): SuggestedOption[] {
  const { maxTotal = 10, market } = options ?? {};
  
  const marketState = market?.enabled && market?.data
    ? detectMarketState(market.data).state
    : null;
  
  const result = getSuggestions({
    selections,
    maxPerCategory: 3,
    marketMoodEnabled: Boolean(market?.enabled),
    marketState,
    minScore: 60,
  });
  
  // Flatten and take top N
  const allSuggestions: SuggestedOption[] = [];
  for (const categorySuggestions of Object.values(result.suggestions)) {
    allSuggestions.push(...categorySuggestions);
  }
  
  // Sort by score and take top
  allSuggestions.sort((a, b) => b.score - a.score);
  return allSuggestions.slice(0, maxTotal);
}

/**
 * Format prompt with trimming if needed.
 */
export function formatAndTrim(
  state: PromptState,
  maxChars?: number
): FormatPromptResult & { trimDetails: PromptTrimResult | null } {
  const { selections, customValues, negatives, platformId, subject } = state;
  
  const platformRecs = getPlatformRecommendations(platformId);
  const limit = maxChars ?? platformRecs.maxChars;
  
  // First try without trimming
  const result = formatPromptForPlatform({
    selections,
    customValues: { ...customValues, subject },
    negatives,
    platformId,
    maxChars: limit,
  });
  
  let trimDetails: PromptTrimResult | null = null;
  
  if (result.wasTrimmed) {
    // Get all terms for trim analysis
    const allTerms: string[] = [];
    for (const terms of Object.values(selections)) {
      if (terms) allTerms.push(...terms);
    }
    
    trimDetails = smartTrimPrompt({
      terms: allTerms,
      category: 'style',
      maxChars: limit - subject.length - 10,
    });
  }
  
  return {
    ...result,
    trimDetails,
  };
}

/**
 * Get market mood UI data.
 */
export function getMarketMoodUI(market: MarketContext): {
  active: boolean;
  state: MarketState | null;
  theme: { primary: string; secondary: string; accent: string } | null;
  icon: string | null;
  description: string | null;
} | null {
  if (!market.enabled || !market.data) {
    return null;
  }
  
  const result = detectMarketState(market.data);
  
  if (!shouldShowMarketMood(result.state)) {
    return {
      active: false,
      state: result.state,
      theme: null,
      icon: null,
      description: null,
    };
  }
  
  return {
    active: true,
    state: result.state,
    theme: getMarketMoodTheme(result.state.type),
    icon: getMarketMoodIcon(result.state.type),
    description: result.description,
  };
}

/**
 * Check if adding a term would cause issues.
 */
export function previewTermAddition(
  currentSelections: Partial<Record<PromptCategory, string[]>>,
  newTerm: string,
  category: PromptCategory
): {
  wouldConflict: boolean;
  conflict: DetectedConflict | null;
  suggestedAlternatives: string[];
} {
  // Create test selections with the new term
  const testSelections = { ...currentSelections };
  testSelections[category] = [...(testSelections[category] ?? []), newTerm];
  
  // Check for conflicts
  const beforeConflicts = detectConflicts({ selections: currentSelections });
  const afterConflicts = detectConflicts({ selections: testSelections });
  
  // Find new conflicts
  const beforeTerms = new Set(beforeConflicts.conflicts.map(c => c.terms.sort().join('|')));
  const newConflicts = afterConflicts.conflicts.filter(
    c => !beforeTerms.has(c.terms.sort().join('|'))
  );
  
  // Get alternatives if there's a conflict
  let suggestedAlternatives: string[] = [];
  if (newConflicts.length > 0) {
    const suggestions = getSuggestions({
      selections: currentSelections,
      forCategory: category,
      maxPerCategory: 3,
      minScore: 60,
    });
    suggestedAlternatives = (suggestions.suggestions[category] ?? [])
      .map(s => s.option)
      .filter(o => o !== newTerm);
  }
  
  return {
    wouldConflict: newConflicts.length > 0,
    conflict: newConflicts[0] ?? null,
    suggestedAlternatives,
  };
}
