// src/hooks/prompt-intelligence/use-conflict-detection.ts
// ============================================================================
// USE CONFLICT DETECTION HOOK
// ============================================================================
// React hook for real-time conflict detection.
//
// Version: 1.2.0 — Uses shared useSyncComputation utility
// ============================================================================

import { useCallback, useRef } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { DetectedConflict } from '@/lib/prompt-intelligence/types';
import {
  detectConflicts,
  previewTermAddition,
} from '@/lib/prompt-intelligence';
import { useSyncComputation } from '@/hooks/use-sync-computation';

// ============================================================================
// Types
// ============================================================================

export interface UseConflictDetectionOptions {
  /** Whether to include soft conflicts (default: true) */
  includeSoftConflicts?: boolean;
  
  /** Custom values by category */
  customValues?: Partial<Record<PromptCategory, string>>;
  
  /** Whether detection is enabled (default: true) */
  enabled?: boolean;
}

export interface UseConflictDetectionResult {
  /** All detected conflicts */
  conflicts: DetectedConflict[];
  
  /** Whether there are any conflicts */
  hasConflicts: boolean;
  
  /** Whether there are hard conflicts */
  hasHardConflicts: boolean;
  
  /** Count of hard conflicts */
  hardCount: number;
  
  /** Count of soft conflicts */
  softCount: number;
  
  /** Get conflicts for a specific category */
  forCategory: (category: PromptCategory) => DetectedConflict[];
  
  /** Get conflicts involving a specific term */
  forTerm: (term: string) => DetectedConflict[];
  
  /** Preview if adding a term would cause conflicts */
  wouldConflict: (term: string, category: PromptCategory) => {
    wouldConflict: boolean;
    conflict: DetectedConflict | null;
    suggestedAlternatives: string[];
  };
  
  /** Force re-detection */
  redetect: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for real-time conflict detection.
 */
export function useConflictDetection(
  selections: Partial<Record<PromptCategory, string[]>>,
  options: UseConflictDetectionOptions = {}
): UseConflictDetectionResult {
  const {
    includeSoftConflicts = true,
    customValues,
    enabled = true,
  } = options;
  
  // Ref for wouldConflict callback (needs latest selections without deps)
  const selectionsRef = useRef(selections);
  selectionsRef.current = selections;
  
  // Stringify for dependency comparison
  const selectionsKey = JSON.stringify(selections);
  const customValuesKey = JSON.stringify(customValues);
  
  // Core computation via shared utility
  const { value: detected, refresh: redetect } = useSyncComputation(
    () => {
      if (!enabled) {
        return {
          conflicts: [] as DetectedConflict[],
          hasConflicts: false,
          hasHardConflicts: false,
          hardCount: 0,
          softCount: 0,
        };
      }
      
      const result = detectConflicts({
        selections,
        customValues,
        includeSoftConflicts,
      });
      
      return {
        conflicts: result.conflicts,
        hasConflicts: result.hasConflicts,
        hasHardConflicts: result.hasHardConflicts,
        hardCount: result.hardCount,
        softCount: result.softCount,
      };
    },
    [enabled, includeSoftConflicts, selectionsKey, customValuesKey]
  );
  
  // Helpers
  const forCategory = useCallback(
    (category: PromptCategory): DetectedConflict[] =>
      detected.conflicts.filter(c => c.categories.includes(category)),
    [detected.conflicts]
  );
  
  const forTerm = useCallback(
    (term: string): DetectedConflict[] =>
      detected.conflicts.filter(c => c.terms.includes(term)),
    [detected.conflicts]
  );
  
  const wouldConflict = useCallback(
    (term: string, category: PromptCategory) =>
      previewTermAddition(selectionsRef.current, term, category),
    []
  );
  
  return {
    conflicts: detected.conflicts,
    hasConflicts: detected.hasConflicts,
    hasHardConflicts: detected.hasHardConflicts,
    hardCount: detected.hardCount,
    softCount: detected.softCount,
    forCategory,
    forTerm,
    wouldConflict,
    redetect,
  };
}

export default useConflictDetection;
