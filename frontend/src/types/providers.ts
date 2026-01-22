// src/types/providers.ts
// Updated: January 2026 - Added community voting/ranking fields
// Updated: January 2026 - Added social media links (Support column)
// Updated: January 18, 2026 - Added pinterest and x (Twitter) to socials
// Updated: January 22, 2026 - Added apiDocsUrl field for API documentation links
// Updated: January 22, 2026 - Added promagenUsers field for per-provider country usage

import type { PromagenUsersCountryUsage } from './promagen-users';

export type ProviderTrend = 'up' | 'down' | 'flat';

/**
 * Social media links for a provider.
 * Only official accounts - all fields are optional.
 *
 * Platform order in UI:
 * LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X
 */
export type ProviderSocials = {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  discord?: string;
  reddit?: string;
  tiktok?: string;
  pinterest?: string;
  x?: string;
};

export type ProviderGenerationSpeed = 'fast' | 'medium' | 'slow' | 'varies';

/**
 * Quality tier for providers not covered by external benchmarks.
 * Used as fallback when no ELO data is available.
 */
export type ProviderQualityTier =
  | 'top-tier' // Best-in-class quality
  | 'mid-tier' // Good quality, competitive
  | 'entry-tier' // Basic quality, accessible
  | 'specialized' // Niche use case (anime, editing, etc.)
  | 'utility'; // Not primarily generative (background removal, etc.)

/**
 * Community ranking data for a provider.
 * Populated by user votes and recalculated hourly.
 */
export type ProviderRanking = {
  /** Seed ELO from Artificial Analysis (null if not benchmarked) */
  seedElo: number | null;

  /** Manual tier assignment for providers without external benchmarks */
  seedTier: ProviderQualityTier;

  /** Bayesian score calculated from community votes (null until sufficient votes) */
  bayesianScore: number | null;

  /** Community-derived rank 1-N (null until calculated) */
  communityRank: number | null;

  /** Total weighted votes received */
  totalVotes: number;

  /** Breakdown of vote signals */
  signals: {
    imageUploads: number;
    imageLikes: number;
    comments: number;
    cardLikes: number;
  };

  /** ISO timestamp of last ranking calculation */
  lastCalculated: string | null;
};

export type Provider = {
  id: string;
  name: string;
  country?: string; // DEPRECATED: Use countryCode instead
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g., "US", "GB", "DE")

  score?: number; // Overall score 0-100
  trend?: ProviderTrend;
  tags?: string[];

  // SSOT in providers.json is `website`; UI may also use `url` as a normalised alias.
  url?: string;
  website: string;

  // Affiliate / disclosure
  affiliateUrl: string | null;
  requiresDisclosure: boolean;

  // API documentation URL (for 🔌 emoji link)
  apiDocsUrl?: string | null;

  // Short marketing copy
  tagline?: string;
  tip?: string;

  // Leaderboard enrichment fields (UI contract – optional until populated)
  icon?: string;
  localIcon?: string; // Local icon path (e.g., "/icons/providers/midjourney.png")

  // Leaderboard: HQ location and support
  hqCity?: string; // Headquarters city (e.g., "San Francisco", "London")
  timezone?: string; // IANA timezone (e.g., "America/Los_Angeles", "Europe/London")
  supportHours?: string; // Human-readable (e.g., "24/7", "Mon-Fri 9AM-6PM PT")

  // Leaderboard: Image quality and scoring
  imageQualityRank?: number; // Ordinal rank (1 = best quality, 2 = second best, etc.)
  incumbentAdjustment?: boolean; // True if -5 Big Tech adjustment applies

  // Leaderboard: Visual styles and capabilities
  visualStyles?: string;
  apiAvailable?: boolean;
  affiliateProgramme?: boolean;

  // Social media links (Support column)
  socials?: ProviderSocials | null;

  // Community ranking (optional - populated when voting is enabled)
  ranking?: ProviderRanking;

  // Promagen Users: per-provider country usage (populated from aggregation table)
  // Authority: docs/authority/ribbon-homepage.md § Promagen Users
  // - Top up to 6 countries by Promagen usage for that provider
  // - Empty if zero users or stale data (>48h)
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;

  // DEPRECATED fields (kept for backwards compatibility)
  sweetSpot?: string; // DEPRECATED: Removed from new leaderboard
  generationSpeed?: ProviderGenerationSpeed; // DEPRECATED: Removed from new leaderboard
  affordability?: string; // DEPRECATED: Removed from new leaderboard

  // Prompt builder UX
  supportsPrefill?: boolean;

  // Future categorisation (optional)
  group?: string;
  tier?: string;
};
