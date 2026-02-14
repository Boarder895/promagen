// src/hooks/use-weather-prompt-tier.ts
// ============================================================================
// WEATHER PROMPT TIER HOOK
// ============================================================================
// Manages weather prompt tier preference for users.
// Free users: Locked to Tier 3 (Natural Language / DALL·E, Imagen, Firefly)
// Pro users: Can select Tier 1-4
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import { getDefaultTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'promagen:weather-prompt-tier';
const FREE_USER_TIER: PromptTier = 3; // Natural Language (DALL·E, Imagen, Firefly)

// ============================================================================
// TYPES
// ============================================================================

export interface UseWeatherPromptTierReturn {
  /** Current prompt tier (1-4) */
  tier: PromptTier;
  /** Set the tier (only works for Pro users) */
  setTier: (tier: PromptTier) => void;
  /** Whether user can change the tier */
  canChangeTier: boolean;
  /** Whether hook has hydrated from storage */
  isHydrated: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function loadTierFromStorage(): PromptTier | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = parseInt(stored, 10);
    if (parsed >= 1 && parsed <= 4) return parsed as PromptTier;
    return null;
  } catch {
    return null;
  }
}

function saveTierToStorage(tier: PromptTier): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, tier.toString());
  } catch {
    // Storage full or unavailable - fail silently
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing weather prompt tier preference.
 * 
 * @param isPro - Whether user is Pro tier
 * @returns Tier state and setter
 * 
 * @example
 * const { tier, setTier, canChangeTier } = useWeatherPromptTier(isPaidUser);
 */
export function useWeatherPromptTier(isPro: boolean = false): UseWeatherPromptTierReturn {
  const [tier, setTierState] = useState<PromptTier>(getDefaultTier());
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from storage on mount (Pro users only)
  useEffect(() => {
    if (isHydrated) return;

    if (isPro) {
      const stored = loadTierFromStorage();
      if (stored !== null) {
        setTierState(stored);
      }
    } else {
      // Free users always get tier 3 (Natural Language)
      setTierState(FREE_USER_TIER);
    }

    setIsHydrated(true);
  }, [isPro, isHydrated]);

  // Update tier when isPro changes
  useEffect(() => {
    if (!isHydrated) return;

    if (!isPro) {
      // Free user - reset to tier 3
      setTierState(FREE_USER_TIER);
    }
  }, [isPro, isHydrated]);

  // Setter that validates and persists
  const setTier = useCallback((newTier: PromptTier) => {
    if (!isPro) {
      // Free users cannot change tier
      return;
    }

    if (newTier < 1 || newTier > 4) {
      return;
    }

    setTierState(newTier);
    saveTierToStorage(newTier);
  }, [isPro]);

  return {
    tier: isPro ? tier : FREE_USER_TIER,
    setTier,
    canChangeTier: isPro,
    isHydrated,
  };
}

export default useWeatherPromptTier;
