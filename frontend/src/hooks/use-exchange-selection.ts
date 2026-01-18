// src/hooks/use-exchange-selection.ts
// ============================================================================
// EXCHANGE SELECTION HOOK - Tier-Aware Exchange Selection for Indices
// ============================================================================
// Central hook that manages which exchanges a user sees on the homepage.
//
// FREE users: Returns default selections from exchanges.selected.json
// PAID users: Returns custom selections from Clerk publicMetadata
//
// This ensures:
// 1. When SSOT (exchanges.selected.json) changes → free users see updated exchanges
// 2. When paid users change their selection → their view updates immediately
// 3. Indices API calls only request data for selected exchanges
//
// Authority: docs/authority/paid_tier.md §5.3
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

import exchangesSelectedJson from '@/data/exchanges/exchanges.selected.json';
import type { UserTier } from './use-promagen-auth';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Exchange selection stored in Clerk publicMetadata for paid users.
 */
export interface ExchangeSelectionMetadata {
  exchangeIds: string[];
  updatedAt: string;
}

/**
 * Result from the useExchangeSelection hook.
 */
export interface ExchangeSelectionResult {
  /** Array of selected exchange IDs */
  exchangeIds: string[];
  /** Whether the selection is custom (paid user) or default (free/anonymous) */
  isCustomSelection: boolean;
  /** Whether the selection is being loaded */
  isLoading: boolean;
  /** User's tier for UI decisions */
  userTier: UserTier;
  /** Whether user can customize selection */
  canCustomize: boolean;
  /** Update the selection (paid users only) */
  updateSelection: (ids: string[]) => Promise<boolean>;
  /** Reset to defaults */
  resetToDefaults: () => Promise<boolean>;
  /** Source of current selection for debugging */
  source: 'ssot' | 'clerk' | 'local-optimistic';
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Minimum and maximum exchange selection counts
const MIN_EXCHANGES = 6;
const MAX_EXCHANGES = 16;

// Debug flag
const DEBUG_SELECTION = process.env.NODE_ENV !== 'production';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract default exchange IDs from the SSOT JSON file.
 */
function getDefaultExchangeIds(): string[] {
  const raw = exchangesSelectedJson as { ids?: unknown };
  if (!raw || !Array.isArray(raw.ids)) {
    console.error('[useExchangeSelection] Invalid exchanges.selected.json format');
    return [];
  }
  return raw.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/**
 * Narrow unknown → string[] and validate constraints.
 * Used when reading untyped external data (e.g. Clerk metadata).
 */
function isExchangeIds(ids: unknown): ids is string[] {
  if (!Array.isArray(ids)) return false;
  if (ids.length < MIN_EXCHANGES || ids.length > MAX_EXCHANGES) return false;
  return ids.every((id) => typeof id === 'string' && id.length > 0);
}

/**
 * Validate a known string[] selection (length bounds + non-empty strings).
 * Used for in-app arrays (e.g. UI selection before saving).
 */
function validateExchangeIds(ids: ReadonlyArray<string>): boolean {
  if (ids.length < MIN_EXCHANGES || ids.length > MAX_EXCHANGES) return false;
  return ids.every((id) => id.length > 0);
}

/**
 * Extract exchange selection from Clerk public metadata.
 */
function getExchangeSelectionFromMetadata(
  publicMetadata: Record<string, unknown> | null | undefined,
): ExchangeSelectionMetadata | null {
  if (!publicMetadata) return null;

  const selection = publicMetadata.exchangeSelection as
    | {
        exchangeIds?: unknown;
        updatedAt?: unknown;
      }
    | undefined;

  if (!selection) return null;

  const exchangeIds = selection.exchangeIds;
  if (!isExchangeIds(exchangeIds)) {
    if (DEBUG_SELECTION) {
      console.warn('[useExchangeSelection] Invalid exchangeIds in Clerk metadata:', exchangeIds);
    }
    return null;
  }

  return {
    exchangeIds,
    updatedAt:
      typeof selection.updatedAt === 'string' ? selection.updatedAt : new Date().toISOString(),
  };
}

function debugLog(message: string, data?: Record<string, unknown>): void {
  if (!DEBUG_SELECTION) return;
  const timestamp = new Date().toISOString().slice(11, 23);
  if (data) {
    // eslint-disable-next-line no-console
    console.log(`[ExchangeSelection ${timestamp}] ${message}`, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[ExchangeSelection ${timestamp}] ${message}`);
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useExchangeSelection - Get and manage exchange selection based on user tier.
 *
 * For FREE/anonymous users:
 * - Returns default selections from exchanges.selected.json (SSOT)
 * - canCustomize = false
 * - updateSelection/resetToDefaults are no-ops
 *
 * For PAID users:
 * - Returns custom selections from Clerk publicMetadata if set
 * - Falls back to SSOT defaults if no custom selection
 * - canCustomize = true
 * - updateSelection persists to Clerk metadata
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { exchangeIds, isCustomSelection, updateSelection } = useExchangeSelection();
 *
 *   // Pass exchangeIds to useIndicesQuotes
 *   const { quotesById } = useIndicesQuotes({ exchangeIds });
 * }
 * ```
 */
export function useExchangeSelection(): ExchangeSelectionResult {
  const { user, isLoaded } = useUser();

  // Local state for optimistic updates
  const [localSelection, setLocalSelection] = useState<string[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Extract user tier from Clerk metadata
  const publicMetadata = user?.publicMetadata as { tier?: UserTier } | undefined;
  const userTier: UserTier = publicMetadata?.tier ?? 'free';
  const canCustomize = userTier === 'paid';

  // Get selections from various sources
  const defaultIds = useMemo(() => getDefaultExchangeIds(), []);
  const clerkSelection = useMemo(
    () => getExchangeSelectionFromMetadata(user?.publicMetadata as Record<string, unknown>),
    [user?.publicMetadata],
  );

  // Determine the effective exchange IDs and source
  const { exchangeIds, isCustomSelection, source } = useMemo(() => {
    // Priority 1: Local optimistic state (during save)
    if (localSelection !== null) {
      debugLog('Using local optimistic selection', { count: localSelection.length });
      return {
        exchangeIds: localSelection,
        isCustomSelection: true,
        source: 'local-optimistic' as const,
      };
    }

    // Priority 2: Clerk metadata for paid users
    if (userTier === 'paid' && clerkSelection) {
      debugLog('Using Clerk selection', {
        count: clerkSelection.exchangeIds.length,
        updatedAt: clerkSelection.updatedAt,
      });
      return {
        exchangeIds: clerkSelection.exchangeIds,
        isCustomSelection: true,
        source: 'clerk' as const,
      };
    }

    // Priority 3: SSOT defaults
    debugLog('Using SSOT defaults', { count: defaultIds.length });
    return {
      exchangeIds: defaultIds,
      isCustomSelection: false,
      source: 'ssot' as const,
    };
  }, [localSelection, userTier, clerkSelection, defaultIds]);

  // Clear local selection when Clerk data updates (save completed)
  useEffect(() => {
    if (!isSaving && localSelection !== null && clerkSelection) {
      // Check if Clerk has our update
      const clerkSet = new Set(clerkSelection.exchangeIds);
      const localSet = new Set(localSelection);
      const matches =
        localSet.size === clerkSet.size && localSelection.every((id) => clerkSet.has(id));

      if (matches) {
        debugLog('Clerk synced, clearing local state');
        setLocalSelection(null);
      }
    }
  }, [isSaving, localSelection, clerkSelection]);

  /**
   * Update the exchange selection (paid users only).
   * Saves to Clerk publicMetadata via /api/user/preferences.
   */
  const updateSelection = useCallback(
    async (ids: string[]): Promise<boolean> => {
      if (!canCustomize) {
        console.warn('[useExchangeSelection] Cannot customize - not a paid user');
        return false;
      }

      if (!validateExchangeIds(ids)) {
        console.error('[useExchangeSelection] Invalid selection:', {
          count: ids.length,
          min: MIN_EXCHANGES,
          max: MAX_EXCHANGES,
        });
        return false;
      }

      // Optimistic update
      setLocalSelection(ids);
      setIsSaving(true);

      try {
        debugLog('Saving selection to Clerk', { count: ids.length });

        const response = await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            exchangeSelection: {
              exchangeIds: ids,
              updatedAt: new Date().toISOString(),
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[useExchangeSelection] Save failed:', response.status, errorData);
          setLocalSelection(null); // Revert
          return false;
        }

        debugLog('Selection saved successfully');
        return true;
      } catch (error) {
        console.error('[useExchangeSelection] Save error:', error);
        setLocalSelection(null); // Revert
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [canCustomize],
  );

  /**
   * Reset to default SSOT selection (paid users only).
   */
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    if (!canCustomize) {
      console.warn('[useExchangeSelection] Cannot reset - not a paid user');
      return false;
    }

    debugLog('Resetting to defaults');
    return updateSelection(defaultIds);
  }, [canCustomize, updateSelection, defaultIds]);

  return {
    exchangeIds,
    isCustomSelection,
    isLoading: !isLoaded || isSaving,
    userTier,
    canCustomize,
    updateSelection,
    resetToDefaults,
    source,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default useExchangeSelection;

// Re-export constants for external validation
export { MIN_EXCHANGES, MAX_EXCHANGES };
