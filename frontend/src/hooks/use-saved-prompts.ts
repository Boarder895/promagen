// src/hooks/use-saved-prompts.ts
// ============================================================================
// SAVED PROMPTS HOOK (v2.0.0)
// ============================================================================
// Manages saved prompts in localStorage with filtering, sorting, and folders.
//
// UPDATED v2.0.0 (9 March 2026): Saved Prompts page redesign
// - Storage version bumped from 1.0.0 → 1.1.0
// - Auto-migration: existing prompts get source:'builder', folder:undefined
// - New folder operations: createFolder, renameFolder, deleteFolder, moveToFolder
// - getFolders() derives folder list from prompt data (no separate storage)
// - Folder-aware filtering (filters.folder)
// - Folder-aware export (exports current folder or all)
// - Duplicate detection on import (by positivePrompt hash)
// - folderBreakdown added to stats
// - quickSave() for one-click saves with auto-naming
// - All existing hook API preserved — new methods are additive
//
// Authority: docs/authority/saved-page.md §9, §11, §12, §13
// Existing features preserved: Yes
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
const STORAGE_VERSION = '1.1.0';
const PREVIOUS_VERSION = '1.0.0';
/** Maximum user-created folders */
const MAX_FOLDERS = 20;
/** Maximum characters per folder name */
const MAX_FOLDER_NAME_LENGTH = 30;
/** Key used in folderBreakdown for prompts with no folder */
const UNSORTED_KEY = '__unsorted__';

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
 * Simple hash of prompt text for duplicate detection.
 * Uses djb2 algorithm — fast and sufficient for client-side dedup.
 */
function hashPromptText(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Migrate prompts from v1.0.0 → v1.1.0.
 * Existing prompts all came from the builder, so they get source:'builder'.
 * folder and tier are left undefined (spec §12.2).
 */
function migrateV1ToV1_1(prompts: SavedPrompt[]): SavedPrompt[] {
  return prompts.map((p) => ({
    ...p,
    source: p.source ?? 'builder',
    // folder and tier remain undefined if not present
  }));
}

/**
 * Load prompts from localStorage with auto-migration.
 */
function loadFromStorage(): SavedPrompt[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data: StorageData = JSON.parse(raw);
    let prompts = data.prompts || [];

    // Migrate from 1.0.0 → 1.1.0
    if (data.version === PREVIOUS_VERSION) {
      console.debug('[SavedPrompts] Migrating storage from v1.0.0 → v1.1.0');
      prompts = migrateV1ToV1_1(prompts);

      // Persist migrated data immediately
      const migrated: StorageData = {
        version: STORAGE_VERSION,
        prompts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      console.debug(`[SavedPrompts] Migration complete — ${prompts.length} prompts updated`);
    } else if (data.version !== STORAGE_VERSION) {
      console.debug(
        `[SavedPrompts] Unknown storage version "${data.version}", expected "${STORAGE_VERSION}"`
      );
    }

    return prompts;
  } catch (error) {
    console.debug('[SavedPrompts] Failed to load from storage:', error);
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
    console.debug('[SavedPrompts] Failed to save to storage:', error);
    return false;
  }
}

/**
 * Filter prompts based on criteria (including folder filter).
 */
function filterPrompts(
  prompts: SavedPrompt[],
  filters: LibraryFilters
): SavedPrompt[] {
  return prompts.filter((prompt) => {
    // Folder filter
    if (filters.folder !== undefined) {
      if (filters.folder === UNSORTED_KEY) {
        // "Unsorted" = no folder assigned
        if (prompt.folder) return false;
      } else {
        // Specific folder
        if (prompt.folder !== filters.folder) return false;
      }
    }

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
        prompt.folder || '',
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
 * Calculate library statistics (including folder breakdown).
 */
function calculateStats(prompts: SavedPrompt[]): LibraryStats {
  const stats: LibraryStats = {
    totalPrompts: prompts.length,
    averageCoherence: 0,
    platformBreakdown: {},
    familyBreakdown: {},
    moodBreakdown: { calm: 0, intense: 0, neutral: 0 },
    folderBreakdown: {},
  };

  if (prompts.length === 0) return stats;

  let totalCoherence = 0;
  let scoredCount = 0;

  for (const prompt of prompts) {
    if (prompt.coherenceScore > 0) {
      totalCoherence += prompt.coherenceScore;
      scoredCount++;
    }

    stats.platformBreakdown[prompt.platformId] =
      (stats.platformBreakdown[prompt.platformId] || 0) + 1;

    for (const family of prompt.families) {
      stats.familyBreakdown[family] =
        (stats.familyBreakdown[family] || 0) + 1;
    }

    stats.moodBreakdown[prompt.mood]++;

    // Folder breakdown
    const folderKey = prompt.folder || UNSORTED_KEY;
    stats.folderBreakdown[folderKey] =
      (stats.folderBreakdown[folderKey] || 0) + 1;
  }

  stats.averageCoherence = scoredCount > 0 ? Math.round(totalCoherence / scoredCount) : 0;

  return stats;
}

/**
 * Extract subject from prompt data for auto-naming.
 * Spec §8.1: "{subject} — {platformName}" or "Untitled — {platformName}"
 */
function extractSubject(prompt: {
  selections?: SavedPrompt['selections'];
  customValues?: SavedPrompt['customValues'];
  positivePrompt: string;
}): string {
  // Builder saves: try selections.subject first, then customValues.subject
  if (prompt.selections) {
    const subjectSelections = prompt.selections['subject' as keyof typeof prompt.selections];
    if (Array.isArray(subjectSelections) && subjectSelections.length > 0) {
      return String(subjectSelections[0]).slice(0, 30);
    }
  }

  if (prompt.customValues) {
    const customSubject = prompt.customValues['subject' as keyof typeof prompt.customValues];
    if (customSubject && typeof customSubject === 'string') {
      return customSubject.slice(0, 30);
    }
  }

  // Fallback: first 30 chars of positivePrompt
  if (prompt.positivePrompt) {
    return prompt.positivePrompt.slice(0, 30);
  }

  return 'Untitled';
}

/**
 * Sanitise a folder name (trim, clamp length).
 */
function sanitiseFolderName(name: string): string {
  return name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseSavedPromptsReturn {
  /** All prompts (unfiltered) */
  allPrompts: SavedPrompt[];
  /** Prompts after applying current filters + sort */
  filteredPrompts: SavedPrompt[];
  /** Current filter state */
  filters: LibraryFilters;
  /** Computed statistics across all prompts */
  stats: LibraryStats;
  /** True while loading from localStorage */
  isLoading: boolean;

  // ── Prompt CRUD ──

  /**
   * Save a prompt (builder flow — full structured data).
   * `source` is optional in the input — defaults to 'builder' if not provided.
   * This preserves backward compatibility with existing prompt builder callers.
   */
  savePrompt: (prompt: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { source?: 'builder' | 'tooltip' }) => SavedPrompt | null;
  /**
   * Quick save a prompt (tooltip flow — one-click, auto-named).
   * Returns the saved prompt with auto-generated name.
   */
  quickSave: (data: {
    positivePrompt: string;
    negativePrompt?: string;
    platformId: string;
    platformName: string;
    source: 'builder' | 'tooltip';
    /** Full selections if available (builder origin) */
    selections?: SavedPrompt['selections'];
    customValues?: SavedPrompt['customValues'];
    families?: string[];
    mood?: SavedPrompt['mood'];
    coherenceScore?: number;
    tier?: number;
  }) => SavedPrompt | null;
  /** Update specific fields on a prompt */
  updatePrompt: (id: string, updates: Partial<SavedPrompt>) => boolean;
  /** Delete a prompt by ID */
  deletePrompt: (id: string) => boolean;
  /** Get a single prompt by ID */
  getPrompt: (id: string) => SavedPrompt | undefined;

  // ── Filters ──

  /** Merge partial filter changes into current state */
  setFilters: (filters: Partial<LibraryFilters>) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;

  // ── Folders ──

  /** Derived list of user-created folder names (sorted alphabetically) */
  folders: string[];
  /** Create a new folder. Returns false if at max limit or name exists. */
  createFolder: (name: string) => boolean;
  /** Rename a folder. All prompts in that folder are updated. */
  renameFolder: (oldName: string, newName: string) => boolean;
  /** Delete a folder. Prompts inside move to Unsorted (folder=undefined). */
  deleteFolder: (name: string) => boolean;
  /** Move a prompt to a folder. Pass undefined to move to Unsorted. */
  moveToFolder: (promptId: string, folder: string | undefined) => boolean;

  // ── Import / Export ──

  /**
   * Export prompts as JSON string.
   * If a folder filter is active, exports only that folder.
   * Otherwise exports all prompts.
   */
  exportPrompts: (folderName?: string) => string;
  /**
   * Import prompts from JSON.
   * Duplicate detection by positivePrompt hash — identical text is skipped.
   * Imported prompts go into the specified folder (or Unsorted if undefined).
   */
  importPrompts: (json: string, targetFolder?: string) => {
    imported: number;
    duplicates: number;
    errors: number;
  };

  /** Delete ALL prompts (nuclear option) */
  clearAll: () => void;
}

export function useSavedPrompts(): UseSavedPromptsReturn {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [filters, setFiltersState] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  /** React state mirror of the empty folder registry (localStorage) */
  const [emptyFolderNames, setEmptyFolderNames] = useState<string[]>([]);

  // ============================================================================
  // LOAD + PERSIST
  // ============================================================================

  useEffect(() => {
    const loaded = loadFromStorage();
    setPrompts(loaded);
    setEmptyFolderNames(loadEmptyFolders());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveToStorage(prompts);
    }
  }, [prompts, isLoading]);

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  const filteredPrompts = useMemo(() => {
    const filtered = filterPrompts(prompts, filters);
    return sortPrompts(filtered, filters.sortBy, filters.sortDirection);
  }, [prompts, filters]);

  const stats = useMemo(() => calculateStats(prompts), [prompts]);

  /** Derived folder list — unique folder names from all prompts, sorted A-Z */
  const folders = useMemo(() => {
    const folderSet = new Set<string>();
    for (const p of prompts) {
      if (p.folder) {
        folderSet.add(p.folder);
      }
    }
    return [...folderSet].sort((a, b) => a.localeCompare(b));
  }, [prompts]);

  // ============================================================================
  // PROMPT CRUD
  // ============================================================================

  const savePrompt = useCallback(
    (
      promptData: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { source?: 'builder' | 'tooltip' }
    ): SavedPrompt | null => {
      const now = new Date().toISOString();
      const newPrompt: SavedPrompt = {
        ...promptData,
        // Ensure v1.1.0 fields have defaults
        source: promptData.source ?? 'builder',
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };

      setPrompts((prev) => [...prev, newPrompt]);
      return newPrompt;
    },
    []
  );

  const quickSave = useCallback(
    (data: {
      positivePrompt: string;
      negativePrompt?: string;
      platformId: string;
      platformName: string;
      source: 'builder' | 'tooltip';
      selections?: SavedPrompt['selections'];
      customValues?: SavedPrompt['customValues'];
      families?: string[];
      mood?: SavedPrompt['mood'];
      coherenceScore?: number;
      tier?: number;
    }): SavedPrompt | null => {
      const subject = extractSubject({
        selections: data.selections,
        customValues: data.customValues,
        positivePrompt: data.positivePrompt,
      });

      const autoName = `${subject} — ${data.platformName}`;
      const now = new Date().toISOString();

      const newPrompt: SavedPrompt = {
        id: generateId(),
        name: autoName,
        platformId: data.platformId,
        platformName: data.platformName,
        positivePrompt: data.positivePrompt,
        negativePrompt: data.negativePrompt,
        selections: data.selections ?? ({} as SavedPrompt['selections']),
        customValues: data.customValues ?? {},
        families: data.families ?? [],
        mood: data.mood ?? 'neutral',
        coherenceScore: data.coherenceScore ?? 0,
        characterCount: data.positivePrompt.length,
        createdAt: now,
        updatedAt: now,
        source: data.source,
        tier: data.tier,
        // folder: undefined → goes to "Unsorted"
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

  // ============================================================================
  // FILTERS
  // ============================================================================

  const setFilters = useCallback((newFilters: Partial<LibraryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_LIBRARY_FILTERS);
  }, []);

  // ============================================================================
  // FOLDER OPERATIONS
  // ============================================================================

  const createFolder = useCallback(
    (name: string): boolean => {
      const sanitised = sanitiseFolderName(name);
      if (!sanitised) return false;

      // Check max folder limit
      if (folders.length >= MAX_FOLDERS) {
        console.debug(`[SavedPrompts] Cannot create folder — max ${MAX_FOLDERS} reached`);
        return false;
      }

      // Check for duplicate name (case-insensitive)
      if (folders.some((f) => f.toLowerCase() === sanitised.toLowerCase())) {
        console.debug(`[SavedPrompts] Folder "${sanitised}" already exists`);
        return false;
      }

      // Creating a folder is implicit — we just need to assign a prompt to it.
      // But we also want empty folders to persist. We achieve this by creating
      // a "folder marker" — we don't store separate folder data (spec §9.1).
      // The folder will appear once a prompt is moved into it.
      //
      // To support empty folder creation, we store folder names in a separate
      // localStorage key. This is lightweight and avoids polluting prompt data.
      persistEmptyFolder(sanitised);

      // Trigger allFolders re-derive
      setEmptyFolderNames(loadEmptyFolders());
      return true;
    },
    [folders]
  );

  const renameFolder = useCallback(
    (oldName: string, newName: string): boolean => {
      const sanitisedNew = sanitiseFolderName(newName);
      if (!sanitisedNew || !oldName) return false;

      // Check for duplicate name (case-insensitive, exclude the old name)
      if (
        folders.some(
          (f) =>
            f.toLowerCase() === sanitisedNew.toLowerCase() &&
            f.toLowerCase() !== oldName.toLowerCase()
        )
      ) {
        console.debug(`[SavedPrompts] Folder "${sanitisedNew}" already exists`);
        return false;
      }

      // Update all prompts in the old folder
      setPrompts((prev) =>
        prev.map((p) => {
          if (p.folder === oldName) {
            return { ...p, folder: sanitisedNew, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      // Update empty folder registry
      removeEmptyFolder(oldName);
      persistEmptyFolder(sanitisedNew);
      setEmptyFolderNames(loadEmptyFolders());

      return true;
    },
    [folders]
  );

  const deleteFolder = useCallback(
    (name: string): boolean => {
      if (!name) return false;

      // Move all prompts in this folder to Unsorted (folder = undefined)
      setPrompts((prev) =>
        prev.map((p) => {
          if (p.folder === name) {
            return { ...p, folder: undefined, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      // Clean up empty folder registry
      removeEmptyFolder(name);
      setEmptyFolderNames(loadEmptyFolders());

      return true;
    },
    []
  );

  const moveToFolder = useCallback(
    (promptId: string, folder: string | undefined): boolean => {
      let found = false;

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.id === promptId) {
            found = true;
            return { ...p, folder, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      return found;
    },
    []
  );

  // ============================================================================
  // IMPORT / EXPORT
  // ============================================================================

  const exportPrompts = useCallback(
    (folderName?: string): string => {
      // If folderName provided, export only that folder
      let toExport = prompts;
      if (folderName !== undefined) {
        if (folderName === UNSORTED_KEY) {
          toExport = prompts.filter((p) => !p.folder);
        } else {
          toExport = prompts.filter((p) => p.folder === folderName);
        }
      }

      return JSON.stringify(
        {
          version: STORAGE_VERSION,
          exportedAt: new Date().toISOString(),
          folder: folderName ?? 'All Prompts',
          prompts: toExport,
        },
        null,
        2
      );
    },
    [prompts]
  );

  const importPrompts = useCallback(
    (
      json: string,
      targetFolder?: string
    ): { imported: number; duplicates: number; errors: number } => {
      let imported = 0;
      let duplicates = 0;
      let errors = 0;

      try {
        const data = JSON.parse(json);
        const importedPrompts: SavedPrompt[] = data.prompts || [];

        // Build hash set of existing prompt text for duplicate detection
        const existingHashes = new Set<number>();
        for (const p of prompts) {
          existingHashes.add(hashPromptText(p.positivePrompt));
        }

        const now = new Date().toISOString();
        const newPrompts: SavedPrompt[] = [];

        for (const prompt of importedPrompts) {
          try {
            // Validate required fields
            if (!prompt.name || !prompt.platformId || !prompt.positivePrompt) {
              errors++;
              continue;
            }

            // Duplicate detection by prompt text hash
            const hash = hashPromptText(prompt.positivePrompt);
            if (existingHashes.has(hash)) {
              duplicates++;
              continue;
            }
            existingHashes.add(hash); // prevent import-to-import dupes too

            newPrompts.push({
              ...prompt,
              id: generateId(),
              createdAt: prompt.createdAt || now,
              updatedAt: now,
              // Ensure v1.1.0 fields
              source: prompt.source ?? 'builder',
              // Place in target folder if specified
              folder: targetFolder,
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

      return { imported, duplicates, errors };
    },
    [prompts]
  );

  const clearAll = useCallback(() => {
    setPrompts([]);
    clearEmptyFolders();
    setEmptyFolderNames(loadEmptyFolders());
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  // Merge prompt-derived folders with empty folder registry (React state)
  const allFolders = useMemo(() => {
    const merged = new Set([...folders, ...emptyFolderNames]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }, [folders, emptyFolderNames]);

  return {
    allPrompts: prompts,
    filteredPrompts,
    filters,
    stats,
    isLoading,
    savePrompt,
    quickSave,
    updatePrompt,
    deletePrompt,
    getPrompt,
    setFilters,
    resetFilters,
    folders: allFolders,
    createFolder,
    renameFolder,
    deleteFolder,
    moveToFolder,
    exportPrompts,
    importPrompts,
    clearAll,
  };
}

export default useSavedPrompts;

// ============================================================================
// EMPTY FOLDER REGISTRY (localStorage)
// ============================================================================
// Folders are implicit (derived from prompt.folder values), but we need to
// support creating empty folders before any prompt is moved into them.
// This lightweight registry stores just the names.
// ============================================================================

const EMPTY_FOLDERS_KEY = 'promagen_empty_folders';

function loadEmptyFolders(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(EMPTY_FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistEmptyFolder(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadEmptyFolders();
    if (!existing.includes(name)) {
      existing.push(name);
      localStorage.setItem(EMPTY_FOLDERS_KEY, JSON.stringify(existing));
    }
  } catch {
    // Silent fail — non-critical
  }
}

function removeEmptyFolder(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadEmptyFolders();
    const filtered = existing.filter((f) => f !== name);
    localStorage.setItem(EMPTY_FOLDERS_KEY, JSON.stringify(filtered));
  } catch {
    // Silent fail — non-critical
  }
}

function clearEmptyFolders(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(EMPTY_FOLDERS_KEY);
  } catch {
    // Silent fail — non-critical
  }
}
