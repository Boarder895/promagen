// src/hooks/use-weather-prompt-tier.ts
// ============================================================================
// WEATHER PROMPT TIER HOOK — Section-Aware
// ============================================================================
// Manages weather prompt tier preference per UI section.
// Each section stores its own tier preference independently in localStorage.
//
// Sections:
//   'exchange-cards' — Exchange card flag tooltips (default Tier 3)
//   'fx-ribbon'      — FX ribbon flag tooltips (Pro default Tier 2 / Midjourney)
//
// Gating:
//   Free users: Locked to section default (cards=Tier 3, ribbon=Tier 2)
//   Pro users:  Can select Tier 1-4 independently per section
//
// MIGRATION: The old single key 'promagen:weather-prompt-tier' is read as a
// fallback for 'exchange-cards' to preserve any existing Pro preference.
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** UI sections that can have independent tier preferences */
export type TierSection = 'exchange-cards' | 'fx-ribbon';

/** localStorage key per section */
const STORAGE_KEYS: Record<TierSection, string> = {
  'exchange-cards': 'promagen:weather-prompt-tier:exchange-cards',
  'fx-ribbon': 'promagen:weather-prompt-tier:fx-ribbon',
};

/** Legacy single key — read-only fallback for exchange-cards migration */
const LEGACY_STORAGE_KEY = 'promagen:weather-prompt-tier';

/**
 * Default tier per section — applies to ALL users (free and Pro).
 * Free users are locked to this value. Pro users use it as initial default
 * before any stored preference is loaded from localStorage.
 *
 * exchange-cards: Tier 3 — Natural Language (DALL·E, Imagen, Firefly)
 * fx-ribbon:      Tier 2 — Midjourney V6.1/V7 format
 */
const DEFAULT_TIER: Record<TierSection, PromptTier> = {
  'exchange-cards': 3,
  'fx-ribbon': 2,
};

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

function loadTierFromStorage(section: TierSection): PromptTier | null {
  if (typeof window === 'undefined') return null;
  try {
    // Try section-specific key first
    const stored = localStorage.getItem(STORAGE_KEYS[section]);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 1 && parsed <= 4) return parsed as PromptTier;
    }

    // Fallback: read legacy key for exchange-cards migration
    if (section === 'exchange-cards') {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy !== null) {
        const parsed = parseInt(legacy, 10);
        if (parsed >= 1 && parsed <= 4) return parsed as PromptTier;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function saveTierToStorage(section: TierSection, tier: PromptTier): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS[section], tier.toString());
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing weather prompt tier preference per section.
 *
 * @param isPro   - Whether user is Pro tier
 * @param section - Which UI section this tier controls
 * @returns Tier state, setter, and metadata
 *
 * @example
 * // Exchange cards — Pro default Tier 3
 * const { tier, setTier } = useWeatherPromptTier(isPaidUser, 'exchange-cards');
 *
 * // FX ribbon — Pro default Tier 2 (Midjourney)
 * const { tier, setTier } = useWeatherPromptTier(isPaidUser, 'fx-ribbon');
 */
export function useWeatherPromptTier(
  isPro: boolean = false,
  section: TierSection = 'exchange-cards',
): UseWeatherPromptTierReturn {
  const sectionDefault = DEFAULT_TIER[section];
  const [tier, setTierState] = useState<PromptTier>(sectionDefault);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from storage on mount (Pro users only)
  useEffect(() => {
    if (isHydrated) return;

    if (isPro) {
      const stored = loadTierFromStorage(section);
      if (stored !== null) {
        setTierState(stored);
      } else {
        setTierState(sectionDefault);
      }
    } else {
      // Free users get the section default (cards=3, ribbon=2)
      setTierState(sectionDefault);
    }

    setIsHydrated(true);
  }, [isPro, section, isHydrated, sectionDefault]);

  // Update tier when isPro changes (e.g. user upgrades/downgrades)
  useEffect(() => {
    if (!isHydrated) return;

    if (!isPro) {
      // Free user — reset to section default (cards=3, ribbon=2)
      setTierState(sectionDefault);
    }
  }, [isPro, isHydrated, sectionDefault]);

  // Setter that validates and persists
  const setTier = useCallback(
    (newTier: PromptTier) => {
      if (!isPro) return; // Free users cannot change tier
      if (newTier < 1 || newTier > 4) return; // Invalid tier

      setTierState(newTier);
      saveTierToStorage(section, newTier);
    },
    [isPro, section],
  );

  return {
    tier: isPro ? tier : sectionDefault,
    setTier,
    canChangeTier: isPro,
    isHydrated,
  };
}

export default useWeatherPromptTier;
