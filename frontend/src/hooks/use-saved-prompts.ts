// src/hooks/use-saved-prompts.ts
// ============================================================================
// SAVED PROMPTS HOOK
// ============================================================================
// Manages saved prompts in localStorage with filtering and sorting.
// Authority: docs/authority/prompt-intelligence.md §9.2
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  SavedPrompt,
  LibraryFilters,
  LibraryStats,
} from '@/types/saved-prompt';
import { DEFAULT_LIBRARY_FILTERS } from '@/types/saved-prompt';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'promagen_saved_prompts';
const STORAGE_VERSION = '1.0.0';

interface StorageData {
  version: string;
  prompts: SavedPrompt[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a UUID v4.
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load prompts from localStorage.
 */
function loadFromStorage(): SavedPrompt[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data: StorageData = JSON.parse(raw);

    if (data.version !== STORAGE_VERSION) {
      console.warn('[SavedPrompts] Storage version mismatch, may need migration');
    }

    return data.prompts || [];
  } catch (error) {
    console.error('[SavedPrompts] Failed to load from storage:', error);
    return [];
  }
}

/**
 * Save prompts to localStorage.
 */
function saveToStorage(prompts: SavedPrompt[]): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const data: StorageData = {
      version: STORAGE_VERSION,
      prompts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('[SavedPrompts] Failed to save to storage:', error);
    return false;
  }
}

/**
 * Filter prompts based on criteria.
 */
function filterPrompts(
  prompts: SavedPrompt[],
  filters: LibraryFilters
): SavedPrompt[] {
  return prompts.filter((prompt) => {
    if (filters.platformId && prompt.platformId !== filters.platformId) {
      return false;
    }

    if (filters.family && !prompt.families.includes(filters.family)) {
      return false;
    }

    if (filters.mood && filters.mood !== 'all' && prompt.mood !== filters.mood) {
      return false;
    }

    if (
      filters.minCoherence !== undefined &&
      prompt.coherenceScore < filters.minCoherence
    ) {
      return false;
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchable = [
        prompt.name,
        prompt.positivePrompt,
        prompt.negativePrompt || '',
        prompt.notes || '',
        ...(prompt.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      if (!searchable.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sort prompts based on criteria.
 */
function sortPrompts(
  prompts: SavedPrompt[],
  sortBy: LibraryFilters['sortBy'],
  sortDirection: LibraryFilters['sortDirection']
): SavedPrompt[] {
  const sorted = [...prompts].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'coherenceScore':
        comparison = a.coherenceScore - b.coherenceScore;
        break;
      case 'createdAt':
        comparison =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'updatedAt':
      default:
        comparison =
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }

    return sortDirection === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Calculate library statistics.
 */
function calculateStats(prompts: SavedPrompt[]): LibraryStats {
  const stats: LibraryStats = {
    totalPrompts: prompts.length,
    averageCoherence: 0,
    platformBreakdown: {},
    familyBreakdown: {},
    moodBreakdown: { calm: 0, intense: 0, neutral: 0 },
  };

  if (prompts.length === 0) return stats;

  let totalCoherence = 0;

  for (const prompt of prompts) {
    totalCoherence += prompt.coherenceScore;

    stats.platformBreakdown[prompt.platformId] =
      (stats.platformBreakdown[prompt.platformId] || 0) + 1;

    for (const family of prompt.families) {
      stats.familyBreakdown[family] =
        (stats.familyBreakdown[family] || 0) + 1;
    }

    stats.moodBreakdown[prompt.mood]++;
  }

  stats.averageCoherence = Math.round(totalCoherence / prompts.length);

  return stats;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseSavedPromptsReturn {
  allPrompts: SavedPrompt[];
  filteredPrompts: SavedPrompt[];
  filters: LibraryFilters;
  stats: LibraryStats;
  isLoading: boolean;
  savePrompt: (prompt: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt'>) => SavedPrompt | null;
  updatePrompt: (id: string, updates: Partial<SavedPrompt>) => boolean;
  deletePrompt: (id: string) => boolean;
  getPrompt: (id: string) => SavedPrompt | undefined;
  setFilters: (filters: Partial<LibraryFilters>) => void;
  resetFilters: () => void;
  exportPrompts: () => string;
  importPrompts: (json: string) => { imported: number; errors: number };
  clearAll: () => void;
}

export function useSavedPrompts(): UseSavedPromptsReturn {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [filters, setFiltersState] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loaded = loadFromStorage();
    setPrompts(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(prompts);
    }
  }, [prompts, isLoading]);

  const filteredPrompts = useMemo(() => {
    const filtered = filterPrompts(prompts, filters);
    return sortPrompts(filtered, filters.sortBy, filters.sortDirection);
  }, [prompts, filters]);

  const stats = useMemo(() => calculateStats(prompts), [prompts]);

  const savePrompt = useCallback(
    (
      promptData: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt'>
    ): SavedPrompt | null => {
      const now = new Date().toISOString();
      const newPrompt: SavedPrompt = {
        ...promptData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };

      setPrompts((prev) => [...prev, newPrompt]);
      return newPrompt;
    },
    []
  );

  const updatePrompt = useCallback(
    (id: string, updates: Partial<SavedPrompt>): boolean => {
      let found = false;

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            found = true;
            return {
              ...p,
              ...updates,
              updatedAt: new Date().toISOString(),
            };
          }
          return p;
        })
      );

      return found;
    },
    []
  );

  const deletePrompt = useCallback((id: string): boolean => {
    let found = false;

    setPrompts((prev) => {
      const filtered = prev.filter((p) => {
        if (p.id === id) {
          found = true;
          return false;
        }
        return true;
      });
      return filtered;
    });

    return found;
  }, []);

  const getPrompt = useCallback(
    (id: string): SavedPrompt | undefined => {
      return prompts.find((p) => p.id === id);
    },
    [prompts]
  );

  const setFilters = useCallback((newFilters: Partial<LibraryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_LIBRARY_FILTERS);
  }, []);

  const exportPrompts = useCallback((): string => {
    return JSON.stringify(
      {
        version: STORAGE_VERSION,
        exportedAt: new Date().toISOString(),
        prompts,
      },
      null,
      2
    );
  }, [prompts]);

  const importPrompts = useCallback(
    (json: string): { imported: number; errors: number } => {
      let imported = 0;
      let errors = 0;

      try {
        const data = JSON.parse(json);
        const importedPrompts: SavedPrompt[] = data.prompts || [];

        const now = new Date().toISOString();
        const newPrompts: SavedPrompt[] = [];

        for (const prompt of importedPrompts) {
          try {
            if (!prompt.name || !prompt.platformId || !prompt.positivePrompt) {
              errors++;
              continue;
            }

            newPrompts.push({
              ...prompt,
              id: generateId(),
              createdAt: prompt.createdAt || now,
              updatedAt: now,
            });
            imported++;
          } catch {
            errors++;
          }
        }

        if (newPrompts.length > 0) {
          setPrompts((prev) => [...prev, ...newPrompts]);
        }
      } catch {
        errors = 1;
      }

      return { imported, errors };
    },
    []
  );

  const clearAll = useCallback(() => {
    setPrompts([]);
  }, []);

  return {
    allPrompts: prompts,
    filteredPrompts,
    filters,
    stats,
    isLoading,
    savePrompt,
    updatePrompt,
    deletePrompt,
    getPrompt,
    setFilters,
    resetFilters,
    exportPrompts,
    importPrompts,
    clearAll,
  };
}

export default useSavedPrompts;
