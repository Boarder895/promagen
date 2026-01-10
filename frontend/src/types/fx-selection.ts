// src/types/fx-selection.ts
// =============================================================================
// FX Picker Selection Types
// Authority: docs/authority/paid_tier.md §5.5
// =============================================================================

/**
 * FX Selection Limits
 * - Minimum: 6 pairs (ensures meaningful ribbon)
 * - Maximum: 16 pairs (aligns with exchange count ceiling, controls API budget)
 * - Any integer from 6 to 16 inclusive (no odd/even constraint)
 */
export const FX_SELECTION_LIMITS = {
  MIN_PAIRS: 6,
  MAX_PAIRS: 16,
  DEFAULT_COUNT: 8,
} as const;

/**
 * localStorage schema for FX selection
 * Key: promagen:fx:selection
 */
export interface FxSelectionLocal {
  /** Selected pair IDs, e.g. ["eur-usd", "gbp-jpy", ...] */
  pairIds: string[];
  /** ISO timestamp of last local update */
  updatedAt: string;
  /** ISO timestamp of last successful Clerk sync, null if never synced */
  syncedAt: string | null;
  /** Schema version for future migrations */
  version: 1;
}

/**
 * Clerk publicMetadata.fxSelection schema
 * Stored in Clerk for cross-device sync
 */
export interface ClerkFxSelection {
  /** Selected pair IDs, max 16 items */
  pairIds: string[];
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Clerk publicMetadata structure (partial, FX-related only)
 */
export interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  fxSelection?: ClerkFxSelection;
}

/**
 * Sync status for UI feedback
 */
export type FxSyncStatus =
  | 'idle' // No sync in progress
  | 'syncing' // Sync to Clerk in progress
  | 'synced' // Successfully synced
  | 'error' // Sync failed (will retry)
  | 'offline'; // Browser offline

/**
 * Result of sync conflict resolution
 */
export interface FxSyncResolution {
  /** Which source won the conflict */
  winner: 'local' | 'clerk' | 'default';
  /** The resolved pair IDs */
  pairIds: string[];
  /** Reason for the resolution */
  reason: string;
}

/**
 * FX Picker state exposed to components
 */
export interface FxPickerState {
  /** Currently selected pair IDs */
  pairIds: string[];
  /** Current sync status */
  syncStatus: FxSyncStatus;
  /** Whether user can edit (Pro tier only) */
  canEdit: boolean;
  /** Maximum pairs allowed for current tier */
  maxPairs: number;
  /** Minimum pairs required */
  minPairs: number;
  /** Whether selection is loading from storage */
  isLoading: boolean;
  /** Last sync timestamp */
  lastSyncedAt: string | null;
}

/**
 * FX Picker actions for mutations
 */
export interface FxPickerActions {
  /** Set the entire selection (replaces current) */
  setSelection: (pairIds: string[]) => void;
  /** Add a pair to selection (if under limit) */
  addPair: (pairId: string) => boolean;
  /** Remove a pair from selection (if above minimum) */
  removePair: (pairId: string) => boolean;
  /** Reset to SSOT defaults */
  resetToDefault: () => void;
  /** Force sync to Clerk immediately */
  forceSync: () => Promise<void>;
}

/**
 * Validation result for selection updates
 */
export interface FxSelectionValidation {
  valid: boolean;
  errors: string[];
  sanitized: string[];
}

/**
 * Gateway POST /fx request body
 */
export interface GatewayFxRequest {
  pairIds: string[];
  tier: 'free' | 'paid';
}

/**
 * Gateway validation result
 */
export interface GatewayFxValidation {
  valid: boolean;
  errors: string[];
  /** Pair IDs that passed validation */
  allowedPairIds: string[];
}

// =============================================================================
// Type Guards
// =============================================================================

export function isFxSelectionLocal(value: unknown): value is FxSelectionLocal {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.pairIds) &&
    obj.pairIds.every((id) => typeof id === 'string') &&
    typeof obj.updatedAt === 'string' &&
    (obj.syncedAt === null || typeof obj.syncedAt === 'string') &&
    obj.version === 1
  );
}

export function isClerkFxSelection(value: unknown): value is ClerkFxSelection {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.pairIds) &&
    obj.pairIds.every((id) => typeof id === 'string') &&
    typeof obj.updatedAt === 'string'
  );
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates an empty/default local selection state
 */
export function createEmptyLocalSelection(defaultPairIds: string[]): FxSelectionLocal {
  return {
    pairIds: defaultPairIds.slice(0, FX_SELECTION_LIMITS.MAX_PAIRS),
    updatedAt: new Date().toISOString(),
    syncedAt: null,
    version: 1,
  };
}

/**
 * Validates pair count is within limits (any integer 6-16, no odd/even constraint)
 */
export function validatePairCount(count: number): { valid: boolean; error?: string } {
  if (count < FX_SELECTION_LIMITS.MIN_PAIRS) {
    return {
      valid: false,
      error: `Minimum ${FX_SELECTION_LIMITS.MIN_PAIRS} pairs required, got ${count}`,
    };
  }
  if (count > FX_SELECTION_LIMITS.MAX_PAIRS) {
    return {
      valid: false,
      error: `Maximum ${FX_SELECTION_LIMITS.MAX_PAIRS} pairs allowed, got ${count}`,
    };
  }
  return { valid: true };
}
