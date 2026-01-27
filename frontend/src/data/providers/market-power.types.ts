/**
 * Market Power Types
 * 
 * TypeScript types for Market Power data used in Index Rating calculations.
 * These types correspond to the market-power.json schema.
 */

/**
 * Social media reach metrics for a provider
 */
export interface SocialReach {
  /** YouTube subscribers */
  youtube?: number;
  /** X (Twitter) followers */
  x?: number;
  /** Instagram followers */
  instagram?: number;
  /** Facebook page likes/followers */
  facebook?: number;
  /** Discord server members */
  discord?: number;
  /** Reddit subreddit members */
  reddit?: number;
  /** LinkedIn followers */
  linkedin?: number;
  /** TikTok followers */
  tiktok?: number;
}

/**
 * Market Power data for a single provider
 */
export interface ProviderMarketPower {
  /** Year the company/product was founded */
  foundingYear: number;
  /** Social media follower counts */
  socialReach?: SocialReach;
  /** Estimated monthly active users */
  estimatedUsers: number;
  /** Additional context about the provider */
  notes?: string;
}

/**
 * Complete Market Power data structure
 */
export interface MarketPowerData {
  /** Schema reference */
  $schema?: string;
  /** Date when data was last researched (YYYY-MM-DD) */
  lastResearched: string;
  /** Notes about research methodology and sources */
  researchNotes?: string;
  /** Provider-keyed market power data */
  providers: Record<string, ProviderMarketPower>;
}

/**
 * Market Power Index (MPI) calculation result
 */
export interface MarketPowerIndex {
  /** Provider ID */
  providerId: string;
  /** Calculated MPI value (1.0-5.0 scale) */
  mpi: number;
  /** Age factor contribution */
  ageFactor: number;
  /** Social factor contribution */
  socialFactor: number;
  /** User base factor contribution */
  userFactor: number;
  /** Whether default MPI was used (provider not in JSON) */
  isDefault: boolean;
}

/**
 * Default MPI for providers not in market-power.json
 * Mid-range value provides neutral handicap
 */
export const DEFAULT_MPI = 3.0;

/**
 * MPI range bounds
 */
export const MPI_MIN = 1.0;
export const MPI_MAX = 5.0;

/**
 * Age thresholds for MPI calculation (in years)
 */
export const AGE_THRESHOLDS = {
  /** Newcomer: less than 1 year old */
  NEWCOMER: 1,
  /** Young: 1-3 years old */
  YOUNG: 3,
  /** Established: 3-7 years old */
  ESTABLISHED: 7,
  /** Veteran: 7+ years old */
  VETERAN: 7,
};

/**
 * User base thresholds for MPI calculation
 */
export const USER_THRESHOLDS = {
  /** Micro: less than 100K users */
  MICRO: 100_000,
  /** Small: 100K-1M users */
  SMALL: 1_000_000,
  /** Medium: 1M-10M users */
  MEDIUM: 10_000_000,
  /** Large: 10M-50M users */
  LARGE: 50_000_000,
  /** Massive: 50M+ users */
  MASSIVE: 50_000_000,
};
