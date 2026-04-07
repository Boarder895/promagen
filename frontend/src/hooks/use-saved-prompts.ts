// src/hooks/use-saved-prompts.ts
// ============================================================================
// SAVED PROMPTS HOOK (v3.0.0)
// ============================================================================
// Dual-mode: localStorage (free) or Postgres cloud (Pro Promagen).
//
// v3.0.0 (7 Apr 2026): Cloud storage for paid users
// - Detects paid status via Clerk useAuth + useUser (publicMetadata.tier)
// - Cloud mode: reads/writes via /api/saved-prompts endpoints
// - Optimistic writes: UI updates instantly, API syncs in background
// - On API failure: reverts state, exposes syncError for UI toast
// - One-time sync: localStorage → DB on first cloud-mode mount
// - proSyncBanner: data for "Go Pro to sync" conversion trigger
// - storageMode exposed: 'local' | 'cloud' | 'loading'
//
// v2.0.0 (9 Mar 2026): Saved Prompts page redesign — folders, quick save, etc.
//
// Return interface: 100% backward compatible (new fields are additive).
// All existing consumers continue to work without any changes.
//
// Authority: docs/authority/saved-page.md §9, §11, §12, §13
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
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
/** localStorage flag to prevent re-syncing every mount */
const SYNC_FLAG_KEY = 'promagen_cloud_synced';
/** Minimum prompts before showing Pro conversion banner */
const PRO_BANNER_THRESHOLD = 10;

type StorageMode = 'local' | 'cloud' | 'loading';

interface StorageData {
  version: string;
  prompts: SavedPrompt[];
}

// ============================================================================
// HELPERS (unchanged from v2.0.0)
// ============================================================================

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function hashPromptText(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return hash;
}

function migrateV1ToV1_1(prompts: SavedPrompt[]): SavedPrompt[] {
  return prompts.map((p) => ({
    ...p,
    source: p.source ?? 'builder',
  }));
}

function loadFromStorage(): SavedPrompt[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data: StorageData = JSON.parse(raw);
    let prompts = data.prompts || [];

    if (data.version === PREVIOUS_VERSION) {
      console.debug('[SavedPrompts] Migrating storage from v1.0.0 → v1.1.0');
      prompts = migrateV1ToV1_1(prompts);
      const migrated: StorageData = { version: STORAGE_VERSION, prompts };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      console.debug(`[SavedPrompts] Migration complete — ${prompts.length} prompts updated`);
    } else if (data.version !== STORAGE_VERSION) {
      console.warn(
        `[SavedPrompts] Unknown storage version "${data.version}", expected "${STORAGE_VERSION}"`
      );
    }

    return prompts;
  } catch (error) {
    console.error('[SavedPrompts] Failed to load from storage:', error);
    return [];
  }
}

function saveToStorage(prompts: SavedPrompt[]): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const data: StorageData = { version: STORAGE_VERSION, prompts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('[SavedPrompts] Failed to save to storage:', error);
    return false;
  }
}

function filterPrompts(
  prompts: SavedPrompt[],
  filters: LibraryFilters
): SavedPrompt[] {
  return prompts.filter((prompt) => {
    if (filters.folder !== undefined) {
      if (filters.folder === UNSORTED_KEY) {
        if (prompt.folder) return false;
      } else {
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

    const folderKey = prompt.folder || UNSORTED_KEY;
    stats.folderBreakdown[folderKey] =
      (stats.folderBreakdown[folderKey] || 0) + 1;
  }

  stats.averageCoherence = scoredCount > 0 ? Math.round(totalCoherence / scoredCount) : 0;

  return stats;
}

function extractSubject(prompt: {
  selections?: SavedPrompt['selections'];
  customValues?: SavedPrompt['customValues'];
  positivePrompt: string;
}): string {
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

  if (prompt.positivePrompt) {
    return prompt.positivePrompt.slice(0, 30);
  }

  return 'Untitled';
}

function sanitiseFolderName(name: string): string {
  return name.trim().slice(0, MAX_FOLDER_NAME_LENGTH);
}

// ============================================================================
// CLOUD API HELPERS (v3.0.0)
// ============================================================================

/** Fetch all prompts from the cloud API. */
async function cloudFetchPrompts(): Promise<SavedPrompt[]> {
  const res = await fetch('/api/saved-prompts', { credentials: 'include' });
  if (!res.ok) {
    console.error('[SavedPrompts:cloud] GET failed:', res.status);
    return [];
  }
  const data = await res.json() as { prompts?: unknown[] };
  // The API returns DbSavedPrompt[] which is structurally compatible with SavedPrompt
  return (data.prompts ?? []) as SavedPrompt[];
}

/** Save a prompt to the cloud (POST). */
async function cloudSavePrompt(prompt: SavedPrompt): Promise<boolean> {
  const res = await fetch('/api/saved-prompts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt),
  });
  return res.ok;
}

/** Update a prompt in the cloud (PATCH). */
async function cloudUpdatePrompt(
  id: string,
  updates: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(`/api/saved-prompts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

/** Delete a prompt from the cloud (DELETE). */
async function cloudDeletePrompt(id: string): Promise<boolean> {
  const res = await fetch(`/api/saved-prompts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return res.ok;
}

/** One-time sync: push localStorage prompts to the cloud. */
async function cloudSyncFromLocal(prompts: SavedPrompt[]): Promise<boolean> {
  const res = await fetch('/api/saved-prompts/sync', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts }),
  });
  return res.ok;
}

/** Check if the one-time sync has already run (localStorage flag). */
function hasSyncCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SYNC_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Mark the one-time sync as complete. */
function markSyncComplete(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_FLAG_KEY, 'true');
  } catch { /* non-critical */ }
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
  /** True while loading from localStorage or cloud */
  isLoading: boolean;

  // ── Prompt CRUD ──

  savePrompt: (prompt: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { source?: 'builder' | 'tooltip' }) => SavedPrompt | null;
  quickSave: (data: {
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
  }) => SavedPrompt | null;
  updatePrompt: (id: string, updates: Partial<SavedPrompt>) => boolean;
  deletePrompt: (id: string) => boolean;
  getPrompt: (id: string) => SavedPrompt | undefined;

  // ── Filters ──

  setFilters: (filters: Partial<LibraryFilters>) => void;
  resetFilters: () => void;

  // ── Folders ──

  folders: string[];
  createFolder: (name: string) => boolean;
  renameFolder: (oldName: string, newName: string) => boolean;
  deleteFolder: (name: string) => boolean;
  moveToFolder: (promptId: string, folder: string | undefined) => boolean;

  // ── Import / Export ──

  exportPrompts: (folderName?: string) => string;
  importPrompts: (json: string, targetFolder?: string) => {
    imported: number;
    duplicates: number;
    errors: number;
  };

  /** Delete ALL prompts (nuclear option) */
  clearAll: () => void;

  // ── v3.0.0: Cloud storage ──

  /** Current storage backend: 'local' (free), 'cloud' (Pro), 'loading' (detecting) */
  storageMode: StorageMode;
  /** Non-null when the last cloud write failed. Cleared on next successful write. */
  syncError: string | null;
  /** Data for the Pro conversion banner (show when free user has 10+ local prompts) */
  proSyncBanner: {
    show: boolean;
    promptCount: number;
  };
}

export function useSavedPrompts(): UseSavedPromptsReturn {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [filters, setFiltersState] = useState<LibraryFilters>(DEFAULT_LIBRARY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [emptyFolderNames, setEmptyFolderNames] = useState<string[]>([]);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Clerk auth state — always called (React hooks rules)
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Prevent duplicate cloud loads / syncs
  const cloudLoadedRef = useRef(false);
  const syncTriggeredRef = useRef(false);
  // Ref mirror of storageMode for use inside callbacks (avoids stale closures)
  const storageModeRef = useRef<StorageMode>('local');
  storageModeRef.current = storageMode;

  // ============================================================================
  // MODE DETECTION
  // ============================================================================

  const isPaid = useMemo(() => {
    if (!authLoaded || !isSignedIn || !user) return false;
    const meta = user.publicMetadata as { tier?: string } | undefined;
    return meta?.tier === 'paid';
  }, [authLoaded, isSignedIn, user]);

  // Resolve storage mode once auth is loaded
  useEffect(() => {
    if (!authLoaded) return;
    setStorageMode(isPaid ? 'cloud' : 'local');
  }, [authLoaded, isPaid]);

  // ============================================================================
  // INITIAL LOAD — localStorage (free) or cloud API (Pro)
  // ============================================================================

  // Local mode: load from localStorage (same as v2.0.0)
  useEffect(() => {
    if (storageMode !== 'local') return;
    const loaded = loadFromStorage();
    setPrompts(loaded);
    setEmptyFolderNames(loadEmptyFolders());
    setIsLoading(false);
  }, [storageMode]);

  // ============================================================================
  // CLOUD MODE: Sync-then-load (single sequenced effect)
  // ============================================================================
  // When storageMode switches to 'cloud':
  //   1. If localStorage has un-synced prompts → sync them to DB first
  //   2. THEN fetch from cloud (which now includes the synced data)
  //   3. If sync fails → keep localStorage data, show error, do NOT wipe
  //   4. If cloud fetch fails → keep localStorage data, show error
  // ============================================================================

  useEffect(() => {
    if (storageMode !== 'cloud') return;
    if (cloudLoadedRef.current) return;
    cloudLoadedRef.current = true;

    let cancelled = false;

    async function initCloud() {
      // Step 1: Check if one-time sync is needed
      const needsSync = !hasSyncCompleted();
      const localPrompts = loadFromStorage();

      if (needsSync && localPrompts.length > 0) {
        // Sync localStorage → cloud FIRST
        syncTriggeredRef.current = true;
        try {
          console.debug(`[SavedPrompts:cloud] Syncing ${localPrompts.length} local prompts to cloud…`);
          const syncOk = await cloudSyncFromLocal(localPrompts);
          if (cancelled) return;

          if (syncOk) {
            markSyncComplete();
            console.debug('[SavedPrompts:cloud] Sync complete');
          } else {
            // Sync failed — keep localStorage data, do NOT overwrite with empty cloud
            console.error('[SavedPrompts:cloud] Sync returned non-ok');
            setSyncError('Failed to sync local prompts to cloud. Will retry next time.');
            setIsLoading(false);
            return; // STOP — don't fetch from empty cloud
          }
        } catch (error) {
          if (cancelled) return;
          console.error('[SavedPrompts:cloud] Sync failed:', error);
          setSyncError('Failed to sync local prompts to cloud. Will retry next time.');
          setIsLoading(false);
          return; // STOP — keep localStorage data
        }
      } else if (needsSync && localPrompts.length === 0) {
        // No local data to sync — mark complete
        markSyncComplete();
      }

      // Step 2: Fetch from cloud (DB now has synced data if sync ran)
      try {
        const cloudPrompts = await cloudFetchPrompts();
        if (cancelled) return;
        setPrompts(cloudPrompts);
        setEmptyFolderNames(loadEmptyFolders());
        setIsLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('[SavedPrompts:cloud] Cloud load failed:', error);
        // Keep localStorage data — don't wipe to empty
        setSyncError('Could not reach the cloud. Showing local prompts.');
        setIsLoading(false);
      }
    }

    void initCloud();
    return () => { cancelled = true; };
  }, [storageMode]);

  // ============================================================================
  // PERSIST — localStorage only in local mode
  // ============================================================================

  useEffect(() => {
    if (storageMode !== 'local') return;
    if (isLoading) return;
    saveToStorage(prompts);
  }, [prompts, isLoading, storageMode]);

  // ============================================================================
  // DERIVED DATA (unchanged from v2.0.0)
  // ============================================================================

  const filteredPrompts = useMemo(() => {
    const filtered = filterPrompts(prompts, filters);
    return sortPrompts(filtered, filters.sortBy, filters.sortDirection);
  }, [prompts, filters]);

  const stats = useMemo(() => calculateStats(prompts), [prompts]);

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
  // PRO SYNC BANNER (Extra #2)
  // ============================================================================

  const proSyncBanner = useMemo(() => {
    // Show when: user is NOT paid AND has 10+ prompts in local storage
    if (isPaid) return { show: false, promptCount: 0 };

    // Read local count directly (don't use state — state may be cloud data)
    const localPrompts = loadFromStorage();
    const count = localPrompts.length;

    return {
      show: count >= PRO_BANNER_THRESHOLD,
      promptCount: count,
    };
  }, [isPaid, prompts]); // eslint-disable-line react-hooks/exhaustive-deps
  // prompts in dep array to re-check after saves (the lint warning is a false positive —
  // we intentionally re-check localStorage count when prompts state changes in local mode)

  // ============================================================================
  // OPTIMISTIC WRITE HELPER
  // ============================================================================

  /**
   * Fire a cloud API call in the background. On failure, revert state.
   * Clears syncError on success. Uses ref to read current storageMode.
   */
  function fireAndForget(
    apiCall: () => Promise<boolean>,
    revert: () => void,
    label: string,
  ): void {
    if (storageModeRef.current !== 'cloud') return;

    apiCall()
      .then((ok) => {
        if (ok) {
          setSyncError(null);
        } else {
          console.error(`[SavedPrompts:cloud] ${label} failed (non-ok)`);
          revert();
          setSyncError(`Failed to ${label}. Change reverted.`);
        }
      })
      .catch((err) => {
        console.error(`[SavedPrompts:cloud] ${label} error:`, err);
        revert();
        setSyncError(`Failed to ${label}. Change reverted.`);
      });
  }

  // ============================================================================
  // PROMPT CRUD (optimistic writes in cloud mode)
  // ============================================================================

  const savePrompt = useCallback(
    (
      promptData: Omit<SavedPrompt, 'id' | 'createdAt' | 'updatedAt' | 'source'> & { source?: 'builder' | 'tooltip' }
    ): SavedPrompt | null => {
      const now = new Date().toISOString();
      const newPrompt: SavedPrompt = {
        ...promptData,
        source: promptData.source ?? 'builder',
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };

      // Optimistic: update state immediately
      setPrompts((prev) => [...prev, newPrompt]);

      // Cloud: fire API in background
      fireAndForget(
        () => cloudSavePrompt(newPrompt),
        () => setPrompts((prev) => prev.filter((p) => p.id !== newPrompt.id)),
        'save prompt',
      );

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
      };

      setPrompts((prev) => [...prev, newPrompt]);

      fireAndForget(
        () => cloudSavePrompt(newPrompt),
        () => setPrompts((prev) => prev.filter((p) => p.id !== newPrompt.id)),
        'quick save',
      );

      return newPrompt;
    },
     
    []
  );

  const updatePrompt = useCallback(
    (id: string, updates: Partial<SavedPrompt>): boolean => {
      let found = false;
      let snapshot: SavedPrompt | null = null;

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            found = true;
            snapshot = { ...p }; // snapshot for rollback
            return { ...p, ...updates, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      if (found) {
        const capturedSnapshot = snapshot;
        fireAndForget(
          () => cloudUpdatePrompt(id, updates as Record<string, unknown>),
          () => {
            if (capturedSnapshot) {
              setPrompts((prev) =>
                prev.map((p) => (p.id === id ? capturedSnapshot : p))
              );
            }
          },
          'update prompt',
        );
      }

      return found;
    },
     
    []
  );

  const deletePrompt = useCallback(
    (id: string): boolean => {
      let found = false;
      let snapshot: SavedPrompt | null = null;

      setPrompts((prev) => {
        const filtered = prev.filter((p) => {
          if (p.id === id) {
            found = true;
            snapshot = { ...p };
            return false;
          }
          return true;
        });
        return filtered;
      });

      if (found) {
        const capturedSnapshot = snapshot;
        fireAndForget(
          () => cloudDeletePrompt(id),
          () => {
            if (capturedSnapshot) {
              setPrompts((prev) => [...prev, capturedSnapshot]);
            }
          },
          'delete prompt',
        );
      }

      return found;
    },
     
    []
  );

  const getPrompt = useCallback(
    (id: string): SavedPrompt | undefined => {
      return prompts.find((p) => p.id === id);
    },
    [prompts]
  );

  // ============================================================================
  // FILTERS (unchanged)
  // ============================================================================

  const setFilters = useCallback((newFilters: Partial<LibraryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_LIBRARY_FILTERS);
  }, []);

  // ============================================================================
  // FOLDER OPERATIONS (optimistic writes in cloud mode)
  // ============================================================================

  const createFolder = useCallback(
    (name: string): boolean => {
      const sanitised = sanitiseFolderName(name);
      if (!sanitised) return false;

      if (folders.length >= MAX_FOLDERS) {
        console.warn(`[SavedPrompts] Cannot create folder — max ${MAX_FOLDERS} reached`);
        return false;
      }

      if (folders.some((f) => f.toLowerCase() === sanitised.toLowerCase())) {
        console.warn(`[SavedPrompts] Folder "${sanitised}" already exists`);
        return false;
      }

      persistEmptyFolder(sanitised);
      setEmptyFolderNames(loadEmptyFolders());
      return true;
    },
    [folders]
  );

  const renameFolder = useCallback(
    (oldName: string, newName: string): boolean => {
      const sanitisedNew = sanitiseFolderName(newName);
      if (!sanitisedNew || !oldName) return false;

      if (
        folders.some(
          (f) =>
            f.toLowerCase() === sanitisedNew.toLowerCase() &&
            f.toLowerCase() !== oldName.toLowerCase()
        )
      ) {
        console.warn(`[SavedPrompts] Folder "${sanitisedNew}" already exists`);
        return false;
      }

      // Snapshot for rollback
      const affectedIds: string[] = [];

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.folder === oldName) {
            affectedIds.push(p.id);
            return { ...p, folder: sanitisedNew, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      removeEmptyFolder(oldName);
      persistEmptyFolder(sanitisedNew);
      setEmptyFolderNames(loadEmptyFolders());

      // Cloud: update each affected prompt's folder
      if (storageModeRef.current === 'cloud') {
        for (const id of affectedIds) {
          void cloudUpdatePrompt(id, { folder: sanitisedNew }).catch((err) => {
            console.error('[SavedPrompts:cloud] Folder rename sync error:', err);
          });
        }
      }

      return true;
    },
     
    [folders]
  );

  const deleteFolder = useCallback(
    (name: string): boolean => {
      if (!name) return false;

      const affectedIds: string[] = [];

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.folder === name) {
            affectedIds.push(p.id);
            return { ...p, folder: undefined, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      removeEmptyFolder(name);
      setEmptyFolderNames(loadEmptyFolders());

      if (storageModeRef.current === 'cloud') {
        for (const id of affectedIds) {
          void cloudUpdatePrompt(id, { folder: null }).catch((err) => {
            console.error('[SavedPrompts:cloud] Folder delete sync error:', err);
          });
        }
      }

      return true;
    },
     
    []
  );

  const moveToFolder = useCallback(
    (promptId: string, folder: string | undefined): boolean => {
      let found = false;
      let oldFolder: string | undefined;

      setPrompts((prev) =>
        prev.map((p) => {
          if (p.id === promptId) {
            found = true;
            oldFolder = p.folder;
            return { ...p, folder, updatedAt: new Date().toISOString() };
          }
          return p;
        })
      );

      if (found) {
        const capturedOldFolder = oldFolder;
        fireAndForget(
          () => cloudUpdatePrompt(promptId, { folder: folder ?? null }),
          () => {
            setPrompts((prev) =>
              prev.map((p) =>
                p.id === promptId
                  ? { ...p, folder: capturedOldFolder, updatedAt: new Date().toISOString() }
                  : p
              )
            );
          },
          'move to folder',
        );
      }

      return found;
    },
     
    []
  );

  // ============================================================================
  // IMPORT / EXPORT (unchanged — operates on in-memory state)
  // ============================================================================

  const exportPrompts = useCallback(
    (folderName?: string): string => {
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

        const existingHashes = new Set<number>();
        for (const p of prompts) {
          existingHashes.add(hashPromptText(p.positivePrompt));
        }

        const now = new Date().toISOString();
        const newPrompts: SavedPrompt[] = [];

        for (const prompt of importedPrompts) {
          try {
            if (!prompt.name || !prompt.platformId || !prompt.positivePrompt) {
              errors++;
              continue;
            }

            const hash = hashPromptText(prompt.positivePrompt);
            if (existingHashes.has(hash)) {
              duplicates++;
              continue;
            }
            existingHashes.add(hash);

            const newP: SavedPrompt = {
              ...prompt,
              id: generateId(),
              createdAt: prompt.createdAt || now,
              updatedAt: now,
              source: prompt.source ?? 'builder',
              folder: targetFolder,
            };
            newPrompts.push(newP);
            imported++;
          } catch {
            errors++;
          }
        }

        if (newPrompts.length > 0) {
          setPrompts((prev) => [...prev, ...newPrompts]);

          // Cloud: save each imported prompt in background
          if (storageModeRef.current === 'cloud') {
            for (const p of newPrompts) {
              void cloudSavePrompt(p).catch((err) => {
                console.error('[SavedPrompts:cloud] Import sync error:', err);
              });
            }
          }
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

    // Note: cloud clear is NOT done here — that would need a dedicated
    // "delete all" API endpoint. For now clearAll only clears the UI state.
    // The user would need to delete prompts individually in cloud mode.
    // This matches the existing behaviour where clearAll is a dev/debug tool.
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

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

    // v3.0.0 additions
    storageMode,
    syncError,
    proSyncBanner,
  };
}

export default useSavedPrompts;

// ============================================================================
// EMPTY FOLDER REGISTRY (unchanged from v2.0.0)
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
