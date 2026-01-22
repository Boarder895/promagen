// src/types/promagen-users.ts
//
// Type definitions for the Promagen Users feature.
// This tracks per-provider usage by country, displayed in the leaderboard.
//
// Authority: docs/authority/ribbon-homepage.md § Promagen Users
//
// Existing features preserved: Yes (new file, no modifications to existing types).

/**
 * Usage data for a single country within a provider's Promagen Users cell.
 *
 * @example
 * { countryCode: 'US', count: 42 }
 * { countryCode: 'GB', count: 17 }
 */
export type PromagenUsersCountryUsage = {
  /** ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "DE") */
  countryCode: string;
  /** Number of distinct users from this country in the window (30 days) */
  count: number;
};

/**
 * Aggregated Promagen Users data for a single provider.
 * This is the shape returned by the providers API and consumed by the UI.
 *
 * Per spec (ribbon-homepage.md):
 * - Top up to 6 countries by usage for that provider
 * - If zero users → empty array (UI renders empty cell)
 * - If stale (>48h) → empty array + log warning
 */
export type PromagenUsersData = {
  /** Array of country usage, sorted by count descending, max 6 entries */
  countries: ReadonlyArray<PromagenUsersCountryUsage>;
  /** ISO timestamp of when this aggregation was computed */
  updatedAt: string | null;
  /** True if data is stale (older than 48 hours per spec) */
  isStale: boolean;
};

/**
 * Raw database row from the aggregation table.
 * Used internally by the cron and providers API.
 */
export type ProviderCountryUsageRow = {
  provider_id: string;
  country_code: string;
  users_count: number;
  updated_at: Date;
};

/**
 * Cron run record for observability.
 */
export type PromagenUsersCronRun = {
  id: string;
  ran_at: Date;
  ok: boolean;
  message: string | null;
  rows_affected: number;
  providers_affected: number;
};
