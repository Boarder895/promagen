/**
 * Index Rating System Library
 * 
 * Public API for Promagen's Elo-style competitive ranking system.
 * 
 * @example
 * ```typescript
 * import { getProviderRating, calculateMPI, getDisplayRating } from '@/lib/index-rating';
 * 
 * // Get rating from database
 * const rating = await getProviderRating('midjourney');
 * 
 * // Calculate MPI for handicapping
 * const mpi = calculateMPI(marketPowerData);
 * 
 * // Get display-ready rating
 * const display = getDisplayRating(provider, rating);
 * ```
 * 
 * @see docs/authority/index-rating.md
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  ProviderRating,
  ProviderRatingRow,
  IndexRatingCronRun,
  IndexRatingCronRunRow,
  DisplayRating,
  RatingChangeState,
  RatingEvent,
  ProviderContext,
  ProviderMarketPower,
  MarketPowerData,
  TrackEventRequest,
  IndexRatingCronResponse,
  IndexRatingEventType,
} from '@/types/index-rating';

// =============================================================================
// CONSTANT EXPORTS
// =============================================================================

export {
  INDEX_RATING_BASELINE,
  INDEX_RATING_DECAY_LAMBDA,
  INDEX_RATING_STALE_HOURS,
  INDEX_RATING_DAILY_REGRESSION,
  INDEX_RATING_FLAT_THRESHOLD,
  INDEX_RATING_ADVISORY_LOCK_ID,
  INDEX_RATING_MIN_FLOOR,
  DEFAULT_MPI,
  MIN_MPI,
  MAX_MPI,
  EVENT_CONFIG,
  STATIC_BONUSES,
  NEWCOMER_BOOST,
  VALID_EVENT_TYPES,
  RATING_COLORS,
  isValidEventType,
  isValidMPI,
} from '@/types/index-rating';

// =============================================================================
// CALCULATION EXPORTS
// =============================================================================

export {
  calculateMPI,
  calculateStaticBonus,
  calculateNewcomerBoost,
  calculateTimeDecay,
  calculateEffectivePoints,
  calculateEloGain,
  calculateTotalEloChange,
  applyDailyRegression,
  calculateSeedRating,
  getRatingChangeState,
  isUnderdog,
  isNewcomer,
  hasRecentRankUp,
  applyRatingFloor,
  calculateChangePercent,
} from './calculations';

// =============================================================================
// DATABASE EXPORTS
// =============================================================================

export {
  hasDatabaseConfigured,
  ensureTablesExist,
  ensureProviderRatingsTable,
  ensureIndexRatingCronRunsTable,
  acquireAdvisoryLock,
  releaseAdvisoryLock,
  getProviderRating,
  getProviderRatings,
  getAllProviderRatings,
  upsertProviderRating,
  seedProviderRating,
  getProviderEvents,
  getAllProviderEvents,
  logCronRun,
  getLastCronRun,
  isStale,
  checkIndexRatingHealth,
} from './database';

// =============================================================================
// DISPLAY HELPER
// =============================================================================

import type { DisplayRating, ProviderRating, ProviderMarketPower } from '@/types/index-rating';
import { getRatingChangeState, isUnderdog, isNewcomer, hasRecentRankUp, calculateMPI } from './calculations';
import { isStale } from './database';

/**
 * Provider context for display rating resolution
 */
type ProviderForDisplay = {
  id: string;
  score?: number;
};

/**
 * Get display-ready rating data for a provider.
 * 
 * Follows the fallback strategy:
 * 1. Use database rating if available and not stale
 * 2. Fall back to providers.json score × 20
 * 
 * @param provider - Provider object with id and optional score
 * @param dbRating - Rating from database (can be null)
 * @param marketPower - Optional market power data for badges
 * @returns Display-ready rating data
 */
export function getDisplayRating(
  provider: ProviderForDisplay,
  dbRating: ProviderRating | null,
  marketPower?: ProviderMarketPower | null
): DisplayRating {
  // Check if we have valid, non-stale database data
  if (dbRating && !isStale(dbRating.calculatedAt)) {
    const state = getRatingChangeState(dbRating.changePercent, false);
    const mpi = marketPower ? calculateMPI(marketPower) : undefined;
    
    return {
      rating: dbRating.currentRating,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      state,
      source: 'database',
      rank: dbRating.currentRank,
      hasRankUp: hasRecentRankUp(dbRating.rankChangedAt),
      isUnderdog: isUnderdog(mpi, marketPower?.foundingYear),
      isNewcomer: isNewcomer(marketPower?.foundingYear),
    };
  }
  
  // Fallback to static JSON values
  return {
    rating: typeof provider.score === 'number' ? provider.score * 20 : null,
    change: null,
    changePercent: null,
    state: 'fallback',
    source: 'fallback',
    rank: null,
    hasRankUp: false,
    isUnderdog: false,
    isNewcomer: false,
  };
}
