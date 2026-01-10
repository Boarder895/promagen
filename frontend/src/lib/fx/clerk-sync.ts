// src/lib/fx/clerk-sync.ts
// =============================================================================
// Clerk FX Selection Sync Utilities
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================
// Handles:
// - Syncing FX selection to Clerk publicMetadata (via API route)
// - Loading FX selection from Clerk on login
// - Conflict resolution (Clerk wins on same timestamp)
// =============================================================================

'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import type { FxSelectionLocal, ClerkFxSelection, FxSyncResolution } from '@/types/fx-selection';
import {
  registerClerkSyncCallback,
  unregisterClerkSyncCallback,
  applyClerkSelection,
  getSelection,
} from '@/lib/fx/fx-selection.store';

// =============================================================================
// Types
// =============================================================================

interface ClerkUserMetadata {
  publicMetadata?: {
    tier?: 'free' | 'paid';
    fxSelection?: ClerkFxSelection;
  };
}

// =============================================================================
// Load from Clerk
// =============================================================================

/**
 * Loads FX selection from Clerk publicMetadata and applies conflict resolution
 */
export function loadSelectionFromClerk(clerkUser: ClerkUserMetadata): FxSyncResolution {
  const clerkSelection = clerkUser.publicMetadata?.fxSelection;
  const localSelection = getSelection();

  // Case 1: No Clerk data
  if (!clerkSelection || !Array.isArray(clerkSelection.pairIds)) {
    if (localSelection) {
      // Migrate local to Clerk (will happen on next sync)
      return {
        winner: 'local',
        pairIds: localSelection.pairIds,
        reason: 'No Clerk data, using local selection',
      };
    }
    // Both empty, use defaults
    return {
      winner: 'default',
      pairIds: [],
      reason: 'No selection data, using SSOT defaults',
    };
  }

  // Case 2: No local data
  if (!localSelection) {
    applyClerkSelection(clerkSelection.pairIds, clerkSelection.updatedAt);
    return {
      winner: 'clerk',
      pairIds: clerkSelection.pairIds,
      reason: 'No local data, using Clerk selection',
    };
  }

  // Case 3: Both exist - compare timestamps
  const clerkTime = new Date(clerkSelection.updatedAt).getTime();
  const localTime = new Date(localSelection.updatedAt).getTime();

  if (isNaN(clerkTime)) {
    // Invalid Clerk timestamp, local wins
    return {
      winner: 'local',
      pairIds: localSelection.pairIds,
      reason: 'Invalid Clerk timestamp, using local selection',
    };
  }

  if (isNaN(localTime)) {
    // Invalid local timestamp, Clerk wins
    applyClerkSelection(clerkSelection.pairIds, clerkSelection.updatedAt);
    return {
      winner: 'clerk',
      pairIds: clerkSelection.pairIds,
      reason: 'Invalid local timestamp, using Clerk selection',
    };
  }

  // Clerk wins if newer OR same timestamp (source of truth)
  if (clerkTime >= localTime) {
    applyClerkSelection(clerkSelection.pairIds, clerkSelection.updatedAt);
    return {
      winner: 'clerk',
      pairIds: clerkSelection.pairIds,
      reason:
        clerkTime === localTime
          ? 'Same timestamp, Clerk wins (source of truth)'
          : 'Clerk is newer',
    };
  }

  // Local is strictly newer
  return {
    winner: 'local',
    pairIds: localSelection.pairIds,
    reason: 'Local is newer, will sync to Clerk',
  };
}

// =============================================================================
// Sync to Clerk via API Route
// =============================================================================

/**
 * Syncs FX selection to Clerk via the API route
 * publicMetadata can only be updated server-side for security
 */
async function syncToClerkViaApi(selection: FxSelectionLocal): Promise<void> {
  const response = await fetch('/api/fx/selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pairIds: selection.pairIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Sync failed: ${response.status}`);
  }
}

// =============================================================================
// React Hook: useClerkFxSync
// =============================================================================

interface UseClerkFxSyncOptions {
  /** Enable debug logging */
  debug?: boolean;
}

interface UseClerkFxSyncResult {
  /** Whether user is Pro tier */
  isPro: boolean;
  /** Whether sync is initialized */
  isInitialized: boolean;
  /** Last sync resolution (if any) */
  lastResolution: FxSyncResolution | null;
}

/**
 * React hook that manages Clerk FX selection sync
 * - Registers sync callback on mount
 * - Loads selection from Clerk on login
 * - Handles cleanup on unmount
 */
export function useClerkFxSync(options: UseClerkFxSyncOptions = {}): UseClerkFxSyncResult {
  const { debug = false } = options;
  const { user, isLoaded } = useUser();
  const isInitializedRef = useRef(false);
  const lastResolutionRef = useRef<FxSyncResolution | null>(null);

  // Determine tier from Clerk metadata
  const tier = (user?.publicMetadata as ClerkUserMetadata['publicMetadata'])?.tier ?? 'free';
  const isPro = tier === 'paid';

  useEffect(() => {
    // Wait for Clerk to load
    if (!isLoaded) return;

    // No user = no sync
    if (!user) {
      unregisterClerkSyncCallback();
      isInitializedRef.current = false;
      return;
    }

    // Already initialized for this user
    if (isInitializedRef.current) return;

    // Load selection from Clerk and resolve conflicts
    const resolution = loadSelectionFromClerk({
      publicMetadata: user.publicMetadata as ClerkUserMetadata['publicMetadata'],
    });
    lastResolutionRef.current = resolution;

    if (debug) {
      console.debug('[clerk-sync] Resolution:', resolution);
    }

    // Register sync callback (only for Pro users)
    if (isPro) {
      registerClerkSyncCallback(async (selection: FxSelectionLocal) => {
        await syncToClerkViaApi(selection);

        if (debug) {
          console.debug('[clerk-sync] Synced to Clerk:', selection.pairIds);
        }
      });
    }

    isInitializedRef.current = true;

    return () => {
      unregisterClerkSyncCallback();
      isInitializedRef.current = false;
    };
  }, [user, isLoaded, isPro, debug]);

  return {
    isPro,
    isInitialized: isInitializedRef.current,
    lastResolution: lastResolutionRef.current,
  };
}

// =============================================================================
// Standalone Sync Functions (for server-side or manual use)
// =============================================================================

/**
 * Check if selection exists in Clerk metadata
 */
export function hasClerkSelection(publicMetadata: unknown): boolean {
  if (typeof publicMetadata !== 'object' || publicMetadata === null) {
    return false;
  }
  const meta = publicMetadata as ClerkUserMetadata['publicMetadata'];
  return (
    meta?.fxSelection !== undefined &&
    Array.isArray(meta.fxSelection.pairIds) &&
    meta.fxSelection.pairIds.length > 0
  );
}

/**
 * Extract FX selection from Clerk metadata
 */
export function extractClerkSelection(publicMetadata: unknown): ClerkFxSelection | null {
  if (typeof publicMetadata !== 'object' || publicMetadata === null) {
    return null;
  }
  const meta = publicMetadata as ClerkUserMetadata['publicMetadata'];
  if (!meta?.fxSelection || !Array.isArray(meta.fxSelection.pairIds)) {
    return null;
  }
  return meta.fxSelection;
}

/**
 * Create Clerk metadata update payload for FX selection
 */
export function createClerkSelectionPayload(pairIds: string[]): {
  publicMetadata: { fxSelection: ClerkFxSelection };
} {
  return {
    publicMetadata: {
      fxSelection: {
        pairIds,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}
