// src/lib/prompt-intelligence/engines/suggestion-engine.ts
// ============================================================================
// SUGGESTION ENGINE
// ============================================================================
// Provides context-aware option suggestions based on current selections.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { 
  PromptContext,
  ScoredOption,
  SuggestedOption,
  SemanticMood,
  SemanticEra,
  MarketState,
} from '../types';
import { 
  getSemanticTag, 
  getSemanticTags,
  getFamilies,
  getMarketMood,
  getClustersForTerm,
  computeActiveClusters,
  getAffinityForTerm,
} from '../index';
import { detectConflicts } from './conflict-detection';
import { lookupCoOccurrence } from '@/lib/learning/co-occurrence-lookup';
import type { CoOccurrenceLookup } from '@/lib/learning/co-occurrence-lookup';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for building prompt context.
 */
export interface BuildContextInput {
  /** Current selections by category */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Custom/typed subject text */
  customSubject?: string;
  
  /** Whether market mood is enabled */
  marketMoodEnabled?: boolean;
  
  /** Current market state */
  marketState?: MarketState | null;
  
  /** Platform tier (1-4) for tier-aware scoring */
  tier?: number | null;

  /** Pre-built co-occurrence lookup from Phase 5 (null = no data) */
  coOccurrenceWeights?: CoOccurrenceLookup | null;

  /** Blend ratio [curated, learned] from Phase 5 (default: [1.0, 0.0]) */
  blendRatio?: [curated: number, learned: number];
}

/**
 * Input for scoring options.
 */
export interface ScoreOptionsInput {
  /** Options to score */
  options: string[];
  
  /** Category these options belong to */
  category: PromptCategory;
  
  /** Current prompt context */
  context: PromptContext;
  
  /** Whether to include score breakdown */
  includeBreakdown?: boolean;
}

/**
 * Input for getting suggestions.
 */
export interface GetSuggestionsInput {
  /** Current selections by category */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Custom/typed subject text */
  customSubject?: string;
  
  /** Category to get suggestions for (or all if not specified) */
  forCategory?: PromptCategory;
  
  /** Maximum suggestions per category */
  maxPerCategory?: number;
  
  /** Whether market mood is enabled */
  marketMoodEnabled?: boolean;
  
  /** Current market state */
  marketState?: MarketState | null;
  
  /** Minimum score threshold (0-100) */
  minScore?: number;
}

/**
 * Result of getting suggestions.
 */
export interface GetSuggestionsResult {
  /** Suggestions grouped by category */
  suggestions: Partial<Record<PromptCategory, SuggestedOption[]>>;
  
  /** The context used for scoring */
  context: PromptContext;
  
  /** Total suggestions across all categories */
  totalCount: number;
}

// ============================================================================
// Score Weights (tuned for optimal coherence - Phase 6)
// ============================================================================

const SCORE_WEIGHTS = {
  /** Base score for all options (lowered to allow more differentiation) */
  base: 40,
  
  /** Bonus for matching the active/dominant family */
  familyMatch: 30,
  
  /** Bonus for matching related families (not primary but connected) */
  relatedFamilyMatch: 18,
  
  /** Bonus for matching dominant mood (calm/intense/neutral) */
  moodMatch: 15,
  
  /** Bonus for matching era (past/present/future/timeless) */
  eraMatch: 12,
  
  /** Bonus for being in complements list of another term */
  complementBonus: 22,
  
  /** Bonus for being explicitly suggested by another selection */
  suggestBonus: 28,
  
  /** Penalty for potential conflict (increased for stronger warnings) */
  conflictPenalty: -35,
  
  /** Maximum market mood boost */
  marketBoostMax: 18,
  
  /** Bonus for matching multiple families (stacking coherence) */
  multiFamilyBonus: 8,
  
  /** Bonus for subject keyword relevance */
  subjectKeywordMatch: 15,
  
  /** Per shared cluster member bonus (Phase 1) */
  clusterPerMember: 8,
  
  /** Maximum cluster boost cap (Phase 1) */
  clusterMax: 25,
  
  /** Direct affinity boost from another selected term (Phase 1) */
  affinityBoost: 20,
  
  /** Direct affinity penalty from another selected term (Phase 1) */
  affinityPenalty: -15,

  /** Maximum co-occurrence boost from learned data (Phase 5) */
  coOccurrenceMax: 20,
};

// ============================================================================
// Tier-Aware Multipliers (Phase 1)
// ============================================================================
// Each tier optimises scoring for its prompt assembly strategy.
// Multiplier is applied to the *variable* portion of the score (score - base).
// 1.0 = no change, >1.0 = amplified differentiation, <1.0 = dampened.

const TIER_MULTIPLIERS: Record<number, {
  cluster: number;
  affinity: number;
  family: number;
  mood: number;
  label: string;
}> = {
  1: {  // CLIP — keyword coherence matters most
    cluster: 1.2,
    affinity: 1.0,
    family: 1.0,
    mood: 0.8,
    label: 'CLIP',
  },
  2: {  // MJ — MJ-specific affinities matter most
    cluster: 1.0,
    affinity: 1.2,
    family: 1.0,
    mood: 1.0,
    label: 'Midjourney',
  },
  3: {  // Natural Language — family coherence + mood matter more
    cluster: 0.8,
    affinity: 1.0,
    family: 1.2,
    mood: 1.3,
    label: 'Natural Language',
  },
  4: {  // Plain — dampened, "keep it simple" bias
    cluster: 0.5,
    affinity: 0.5,
    family: 0.5,
    mood: 0.5,
    label: 'Plain',
  },
};

// ============================================================================
// Context Building
// ============================================================================

/**
 * Extract keywords from subject text.
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  // Split on whitespace and punctuation
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  // Remove common stop words
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has',
    'have', 'been', 'being', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'not', 'but', 'yet', 'also', 'just', 'only', 'very',
  ]);
  
  return words.filter(w => !stopWords.has(w));
}

/**
 * Count family occurrences across all selections.
 */
function countFamilies(selections: Partial<Record<PromptCategory, string[]>>): Map<string, number> {
  const familyCounts = new Map<string, number>();
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.families) {
        for (const family of tag.families) {
          familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
        }
      }
    }
  }
  
  return familyCounts;
}

/**
 * Count mood occurrences across all selections.
 */
function countMoods(selections: Partial<Record<PromptCategory, string[]>>): Map<SemanticMood, number> {
  const moodCounts = new Map<SemanticMood, number>();
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.mood) {
        moodCounts.set(tag.mood, (moodCounts.get(tag.mood) || 0) + 1);
      }
    }
  }
  
  return moodCounts;
}

/**
 * Get the most common era from selections.
 */
function getDominantEra(selections: Partial<Record<PromptCategory, string[]>>): SemanticEra | null {
  const eraCounts = new Map<SemanticEra, number>();
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.era && tag.era !== 'timeless') {
        eraCounts.set(tag.era, (eraCounts.get(tag.era) || 0) + 1);
      }
    }
  }
  
  if (eraCounts.size === 0) return null;
  
  let maxEra: SemanticEra | null = null;
  let maxCount = 0;
  
  for (const [era, count] of eraCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxEra = era;
    }
  }
  
  return maxEra;
}

/**
 * Get all suggested terms from current selections.
 */
function collectSuggestions(
  selections: Partial<Record<PromptCategory, string[]>>
): Map<string, Set<string>> {
  const suggestions = new Map<string, Set<string>>(); // term -> set of sources
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.suggests) {
        for (const suggestList of Object.values(tag.suggests)) {
          for (const suggested of suggestList) {
            if (!suggestions.has(suggested)) {
              suggestions.set(suggested, new Set());
            }
            suggestions.get(suggested)!.add(term);
          }
        }
      }
    }
  }
  
  return suggestions;
}

/**
 * Get all complement terms from current selections.
 */
function collectComplements(
  selections: Partial<Record<PromptCategory, string[]>>
): Set<string> {
  const complements = new Set<string>();
  
  for (const terms of Object.values(selections)) {
    if (!terms) continue;
    
    for (const term of terms) {
      const tag = getSemanticTag(term);
      if (tag?.complements) {
        for (const complement of tag.complements) {
          complements.add(complement.toLowerCase());
        }
      }
    }
  }
  
  return complements;
}

/**
 * Build context from current selections.
 */
export function buildContext(input: BuildContextInput): PromptContext {
  const {
    selections,
    customSubject,
    marketMoodEnabled = false,
    marketState = null,
    tier = null,
    coOccurrenceWeights = null,
    blendRatio = [1.0, 0.0],
  } = input;
  
  // Extract subject keywords
  const subjectKeywords = extractKeywords(customSubject || '');
  
  // Count families
  const familyCounts = countFamilies(selections);
  
  // Find active (most common) family
  let activeFamily: string | null = null;
  let maxCount = 0;
  for (const [family, count] of familyCounts) {
    if (count > maxCount) {
      maxCount = count;
      activeFamily = family;
    }
  }
  
  // Get related families from the families data
  const relatedFamilies: string[] = [];
  if (activeFamily) {
    const familiesData = getFamilies();
    const activeFamilyData = familiesData.families[activeFamily];
    if (activeFamilyData?.related) {
      relatedFamilies.push(...activeFamilyData.related);
    }
  }
  
  // Also include all families that appear in selections
  for (const family of familyCounts.keys()) {
    if (!relatedFamilies.includes(family) && family !== activeFamily) {
      relatedFamilies.push(family);
    }
  }
  
  // Get dominant mood
  const moodCounts = countMoods(selections);
  let dominantMood: SemanticMood | null = null;
  maxCount = 0;
  for (const [mood, count] of moodCounts) {
    if (count > maxCount && mood !== 'neutral') {
      maxCount = count;
      dominantMood = mood;
    }
  }
  
  // Get dominant era
  const era = getDominantEra(selections);
  
  // Collect all selected terms
  const selectedTerms: string[] = [];
  for (const terms of Object.values(selections)) {
    if (terms) {
      selectedTerms.push(...terms);
    }
  }
  
  // Compute active clusters from selected terms (Phase 1)
  const activeClusters = computeActiveClusters(selectedTerms);
  
  return {
    subjectKeywords,
    activeFamily,
    relatedFamilies,
    dominantMood,
    era,
    selectedTerms,
    marketMoodEnabled,
    marketState,
    activeClusters,
    tier,
    coOccurrenceWeights,
    blendRatio,
  };
}

// ============================================================================
// Option Scoring
// ============================================================================

/**
 * Score a single option against the context.
 */
function scoreOption(
  option: string,
  category: PromptCategory,
  context: PromptContext,
  suggestions: Map<string, Set<string>>,
  complements: Set<string>,
  includeBreakdown: boolean
): ScoredOption {
  const tag = getSemanticTag(option);
  
  let score = SCORE_WEIGHTS.base;
  const breakdown = {
    familyMatch: 0,
    moodMatch: 0,
    eraMatch: 0,
    conflictPenalty: 0,
    complementBonus: 0,
    marketBoost: 0,
    multiFamilyBonus: 0,
    subjectKeywordMatch: 0,
    clusterBoost: 0,
    affinityBoost: 0,
    coOccurrenceBoost: 0,
  };
  
  if (tag) {
    // Family matching
    if (context.activeFamily && tag.families.includes(context.activeFamily)) {
      breakdown.familyMatch = SCORE_WEIGHTS.familyMatch;
      score += breakdown.familyMatch;
    } else if (tag.families.some(f => context.relatedFamilies.includes(f))) {
      breakdown.familyMatch = SCORE_WEIGHTS.relatedFamilyMatch;
      score += breakdown.familyMatch;
    }
    
    // Multi-family bonus: reward options that match multiple selected families
    if (tag.families.length > 0 && context.relatedFamilies.length > 1) {
      const matchCount = tag.families.filter(f => 
        context.relatedFamilies.includes(f)
      ).length;
      if (matchCount > 1) {
        breakdown.multiFamilyBonus = SCORE_WEIGHTS.multiFamilyBonus * (matchCount - 1);
        score += breakdown.multiFamilyBonus;
      }
    }
    
    // Mood matching
    if (context.dominantMood && tag.mood === context.dominantMood) {
      breakdown.moodMatch = SCORE_WEIGHTS.moodMatch;
      score += breakdown.moodMatch;
    }
    
    // Era matching
    if (context.era && tag.era === context.era) {
      breakdown.eraMatch = SCORE_WEIGHTS.eraMatch;
      score += breakdown.eraMatch;
    }
  }
  
  // Subject keyword matching - boost options that relate to subject text
  if (context.subjectKeywords.length > 0) {
    const optionLower = option.toLowerCase();
    const hasKeywordMatch = context.subjectKeywords.some(kw => 
      optionLower.includes(kw) || kw.includes(optionLower.split(' ')[0] ?? '')
    );
    if (hasKeywordMatch) {
      breakdown.subjectKeywordMatch = SCORE_WEIGHTS.subjectKeywordMatch;
      score += breakdown.subjectKeywordMatch;
    }
  }
  
  // Complement bonus
  if (complements.has(option.toLowerCase())) {
    breakdown.complementBonus = SCORE_WEIGHTS.complementBonus;
    score += breakdown.complementBonus;
  }
  
  // Suggestion bonus (from other selections)
  const lowerOption = option.toLowerCase();
  if (suggestions.has(option) || suggestions.has(lowerOption)) {
    breakdown.complementBonus += SCORE_WEIGHTS.suggestBonus;
    score += SCORE_WEIGHTS.suggestBonus;
  }
  
  // Conflict penalty - check if this option would conflict
  if (context.selectedTerms.length > 0) {
    const testSelections: Partial<Record<PromptCategory, string[]>> = {};
    testSelections[category] = [option];
    
    // Add existing selections
    for (const term of context.selectedTerms) {
      const termTag = getSemanticTag(term);
      if (termTag) {
        const cat = termTag.category as PromptCategory;
        if (!testSelections[cat]) {
          testSelections[cat] = [];
        }
        testSelections[cat]!.push(term);
      }
    }
    
    const conflictResult = detectConflicts({ 
      selections: testSelections,
      includeSoftConflicts: false // Only penalize hard conflicts
    });
    
    if (conflictResult.hasHardConflicts) {
      breakdown.conflictPenalty = SCORE_WEIGHTS.conflictPenalty;
      score += breakdown.conflictPenalty;
    }
  }
  
  // Market mood boost
  if (context.marketMoodEnabled && context.marketState) {
    const moodConfig = getMarketMood(context.marketState.type);
    if (moodConfig?.boost[category]) {
      const boostedOptions = moodConfig.boost[category] as string[];
      if (boostedOptions.some(b => 
        option.toLowerCase().includes(b.toLowerCase()) ||
        b.toLowerCase().includes(option.toLowerCase())
      )) {
        const boost = SCORE_WEIGHTS.marketBoostMax * context.marketState.intensity;
        breakdown.marketBoost = Math.round(boost);
        score += breakdown.marketBoost;
      }
    }
  }
  
  // === CLUSTER SCORING (Phase 1) ===
  // How many of the user's active clusters does this option belong to?
  // More shared clusters = higher relevance.
  if (context.activeClusters.size > 0) {
    const optionClusters = getClustersForTerm(option);
    let clusterScore = 0;
    for (const clusterId of optionClusters) {
      if (context.activeClusters.has(clusterId)) {
        // Count how many selected terms share this cluster
        let sharedCount = 0;
        for (const sel of context.selectedTerms) {
          const selClusters = getClustersForTerm(sel);
          if (selClusters.includes(clusterId)) {
            sharedCount++;
          }
        }
        clusterScore += Math.min(
          sharedCount * SCORE_WEIGHTS.clusterPerMember,
          SCORE_WEIGHTS.clusterMax
        );
      }
    }
    // Cap total cluster boost across all clusters
    breakdown.clusterBoost = Math.min(clusterScore, SCORE_WEIGHTS.clusterMax);
    score += breakdown.clusterBoost;
  }
  
  // === DIRECT AFFINITY SCORING (Phase 1) ===
  // Do any of the user's selections explicitly boost or penalise this option?
  if (context.selectedTerms.length > 0) {
    const optionLower = option.toLowerCase();
    let affinityScore = 0;
    for (const selectedTerm of context.selectedTerms) {
      const aff = getAffinityForTerm(selectedTerm);
      if (!aff) continue;
      if (aff.boosts.has(optionLower)) {
        affinityScore += SCORE_WEIGHTS.affinityBoost;
      }
      if (aff.penalises.has(optionLower)) {
        affinityScore += SCORE_WEIGHTS.affinityPenalty;
      }
    }
    breakdown.affinityBoost = affinityScore;
    score += affinityScore;
  }
  
  // === CO-OCCURRENCE SCORING (Phase 5) ===
  // Blend learned co-occurrence signal with curated scores.
  // Uses blendRatio to gradually shift weight from curated to learned
  // as more telemetry accumulates.
  let coOccurrenceBoostValue = 0;
  if (context.coOccurrenceWeights && context.blendRatio[1] > 0) {
    const rawCoOccurrence = lookupCoOccurrence(
      option,
      context.selectedTerms,
      context.tier,
      context.coOccurrenceWeights,
    );
    if (rawCoOccurrence > 0) {
      // Scale by learned weight portion of blend ratio and max boost
      coOccurrenceBoostValue = Math.round(
        (rawCoOccurrence / 100) * SCORE_WEIGHTS.coOccurrenceMax * context.blendRatio[1],
      );
      score += coOccurrenceBoostValue;
    }
  }
  
  // === TIER-AWARE MULTIPLIER (Phase 1) ===
  // Apply per-tier weight to the variable portion of the score.
  // This amplifies differentiation for keyword-focused tiers (1,2) and
  // dampens it for plain tiers (4).
  let tierMultiplierValue = 1.0;
  const tm = context.tier != null ? TIER_MULTIPLIERS[context.tier] : undefined;
  if (tm) {
    // Weight the variable components by tier preferences
    const tierAdjusted =
      breakdown.clusterBoost * (tm.cluster - 1.0) +
      breakdown.affinityBoost * (tm.affinity - 1.0) +
      breakdown.familyMatch * (tm.family - 1.0) +
      breakdown.moodMatch * (tm.mood - 1.0);
    score += tierAdjusted;
    tierMultiplierValue = (tm.cluster + tm.affinity + tm.family + tm.mood) / 4;
  }
  
  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, Math.round(score)));
  
  return {
    option,
    score,
    breakdown: includeBreakdown ? { ...breakdown, tierMultiplier: tierMultiplierValue, coOccurrenceBoost: coOccurrenceBoostValue } : undefined,
  };
}

/**
 * Score multiple options against the context.
 */
export function scoreOptions(input: ScoreOptionsInput): ScoredOption[] {
  const { options, category, context, includeBreakdown = false } = input;
  
  // Build lookup maps for suggestions and complements
  const selectionsMap: Partial<Record<PromptCategory, string[]>> = {};
  for (const term of context.selectedTerms) {
    const tag = getSemanticTag(term);
    if (tag) {
      const cat = tag.category as PromptCategory;
      if (!selectionsMap[cat]) {
        selectionsMap[cat] = [];
      }
      selectionsMap[cat]!.push(term);
    }
  }
  
  const suggestions = collectSuggestions(selectionsMap);
  const complements = collectComplements(selectionsMap);
  
  // Score each option
  const scored = options.map(option => 
    scoreOption(option, category, context, suggestions, complements, includeBreakdown)
  );
  
  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);
  
  return scored;
}

/**
 * Reorder options by relevance score.
 * Returns options in scored order.
 */
export function reorderByRelevance(
  options: string[],
  category: PromptCategory,
  selections: Partial<Record<PromptCategory, string[]>>,
  marketMoodEnabled = false,
  marketState: MarketState | null = null,
  tier: number | null = null,
  coOccurrenceWeights: CoOccurrenceLookup | null = null,
  blendRatio: [number, number] = [1.0, 0.0],
): ScoredOption[] {
  const context = buildContext({ 
    selections, 
    marketMoodEnabled, 
    marketState,
    tier,
    coOccurrenceWeights,
    blendRatio,
  });
  
  return scoreOptions({
    options,
    category,
    context,
    includeBreakdown: false,
  });
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generate educational "Why this?" suggestion reason text.
 * These explanations help users understand why a term is suggested
 * and how it contributes to their prompt's coherence.
 */
function generateReason(
  option: string,
  context: PromptContext,
  suggestions: Map<string, Set<string>>,
  complements: Set<string>,
  isMarketBoosted: boolean
): string {
  const reasons: string[] = [];
  
  // Check if suggested by another selection (most educational)
  const suggestedBy = suggestions.get(option) || suggestions.get(option.toLowerCase());
  if (suggestedBy && suggestedBy.size > 0) {
    const source = [...suggestedBy][0];
    reasons.push(`Pairs well with "${source}"`);
  }
  
  // Check if it's a complement
  if (complements.has(option.toLowerCase())) {
    reasons.push('Enhances your current look');
  }
  
  // Check family match (explain the aesthetic connection)
  const tag = getSemanticTag(option);
  if (tag && context.activeFamily && tag.families.includes(context.activeFamily)) {
    const familyName = context.activeFamily.replace(/-/g, ' ');
    reasons.push(`Part of ${familyName} aesthetic`);
  }
  
  // Check mood match (explain emotional coherence)
  if (tag?.mood && context.dominantMood && tag.mood === context.dominantMood) {
    const moodDescriptions: Record<string, string> = {
      intense: 'Adds dramatic impact',
      calm: 'Keeps the serene feel',
      neutral: 'Versatile addition',
    };
    const moodText = moodDescriptions[tag.mood] ?? `${tag.mood} mood`;
    reasons.push(moodText);
  }
  
  // Era match (explain temporal coherence)
  if (tag?.era) {
    const eraDescriptions: Record<string, string> = {
      futuristic: 'Futuristic vibes',
      contemporary: 'Modern touch',
      historical: 'Classic feel',
      timeless: 'Timeless appeal',
    };
    const eraText = eraDescriptions[tag.era];
    if (eraText && !reasons.some(r => r.includes(tag.era ?? ''))) {
      reasons.push(eraText);
    }
  }
  
  // Market boost
  if (isMarketBoosted) {
    reasons.push('Trending now');
  }
  
  // If no specific reason, provide context-based fallback
  if (reasons.length === 0) {
    if (tag?.families?.length) {
      const family = tag.families[0];
      if (family) {
        reasons.push(`Works with ${family.replace(/-/g, ' ')} styles`);
      } else {
        reasons.push('Versatile choice');
      }
    } else {
      reasons.push('High relevance to your prompt');
    }
  }
  
  return reasons.join(' • ');
}

/**
 * Get top suggestions for a category.
 */
export function getSuggestionsForCategory(
  category: PromptCategory,
  context: PromptContext,
  maxSuggestions: number,
  minScore: number,
  existingSelections: string[]
): SuggestedOption[] {
  const semanticTags = getSemanticTags();
  
  // Get all options for this category
  const categoryOptions: string[] = [];
  for (const [option, tag] of Object.entries(semanticTags.options)) {
    if (tag.category === category && !existingSelections.includes(option)) {
      categoryOptions.push(option);
    }
  }
  
  // Build lookup maps
  const selectionsMap: Partial<Record<PromptCategory, string[]>> = {};
  for (const term of context.selectedTerms) {
    const tag = getSemanticTag(term);
    if (tag) {
      const cat = tag.category as PromptCategory;
      if (!selectionsMap[cat]) {
        selectionsMap[cat] = [];
      }
      selectionsMap[cat]!.push(term);
    }
  }
  
  const suggestions = collectSuggestions(selectionsMap);
  const complements = collectComplements(selectionsMap);
  
  // Score all options
  const scored = scoreOptions({
    options: categoryOptions,
    category,
    context,
    includeBreakdown: true,
  });
  
  // Filter by minimum score and convert to suggestions
  const results: SuggestedOption[] = [];
  
  for (const scoredOption of scored) {
    if (scoredOption.score < minScore) break; // Already sorted, so we can stop
    if (results.length >= maxSuggestions) break;
    
    const isMarketBoosted = (scoredOption.breakdown?.marketBoost ?? 0) > 0;
    
    results.push({
      option: scoredOption.option,
      category,
      score: scoredOption.score,
      reason: generateReason(
        scoredOption.option, 
        context, 
        suggestions, 
        complements, 
        isMarketBoosted
      ),
      isMarketBoosted,
    });
  }
  
  return results;
}

/**
 * Get suggestions across all categories or a specific category.
 */
export function getSuggestions(input: GetSuggestionsInput): GetSuggestionsResult {
  const {
    selections,
    customSubject,
    forCategory,
    maxPerCategory = 5,
    marketMoodEnabled = false,
    marketState = null,
    minScore = 55,
  } = input;
  
  // Build context
  const context = buildContext({
    selections,
    customSubject,
    marketMoodEnabled,
    marketState,
  });
  
  // Determine which categories to process
  const categoriesToProcess: PromptCategory[] = forCategory 
    ? [forCategory]
    : ['style', 'lighting', 'colour', 'atmosphere', 'environment', 
       'action', 'composition', 'camera', 'materials', 'fidelity'];
  
  // Get suggestions for each category
  const suggestions: Partial<Record<PromptCategory, SuggestedOption[]>> = {};
  let totalCount = 0;
  
  for (const category of categoriesToProcess) {
    const existing = selections[category] || [];
    const categorySuggestions = getSuggestionsForCategory(
      category,
      context,
      maxPerCategory,
      minScore,
      existing
    );
    
    if (categorySuggestions.length > 0) {
      suggestions[category] = categorySuggestions;
      totalCount += categorySuggestions.length;
    }
  }
  
  return {
    suggestions,
    context,
    totalCount,
  };
}

/**
 * Get the single best suggestion for each empty category.
 * Useful for "auto-complete" functionality.
 */
export function getAutoCompleteSuggestions(
  selections: Partial<Record<PromptCategory, string[]>>,
  marketMoodEnabled = false,
  marketState: MarketState | null = null
): SuggestedOption[] {
  const result = getSuggestions({
    selections,
    maxPerCategory: 1,
    marketMoodEnabled,
    marketState,
    minScore: 60,
  });
  
  const suggestions: SuggestedOption[] = [];
  
  for (const [category, categoryResults] of Object.entries(result.suggestions)) {
    // Only suggest for empty categories
    const firstResult = categoryResults[0];
    if (!selections[category as PromptCategory]?.length && firstResult) {
      suggestions.push(firstResult);
    }
  }
  
  return suggestions;
}
