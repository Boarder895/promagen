// src/lib/prompt-intelligence/combine.ts
// ============================================================================
// COMBINE ENGINE
// ============================================================================
// Merges similar/redundant terms in prompts to reduce duplication.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import { getSemanticTag } from './index';

// ============================================================================
// Types
// ============================================================================

export interface CombineOptions {
  /** Similarity threshold (0-1). Default: 0.7 */
  similarityThreshold?: number;
  /** Whether to combine across categories. Default: false */
  crossCategory?: boolean;
  /** Categories to exclude from combining */
  excludeCategories?: PromptCategory[];
}

export interface CombineResult {
  /** Merged terms by category */
  merged: Partial<Record<PromptCategory, string[]>>;
  /** Number of terms reduced */
  termsSaved: number;
  /** Merges that occurred (for logging/UI) */
  merges: Array<{ from: string[]; to: string; category: PromptCategory }>;
}

export interface ConsolidationSuggestion {
  /** Terms that could be consolidated */
  terms: string[];
  /** Human-readable suggestion */
  suggestion: string;
  /** Category the terms belong to */
  category: PromptCategory;
}

// ============================================================================
// Similarity Helpers
// ============================================================================

/**
 * Calculate word overlap similarity between two terms.
 */
function wordOverlapSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  // Jaccard similarity
  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap / union;
}

/**
 * Check if two terms are semantically similar using tags.
 */
function semanticSimilarity(a: string, b: string): number {
  const tagA = getSemanticTag(a);
  const tagB = getSemanticTag(b);
  
  if (!tagA || !tagB) return 0;
  
  let score = 0;
  
  // Same category
  if (tagA.category === tagB.category) score += 0.3;
  
  // Overlapping families
  const familiesA = new Set(tagA.families);
  const familiesB = new Set(tagB.families);
  let familyOverlap = 0;
  for (const f of familiesA) {
    if (familiesB.has(f)) familyOverlap++;
  }
  const totalFamilies = new Set([...tagA.families, ...tagB.families]).size;
  const familyJaccard = totalFamilies > 0 ? familyOverlap / totalFamilies : 0;
  score += familyJaccard * 0.4;
  
  // Same mood
  if (tagA.mood && tagB.mood && tagA.mood === tagB.mood) score += 0.2;
  
  // Same era
  if (tagA.era && tagB.era && tagA.era === tagB.era) score += 0.1;
  
  return score;
}

/**
 * Combined similarity score (word overlap + semantic).
 */
function combinedSimilarity(a: string, b: string): number {
  const wordSim = wordOverlapSimilarity(a, b);
  const semanticSim = semanticSimilarity(a, b);
  
  // Weight semantic higher when available
  return Math.max(wordSim, semanticSim * 0.8 + wordSim * 0.2);
}

// ============================================================================
// Merge Strategies
// ============================================================================

/**
 * Choose the best representative term from a group of similar terms.
 * Prefers shorter, more common terms.
 */
function chooseBestTerm(terms: string[]): string {
  if (terms.length === 0) return '';
  
  const firstTerm = terms[0];
  if (!firstTerm) return '';
  if (terms.length === 1) return firstTerm;
  
  // Score each term
  const scored = terms.map(term => {
    let score = 0;
    
    // Prefer shorter terms (more concise)
    score -= term.length * 0.1;
    
    // Prefer terms with semantic tags (known good terms)
    if (getSemanticTag(term)) score += 5;
    
    // Prefer single words
    if (!term.includes(' ')) score += 2;
    
    // Prefer lowercase (more natural in prompts)
    if (term === term.toLowerCase()) score += 1;
    
    return { term, score };
  });
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  const best = scored[0];
  return best?.term ?? firstTerm;
}

/**
 * Group similar terms together.
 */
function groupSimilarTerms(terms: string[], threshold: number): string[][] {
  if (terms.length <= 1) return [terms];
  
  const groups: string[][] = [];
  const assigned = new Set<string>();
  
  for (const term of terms) {
    if (assigned.has(term)) continue;
    
    const group = [term];
    assigned.add(term);
    
    for (const other of terms) {
      if (assigned.has(other)) continue;
      
      if (combinedSimilarity(term, other) >= threshold) {
        group.push(other);
        assigned.add(other);
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Combine similar terms within a category.
 */
export function combineTermsInCategory(
  terms: string[],
  options: CombineOptions = {}
): { merged: string[]; saved: number; merges: Array<{ from: string[]; to: string }> } {
  const { similarityThreshold = 0.7 } = options;
  
  if (terms.length <= 1) {
    return { merged: terms, saved: 0, merges: [] };
  }
  
  const groups = groupSimilarTerms(terms, similarityThreshold);
  const merged: string[] = [];
  const merges: Array<{ from: string[]; to: string }> = [];
  
  for (const group of groups) {
    const best = chooseBestTerm(group);
    merged.push(best);
    
    if (group.length > 1) {
      merges.push({ from: group, to: best });
    }
  }
  
  return {
    merged,
    saved: terms.length - merged.length,
    merges,
  };
}

/**
 * Combine similar terms across all categories.
 */
export function combineAllTerms(
  selections: Partial<Record<PromptCategory, string[]>>,
  options: CombineOptions = {}
): CombineResult {
  const {
    excludeCategories = ['subject', 'negative'], // Don't combine subjects or negatives
  } = options;
  
  const merged: Partial<Record<PromptCategory, string[]>> = {};
  const allMerges: CombineResult['merges'] = [];
  let totalSaved = 0;
  
  for (const [cat, terms] of Object.entries(selections)) {
    const category = cat as PromptCategory;
    
    if (!terms || terms.length === 0) {
      merged[category] = [];
      continue;
    }
    
    if (excludeCategories.includes(category)) {
      merged[category] = [...terms];
      continue;
    }
    
    const result = combineTermsInCategory(terms, options);
    merged[category] = result.merged;
    totalSaved += result.saved;
    
    for (const merge of result.merges) {
      allMerges.push({ ...merge, category });
    }
  }
  
  return {
    merged,
    termsSaved: totalSaved,
    merges: allMerges,
  };
}

/**
 * Detect redundant modifiers (e.g., "very detailed" and "highly detailed").
 */
export function detectRedundantModifiers(terms: string[]): string[][] {
  const redundantPatterns = [
    // Intensity modifiers
    ['very', 'highly', 'extremely', 'ultra', 'super'],
    // Quality modifiers
    ['detailed', 'intricate', 'elaborate'],
    // Resolution modifiers
    ['4k', '8k', 'high resolution', 'high res', 'hd'],
    // Style consistency
    ['consistent style', 'coherent style', 'unified style'],
  ];
  
  const redundantGroups: string[][] = [];
  
  for (const pattern of redundantPatterns) {
    const matches = terms.filter(term => 
      pattern.some(p => term.toLowerCase().includes(p))
    );
    
    if (matches.length > 1) {
      redundantGroups.push(matches);
    }
  }
  
  return redundantGroups;
}

/**
 * Suggest term consolidations (for UI feedback).
 */
export function suggestConsolidations(
  selections: Partial<Record<PromptCategory, string[]>>
): ConsolidationSuggestion[] {
  const suggestions: ConsolidationSuggestion[] = [];
  
  for (const [cat, terms] of Object.entries(selections)) {
    const category = cat as PromptCategory;
    if (!terms || terms.length <= 1) continue;
    
    // Check for redundant modifiers
    const redundant = detectRedundantModifiers(terms);
    for (const group of redundant) {
      if (group.length > 1) {
        suggestions.push({
          terms: group,
          suggestion: `Consider using just "${chooseBestTerm(group)}" instead of multiple similar modifiers`,
          category,
        });
      }
    }
    
    // Check for high similarity pairs
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const termI = terms[i];
        const termJ = terms[j];
        if (!termI || !termJ) continue;
        
        const sim = combinedSimilarity(termI, termJ);
        if (sim >= 0.6 && sim < 0.9) {
          // Similar but not identical - suggest consolidation
          suggestions.push({
            terms: [termI, termJ],
            suggestion: `"${termI}" and "${termJ}" are similar - consider keeping just one`,
            category,
          });
        }
      }
    }
  }
  
  return suggestions;
}

/**
 * Quick check if terms have potential redundancy.
 */
export function hasRedundantTerms(
  selections: Partial<Record<PromptCategory, string[]>>
): boolean {
  for (const terms of Object.values(selections)) {
    if (!terms || terms.length <= 1) continue;
    
    // Quick check for redundant modifiers
    if (detectRedundantModifiers(terms).length > 0) return true;
    
    // Quick similarity check
    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const termI = terms[i];
        const termJ = terms[j];
        if (!termI || !termJ) continue;
        
        if (combinedSimilarity(termI, termJ) >= 0.7) return true;
      }
    }
  }
  
  return false;
}
