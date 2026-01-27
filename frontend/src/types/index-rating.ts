/**
 * Index Rating System Types
 * 
 * Promagen's dynamic Elo-style competitive ranking system
 * for AI image generation providers.
 * 
 * @see docs/authority/index-rating.md
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Elo baseline rating for all providers */
export const INDEX_RATING_BASELINE = 1500;

/** Time decay rate (half-life ≈ 35 days) */
export const INDEX_RATING_DECAY_LAMBDA = 0.02;

/** Staleness threshold in hours */
export const INDEX_RATING_STALE_HOURS = 48;

/** Daily regression rate toward baseline */
export const INDEX_RATING_DAILY_REGRESSION = 0.002;

/** Flat threshold for display (±0.1%) */
export const INDEX_RATING_FLAT_THRESHOLD = 0.1;

/** Advisory lock ID for cron job */
export const INDEX_RATING_ADVISORY_LOCK_ID = 424243;

/** Minimum rating floor */
export const INDEX_RATING_MIN_FLOOR = 100;

// =============================================================================
// EVENT TYPES
// =============================================================================

/** Tracked event types and their scoring configuration */
export const EVENT_CONFIG = {
  vote: { basePoints: 5, kFactor: 32 },
  prompt_submit: { basePoints: 5, kFactor: 24 },
  prompt_builder_open: { basePoints: 3, kFactor: 16 },
  open: { basePoints: 2, kFactor: 16 },
  click: { basePoints: 2, kFactor: 16 }, // Legacy alias for open
  social_click: { basePoints: 1, kFactor: 8 },
} as const;

export type IndexRatingEventType = keyof typeof EVENT_CONFIG;

/** All valid event types for validation */
export const VALID_EVENT_TYPES = Object.keys(EVENT_CONFIG) as IndexRatingEventType[];

// =============================================================================
// STATIC BONUS MULTIPLIERS
// =============================================================================

export const STATIC_BONUSES = {
  apiAvailable: 1.10,
  affiliateProgramme: 1.05,
  supportsPrefill: 1.05,
} as const;

// =============================================================================
// NEWCOMER BOOST
// =============================================================================

export const NEWCOMER_BOOST = {
  /** 0-3 months: 20% boost */
  FULL_BOOST_MONTHS: 3,
  FULL_BOOST_MULTIPLIER: 1.20,
  /** 3-6 months: 10% boost */
  TAPER_MONTHS: 6,
  TAPER_MULTIPLIER: 1.10,
  /** 6+ months: no boost */
  NORMAL_MULTIPLIER: 1.00,
} as const;

// =============================================================================
// MARKET POWER INDEX
// =============================================================================

/** Default MPI for providers without market power data */
export const DEFAULT_MPI = 3.0;

/** Minimum valid MPI */
export const MIN_MPI = 1.0;

/** Maximum valid MPI */
export const MAX_MPI = 10.0;

// =============================================================================
// DATABASE TYPES
// =============================================================================

/**
 * Provider rating record from database
 */
export type ProviderRating = {
  providerId: string;
  currentRating: number;
  previousRating: number;
  change: number;
  changePercent: number;
  currentRank: number | null;
  previousRank: number | null;
  rankChangedAt: Date | null;
  calculatedAt: Date;
};

/**
 * Raw database row from provider_ratings table
 */
export type ProviderRatingRow = {
  provider_id: string;
  current_rating: string | number;
  previous_rating: string | number;
  change: string | number;
  change_percent: string | number;
  current_rank: number | null;
  previous_rank: number | null;
  rank_changed_at: Date | string | null;
  calculated_at: Date | string;
};

/**
 * Cron run log entry
 */
export type IndexRatingCronRun = {
  id: string;
  ranAt: Date;
  ok: boolean;
  message: string | null;
  providersUpdated: number;
  durationMs: number;
};

/**
 * Raw database row from index_rating_cron_runs table
 */
export type IndexRatingCronRunRow = {
  id: string;
  ran_at: Date | string;
  ok: boolean;
  message: string | null;
  providers_updated: string | number;
  duration_ms: string | number;
};

// =============================================================================
// DISPLAY TYPES
// =============================================================================

/** Display state for rating change */
export type RatingChangeState = 'gain' | 'loss' | 'flat' | 'fallback';

/**
 * Resolved rating data for UI display
 */
export type DisplayRating = {
  /** Current rating value */
  rating: number | null;
  /** Absolute change from previous */
  change: number | null;
  /** Percentage change */
  changePercent: number | null;
  /** Display state */
  state: RatingChangeState;
  /** Data source */
  source: 'database' | 'fallback';
  /** Current rank position */
  rank: number | null;
  /** Whether rank improved in last 24h */
  hasRankUp: boolean;
  /** Whether provider qualifies for underdog badge */
  isUnderdog: boolean;
  /** Whether provider qualifies for newcomer badge */
  isNewcomer: boolean;
};

// =============================================================================
// CALCULATION TYPES
// =============================================================================

/**
 * Event data for Elo calculation
 */
export type RatingEvent = {
  eventType: IndexRatingEventType;
  createdAt: Date;
  providerId: string;
};

/**
 * Provider context for rating calculation
 */
export type ProviderContext = {
  id: string;
  score?: number;
  apiAvailable?: boolean;
  affiliateProgramme?: boolean;
  supportsPrefill?: boolean;
};

/**
 * Market Power data for a provider
 */
export type ProviderMarketPower = {
  foundingYear: number;
  socialReach: {
    youtube?: number;
    x?: number;
    instagram?: number;
    facebook?: number;
    discord?: number;
    linkedin?: number;
    tiktok?: number;
    reddit?: number;
    pinterest?: number;
  };
  estimatedUsers: number;
  notes?: string;
};

/**
 * Full Market Power data file structure
 */
export type MarketPowerData = {
  $schema?: string;
  lastResearched: string;
  providers: Record<string, ProviderMarketPower>;
};

// =============================================================================
// API TYPES
// =============================================================================

/**
 * Event tracking request body
 */
export type TrackEventRequest = {
  providerId: string;
  eventType: IndexRatingEventType;
  src?: string;
  sessionId?: string;
};

/**
 * Cron response
 */
export type IndexRatingCronResponse = {
  ok: boolean;
  message: string;
  providersUpdated: number;
  providersSeeded: number;
  durationMs: number;
  requestId: string;
  ranAt: string;
  dryRun: boolean;
};

// =============================================================================
// HELPER TYPE GUARDS
// =============================================================================

/**
 * Type guard to check if a string is a valid event type
 */
export function isValidEventType(type: string): type is IndexRatingEventType {
  return VALID_EVENT_TYPES.includes(type as IndexRatingEventType);
}

/**
 * Type guard to check if MPI is valid
 */
export function isValidMPI(mpi: number): boolean {
  return !isNaN(mpi) && isFinite(mpi) && mpi >= MIN_MPI && mpi <= MAX_MPI;
}

// =============================================================================
// DISPLAY COLORS
// =============================================================================

export const RATING_COLORS = {
  gain: '#22c55e',
  loss: '#ef4444',
  flat: '#6b7280',
  fallback: '#6b7280',
} as const;
