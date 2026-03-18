// src/hooks/use-global-prompt-tier.ts
// ============================================================================
// GLOBAL PROMPT TIER HOOK — Surface-Aware Variety for Free Users
// ============================================================================
// Provides the user's prompt tier to ALL emoji flag tooltips.
//
// FREE USERS: Each surface gets its own fixed tier so users experience the
// full range of prompt formats across the platform. This creates Variable
// Reward (human-factors.md) and Loss Aversion — users see rich Tier 1-3
// prompts they can't control without upgrading.
//
//   Surface            │ Free Tier │ Rationale
//   ───────────────────┼───────────┼──────────────────────────────────────
//   exchange-cards     │ Tier 3    │ Most visible — rich natural sentences
//   leaderboard        │ *native*  │ Each provider's own tier (educational)
//   fx-ribbon          │ Tier 1    │ Technical CLIP weights look advanced
//   commodities        │ Tier 2    │ MJ parameters are visually distinctive
//   mission-control    │ Tier 4    │ Simplest entry point, accessible
//
// PRO USERS: Return their stored selection from localStorage (set on
// /pro-promagen). One global selection overrides ALL surfaces.
//
// Storage key: 'promagen:pro:prompt-tier' (same key pro-promagen-client.tsx writes)
//
// Authority: docs/authority/paid_tier.md §5.10
// Authority: docs/authority/human-factors.md §Variable Reward
// Existing features preserved: Yes
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// CONSTANTS
// ============================================================================

/** localStorage key — MUST match pro-promagen-client.tsx STORAGE_KEYS.PROMPT_TIER */
const STORAGE_KEY = 'promagen:pro:prompt-tier';

/**
 * UI surfaces that display prompt tooltips.
 * Each surface can have an independent free-user tier.
 */
export type PromptSurface =
  | 'exchange-cards'
  | 'leaderboard'
  | 'fx-ribbon'
  | 'commodities'
  | 'mission-control'
  | 'pro-page';

/**
 * Default tiers per surface for Standard Promagen users.
 * 'leaderboard' uses the provider's native tier (passed via nativeTier param).
 * All other surfaces have a fixed tier to create variety across the platform.
 */
const FREE_SURFACE_TIERS: Record<Exclude<PromptSurface, 'leaderboard'>, PromptTier> = {
  'exchange-cards': 3,   // Natural Language — DALL·E, Imagen, Firefly
  'fx-ribbon': 1,        // CLIP-Based — technical weighted syntax
  'commodities': 2,      // Midjourney Family — MJ parameters
  'mission-control': 4,  // Plain Language — simple, accessible
  'pro-page': 4,         // Pro page — defaults to Plain, overridden by user selection
};

/**
 * Fallback tier when leaderboard surface has no native tier data.
 * Also the Pro user default when no stored preference exists.
 */
const FALLBACK_TIER: PromptTier = 4;

// ============================================================================
// TYPES
// ============================================================================

export interface UseGlobalPromptTierReturn {
  /** Current prompt tier (1-4) for tooltip rendering */
  tier: PromptTier;
  /** Whether user is Pro (for multi-tier tooltip display) */
  isPro: boolean;
  /**
   * Save a new tier selection (Pro users only).
   * Writes localStorage + PATCHes Clerk metadata + updates local state.
   * No-op for free users.
   */
  saveTier: (tier: PromptTier) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve the free-user tier for a given surface.
 * Leaderboard uses the provider's native tier; other surfaces use the fixed map.
 */
function resolveFreeTier(surface: PromptSurface, nativeTier?: PromptTier): PromptTier {
  if (surface === 'leaderboard') {
    return nativeTier ?? FALLBACK_TIER;
  }
  return FREE_SURFACE_TIERS[surface];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Returns the user's prompt tier for a specific tooltip surface.
 *
 * @param surface    - Which UI surface is requesting the tier
 * @param nativeTier - For 'leaderboard': the provider's own tier from platform-tiers.ts
 * @returns          - Tier (1-4) and Pro status
 *
 * @example
 * // Exchange cards — free users see Tier 3
 * const { tier, isPro } = useGlobalPromptTier('exchange-cards');
 *
 * // Leaderboard — free users see provider's native tier
 * const nativeTier = getPlatformTierId(provider.id);
 * const { tier, isPro } = useGlobalPromptTier('leaderboard', nativeTier);
 *
 * // FX ribbon — free users see Tier 1 (CLIP)
 * const { tier, isPro } = useGlobalPromptTier('fx-ribbon');
 */
export function useGlobalPromptTier(
  surface: PromptSurface = 'exchange-cards',
  nativeTier?: PromptTier,
): UseGlobalPromptTierReturn {
  const { userTier, clerkPromptTier } = usePromagenAuth();
  const isPro = userTier === 'paid';

  const freeTier = resolveFreeTier(surface, nativeTier);
  const [tier, setTier] = useState<PromptTier>(freeTier);

  // Priority chain for Pro users:
  // 1. Clerk publicMetadata (source of truth — survives cache clear / device switch)
  // 2. localStorage (warm cache — faster than waiting for Clerk hydration)
  // 3. FALLBACK_TIER (Tier 4)
  useEffect(() => {
    if (!isPro) {
      setTier(freeTier);
      return;
    }

    // 1. Clerk metadata (authoritative)
    if (clerkPromptTier !== null && [1, 2, 3, 4].includes(clerkPromptTier)) {
      setTier(clerkPromptTier as PromptTier);
      // Sync Clerk → localStorage (warm cache for next load)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clerkPromptTier));
      } catch { /* storage unavailable */ }
      return;
    }

    // 2. localStorage fallback (Clerk may still be hydrating)
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
      // Storage unavailable
    }

    // 3. Default
    setTier(FALLBACK_TIER);
  }, [isPro, freeTier, clerkPromptTier]);

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

  // ── Save tier (Pro users only) ──────────────────────────────────────────
  // Same logic as pro-promagen-client.tsx handlePromptTierChange:
  // 1. Update local state (immediate UI feedback)
  // 2. Write localStorage (warm cache for next load + cross-tab sync)
  // 3. PATCH Clerk metadata (survives cache clear / device switch)
  const saveTier = useCallback(
    (newTier: PromptTier) => {
      if (!isPro) return;
      if (![1, 2, 3, 4].includes(newTier)) return;

      // 1. Local state
      setTier(newTier);

      // 2. localStorage (warm cache)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newTier));
        // Dispatch synthetic StorageEvent for same-tab sync
        // (native StorageEvent only fires in OTHER tabs)
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(newTier),
          }),
        );
      } catch {
        /* storage unavailable */
      }

      // 3. Clerk metadata (fire-and-forget)
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ promptTier: newTier }),
      }).catch((err) => {
        console.error('[useGlobalPromptTier] Failed to sync promptTier to Clerk:', err);
      });
    },
    [isPro],
  );

  return {
    tier: isPro ? tier : freeTier,
    isPro,
    saveTier,
  };
}

export default useGlobalPromptTier;
