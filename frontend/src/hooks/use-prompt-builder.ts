// src/hooks/use-prompt-builder.ts
// Hook for managing prompt builder state

import { useState, useCallback, useMemo } from 'react';
import {
  assemblePrompt,
  formatPromptForCopy,
  getAllCategories,
  getPlatformFormat,
} from '@/lib/prompt-builder';
import type {
  PromptCategory,
  PromptSelections,
  CategoryState,
  AssembledPrompt,
} from '@/types/prompt-builder';

export type PromptBuilderState = Record<PromptCategory, CategoryState>;

const createInitialState = (): PromptBuilderState => {
  const categories = getAllCategories();
  const state: Partial<PromptBuilderState> = {};
  for (const cat of categories) {
    state[cat] = { selected: [], customValue: '' };
  }
  return state as PromptBuilderState;
};

export interface UsePromptBuilderReturn {
  /** Current state for all categories */
  state: PromptBuilderState;
  /** Update selected items for a category */
  setSelected: (category: PromptCategory, selected: string[]) => void;
  /** Update custom value for a category */
  setCustomValue: (category: PromptCategory, value: string) => void;
  /** Add a selection to a category */
  addSelection: (category: PromptCategory, value: string) => void;
  /** Remove a selection from a category */
  removeSelection: (category: PromptCategory, value: string) => void;
  /** Clear all selections for a category */
  clearCategory: (category: PromptCategory) => void;
  /** Clear all selections */
  clearAll: () => void;
  /** Current selections in the format needed for assembly */
  selections: PromptSelections;
  /** Assembled prompt for the platform */
  assembled: AssembledPrompt;
  /** Formatted text ready for copy */
  promptText: string;
  /** Whether there's any content */
  hasContent: boolean;
  /** Platform format configuration */
  platformFormat: ReturnType<typeof getPlatformFormat>;
}

export function usePromptBuilder(platformId: string): UsePromptBuilderReturn {
  const [state, setState] = useState<PromptBuilderState>(createInitialState);

  const platformFormat = useMemo(() => getPlatformFormat(platformId), [platformId]);

  const setSelected = useCallback((category: PromptCategory, selected: string[]) => {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], selected },
    }));
  }, []);

  const setCustomValue = useCallback((category: PromptCategory, value: string) => {
    setState((prev) => ({
      ...prev,
      [category]: { ...prev[category], customValue: value },
    }));
  }, []);

  const addSelection = useCallback((category: PromptCategory, value: string) => {
    setState((prev) => {
      const current = prev[category].selected;
      if (current.includes(value)) return prev;
      return {
        ...prev,
        [category]: { ...prev[category], selected: [...current, value] },
      };
    });
  }, []);

  const removeSelection = useCallback((category: PromptCategory, value: string) => {
    setState((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        selected: prev[category].selected.filter((s) => s !== value),
      },
    }));
  }, []);

  const clearCategory = useCallback((category: PromptCategory) => {
    setState((prev) => ({
      ...prev,
      [category]: { selected: [], customValue: '' },
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState(createInitialState());
  }, []);

  // Build selections from state
  const selections: PromptSelections = useMemo(() => {
    const result: PromptSelections = {};
    for (const [cat, catState] of Object.entries(state)) {
      const allValues = [...catState.selected];
      if (catState.customValue.trim()) {
        allValues.push(catState.customValue.trim());
      }
      if (allValues.length > 0) {
        result[cat as PromptCategory] = allValues;
      }
    }
    return result;
  }, [state]);

  // Assembled prompt
  const assembled = useMemo(
    () => assemblePrompt(platformId, selections),
    [platformId, selections]
  );

  const promptText = useMemo(() => formatPromptForCopy(assembled), [assembled]);

  const hasContent = promptText.trim().length > 0;

  return {
    state,
    setSelected,
    setCustomValue,
    addSelection,
    removeSelection,
    clearCategory,
    clearAll,
    selections,
    assembled,
    promptText,
    hasContent,
    platformFormat,
  };
}

export default usePromptBuilder;
