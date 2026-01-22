// src/lib/promagen-users/index.ts
//
// Centralized helpers for the Promagen Users feature.
// Provides functions to fetch per-provider country usage from the aggregation table.
//
// Authority: docs/authority/ribbon-homepage.md § Promagen Users
// Authority: docs/authority/ai_providers.md § Analytics-derived metrics
//
// Existing features preserved: Yes (new file).

import 'server-only';

import { db, hasDatabaseConfigured } from '@/lib/db';
import { env } from '@/lib/env';
import type { PromagenUsersCountryUsage } from '@/types/promagen-users';

/**
 * Maximum number of countries to return per provider.
 * Per spec: "Top up to 6 countries by Promagen usage for that provider"
 */
export const MAX_COUNTRIES_PER_PROVIDER = 6;

/**
 * Freshness threshold in hours.
 * Per spec: "If the provider's aggregate is stale (updatedAt older than 48 hours),
 * render an empty cell and log a warning."
 */
export const STALE_THRESHOLD_HOURS = 48;

/**
 * Check if a timestamp is stale (older than STALE_THRESHOLD_HOURS).
 */
export function isStale(updatedAt: Date | null | undefined): boolean {
  if (!updatedAt) return true;

  const staleThresholdMs =
    (env.analytics.staleAfterHours ?? STALE_THRESHOLD_HOURS) * 60 * 60 * 1000;
  const now = Date.now();
  const updatedAtMs = updatedAt.getTime();

  return now - updatedAtMs > staleThresholdMs;
}

/**
 * Validate a country code (ISO 3166-1 alpha-2).
 * Returns normalized uppercase code or null if invalid.
 */
export function normalizeCountryCode(code: string | null | undefined): string | null {
  if (!code || typeof code !== 'string') return null;

  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 2) return null;

  // Basic validation: must be uppercase letters only
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;

  // Reject placeholder codes
  if (trimmed === 'XX' || trimmed === 'ZZ') return null;

  return trimmed;
}

/**
 * Check if an error is a "table doesn't exist" error.
 * This is expected during initial setup before the cron creates the table.
 */
function isTableNotExistsError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('relation') &&
      (msg.includes('does not exist') || msg.includes('doesn\'t exist'))
    );
  }
  return false;
}

/**
 * Fetch Promagen Users data for a specific provider.
 *
 * Returns array of country usage sorted by count descending, max MAX_COUNTRIES_PER_PROVIDER entries.
 * Returns empty array if:
 * - Database not configured
 * - No data exists for this provider
 * - Data is stale (older than 48 hours)
 *
 * @param providerId - The provider ID to fetch data for
 * @returns Array of country usage, or empty array if no valid data
 */
export async function getPromagenUsersForProvider(
  providerId: string,
): Promise<ReadonlyArray<PromagenUsersCountryUsage>> {
  if (!hasDatabaseConfigured()) {
    return [];
  }

  if (!providerId || typeof providerId !== 'string') {
    return [];
  }

  const cleanProviderId = providerId.trim().toLowerCase();
  if (!cleanProviderId) {
    return [];
  }

  try {
    const sql = db();

    const rows = await sql<
      Array<{ country_code: string; users_count: string; updated_at: Date }>
    >`
      select country_code, users_count::text, updated_at
      from provider_country_usage_30d
      where provider_id = ${cleanProviderId}
        and users_count > 0
      order by users_count desc
      limit ${MAX_COUNTRIES_PER_PROVIDER}
    `;

    if (rows.length === 0) {
      return [];
    }

    // Check freshness using the most recent updated_at
    const mostRecentUpdate = rows[0]?.updated_at ?? null;
    if (isStale(mostRecentUpdate)) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          component: 'promagen-users',
          event: 'stale_data',
          providerId: cleanProviderId,
          updatedAt: mostRecentUpdate?.toISOString() ?? null,
          thresholdHours: env.analytics.staleAfterHours ?? STALE_THRESHOLD_HOURS,
        }),
      );
      return [];
    }

    // Transform to frontend shape
    return rows
      .map((row) => {
        const countryCode = normalizeCountryCode(row.country_code);
        const count = parseInt(row.users_count, 10);

        if (!countryCode || !Number.isFinite(count) || count <= 0) {
          return null;
        }

        return { countryCode, count };
      })
      .filter((item): item is PromagenUsersCountryUsage => item !== null);
  } catch (error) {
    // Silently ignore "table doesn't exist" errors - expected during initial setup
    if (isTableNotExistsError(error)) {
      return [];
    }

    // Log other unexpected errors
    console.error(
      JSON.stringify({
        level: 'error',
        component: 'promagen-users',
        event: 'fetch_error',
        providerId: cleanProviderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return [];
  }
}

/**
 * Fetch Promagen Users data for multiple providers in a single query.
 * This is more efficient than calling getPromagenUsersForProvider for each provider.
 *
 * @param providerIds - Array of provider IDs to fetch data for
 * @returns Map of providerId -> array of country usage
 */
export async function getPromagenUsersForProviders(
  providerIds: ReadonlyArray<string>,
): Promise<Map<string, ReadonlyArray<PromagenUsersCountryUsage>>> {
  const result = new Map<string, ReadonlyArray<PromagenUsersCountryUsage>>();

  if (!hasDatabaseConfigured()) {
    return result;
  }

  if (!providerIds || providerIds.length === 0) {
    return result;
  }

  // Normalize and validate provider IDs
  const cleanIds = providerIds
    .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
    .filter((id) => id.length > 0);

  if (cleanIds.length === 0) {
    return result;
  }

  try {
    const sql = db();

    // Fetch all rows for all providers, with row number for ranking within each provider
    const rows = await sql<
      Array<{
        provider_id: string;
        country_code: string;
        users_count: string;
        updated_at: Date;
        rn: string;
      }>
    >`
      with ranked as (
        select
          provider_id,
          country_code,
          users_count,
          updated_at,
          row_number() over (
            partition by provider_id
            order by users_count desc
          ) as rn
        from provider_country_usage_30d
        where provider_id = any(${cleanIds})
          and users_count > 0
      )
      select provider_id, country_code, users_count::text, updated_at, rn::text
      from ranked
      where rn <= ${MAX_COUNTRIES_PER_PROVIDER}
      order by provider_id, users_count desc
    `;

    // Group by provider
    const byProvider = new Map<
      string,
      Array<{ country_code: string; users_count: string; updated_at: Date }>
    >();

    for (const row of rows) {
      const providerId = row.provider_id;
      if (!byProvider.has(providerId)) {
        byProvider.set(providerId, []);
      }
      byProvider.get(providerId)!.push(row);
    }

    // Transform each provider's data
    for (const [providerId, providerRows] of byProvider) {
      // Check freshness - safely handle potentially undefined first row
      const firstRow = providerRows[0];
      const mostRecentUpdate = firstRow?.updated_at ?? null;
      if (isStale(mostRecentUpdate)) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            component: 'promagen-users',
            event: 'stale_data',
            providerId,
            updatedAt: mostRecentUpdate?.toISOString() ?? null,
            thresholdHours: env.analytics.staleAfterHours ?? STALE_THRESHOLD_HOURS,
          }),
        );
        result.set(providerId, []);
        continue;
      }

      // Transform to frontend shape
      const countries = providerRows
        .map((row) => {
          const countryCode = normalizeCountryCode(row.country_code);
          const count = parseInt(row.users_count, 10);

          if (!countryCode || !Number.isFinite(count) || count <= 0) {
            return null;
          }

          return { countryCode, count };
        })
        .filter((item): item is PromagenUsersCountryUsage => item !== null);

      result.set(providerId, countries);
    }

    return result;
  } catch (error) {
    // Silently ignore "table doesn't exist" errors - expected during initial setup
    // The cron will create the table on first run
    if (isTableNotExistsError(error)) {
      return result;
    }

    // Log other unexpected errors
    console.error(
      JSON.stringify({
        level: 'error',
        component: 'promagen-users',
        event: 'bulk_fetch_error',
        providerCount: cleanIds.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
    return result;
  }
}

/**
 * Get the last cron run timestamp for observability.
 */
export async function getLastCronRun(): Promise<{
  ranAt: Date | null;
  ok: boolean;
  rowsAffected: number;
  providersAffected: number;
} | null> {
  if (!hasDatabaseConfigured()) {
    return null;
  }

  try {
    const sql = db();

    const rows = await sql<
      Array<{
        ran_at: Date;
        ok: boolean;
        rows_affected: string;
        providers_affected: string;
      }>
    >`
      select ran_at, ok, rows_affected::text, coalesce(providers_affected, 0)::text as providers_affected
      from promagen_users_cron_runs
      order by ran_at desc
      limit 1
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      ranAt: row.ran_at,
      ok: row.ok,
      rowsAffected: parseInt(row.rows_affected, 10) || 0,
      providersAffected: parseInt(row.providers_affected, 10) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Check if the aggregation table exists and has data.
 * Useful for health checks and debugging.
 */
export async function checkAggregationHealth(): Promise<{
  tableExists: boolean;
  rowCount: number;
  providerCount: number;
  oldestUpdate: Date | null;
  newestUpdate: Date | null;
}> {
  if (!hasDatabaseConfigured()) {
    return {
      tableExists: false,
      rowCount: 0,
      providerCount: 0,
      oldestUpdate: null,
      newestUpdate: null,
    };
  }

  try {
    const sql = db();

    const stats = await sql<
      Array<{
        row_count: string;
        provider_count: string;
        oldest_update: Date | null;
        newest_update: Date | null;
      }>
    >`
      select
        count(*)::text as row_count,
        count(distinct provider_id)::text as provider_count,
        min(updated_at) as oldest_update,
        max(updated_at) as newest_update
      from provider_country_usage_30d
    `;

    const stat = stats[0];
    return {
      tableExists: true,
      rowCount: parseInt(stat?.row_count ?? '0', 10) || 0,
      providerCount: parseInt(stat?.provider_count ?? '0', 10) || 0,
      oldestUpdate: stat?.oldest_update ?? null,
      newestUpdate: stat?.newest_update ?? null,
    };
  } catch {
    // Table likely doesn't exist
    return {
      tableExists: false,
      rowCount: 0,
      providerCount: 0,
      oldestUpdate: null,
      newestUpdate: null,
    };
  }
}
