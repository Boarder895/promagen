// src/hooks/use-composition-mode.ts
// ============================================================================
// COMPOSITION MODE HOOK
// ============================================================================
// Manages composition mode state with secure persistence:
// - Anonymous users: localStorage (remembers across sessions)
// - Authenticated users: Clerk publicMetadata (synced with account)
//
// Security:
// - All inputs validated against whitelists
// - localStorage values sanitized on read
// - No user-provided code execution
// - XSS-safe storage handling
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import type { CompositionMode, AspectRatioId } from '@/types/composition';
import {
  isValidCompositionMode,
  isValidAspectRatio,
  DEFAULT_COMPOSITION_MODE,
  COMPOSITION_STORAGE_KEY,
  ASPECT_RATIO_STORAGE_KEY,
} from '@/types/composition';

// ============================================================================
// TYPES
// ============================================================================

export interface UseCompositionModeResult {
  /** Current composition mode */
  compositionMode: CompositionMode;
  /** Set composition mode (validates input) */
  setCompositionMode: (mode: CompositionMode) => void;
  /** Current aspect ratio selection */
  aspectRatio: AspectRatioId | null;
  /** Set aspect ratio (validates input) */
  setAspectRatio: (ratio: AspectRatioId | null) => void;
  /** Whether state is still loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** User tier for feature gating */
  userTier: 'anonymous' | 'free' | 'paid';
}

// ============================================================================
// SECURE STORAGE HELPERS
// ============================================================================

/**
 * Safely read from localStorage with validation
 * Returns null if value is invalid or missing
 */
function safeReadStorage<T>(
  key: string,
  validator: (value: unknown) => value is T
): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    // Parse and validate
    const parsed: unknown = JSON.parse(raw);
    if (validator(parsed)) {
      return parsed;
    }

    // Invalid value - remove it
    localStorage.removeItem(key);
    return null;
  } catch {
    // Corrupted data - remove it
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable
    }
    return null;
  }
}

/**
 * Safely write to localStorage
 * Silently fails if storage unavailable
 */
function safeWriteStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or quota exceeded
    console.warn('[composition-mode] localStorage write failed');
  }
}

/**
 * Safely remove from localStorage
 */
function safeRemoveStorage(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable
  }
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Fetch composition preferences from server
 */
async function fetchPreferences(): Promise<{
  compositionMode?: CompositionMode;
  aspectRatio?: AspectRatioId | null;
} | null> {
  try {
    const response = await fetch('/api/user/preferences', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    const result: { compositionMode?: CompositionMode; aspectRatio?: AspectRatioId | null } = {};

    // Validate compositionMode
    if (isValidCompositionMode(data.preferences?.compositionMode)) {
      result.compositionMode = data.preferences.compositionMode;
    }

    // Validate aspectRatio
    if (data.preferences?.aspectRatio === null) {
      result.aspectRatio = null;
    } else if (isValidAspectRatio(data.preferences?.aspectRatio)) {
      result.aspectRatio = data.preferences.aspectRatio;
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Update composition preferences on server
 */
async function updatePreferences(updates: {
  compositionMode?: CompositionMode;
  aspectRatio?: AspectRatioId | null;
}): Promise<boolean> {
  try {
    const response = await fetch('/api/user/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useCompositionMode - Manages composition mode state with secure persistence
 *
 * State hierarchy:
 * 1. Server (Clerk metadata) - source of truth for authenticated users
 * 2. localStorage - fallback for anonymous users, cache for authenticated
 * 3. Default - initial state while loading
 *
 * Security features:
 * - All values validated against whitelists before use
 * - localStorage sanitized on read
 * - Server-side validation in API
 * - No eval or dynamic code execution
 */
export function useCompositionMode(): UseCompositionModeResult {
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  // State
  const [compositionMode, setCompositionModeState] = useState<CompositionMode>(DEFAULT_COMPOSITION_MODE);
  const [aspectRatio, setAspectRatioState] = useState<AspectRatioId | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track if initial load completed to prevent race conditions
  const initialLoadComplete = useRef(false);

  // Determine user tier
  const userTier: 'anonymous' | 'free' | 'paid' = (() => {
    if (!authLoaded || !userLoaded) return 'anonymous';
    if (!isSignedIn) return 'anonymous';
    if (!user) return 'anonymous';

    const tier = user.publicMetadata?.tier;
    if (tier === 'paid') return 'paid';
    return 'free';
  })();

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================

  useEffect(() => {
    // Wait for auth to load
    if (!authLoaded || !userLoaded) return;

    // Prevent double initialization
    if (initialLoadComplete.current) return;

    async function loadState() {
      setIsLoading(true);

      if (isSignedIn && user) {
        // Authenticated: try server first, fallback to localStorage
        const serverPrefs = await fetchPreferences();

        if (serverPrefs) {
          // Use server values
          if (serverPrefs.compositionMode) {
            setCompositionModeState(serverPrefs.compositionMode);
          }
          if (serverPrefs.aspectRatio !== undefined) {
            setAspectRatioState(serverPrefs.aspectRatio);
          }
        } else {
          // Fallback to localStorage (might have values from before login)
          const localMode = safeReadStorage(COMPOSITION_STORAGE_KEY, isValidCompositionMode);
          const localAR = safeReadStorage(ASPECT_RATIO_STORAGE_KEY, isValidAspectRatio);

          if (localMode) setCompositionModeState(localMode);
          if (localAR) setAspectRatioState(localAR);
        }
      } else {
        // Anonymous: use localStorage
        const localMode = safeReadStorage(COMPOSITION_STORAGE_KEY, isValidCompositionMode);
        const localAR = safeReadStorage(ASPECT_RATIO_STORAGE_KEY, isValidAspectRatio);

        if (localMode) setCompositionModeState(localMode);
        if (localAR) setAspectRatioState(localAR);
      }

      initialLoadComplete.current = true;
      setIsLoading(false);
    }

    loadState();
  }, [authLoaded, userLoaded, isSignedIn, user]);

  // ============================================================================
  // SETTERS WITH VALIDATION AND PERSISTENCE
  // ============================================================================

  /**
   * Set composition mode with validation and persistence
   */
  const setCompositionMode = useCallback(
    (mode: CompositionMode) => {
      // Strict validation - reject invalid inputs
      if (!isValidCompositionMode(mode)) {
        console.warn('[composition-mode] Invalid mode rejected:', mode);
        return;
      }

      // Update local state immediately
      setCompositionModeState(mode);

      // Persist to localStorage (all users)
      safeWriteStorage(COMPOSITION_STORAGE_KEY, mode);

      // Persist to server (authenticated users only)
      if (isSignedIn) {
        updatePreferences({ compositionMode: mode }).catch(() => {
          // Silent fail - localStorage is backup
        });
      }
    },
    [isSignedIn]
  );

  /**
   * Set aspect ratio with validation and persistence
   */
  const setAspectRatio = useCallback(
    (ratio: AspectRatioId | null) => {
      // Validate non-null values
      if (ratio !== null && !isValidAspectRatio(ratio)) {
        console.warn('[composition-mode] Invalid aspect ratio rejected:', ratio);
        return;
      }

      // Update local state immediately
      setAspectRatioState(ratio);

      // Persist to localStorage
      if (ratio === null) {
        safeRemoveStorage(ASPECT_RATIO_STORAGE_KEY);
      } else {
        safeWriteStorage(ASPECT_RATIO_STORAGE_KEY, ratio);
      }

      // Persist to server (authenticated users only)
      if (isSignedIn) {
        updatePreferences({ aspectRatio: ratio }).catch(() => {
          // Silent fail - localStorage is backup
        });
      }
    },
    [isSignedIn]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    compositionMode,
    setCompositionMode,
    aspectRatio,
    setAspectRatio,
    isLoading,
    isAuthenticated: isSignedIn ?? false,
    userTier,
  };
}

export default useCompositionMode;
