// src/hooks/use-learning-data.ts
// ============================================================================
// UNIFIED LEARNING DATA — Composition Hook
// ============================================================================
//
// Phase 7.5, Part 7.5e (Improvement 1) — Thin facade composing:
//   • useLearnedWeights()   → tier-level data (Phases 5–7.4)
//   • usePlatformLearning() → platform-specific data (Phase 7.5)
//
// Components call one hook instead of two. Zero new logic, pure composition.
// Prevents component authors from forgetting to call one of the hooks.
//
// Usage:
//   const { coOccurrenceLookup, platformTermQualityLookup, isLoading, ... } = useLearningData();
//
// isLoading semantics:
//   • true only while BOTH hooks are still loading (one finishing is enough to start rendering)
//   • error is the first non-null error from either hook
//
// Version: 1.0.0
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useLearnedWeights, type UseLearnedWeightsReturn } from './use-learned-weights';
import { usePlatformLearning, type UsePlatformLearningReturn } from './use-platform-learning';

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UseLearningDataReturn {
  // ── Tier-level (Phases 5–7.4) ───────────────────────────────────────────
  /** Pre-built co-occurrence lookup from Phase 5 */
  coOccurrenceLookup: UseLearnedWeightsReturn['coOccurrenceLookup'];

  /** Per-tier scoring weights from Phase 6 */
  scoringWeights: UseLearnedWeightsReturn['scoringWeights'];

  /** Blend ratio [curated, learned] from Phase 5 */
  blendRatio: UseLearnedWeightsReturn['blendRatio'];

  /** Anti-pattern lookup from Phase 7.1 */
  antiPatternLookup: UseLearnedWeightsReturn['antiPatternLookup'];

  /** Collision lookup from Phase 7.1 */
  collisionLookup: UseLearnedWeightsReturn['collisionLookup'];

  /** Weak term lookup from Phase 7.2 */
  weakTermLookup: UseLearnedWeightsReturn['weakTermLookup'];

  /** Redundancy lookup from Phase 7.3 */
  redundancyLookup: UseLearnedWeightsReturn['redundancyLookup'];

  /** Combo lookup from Phase 7.4 */
  comboLookup: UseLearnedWeightsReturn['comboLookup'];

  // ── Platform-level (Phase 7.5) ──────────────────────────────────────────
  /** Platform-specific term quality lookup */
  platformTermQualityLookup: UsePlatformLearningReturn['platformTermQualityLookup'];

  /** Platform-specific co-occurrence lookup */
  platformCoOccurrenceLookup: UsePlatformLearningReturn['platformCoOccurrenceLookup'];

  /** ISO timestamp of when platform data was last computed */
  platformLastUpdatedAt: UsePlatformLearningReturn['lastUpdatedAt'];

  /** Milliseconds since platform data was last computed (>24h = stale) */
  platformDataAge: UsePlatformLearningReturn['dataAge'];

  // ── Merged status ───────────────────────────────────────────────────────
  /** True only while BOTH hooks are still loading */
  isLoading: boolean;

  /** First non-null error from either hook */
  error: string | null;

  /** Refetch both hooks' data */
  refetch: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Unified learning data hook — single call for all learned signals.
 *
 * Composes useLearnedWeights (tier-level, Phases 5–7.4) and
 * usePlatformLearning (platform-level, Phase 7.5) into one return object.
 *
 * @example
 * ```tsx
 * const {
 *   coOccurrenceLookup, blendRatio, antiPatternLookup, // tier
 *   platformTermQualityLookup, platformCoOccurrenceLookup, // platform
 *   isLoading, error,
 * } = useLearningData();
 * ```
 */
export function useLearningData(): UseLearningDataReturn {
  const tier = useLearnedWeights();
  const platform = usePlatformLearning();

  return {
    // Tier-level
    coOccurrenceLookup: tier.coOccurrenceLookup,
    scoringWeights: tier.scoringWeights,
    blendRatio: tier.blendRatio,
    antiPatternLookup: tier.antiPatternLookup,
    collisionLookup: tier.collisionLookup,
    weakTermLookup: tier.weakTermLookup,
    redundancyLookup: tier.redundancyLookup,
    comboLookup: tier.comboLookup,

    // Platform-level
    platformTermQualityLookup: platform.platformTermQualityLookup,
    platformCoOccurrenceLookup: platform.platformCoOccurrenceLookup,
    platformLastUpdatedAt: platform.lastUpdatedAt,
    platformDataAge: platform.dataAge,

    // Merged status — loading only when BOTH are loading
    isLoading: tier.isLoading && platform.isLoading,

    // First non-null error from either hook
    error: tier.error || platform.error,

    // Refetch both
    refetch: async () => {
      await Promise.allSettled([tier.refetch(), platform.refetch()]);
    },
  };
}

export default useLearningData;
