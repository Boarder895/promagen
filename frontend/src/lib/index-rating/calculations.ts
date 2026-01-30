/**
 * Index Rating Calculation Library
 *
 * Core algorithms for Promagen's Elo-style competitive ranking system.
 * All calculations follow the specification in docs/authority/index-rating.md
 *
 * @see docs/authority/index-rating.md
 */

import {
  INDEX_RATING_BASELINE,
  INDEX_RATING_DECAY_LAMBDA,
  INDEX_RATING_DAILY_REGRESSION,
  INDEX_RATING_MIN_FLOOR,
  INDEX_RATING_FLAT_THRESHOLD,
  DEFAULT_MPI,
  MIN_MPI,
  MAX_MPI,
  EVENT_CONFIG,
  STATIC_BONUSES,
  NEWCOMER_BOOST,
  isValidMPI,
  type IndexRatingEventType,
  type ProviderContext,
  type ProviderMarketPower,
  type RatingEvent,
  type RatingChangeState,
} from '@/types/index-rating';

// =============================================================================
// MARKET POWER INDEX (MPI) CALCULATION
// =============================================================================

/**
 * Calculate the Market Power Index for a provider.
 *
 * Formula: MPI = 1 + SocialFactor + YearsFactor + UsersFactor
 *
 * Higher MPI = bigger provider = less points per engagement (handicap)
 *
 * @param marketPower - Provider's market power data
 * @param currentYear - Current year for age calculation
 * @returns MPI value (clamped between MIN_MPI and MAX_MPI)
 */
export function calculateMPI(
  marketPower: ProviderMarketPower | undefined | null,
  currentYear: number = new Date().getFullYear(),
): number {
  // No data = default MPI (mid-range handicap)
  if (!marketPower) {
    return DEFAULT_MPI;
  }

  try {
    // Social Factor: log₁₀(1 + avgSocialFollowers / 1000)
    const socialFactor = calculateSocialFactor(marketPower.socialReach);

    // Years Factor: yearsActive × 0.1
    const yearsActive = Math.max(0, currentYear - marketPower.foundingYear);
    const yearsFactor = yearsActive * 0.1;

    // Users Factor: log₁₀(1 + estimatedUsers / 100000)
    const usersFactor = Math.log10(1 + (marketPower.estimatedUsers || 0) / 100000);

    // Calculate MPI
    const mpi = 1 + socialFactor + yearsFactor + usersFactor;

    // Check for invalid math results only (NaN/Infinity)
    if (isNaN(mpi) || !isFinite(mpi)) {
      console.debug('[Index Rating] MPI calculation returned NaN/Infinity, using default');
      return DEFAULT_MPI;
    }

    // Clamp to valid range (normal for large providers to exceed raw bounds)
    return Math.min(MAX_MPI, Math.max(MIN_MPI, mpi));
  } catch (error) {
    console.error('[Index Rating] MPI calculation error:', error);
    return DEFAULT_MPI;
  }
}

/**
 * Calculate the social factor component of MPI.
 *
 * Formula: log₁₀(1 + avgSocialFollowers / 1000)
 * Only includes platforms where data exists.
 *
 * @param socialReach - Social platform follower counts
 * @returns Social factor value
 */
function calculateSocialFactor(socialReach: ProviderMarketPower['socialReach']): number {
  if (!socialReach) {
    return 1.0; // Default if all social data missing
  }

  const platforms = [
    socialReach.youtube,
    socialReach.x,
    socialReach.instagram,
    socialReach.facebook,
    socialReach.discord,
    socialReach.linkedin,
    socialReach.tiktok,
    socialReach.reddit,
    socialReach.pinterest,
  ];

  // Filter out undefined/null values
  const validCounts = platforms.filter(
    (count): count is number => typeof count === 'number' && !isNaN(count) && count >= 0,
  );

  if (validCounts.length === 0) {
    return 1.0; // Default if all social data missing
  }

  // Calculate average of available platforms
  const avgFollowers = validCounts.reduce((sum, count) => sum + count, 0) / validCounts.length;

  return Math.log10(1 + avgFollowers / 1000);
}

// =============================================================================
// STATIC BONUS CALCULATION
// =============================================================================

/**
 * Calculate the combined static bonus multiplier for a provider.
 *
 * Bonuses multiply together:
 * - API Available: ×1.10
 * - Affiliate Programme: ×1.05
 * - Prefill Supported: ×1.05
 *
 * @param provider - Provider context
 * @returns Total bonus multiplier
 */
export function calculateStaticBonus(provider: ProviderContext): number {
  let bonus = 1.0;

  if (provider.apiAvailable) {
    bonus *= STATIC_BONUSES.apiAvailable;
  }

  if (provider.affiliateProgramme) {
    bonus *= STATIC_BONUSES.affiliateProgramme;
  }

  if (provider.supportsPrefill) {
    bonus *= STATIC_BONUSES.supportsPrefill;
  }

  return bonus;
}

// =============================================================================
// NEWCOMER BOOST CALCULATION
// =============================================================================

/**
 * Calculate the newcomer boost multiplier based on provider age.
 *
 * - 0-3 months: 1.20× (full boost)
 * - 3-6 months: 1.10× (tapering)
 * - 6+ months: 1.00× (normal)
 *
 * @param foundingYear - When the provider was founded
 * @param foundingMonth - Month of founding (1-12, optional, defaults to 1)
 * @returns Newcomer multiplier
 */
export function calculateNewcomerBoost(foundingYear: number, foundingMonth: number = 1): number {
  const now = new Date();
  const foundingDate = new Date(foundingYear, foundingMonth - 1, 1);

  // Calculate months since founding
  const monthsOld =
    (now.getFullYear() - foundingDate.getFullYear()) * 12 +
    (now.getMonth() - foundingDate.getMonth());

  if (monthsOld < NEWCOMER_BOOST.FULL_BOOST_MONTHS) {
    return NEWCOMER_BOOST.FULL_BOOST_MULTIPLIER;
  }

  if (monthsOld < NEWCOMER_BOOST.TAPER_MONTHS) {
    return NEWCOMER_BOOST.TAPER_MULTIPLIER;
  }

  return NEWCOMER_BOOST.NORMAL_MULTIPLIER;
}

// =============================================================================
// TIME DECAY CALCULATION
// =============================================================================

/**
 * Calculate the time decay multiplier for an event.
 *
 * Formula: e^(-λ × daysOld)
 * Where λ = 0.02 (half-life ≈ 35 days)
 *
 * @param eventDate - When the event occurred
 * @param referenceDate - Reference date (defaults to now)
 * @returns Decay multiplier (0-1)
 */
export function calculateTimeDecay(eventDate: Date, referenceDate: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysOld = (referenceDate.getTime() - eventDate.getTime()) / msPerDay;

  // Clamp to non-negative
  const effectiveDays = Math.max(0, daysOld);

  // Apply exponential decay
  return Math.exp(-INDEX_RATING_DECAY_LAMBDA * effectiveDays);
}

// =============================================================================
// ELO RATING CALCULATION
// =============================================================================

/**
 * Calculate effective points for an event.
 *
 * Formula: EffectivePoints = BasePoints × StaticBonuses × TimeDecay × NewcomerBoost
 *
 * @param eventType - Type of event
 * @param provider - Provider context
 * @param marketPower - Provider's market power data
 * @param eventDate - When the event occurred
 * @returns Effective points value
 */
export function calculateEffectivePoints(
  eventType: IndexRatingEventType,
  provider: ProviderContext,
  marketPower: ProviderMarketPower | undefined,
  eventDate: Date,
): number {
  const config = EVENT_CONFIG[eventType];
  if (!config) {
    console.warn('[Index Rating] Unknown event type:', eventType);
    return 0;
  }

  const basePoints = config.basePoints;
  const staticBonus = calculateStaticBonus(provider);
  const timeDecay = calculateTimeDecay(eventDate);
  const newcomerBoost = marketPower ? calculateNewcomerBoost(marketPower.foundingYear) : 1.0;

  return basePoints * staticBonus * timeDecay * newcomerBoost;
}

/**
 * Calculate Elo gain from effective points.
 *
 * Formula: EloGain = (EffectivePoints / MPI) × K-Factor × (Actual - Expected)
 *
 * For Index Rating, Actual = 1 (engagement received)
 * and we simplify by assuming Expected ≈ 0.5 (neutral baseline)
 *
 * @param effectivePoints - Calculated effective points
 * @param mpi - Market Power Index
 * @param kFactor - K-Factor for this event type
 * @returns Elo gain value
 */
export function calculateEloGain(effectivePoints: number, mpi: number, kFactor: number): number {
  // Validate inputs
  if (!isValidMPI(mpi)) {
    mpi = DEFAULT_MPI;
  }

  // Apply MPI handicap (divide points)
  const handicappedPoints = effectivePoints / mpi;

  // Simplified Elo: Actual = 1, Expected ≈ 0.5
  // Gain = K × (1 - 0.5) = K × 0.5
  const actual = 1;
  const expected = 0.5;

  return handicappedPoints * kFactor * (actual - expected);
}

/**
 * Calculate total rating change from a list of events.
 *
 * @param events - List of events
 * @param provider - Provider context
 * @param marketPower - Provider's market power data
 * @returns Total Elo change
 */
export function calculateTotalEloChange(
  events: RatingEvent[],
  provider: ProviderContext,
  marketPower: ProviderMarketPower | undefined,
): number {
  const mpi = calculateMPI(marketPower);
  let totalChange = 0;

  for (const event of events) {
    const config = EVENT_CONFIG[event.eventType];
    if (!config) continue;

    const effectivePoints = calculateEffectivePoints(
      event.eventType,
      provider,
      marketPower,
      event.createdAt,
    );

    totalChange += calculateEloGain(effectivePoints, mpi, config.kFactor);
  }

  return totalChange;
}

// =============================================================================
// DAILY REGRESSION
// =============================================================================

/**
 * Apply daily regression toward baseline.
 *
 * Formula: NewRating = (Rating × 0.998) + (Baseline × 0.002)
 *
 * This pulls all ratings 0.2% per day toward baseline.
 * Active providers easily overcome this; inactive providers drift down.
 *
 * @param currentRating - Current rating
 * @returns Rating after regression
 */
export function applyDailyRegression(currentRating: number): number {
  const regressionFactor = 1 - INDEX_RATING_DAILY_REGRESSION;
  const baselineFactor = INDEX_RATING_DAILY_REGRESSION;

  return currentRating * regressionFactor + INDEX_RATING_BASELINE * baselineFactor;
}

// =============================================================================
// SEEDING FORMULA
// =============================================================================

/**
 * Calculate initial seeded rating for a new provider.
 *
 * Formula: EloSeed = 1000 + (currentScore × 8) + bonuses - penalties
 *
 * @param provider - Provider context with score
 * @param isIncumbent - Whether provider is an established giant
 * @returns Seeded Elo rating
 */
export function calculateSeedRating(
  provider: ProviderContext,
  isIncumbent: boolean = false,
): number {
  let seeded = 1000;

  // Add scaled score (0-100 → 0-800)
  if (typeof provider.score === 'number') {
    seeded += provider.score * 8;
  }

  // API bonus
  if (provider.apiAvailable) {
    seeded += 50;
  }

  // Affiliate bonus
  if (provider.affiliateProgramme) {
    seeded += 25;
  }

  // Incumbent penalty
  if (isIncumbent) {
    seeded -= 30;
  }

  // Floor at minimum
  return Math.max(INDEX_RATING_MIN_FLOOR, seeded);
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

/**
 * Determine the display state for a rating change.
 *
 * @param changePercent - Percentage change
 * @param isFallback - Whether using fallback data
 * @returns Display state
 */
export function getRatingChangeState(
  changePercent: number | null,
  isFallback: boolean = false,
): RatingChangeState {
  if (isFallback || changePercent === null) {
    return 'fallback';
  }

  // Flat threshold: ±0.1%
  if (Math.abs(changePercent) < INDEX_RATING_FLAT_THRESHOLD) {
    return 'flat';
  }

  return changePercent > 0 ? 'gain' : 'loss';
}

/**
 * Check if a provider qualifies for the underdog badge.
 *
 * Criteria: MPI < 3.0 OR provider age < 12 months
 *
 * @param mpi - Market Power Index
 * @param foundingYear - When provider was founded
 * @returns Whether provider is an underdog
 */
export function isUnderdog(mpi: number | undefined, foundingYear: number | undefined): boolean {
  // MPI below 3.0
  if (typeof mpi === 'number' && mpi < 3.0) {
    return true;
  }

  // Provider age < 12 months
  if (typeof foundingYear === 'number') {
    const now = new Date();
    const monthsOld = (now.getFullYear() - foundingYear) * 12 + now.getMonth();
    if (monthsOld < 12) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a provider qualifies for the newcomer badge.
 *
 * Criteria: Provider age < 6 months
 *
 * @param foundingYear - When provider was founded
 * @param foundingMonth - Month of founding (1-12, optional)
 * @returns Whether provider is a newcomer
 */
export function isNewcomer(foundingYear: number | undefined, foundingMonth: number = 1): boolean {
  if (typeof foundingYear !== 'number') {
    return false;
  }

  const now = new Date();
  const foundingDate = new Date(foundingYear, foundingMonth - 1, 1);

  const monthsOld =
    (now.getFullYear() - foundingDate.getFullYear()) * 12 +
    (now.getMonth() - foundingDate.getMonth());

  return monthsOld < 6;
}

/**
 * Check if a rank change within the last 24 hours qualifies for the rank-up arrow.
 *
 * @param rankChangedAt - When rank last improved
 * @returns Whether to show rank-up arrow
 */
export function hasRecentRankUp(rankChangedAt: Date | null): boolean {
  if (!rankChangedAt) {
    return false;
  }

  const now = new Date();
  const hoursSinceChange = (now.getTime() - rankChangedAt.getTime()) / (1000 * 60 * 60);

  return hoursSinceChange <= 24;
}

/**
 * Apply rating floor (minimum 100).
 *
 * @param rating - Calculated rating
 * @returns Rating with floor applied
 */
export function applyRatingFloor(rating: number): number {
  if (rating < INDEX_RATING_MIN_FLOOR) {
    console.warn('[Index Rating] Rating below floor, clamping:', rating);
    return INDEX_RATING_MIN_FLOOR;
  }
  return rating;
}

/**
 * Calculate percentage change between two ratings.
 *
 * @param current - Current rating
 * @param previous - Previous rating
 * @returns Percentage change
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}
