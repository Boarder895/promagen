// src/hooks/use-learning-data.ts
// ============================================================================
// UNIFIED LEARNING DATA — Composition Hook
// ============================================================================
//
// Phase 7.5, Part 7.5e (Improvement 1) + Phase 7.6e + Phase 7.8e — Thin facade composing:
//   • useLearnedWeights()   → tier-level data (Phases 5–7.4) + temporal (Phase 7.8)
//   • usePlatformLearning() → platform-specific data (Phase 7.5)
//   • useABTest()           → A/B test variant assignment (Phase 7.6)
//
// Components call one hook instead of three. Zero new logic, pure composition.
// Prevents component authors from forgetting to call one of the hooks.
//
// Usage:
//   const { coOccurrenceLookup, platformTermQualityLookup, abVariant, temporalLookup, isLoading, ... } = useLearningData();
//
// isLoading semantics:
//   • true only while BOTH tier + platform hooks are still loading
//   • AB loading is tracked separately (abIsLoading) since it's non-blocking
//   • error is the first non-null error from any hook
//
// Version: 4.0.0 — Phase 7.9e: added compression lookup
// Created: 2026-02-27
// Updated: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useLearnedWeights, type UseLearnedWeightsReturn } from './use-learned-weights';
import { usePlatformLearning, type UsePlatformLearningReturn } from './use-platform-learning';
import { useABTest, type UseABTestReturn } from './use-ab-test';

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

  // ── Temporal-level (Phase 7.8) ─────────────────────────────────────────
  /** Pre-built temporal lookup for seasonal/weekly boosts */
  temporalLookup: UseLearnedWeightsReturn['temporalLookup'];

  /** Pre-built trending lookup for velocity signals */
  trendingLookup: UseLearnedWeightsReturn['trendingLookup'];

  // ── Compression-level (Phase 7.9) ────────────────────────────────────
  /** Pre-built compression lookup for optimal lengths + expendable terms */
  compressionLookup: UseLearnedWeightsReturn['compressionLookup'];

  // ── Platform-level (Phase 7.5) ──────────────────────────────────────────
  /** Platform-specific term quality lookup */
  platformTermQualityLookup: UsePlatformLearningReturn['platformTermQualityLookup'];

  /** Platform-specific co-occurrence lookup */
  platformCoOccurrenceLookup: UsePlatformLearningReturn['platformCoOccurrenceLookup'];

  /** ISO timestamp of when platform data was last computed */
  platformLastUpdatedAt: UsePlatformLearningReturn['lastUpdatedAt'];

  /** Milliseconds since platform data was last computed (>24h = stale) */
  platformDataAge: UsePlatformLearningReturn['dataAge'];

  // ── A/B testing (Phase 7.6) ─────────────────────────────────────────────
  /** Active A/B test ID (null if none running) */
  activeTestId: UseABTestReturn['activeTestId'];

  /** Active A/B test name (null if none running) */
  activeTestName: UseABTestReturn['activeTestName'];

  /** Assigned variant: 'A' (control) or 'B' (variant), null if no test */
  abVariant: UseABTestReturn['variant'];

  /** Variant-specific weight overrides (null = use default weights) */
  abVariantWeights: UseABTestReturn['variantWeights'];

  /** Stable anonymous browser hash for A/B assignment */
  abHash: UseABTestReturn['abHash'];

  /** Whether the A/B assignment is still loading (non-blocking) */
  abIsLoading: UseABTestReturn['isLoading'];

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
 *   activeTestId, abVariant, abVariantWeights, abHash, // A/B
 *   temporalLookup, trendingLookup, // temporal (Phase 7.8)
 *   compressionLookup, // compression (Phase 7.9)
 *   isLoading, error,
 * } = useLearningData();
 * ```
 */
export function useLearningData(): UseLearningDataReturn {
  const tier = useLearnedWeights();
  const platform = usePlatformLearning();
  const ab = useABTest();

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

    // Temporal-level
    temporalLookup: tier.temporalLookup,
    trendingLookup: tier.trendingLookup,

    // Compression-level
    compressionLookup: tier.compressionLookup,

    // Platform-level
    platformTermQualityLookup: platform.platformTermQualityLookup,
    platformCoOccurrenceLookup: platform.platformCoOccurrenceLookup,
    platformLastUpdatedAt: platform.lastUpdatedAt,
    platformDataAge: platform.dataAge,

    // A/B testing
    activeTestId: ab.activeTestId,
    activeTestName: ab.activeTestName,
    abVariant: ab.variant,
    abVariantWeights: ab.variantWeights,
    abHash: ab.abHash,
    abIsLoading: ab.isLoading,

    // Merged status — loading only when BOTH tier + platform are loading
    // (AB loading is tracked separately via abIsLoading since it's non-blocking)
    isLoading: tier.isLoading && platform.isLoading,

    // First non-null error from any hook
    error: tier.error || platform.error || ab.error,

    // Refetch all three
    refetch: async () => {
      await Promise.allSettled([tier.refetch(), platform.refetch(), ab.refetch()]);
    },
  };
}

export default useLearningData;
