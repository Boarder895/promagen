// src/hooks/use-global-prompt-tier.ts
// ============================================================================
// GLOBAL PROMPT TIER HOOK — Single Source of Truth
// ============================================================================
// Provides the user's selected prompt tier to ALL emoji flag tooltips across
// every page. One selection on /pro-promagen controls every surface:
//
//   1. Exchange card flags   (exchange-list → exchange-card → WeatherPromptTooltip)
//   2. Mission Control flag  (mission-control → WeatherPromptTooltip)
//   3. Provider table flags  (provider-cell → WeatherPromptTooltip)
//   4. FX ribbon flags       (finance-ribbon → fx-pair-label → WeatherPromptTooltip)
//   5. Commodity ribbon flags (commodity-mover-card → CommodityPromptTooltip)
//
// Free users: Locked to Tier 4 (Plain Language) per paid_tier.md §5.10
// Pro users:  Returns stored selection from localStorage (set on /pro-promagen)
//
// Storage key: 'promagen:pro:prompt-tier' (same key pro-promagen-client.tsx writes)
//
// REPLACES: use-weather-prompt-tier.ts section-based approach
// That hook split tiers per section (exchange-cards vs fx-ribbon).
// This hook unifies ALL surfaces under one user-selected tier.
//
// Authority: docs/authority/paid_tier.md §5.10
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** localStorage key — MUST match pro-promagen-client.tsx STORAGE_KEYS.PROMPT_TIER */
const STORAGE_KEY = 'promagen:pro:prompt-tier';

/**
 * Default tier for Standard Promagen users.
 * Matches comparison table: Standard = "Plain Language (Tier 4)"
 * Authority: paid_tier.md §5.10 comparison table
 */
const FREE_DEFAULT_TIER: PromptTier = 4;

// ============================================================================
// TYPES
// ============================================================================

export interface UseGlobalPromptTierReturn {
  /** Current prompt tier (1-4) for tooltip rendering */
  tier: PromptTier;
  /** Whether user is Pro (for multi-tier tooltip display) */
  isPro: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Returns the user's global prompt tier for all emoji flag tooltips.
 *
 * Call this in any client component that renders a prompt tooltip.
 * No props needed — it reads auth state and localStorage internally.
 *
 * @example
 * const { tier, isPro } = useGlobalPromptTier();
 * <WeatherPromptTooltip tier={tier} ... />
 * <CommodityPromptTooltip tier={tier} isPro={isPro} ... />
 */
export function useGlobalPromptTier(): UseGlobalPromptTierReturn {
  const { userTier } = usePromagenAuth();
  const isPro = userTier === 'paid';

  const [tier, setTier] = useState<PromptTier>(FREE_DEFAULT_TIER);

  // Load stored tier from localStorage (Pro users only)
  useEffect(() => {
    if (!isPro) {
      setTier(FREE_DEFAULT_TIER);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored) as number;
        if ([1, 2, 3, 4].includes(parsed)) {
          setTier(parsed as PromptTier);
          return;
        }
      }
    } catch {
      // Storage unavailable — use default
    }

    // Pro user with no stored preference — default to Tier 4
    setTier(FREE_DEFAULT_TIER);
  }, [isPro]);

  // Listen for storage changes (if user opens Pro page in another tab)
  useEffect(() => {
    if (!isPro) return;

    function handleStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === null) return;
      try {
        const parsed = JSON.parse(e.newValue) as number;
        if ([1, 2, 3, 4].includes(parsed)) {
          setTier(parsed as PromptTier);
        }
      } catch {
        // Ignore malformed values
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [isPro]);

  return {
    tier: isPro ? tier : FREE_DEFAULT_TIER,
    isPro,
  };
}

export default useGlobalPromptTier;
