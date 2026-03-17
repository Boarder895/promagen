// src/hooks/use-learned-weights.ts
// ============================================================================
// COLLECTIVE INTELLIGENCE ENGINE — Learned Weights Hook
// ============================================================================
//
// Client hook that fetches co-occurrence data AND scoring weights
// from the learning API, caches them module-level.
//
// Data only changes at 3 AM UTC (nightly cron), so we:
// 1. Fetch once on mount (parallel requests)
// 2. Cache in module-level variables (survives re-renders)
// 3. Refetch every 10 minutes as background refresh
// 4. Return null gracefully if cron has not run yet
//
// Authority: docs/authority/prompt-builder-evolution-plan-v2.md section 9.1
//
// Version: 8.0.0 — Phase 7.9e: added compression lookup from /compression-profiles
// Created: 2026-02-25
// Updated: 2026-02-28
//
// Existing features preserved: Yes.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

import type { CoOccurrenceMatrix } from '@/lib/learning/co-occurrence';
import {
  buildCoOccurrenceLookup,
  type CoOccurrenceLookup,
} from '@/lib/learning/co-occurrence-lookup';
import { getBlendRatio } from '@/lib/learning/constants';
import type { ScoringWeights } from '@/lib/learning/weight-recalibration';
import type { AntiPatternData } from '@/lib/learning/anti-pattern-detection';
import {
  buildAntiPatternLookup,
  type AntiPatternLookup,
} from '@/lib/learning/anti-pattern-lookup';
import type { CollisionMatrixData } from '@/lib/learning/collision-matrix';
import {
  buildCollisionLookup,
  type CollisionLookup,
} from '@/lib/learning/collision-lookup';
import type { IterationInsightsData } from '@/lib/learning/iteration-tracking';
import {
  buildWeakTermLookup,
  type WeakTermLookup,
} from '@/lib/learning/weak-term-lookup';
import type { RedundancyGroupsData } from '@/lib/learning/redundancy-detection';
import {
  buildRedundancyLookup,
  type RedundancyLookup,
} from '@/lib/learning/redundancy-lookup';
import type { MagicCombosData } from '@/lib/learning/magic-combo-mining';
import {
  buildComboLookup,
  type ComboLookup,
} from '@/lib/learning/combo-lookup';
import type { TemporalBoostsData, TrendingTermsData } from '@/lib/learning/temporal-intelligence';
import {
  buildTemporalLookup,
  buildTrendingLookup,
  type TemporalLookup,
  type TrendingLookup,
} from '@/lib/learning/temporal-lookup';
import type { CompressionProfilesData } from '@/lib/learning/compression-intelligence';
import {
  buildCompressionLookup,
  type CompressionLookup,
} from '@/lib/learning/compression-lookup';

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

/** Cached co-occurrence lookup — survives re-renders, cleared on page refresh */
let cachedLookup: CoOccurrenceLookup | null = null;

/** Cached scoring weights — survives re-renders, cleared on page refresh */
let cachedScoringWeights: ScoringWeights | null = null;

/** Cached anti-pattern lookup (Phase 7.1) — survives re-renders */
let cachedAntiPatternLookup: AntiPatternLookup | null = null;

/** Cached collision lookup (Phase 7.1) — survives re-renders */
let cachedCollisionLookup: CollisionLookup | null = null;

/** Cached weak term lookup (Phase 7.2) — survives re-renders */
let cachedWeakTermLookup: WeakTermLookup | null = null;

/** Cached redundancy lookup (Phase 7.3) — survives re-renders */
let cachedRedundancyLookup: RedundancyLookup | null = null;

/** Cached combo lookup (Phase 7.4) — survives re-renders */
let cachedComboLookup: ComboLookup | null = null;

/** Cached temporal lookup (Phase 7.8) — survives re-renders */
let cachedTemporalLookup: TemporalLookup | null = null;

/** Cached trending lookup (Phase 7.8) — survives re-renders */
let cachedTrendingLookup: TrendingLookup | null = null;

/** Cached compression lookup (Phase 7.9) — survives re-renders */
let cachedCompressionLookup: CompressionLookup | null = null;

/** Timestamp of last successful fetch */
let lastFetchedAt = 0;

/** How often to refetch (10 min — data only changes nightly) */
const REFETCH_INTERVAL_MS = 10 * 60 * 1000;

// ============================================================================
// RETURN TYPE
// ============================================================================

export interface UseLearnedWeightsReturn {
  /** Pre-built co-occurrence lookup (null = no data yet or loading) */
  coOccurrenceLookup: CoOccurrenceLookup | null;

  /** Per-tier scoring weights from Phase 6 (null = cron hasn't run yet) */
  scoringWeights: ScoringWeights | null;

  /** Current blend ratio: [curatedWeight, learnedWeight] based on event count */
  blendRatio: [curated: number, learned: number];

  /** Pre-built anti-pattern lookup from Phase 7.1 (null = no data or cron hasn't run) */
  antiPatternLookup: AntiPatternLookup | null;

  /** Pre-built collision lookup from Phase 7.1 (null = no data or cron hasn't run) */
  collisionLookup: CollisionLookup | null;

  /** Pre-built weak term lookup from Phase 7.2 (null = no data or cron hasn't run) */
  weakTermLookup: WeakTermLookup | null;

  /** Pre-built redundancy lookup from Phase 7.3 (null = no data or cron hasn't run) */
  redundancyLookup: RedundancyLookup | null;

  /** Pre-built combo lookup from Phase 7.4 (null = no data or cron hasn't run) */
  comboLookup: ComboLookup | null;

  /** Pre-built temporal lookup from Phase 7.8 (null = no data or cron hasn't run) */
  temporalLookup: TemporalLookup | null;

  /** Pre-built trending lookup from Phase 7.8 (null = no data or cron hasn't run) */
  trendingLookup: TrendingLookup | null;

  /** Pre-built compression lookup from Phase 7.9 (null = no data or cron hasn't run) */
  compressionLookup: CompressionLookup | null;

  /** Whether the initial fetch is in progress */
  isLoading: boolean;

  /** Error message if fetch failed (null = ok) */
  error: string | null;

  /** Manually trigger a refetch */
  refetch: () => Promise<void>;
}

// ============================================================================
// FETCH TYPES
// ============================================================================

interface CoOccurrenceApiResponse {
  ok: boolean;
  data: CoOccurrenceMatrix | null;
  updatedAt: string | null;
}

interface ScoringWeightsApiResponse {
  ok: boolean;
  data: ScoringWeights | null;
  updatedAt: string | null;
}

interface AntiPatternApiResponse {
  ok: boolean;
  data: AntiPatternData | null;
  updatedAt: string | null;
}

interface CollisionApiResponse {
  ok: boolean;
  data: CollisionMatrixData | null;
  updatedAt: string | null;
}

interface IterationInsightsApiResponse {
  ok: boolean;
  data: IterationInsightsData | null;
  updatedAt: string | null;
}

interface RedundancyGroupsApiResponse {
  ok: boolean;
  data: RedundancyGroupsData | null;
  updatedAt: string | null;
}

interface MagicCombosApiResponse {
  ok: boolean;
  data: MagicCombosData | null;
  updatedAt: string | null;
}

interface TemporalAllApiResponse {
  ok: boolean;
  boosts: TemporalBoostsData | null;
  trending: TrendingTermsData | null;
  boostsUpdatedAt: string | null;
  trendingUpdatedAt: string | null;
}

interface CompressionProfilesApiResponse {
  ok: boolean;
  data: CompressionProfilesData | null;
  updatedAt: string | null;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for accessing learned weights (co-occurrence + scoring weights).
 *
 * Returns pre-built data structures that the suggestion engine and
 * health scorer can use for fast per-option scoring.
 *
 * Phase 6 addition: `scoringWeights` field for per-tier health scoring.
 */
export function useLearnedWeights(): UseLearnedWeightsReturn {
  const [lookup, setLookup] = useState<CoOccurrenceLookup | null>(cachedLookup);
  const [scoringWeights, setScoringWeights] = useState<ScoringWeights | null>(
    cachedScoringWeights,
  );
  const [antiPatternLookup, setAntiPatternLookup] = useState<AntiPatternLookup | null>(
    cachedAntiPatternLookup,
  );
  const [collisionLookup, setCollisionLookup] = useState<CollisionLookup | null>(
    cachedCollisionLookup,
  );
  const [weakTermLookup, setWeakTermLookup] = useState<WeakTermLookup | null>(
    cachedWeakTermLookup,
  );
  const [redundancyLookup, setRedundancyLookup] = useState<RedundancyLookup | null>(
    cachedRedundancyLookup,
  );
  const [comboLookup, setComboLookup] = useState<ComboLookup | null>(
    cachedComboLookup,
  );
  const [temporalLookup, setTemporalLookup] = useState<TemporalLookup | null>(
    cachedTemporalLookup,
  );
  const [trendingLookup, setTrendingLookup] = useState<TrendingLookup | null>(
    cachedTrendingLookup,
  );
  const [compressionLookup, setCompressionLookup] = useState<CompressionLookup | null>(
    cachedCompressionLookup,
  );
  const [blendRatio, setBlendRatio] = useState<[number, number]>(() =>
    cachedLookup ? getBlendRatio(cachedLookup.eventCount) : [1.0, 0.0],
  );
  const [isLoading, setIsLoading] = useState(!cachedLookup);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeights = useCallback(async () => {
    // Skip if we fetched recently and have cached data
    const now = Date.now();
    if (cachedLookup && now - lastFetchedAt < REFETCH_INTERVAL_MS) {
      setLookup(cachedLookup);
      setScoringWeights(cachedScoringWeights);
      setAntiPatternLookup(cachedAntiPatternLookup);
      setCollisionLookup(cachedCollisionLookup);
      setWeakTermLookup(cachedWeakTermLookup);
      setRedundancyLookup(cachedRedundancyLookup);
      setComboLookup(cachedComboLookup);
      setTemporalLookup(cachedTemporalLookup);
      setTrendingLookup(cachedTrendingLookup);
      setCompressionLookup(cachedCompressionLookup);
      setBlendRatio(getBlendRatio(cachedLookup.eventCount));
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // Fetch all endpoints in parallel — none blocks the others
      const [coOccResponse, scoringResponse, antiPatternResponse, collisionResponse, iterationResponse, redundancyResponse, comboResponse, temporalResponse, compressionResponse] =
        await Promise.allSettled([
          fetch('/api/learning/co-occurrence'),
          fetch('/api/learning/scoring-weights'),
          fetch('/api/learning/anti-patterns'),
          fetch('/api/learning/collisions'),
          fetch('/api/learning/iteration-insights'),
          fetch('/api/learning/redundancy-groups'),
          fetch('/api/learning/magic-combos'),
          fetch('/api/learning/temporal-all'),
          fetch('/api/learning/compression-profiles'),
        ]);

      // ── Process co-occurrence ──────────────────────────────────────
      if (coOccResponse.status === 'fulfilled' && coOccResponse.value.ok) {
        const json =
          (await coOccResponse.value.json()) as CoOccurrenceApiResponse;

        if (json.ok) {
          const newLookup = buildCoOccurrenceLookup(json.data);
          cachedLookup = newLookup;
          setLookup(newLookup);
          const eventCount = json.data?.eventCount ?? 0;
          setBlendRatio(getBlendRatio(eventCount));
        }
      }

      // ── Process scoring weights ────────────────────────────────────
      if (scoringResponse.status === 'fulfilled' && scoringResponse.value.ok) {
        const json =
          (await scoringResponse.value.json()) as ScoringWeightsApiResponse;

        if (json.ok && json.data) {
          cachedScoringWeights = json.data;
          setScoringWeights(json.data);
        }
      }

      // ── Process anti-patterns (Phase 7.1) ──────────────────────────
      if (antiPatternResponse.status === 'fulfilled' && antiPatternResponse.value.ok) {
        const json =
          (await antiPatternResponse.value.json()) as AntiPatternApiResponse;

        if (json.ok && json.data) {
          const newAntiPatternLookup = buildAntiPatternLookup(json.data);
          cachedAntiPatternLookup = newAntiPatternLookup;
          setAntiPatternLookup(newAntiPatternLookup);
        }
      }

      // ── Process collisions (Phase 7.1) ─────────────────────────────
      if (collisionResponse.status === 'fulfilled' && collisionResponse.value.ok) {
        const json =
          (await collisionResponse.value.json()) as CollisionApiResponse;

        if (json.ok && json.data) {
          const newCollisionLookup = buildCollisionLookup(json.data);
          cachedCollisionLookup = newCollisionLookup;
          setCollisionLookup(newCollisionLookup);
        }
      }

      // ── Process iteration insights (Phase 7.2) ────────────────────
      if (iterationResponse.status === 'fulfilled' && iterationResponse.value.ok) {
        const json =
          (await iterationResponse.value.json()) as IterationInsightsApiResponse;

        if (json.ok && json.data) {
          const newWeakTermLookup = buildWeakTermLookup(json.data);
          cachedWeakTermLookup = newWeakTermLookup;
          setWeakTermLookup(newWeakTermLookup);
        }
      }

      // ── Process redundancy groups (Phase 7.3) ─────────────────────
      if (redundancyResponse.status === 'fulfilled' && redundancyResponse.value.ok) {
        const json =
          (await redundancyResponse.value.json()) as RedundancyGroupsApiResponse;

        if (json.ok && json.data) {
          const newRedundancyLookup = buildRedundancyLookup(json.data);
          cachedRedundancyLookup = newRedundancyLookup;
          setRedundancyLookup(newRedundancyLookup);
        }
      }

      // ── Process magic combos (Phase 7.4) ──────────────────────────
      if (comboResponse.status === 'fulfilled' && comboResponse.value.ok) {
        const json =
          (await comboResponse.value.json()) as MagicCombosApiResponse;

        if (json.ok && json.data) {
          const newComboLookup = buildComboLookup(json.data);
          cachedComboLookup = newComboLookup;
          setComboLookup(newComboLookup);
        }
      }

      // ── Process temporal intelligence (Phase 7.8) ─────────────────
      if (temporalResponse.status === 'fulfilled' && temporalResponse.value.ok) {
        const json =
          (await temporalResponse.value.json()) as TemporalAllApiResponse;

        if (json.ok) {
          if (json.boosts) {
            const newTemporalLookup = buildTemporalLookup(json.boosts);
            cachedTemporalLookup = newTemporalLookup;
            setTemporalLookup(newTemporalLookup);
          }
          if (json.trending) {
            const newTrendingLookup = buildTrendingLookup(json.trending);
            cachedTrendingLookup = newTrendingLookup;
            setTrendingLookup(newTrendingLookup);
          }
        }
      }

      // ── Process compression profiles (Phase 7.9) ──────────────────
      if (compressionResponse.status === 'fulfilled' && compressionResponse.value.ok) {
        const json =
          (await compressionResponse.value.json()) as CompressionProfilesApiResponse;

        if (json.ok && json.data) {
          const newCompressionLookup = buildCompressionLookup(json.data);
          cachedCompressionLookup = newCompressionLookup;
          setCompressionLookup(newCompressionLookup);
        }
      }

      lastFetchedAt = Date.now();
    } catch (err) {
      console.debug('[useLearnedWeights] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      // Do not clear existing cached data on error — stale > nothing
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWeights();
  }, [fetchWeights]);

  // Background refetch interval
  useEffect(() => {
    intervalRef.current = setInterval(fetchWeights, REFETCH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchWeights]);

  return {
    coOccurrenceLookup: lookup,
    scoringWeights,
    blendRatio,
    antiPatternLookup,
    collisionLookup,
    weakTermLookup,
    redundancyLookup,
    comboLookup,
    temporalLookup,
    trendingLookup,
    compressionLookup,
    isLoading,
    error,
    refetch: fetchWeights,
  };
}

export default useLearnedWeights;
