// src/lib/prompt-intelligence/engines/conflict-detection.ts
// ============================================================================
// CONFLICT DETECTION ENGINE
// ============================================================================
// Detects conflicts between user's prompt selections in real-time.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { 
  DetectedConflict, 
  ConflictSeverity,
  SemanticMood,
  SemanticEra 
} from '../types';
import { getConflicts, getSemanticTag } from '../index';

// ============================================================================
// Types
// ============================================================================

/**
 * Input for conflict detection.
 */
export interface ConflictDetectionInput {
  /** All selected terms across categories */
  selections: Partial<Record<PromptCategory, string[]>>;
  
  /** Custom/typed values (also check these) */
  customValues?: Partial<Record<PromptCategory, string>>;
  
  /** Whether to include soft conflicts (default: true) */
  includeSoftConflicts?: boolean;
}

/**
 * Result of conflict detection.
 */
export interface ConflictDetectionResult {
  /** All detected conflicts */
  conflicts: DetectedConflict[];
  
  /** Number of hard conflicts */
  hardCount: number;
  
  /** Number of soft conflicts */
  softCount: number;
  
  /** Whether prompt has any hard conflicts */
  hasHardConflicts: boolean;
  
  /** Whether prompt has any conflicts at all */
  hasConflicts: boolean;
  
  /** Overall conflict severity (worst found) */
  worstSeverity: ConflictSeverity | null;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Extract all terms from selections and custom values.
 */
function extractAllTerms(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues?: Partial<Record<PromptCategory, string>>
): Map<string, PromptCategory> {
  const termToCategory = new Map<string, PromptCategory>();
  
  // Add selected terms
  for (const [category, terms] of Object.entries(selections)) {
    if (terms) {
      for (const term of terms) {
        if (term) {
          termToCategory.set(term.toLowerCase(), category as PromptCategory);
        }
      }
    }
  }
  
  // Add custom values (extract keywords)
  if (customValues) {
    for (const [category, value] of Object.entries(customValues)) {
      if (value) {
        // For custom text, we check if any term appears in it
        termToCategory.set(value.toLowerCase(), category as PromptCategory);
      }
    }
  }
  
  return termToCategory;
}

/**
 * Check if two terms match (case-insensitive, supports partial matching for custom text).
 */
function termsMatch(term1: string, term2: string): boolean {
  const t1 = term1.toLowerCase();
  const t2 = term2.toLowerCase();
  return t1 === t2 || t1.includes(t2) || t2.includes(t1);
}

// ============================================================================
// Conflict Detection Functions
// ============================================================================

/**
 * Check for conflicts defined in conflicts.json.
 */
function checkDefinedConflicts(
  termToCategory: Map<string, PromptCategory>,
  includeSoft: boolean
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const conflictsData = getConflicts();
  const allTerms = [...termToCategory.keys()];
  
  for (const conflictDef of Object.values(conflictsData.conflicts)) {
    // Skip soft conflicts if not requested
    if (!includeSoft && conflictDef.severity === 'soft') {
      continue;
    }
    
    // Check if all conflict terms are present
    const matchedTerms: string[] = [];
    const matchedCategories: PromptCategory[] = [];
    
    for (const conflictTerm of conflictDef.terms) {
      const lowerConflictTerm = conflictTerm.toLowerCase();
      
      // Check each user term
      for (const userTerm of allTerms) {
        if (termsMatch(userTerm, lowerConflictTerm)) {
          matchedTerms.push(conflictTerm);
          const category = termToCategory.get(userTerm);
          if (category && !matchedCategories.includes(category)) {
            matchedCategories.push(category);
          }
          break;
        }
      }
    }
    
    // If at least 2 conflicting terms are present, it's a conflict
    if (matchedTerms.length >= 2) {
      conflicts.push({
        terms: matchedTerms,
        reason: conflictDef.reason,
        suggestion: conflictDef.suggestion,
        severity: conflictDef.severity as ConflictSeverity,
        categories: matchedCategories,
      });
    }
  }
  
  return conflicts;
}

/**
 * Check for conflicts defined in semantic tags.
 */
function checkSemanticTagConflicts(
  termToCategory: Map<string, PromptCategory>,
  _includeSoft: boolean
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const allTerms = [...termToCategory.keys()];
  const seenPairs = new Set<string>(); // Avoid duplicate conflicts
  
  for (const term of allTerms) {
    const tag = getSemanticTag(term);
    if (!tag?.conflicts) continue;
    
    for (const conflictWith of tag.conflicts) {
      const lowerConflict = conflictWith.toLowerCase();
      
      // Check if the conflicting term is also selected
      for (const otherTerm of allTerms) {
        if (otherTerm === term) continue;
        
        if (termsMatch(otherTerm, lowerConflict)) {
          // Create unique pair key to avoid duplicates
          const pairKey = [term, otherTerm].sort().join('|');
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);
          
          const category1 = termToCategory.get(term);
          const category2 = termToCategory.get(otherTerm);
          const categories: PromptCategory[] = [];
          if (category1) categories.push(category1);
          if (category2 && category2 !== category1) categories.push(category2);
          
          conflicts.push({
            terms: [term, otherTerm],
            reason: `"${term}" conflicts with "${otherTerm}" - these styles don't typically work well together.`,
            suggestion: `Consider removing one of these options for a more coherent result.`,
            severity: 'soft', // Semantic tag conflicts are soft by default
            categories,
          });
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Check for mood conflicts across selections.
 */
function checkMoodConflicts(
  termToCategory: Map<string, PromptCategory>
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const moodGroups: Record<SemanticMood, Array<{ term: string; category: PromptCategory }>> = {
    calm: [],
    intense: [],
    neutral: [],
    eerie: [],
    joyful: [],
    melancholic: [],
    dramatic: [],
  };
  
  // Group terms by mood
  for (const [term, category] of termToCategory) {
    const tag = getSemanticTag(term);
    if (tag?.mood) {
      moodGroups[tag.mood].push({ term, category });
    }
  }
  
  // Check for conflicting moods
  const conflictingMoodPairs: [SemanticMood, SemanticMood][] = [
    ['calm', 'intense'],
    ['joyful', 'melancholic'],
    ['joyful', 'eerie'],
  ];
  
  for (const [mood1, mood2] of conflictingMoodPairs) {
    const group1 = moodGroups[mood1];
    const group2 = moodGroups[mood2];
    
    const item1 = group1[0];
    const item2 = group2[0];
    
    if (item1 && item2) {
      const terms = [item1.term, item2.term];
      const categories: PromptCategory[] = [];
      if (!categories.includes(item1.category)) categories.push(item1.category);
      if (!categories.includes(item2.category)) categories.push(item2.category);
      
      conflicts.push({
        terms,
        reason: `Mood conflict: "${item1.term}" has a ${mood1} mood while "${item2.term}" is ${mood2}.`,
        suggestion: `Consider options with similar moods for a more cohesive result.`,
        severity: 'soft',
        categories,
      });
    }
  }
  
  return conflicts;
}

/**
 * Check for era conflicts across selections.
 */
function checkEraConflicts(
  termToCategory: Map<string, PromptCategory>
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const eraGroups: Record<SemanticEra, Array<{ term: string; category: PromptCategory }>> = {
    past: [],
    present: [],
    future: [],
    timeless: [],
  };
  
  // Group terms by era
  for (const [term, category] of termToCategory) {
    const tag = getSemanticTag(term);
    if (tag?.era && tag.era !== 'timeless') {
      eraGroups[tag.era].push({ term, category });
    }
  }
  
  // Check for conflicting eras (past vs future is the main conflict)
  const pastTerm = eraGroups.past[0];
  const futureTerm = eraGroups.future[0];
  
  if (pastTerm && futureTerm) {
    const categories: PromptCategory[] = [];
    if (!categories.includes(pastTerm.category)) categories.push(pastTerm.category);
    if (!categories.includes(futureTerm.category)) categories.push(futureTerm.category);
    
    conflicts.push({
      terms: [pastTerm.term, futureTerm.term],
      reason: `Era conflict: "${pastTerm.term}" evokes the past while "${futureTerm.term}" is futuristic.`,
      suggestion: `Try "retro-futurism" style if you want to blend eras, or pick one time period.`,
      severity: 'soft',
      categories,
    });
  }
  
  return conflicts;
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Detect conflicts in the user's current prompt selections.
 * 
 * @example
 * ```ts
 * const result = detectConflicts({
 *   selections: {
 *     style: ['cyberpunk', 'vintage'],
 *     lighting: ['neon lights'],
 *   }
 * });
 * 
 * if (result.hasHardConflicts) {
 *   console.log('Warning:', result.conflicts[0].reason);
 * }
 * ```
 */
export function detectConflicts(input: ConflictDetectionInput): ConflictDetectionResult {
  const { selections, customValues, includeSoftConflicts = true } = input;
  
  // Extract all terms with their categories
  const termToCategory = extractAllTerms(selections, customValues);
  
  // If fewer than 2 terms, no conflicts possible
  if (termToCategory.size < 2) {
    return {
      conflicts: [],
      hardCount: 0,
      softCount: 0,
      hasHardConflicts: false,
      hasConflicts: false,
      worstSeverity: null,
    };
  }
  
  // Collect conflicts from all sources
  const allConflicts: DetectedConflict[] = [
    ...checkDefinedConflicts(termToCategory, includeSoftConflicts),
    ...checkSemanticTagConflicts(termToCategory, includeSoftConflicts),
    ...(includeSoftConflicts ? checkMoodConflicts(termToCategory) : []),
    ...(includeSoftConflicts ? checkEraConflicts(termToCategory) : []),
  ];
  
  // Deduplicate conflicts (same terms)
  const uniqueConflicts: DetectedConflict[] = [];
  const seenTermSets = new Set<string>();
  
  for (const conflict of allConflicts) {
    const termSet = conflict.terms.sort().join('|');
    if (!seenTermSets.has(termSet)) {
      seenTermSets.add(termSet);
      uniqueConflicts.push(conflict);
    }
  }
  
  // Sort by severity (hard first)
  uniqueConflicts.sort((a, b) => {
    if (a.severity === 'hard' && b.severity === 'soft') return -1;
    if (a.severity === 'soft' && b.severity === 'hard') return 1;
    return 0;
  });
  
  // Calculate stats
  const hardCount = uniqueConflicts.filter(c => c.severity === 'hard').length;
  const softCount = uniqueConflicts.filter(c => c.severity === 'soft').length;
  
  return {
    conflicts: uniqueConflicts,
    hardCount,
    softCount,
    hasHardConflicts: hardCount > 0,
    hasConflicts: uniqueConflicts.length > 0,
    worstSeverity: hardCount > 0 ? 'hard' : (softCount > 0 ? 'soft' : null),
  };
}

/**
 * Quick check if any hard conflicts exist.
 * Lighter weight than full detection.
 */
export function hasHardConflicts(
  selections: Partial<Record<PromptCategory, string[]>>
): boolean {
  const result = detectConflicts({ 
    selections, 
    includeSoftConflicts: false 
  });
  return result.hasHardConflicts;
}

/**
 * Get conflict count for a specific category.
 * Useful for category-level conflict indicators.
 */
export function getCategoryConflictCount(
  selections: Partial<Record<PromptCategory, string[]>>,
  category: PromptCategory
): number {
  const result = detectConflicts({ selections });
  return result.conflicts.filter(c => c.categories.includes(category)).length;
}

/**
 * Check if adding a specific term would create a conflict.
 * Useful for preview before selection.
 */
export function wouldCreateConflict(
  currentSelections: Partial<Record<PromptCategory, string[]>>,
  newTerm: string,
  category: PromptCategory
): DetectedConflict | null {
  // Create a copy with the new term added
  const testSelections = { ...currentSelections };
  testSelections[category] = [...(testSelections[category] || []), newTerm];
  
  // Get conflicts with and without the new term
  const beforeResult = detectConflicts({ selections: currentSelections });
  const afterResult = detectConflicts({ selections: testSelections });
  
  // Find any new conflicts
  const beforeTermSets = new Set(beforeResult.conflicts.map(c => c.terms.sort().join('|')));
  const newConflicts = afterResult.conflicts.filter(
    c => !beforeTermSets.has(c.terms.sort().join('|'))
  );
  
  return newConflicts.length > 0 ? (newConflicts[0] ?? null) : null;
}
