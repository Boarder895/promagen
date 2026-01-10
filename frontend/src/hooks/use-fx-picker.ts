// src/hooks/use-fx-picker.ts
// =============================================================================
// FX Picker Hook - Main interface for FX pair selection
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================

'use client';

import { useMemo, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useFxSelectionStore } from '@/lib/fx/fx-selection.store';
import { useClerkFxSync } from '@/lib/fx/clerk-sync';
import {
  type FxPickerState,
  type FxPickerActions,
  type FxSyncStatus,
  FX_SELECTION_LIMITS,
} from '@/types/fx-selection';

// =============================================================================
// Types
// =============================================================================

export interface FxPairOption {
  id: string;
  base: string;
  quote: string;
  baseCountryCode: string;
  quoteCountryCode: string;
  label: string;
}

export interface UseFxPickerOptions {
  /** Catalog of all available pairs (from SSOT) */
  catalog: FxPairOption[];
  /** Default pair IDs (from SSOT) */
  defaultPairIds: string[];
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseFxPickerResult {
  /** Current picker state */
  state: FxPickerState;
  /** Available actions */
  actions: FxPickerActions;
  /** All available pair options */
  pairOptions: FxPairOption[];
  /** Currently selected pairs (full objects) */
  selectedPairs: FxPairOption[];
  /** Search/filter pairs by query */
  searchPairs: (query: string) => FxPairOption[];
  /** Validation errors (if any) */
  validationErrors: string[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useFxPicker(options: UseFxPickerOptions): UseFxPickerResult {
  const { catalog, defaultPairIds, debug = false } = options;

  // Get user and tier info
  const { user, isLoaded: isUserLoaded } = useUser();
  const tier =
    (user?.publicMetadata as { tier?: 'free' | 'paid' } | undefined)?.tier ?? 'free';
  const isPro = tier === 'paid';

  // Initialize Clerk sync (only for authenticated Pro users)
  // Note: isInitialized is tracked internally by the hook
  const { isPro: _isPro } = useClerkFxSync({ debug });

  // Get store state and actions
  const store = useFxSelectionStore();

  // Build pair lookup map
  const pairMap = useMemo(() => {
    const map = new Map<string, FxPairOption>();
    for (const pair of catalog) {
      map.set(pair.id.toLowerCase(), pair);
    }
    return map;
  }, [catalog]);

  // Determine effective pair IDs
  const effectivePairIds = useMemo(() => {
    // Free users: always use defaults
    if (!isPro) {
      return defaultPairIds;
    }
    // Pro users: use stored selection or defaults
    return store.pairIds.length > 0 ? store.pairIds : defaultPairIds;
  }, [isPro, store.pairIds, defaultPairIds]);

  // Get selected pairs as full objects
  const selectedPairs = useMemo(() => {
    return effectivePairIds
      .map((id) => pairMap.get(id.toLowerCase()))
      .filter((p): p is FxPairOption => p !== undefined);
  }, [effectivePairIds, pairMap]);

  // Build picker state
  const state: FxPickerState = useMemo(
    () => ({
      pairIds: effectivePairIds,
      syncStatus: store.syncStatus,
      canEdit: isPro,
      maxPairs: FX_SELECTION_LIMITS.MAX_PAIRS,
      minPairs: FX_SELECTION_LIMITS.MIN_PAIRS,
      isLoading: !isUserLoaded || store.isLoading,
      lastSyncedAt: store.lastSyncedAt,
    }),
    [effectivePairIds, store.syncStatus, isPro, isUserLoaded, store.isLoading, store.lastSyncedAt],
  );

  // Validation errors
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (effectivePairIds.length < FX_SELECTION_LIMITS.MIN_PAIRS) {
      errors.push(
        `Select at least ${FX_SELECTION_LIMITS.MIN_PAIRS} pairs (currently ${effectivePairIds.length})`,
      );
    }
    if (effectivePairIds.length > FX_SELECTION_LIMITS.MAX_PAIRS) {
      errors.push(
        `Maximum ${FX_SELECTION_LIMITS.MAX_PAIRS} pairs allowed (currently ${effectivePairIds.length})`,
      );
    }
    // Check for invalid pair IDs
    const invalidIds = effectivePairIds.filter((id) => !pairMap.has(id.toLowerCase()));
    if (invalidIds.length > 0) {
      errors.push(`Invalid pair IDs: ${invalidIds.join(', ')}`);
    }
    return errors;
  }, [effectivePairIds, pairMap]);

  // Actions (wrapped to check tier)
  const actions: FxPickerActions = useMemo(
    () => ({
      setSelection: (pairIds: string[]) => {
        if (!isPro) {
          console.warn('[use-fx-picker] Selection change blocked: Pro Promagen required');
          return;
        }
        store.setSelection(pairIds);
      },
      addPair: (pairId: string) => {
        if (!isPro) {
          console.warn('[use-fx-picker] Add pair blocked: Pro Promagen required');
          return false;
        }
        const result = store.addPair(pairId);
        return result.success;
      },
      removePair: (pairId: string) => {
        if (!isPro) {
          console.warn('[use-fx-picker] Remove pair blocked: Pro Promagen required');
          return false;
        }
        const result = store.removePair(pairId);
        return result.success;
      },
      resetToDefault: () => {
        if (!isPro) {
          console.warn('[use-fx-picker] Reset blocked: Pro Promagen required');
          return;
        }
        store.resetToDefault();
      },
      forceSync: async () => {
        if (!isPro) {
          console.warn('[use-fx-picker] Sync blocked: Pro Promagen required');
          return;
        }
        await store.forceSyncToClerk();
      },
    }),
    [isPro, store],
  );

  // Search function
  const searchPairs = useCallback(
    (query: string): FxPairOption[] => {
      if (!query.trim()) {
        return catalog;
      }
      const lowerQuery = query.toLowerCase().trim();
      return catalog.filter(
        (pair) =>
          pair.id.toLowerCase().includes(lowerQuery) ||
          pair.base.toLowerCase().includes(lowerQuery) ||
          pair.quote.toLowerCase().includes(lowerQuery) ||
          pair.label.toLowerCase().includes(lowerQuery),
      );
    },
    [catalog],
  );

  return {
    state,
    actions,
    pairOptions: catalog,
    selectedPairs,
    searchPairs,
    validationErrors,
  };
}

// =============================================================================
// Simplified Hooks
// =============================================================================

/**
 * Simple hook to get current FX selection (read-only)
 */
export function useFxSelection(): {
  pairIds: string[];
  isLoading: boolean;
} {
  const store = useFxSelectionStore();
  return {
    pairIds: store.pairIds,
    isLoading: store.isLoading,
  };
}

/**
 * Hook to check if user can access FX picker
 */
export function useCanAccessFxPicker(): {
  canAccess: boolean;
  isLoading: boolean;
  tier: 'free' | 'paid';
} {
  const { user, isLoaded } = useUser();
  const tier =
    (user?.publicMetadata as { tier?: 'free' | 'paid' } | undefined)?.tier ?? 'free';

  return {
    canAccess: tier === 'paid',
    isLoading: !isLoaded,
    tier,
  };
}

/**
 * Hook to get sync status only
 */
export function useFxSyncStatus(): FxSyncStatus {
  const store = useFxSelectionStore();
  return store.syncStatus;
}
