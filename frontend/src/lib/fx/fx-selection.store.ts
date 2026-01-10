// src/lib/fx/fx-selection.store.ts
// =============================================================================
// FX Selection Store - Hybrid localStorage + Clerk sync
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================
// Architecture:
// 1. Immediate write to localStorage (fast UX)
// 2. Async sync to Clerk metadata (debounced 2s)
// 3. On login: Clerk → localStorage (Clerk wins on conflict)
// =============================================================================

'use client';

import { useSyncExternalStore, useCallback } from 'react';
import {
  type FxSelectionLocal,
  type FxSyncStatus,
  FX_SELECTION_LIMITS,
  isFxSelectionLocal,
  createEmptyLocalSelection,
  validatePairCount,
} from '@/types/fx-selection';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'promagen:fx:selection';
const SYNC_DEBOUNCE_MS = 2000;

// =============================================================================
// Module State (singleton store)
// =============================================================================

type Listener = () => void;

// Current selection state
let currentSelection: FxSelectionLocal | null = null;

// Sync status
let syncStatus: FxSyncStatus = 'idle';

// Pending sync callback (for Clerk integration)
let pendingSyncCallback: ((selection: FxSelectionLocal) => Promise<void>) | null = null;

// Debounce timer
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Subscribers
const subscribers = new Set<Listener>();

// Default pair IDs (will be populated from SSOT)
let defaultPairIds: string[] = [];

// Hydration flag
let hasHydrated = false;

// =============================================================================
// Notify Subscribers
// =============================================================================

function notify(): void {
  subscribers.forEach((listener) => listener());
}

// =============================================================================
// localStorage Operations
// =============================================================================

function loadFromLocalStorage(): FxSelectionLocal | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (isFxSelectionLocal(parsed)) {
      return parsed;
    }

    // Invalid schema - clear it
    console.warn('[fx-selection-store] Invalid localStorage schema, clearing');
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (err) {
    console.error('[fx-selection-store] Failed to load from localStorage:', err);
    return null;
  }
}

function saveToLocalStorage(selection: FxSelectionLocal): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch (err) {
    console.error('[fx-selection-store] Failed to save to localStorage:', err);
  }
}

// =============================================================================
// Sync Operations
// =============================================================================

function scheduleSyncToClerk(): void {
  // Clear existing timer
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }

  // If no sync callback registered, skip
  if (!pendingSyncCallback || !currentSelection) {
    return;
  }

  syncStatus = 'syncing';
  notify();

  syncDebounceTimer = setTimeout(async () => {
    if (!pendingSyncCallback || !currentSelection) {
      syncStatus = 'idle';
      notify();
      return;
    }

    try {
      await pendingSyncCallback(currentSelection);

      // Update syncedAt timestamp
      currentSelection = {
        ...currentSelection,
        syncedAt: new Date().toISOString(),
      };
      saveToLocalStorage(currentSelection);

      syncStatus = 'synced';
      notify();

      // Reset to idle after a short delay
      setTimeout(() => {
        if (syncStatus === 'synced') {
          syncStatus = 'idle';
          notify();
        }
      }, 2000);
    } catch (err) {
      console.error('[fx-selection-store] Clerk sync failed:', err);
      syncStatus = 'error';
      notify();

      // Retry after 30 seconds
      setTimeout(() => {
        if (syncStatus === 'error') {
          scheduleSyncToClerk();
        }
      }, 30000);
    }
  }, SYNC_DEBOUNCE_MS);
}

// =============================================================================
// Hydration
// =============================================================================

function hydrateOnce(): void {
  if (hasHydrated) return;
  hasHydrated = true;

  const stored = loadFromLocalStorage();
  if (stored) {
    currentSelection = stored;
  } else {
    // Create default selection
    currentSelection = createEmptyLocalSelection(defaultPairIds);
    saveToLocalStorage(currentSelection);
  }
}

// =============================================================================
// Public API - Mutations
// =============================================================================

/**
 * Set the default pair IDs (called once from SSOT on app init)
 */
export function setDefaultPairIds(pairIds: string[]): void {
  defaultPairIds = pairIds.slice(0, FX_SELECTION_LIMITS.MAX_PAIRS);
}

/**
 * Register the Clerk sync callback (called once when user is authenticated)
 */
export function registerClerkSyncCallback(
  callback: (selection: FxSelectionLocal) => Promise<void>,
): void {
  pendingSyncCallback = callback;
}

/**
 * Unregister the Clerk sync callback (called on logout)
 */
export function unregisterClerkSyncCallback(): void {
  pendingSyncCallback = null;
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }
}

/**
 * Set the full selection (replaces current)
 */
export function setSelection(pairIds: string[]): { success: boolean; error?: string } {
  hydrateOnce();

  // Validate count
  const validation = validatePairCount(pairIds.length);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Dedupe and normalize
  const uniquePairIds = [...new Set(pairIds.map((id) => id.toLowerCase().trim()))];

  // Re-validate after deduplication
  const finalValidation = validatePairCount(uniquePairIds.length);
  if (!finalValidation.valid) {
    return { success: false, error: finalValidation.error };
  }

  currentSelection = {
    pairIds: uniquePairIds,
    updatedAt: new Date().toISOString(),
    syncedAt: currentSelection?.syncedAt ?? null,
    version: 1,
  };

  saveToLocalStorage(currentSelection);
  scheduleSyncToClerk();
  notify();

  return { success: true };
}

/**
 * Add a pair to selection
 */
export function addPair(pairId: string): { success: boolean; error?: string } {
  hydrateOnce();

  const normalizedId = pairId.toLowerCase().trim();
  const current = currentSelection?.pairIds ?? [];

  // Already in selection
  if (current.includes(normalizedId)) {
    return { success: true };
  }

  // Check limit
  if (current.length >= FX_SELECTION_LIMITS.MAX_PAIRS) {
    return {
      success: false,
      error: `Maximum ${FX_SELECTION_LIMITS.MAX_PAIRS} pairs allowed`,
    };
  }

  return setSelection([...current, normalizedId]);
}

/**
 * Remove a pair from selection
 */
export function removePair(pairId: string): { success: boolean; error?: string } {
  hydrateOnce();

  const normalizedId = pairId.toLowerCase().trim();
  const current = currentSelection?.pairIds ?? [];

  // Not in selection
  if (!current.includes(normalizedId)) {
    return { success: true };
  }

  // Check minimum
  if (current.length <= FX_SELECTION_LIMITS.MIN_PAIRS) {
    return {
      success: false,
      error: `Minimum ${FX_SELECTION_LIMITS.MIN_PAIRS} pairs required`,
    };
  }

  return setSelection(current.filter((id) => id !== normalizedId));
}

/**
 * Reset to default SSOT pairs
 */
export function resetToDefault(): void {
  hydrateOnce();

  currentSelection = createEmptyLocalSelection(defaultPairIds);
  saveToLocalStorage(currentSelection);
  scheduleSyncToClerk();
  notify();
}

/**
 * Apply selection from Clerk (on login or sync)
 * Clerk wins on conflict (source of truth)
 */
export function applyClerkSelection(clerkPairIds: string[], clerkUpdatedAt: string): void {
  hydrateOnce();

  const localUpdatedAt = currentSelection?.updatedAt ?? '';

  // Clerk wins if:
  // 1. No local selection exists
  // 2. Clerk is newer than local
  // 3. Same timestamp (Clerk is source of truth)
  const clerkWins =
    !currentSelection ||
    !localUpdatedAt ||
    new Date(clerkUpdatedAt) >= new Date(localUpdatedAt);

  if (clerkWins) {
    currentSelection = {
      pairIds: clerkPairIds,
      updatedAt: clerkUpdatedAt,
      syncedAt: new Date().toISOString(),
      version: 1,
    };
    saveToLocalStorage(currentSelection);
    notify();
  } else {
    // Local is newer - sync local to Clerk
    scheduleSyncToClerk();
  }
}

/**
 * Force immediate sync to Clerk
 */
export async function forceSyncToClerk(): Promise<void> {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }

  if (!pendingSyncCallback || !currentSelection) {
    return;
  }

  syncStatus = 'syncing';
  notify();

  try {
    await pendingSyncCallback(currentSelection);

    currentSelection = {
      ...currentSelection,
      syncedAt: new Date().toISOString(),
    };
    saveToLocalStorage(currentSelection);

    syncStatus = 'synced';
    notify();
  } catch (err) {
    console.error('[fx-selection-store] Force sync failed:', err);
    syncStatus = 'error';
    notify();
    throw err;
  }
}

// =============================================================================
// Public API - Read State
// =============================================================================

export function getSelection(): FxSelectionLocal | null {
  hydrateOnce();
  return currentSelection;
}

export function getSyncStatus(): FxSyncStatus {
  return syncStatus;
}

export function getPairIds(): string[] {
  hydrateOnce();
  return currentSelection?.pairIds ?? defaultPairIds;
}

// =============================================================================
// React Hook
// =============================================================================

interface FxSelectionStoreState {
  pairIds: string[];
  syncStatus: FxSyncStatus;
  lastSyncedAt: string | null;
  isLoading: boolean;
}

interface FxSelectionStoreActions {
  setSelection: typeof setSelection;
  addPair: typeof addPair;
  removePair: typeof removePair;
  resetToDefault: typeof resetToDefault;
  forceSyncToClerk: typeof forceSyncToClerk;
}

export function useFxSelectionStore(): FxSelectionStoreState & FxSelectionStoreActions {
  const subscribe = useCallback((listener: Listener) => {
    hydrateOnce();
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback((): FxSelectionStoreState => {
    hydrateOnce();
    return {
      pairIds: currentSelection?.pairIds ?? defaultPairIds,
      syncStatus,
      lastSyncedAt: currentSelection?.syncedAt ?? null,
      isLoading: !hasHydrated,
    };
  }, []);

  // Server snapshot (SSR)
  const getServerSnapshot = useCallback((): FxSelectionStoreState => {
    return {
      pairIds: defaultPairIds,
      syncStatus: 'idle',
      lastSyncedAt: null,
      isLoading: true,
    };
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    ...state,
    setSelection,
    addPair,
    removePair,
    resetToDefault,
    forceSyncToClerk,
  };
}
