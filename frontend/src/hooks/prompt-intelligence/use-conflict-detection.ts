// src/hooks/prompt-intelligence/use-conflict-detection.ts
// ============================================================================
// USE CONFLICT DETECTION HOOK
// ============================================================================
// React hook for real-time conflict detection.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PromptCategory } from '@/types/prompt-builder';
import type { DetectedConflict } from '@/lib/prompt-intelligence/types';
import {
  detectConflicts,
  previewTermAddition,
} from '@/lib/prompt-intelligence';

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
  
  const [conflicts, setConflicts] = useState<DetectedConflict[]>([]);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [hasHardConflicts, setHasHardConflicts] = useState(false);
  const [hardCount, setHardCount] = useState(0);
  const [softCount, setSoftCount] = useState(0);
  
  // Use refs to track latest values for callbacks
  const selectionsRef = useRef(selections);
  const customValuesRef = useRef(customValues);
  selectionsRef.current = selections;
  customValuesRef.current = customValues;
  
  // Stringify for dependency comparison
  const selectionsKey = JSON.stringify(selections);
  const customValuesKey = JSON.stringify(customValues);
  
  // Detect conflicts
  const detectConflictsNow = useCallback(() => {
    if (!enabled) {
      setConflicts([]);
      setHasConflicts(false);
      setHasHardConflicts(false);
      setHardCount(0);
      setSoftCount(0);
      return;
    }
    
    const result = detectConflicts({
      selections: selectionsRef.current,
      customValues: customValuesRef.current,
      includeSoftConflicts,
    });
    
    setConflicts(result.conflicts);
    setHasConflicts(result.hasConflicts);
    setHasHardConflicts(result.hasHardConflicts);
    setHardCount(result.hardCount);
    setSoftCount(result.softCount);
  }, [enabled, includeSoftConflicts]);
  
  // Re-detect on changes
  useEffect(() => {
    detectConflictsNow();
     
  }, [detectConflictsNow, selectionsKey, customValuesKey]);
  
  // Get conflicts for a specific category
  const forCategory = useCallback((category: PromptCategory): DetectedConflict[] => {
    return conflicts.filter(c => c.categories.includes(category));
  }, [conflicts]);
  
  // Get conflicts involving a specific term
  const forTerm = useCallback((term: string): DetectedConflict[] => {
    return conflicts.filter(c => c.terms.includes(term));
  }, [conflicts]);
  
  // Preview if adding a term would cause conflicts
  const wouldConflict = useCallback((term: string, category: PromptCategory) => {
    return previewTermAddition(selectionsRef.current, term, category);
  }, []);
  
  return {
    conflicts,
    hasConflicts,
    hasHardConflicts,
    hardCount,
    softCount,
    forCategory,
    forTerm,
    wouldConflict,
    redetect: detectConflictsNow,
  };
}

export default useConflictDetection;
