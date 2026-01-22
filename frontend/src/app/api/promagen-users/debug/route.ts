// frontend/src/app/api/promagen-users/debug/route.ts
//
// Debug endpoint to verify the Promagen Users pipeline.
// Protected by PROMAGEN_CRON_SECRET (same as cron).
//
// Provides:
// - Health check for database connectivity
// - Aggregation table stats
// - Sample data for verification
// - Last cron run info
//
// Usage: GET /api/promagen-users/debug?secret=YOUR_CRON_SECRET
//
// Existing features preserved: Yes (new endpoint).

import crypto from 'node:crypto';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db, hasDatabaseConfigured, canReachDatabase } from '@/lib/db';
import { env, requireCronSecret } from '@/lib/env';
import {
  checkAggregationHealth,
  getLastCronRun,
  isStale,
  STALE_THRESHOLD_HOURS,
  MAX_COUNTRIES_PER_PROVIDER,
} from '@/lib/promagen-users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);
  return crypto.randomUUID();
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/**
 * Validate authentication (same as cron).
 */
function requireAuth(req: NextRequest): void {
  const expected = requireCronSecret();

  const provided =
    req.headers.get('x-promagen-cron') ??
    req.headers.get('x-cron-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    '';

  if (!provided || !constantTimeEquals(provided, expected)) {
    throw new Error('Unauthorized');
  }
}

/**
 * Get sample providers with their aggregation data.
 */
async function getSampleProviderData(limit: number = 5): Promise<
  Array<{
    providerId: string;
    countries: Array<{ countryCode: string; usersCount: number }>;
    totalUsers: number;
    updatedAt: string | null;
    isStale: boolean;
  }>
> {
  if (!hasDatabaseConfigured()) return [];

  try {
    const sql = db();

    // Get top providers by total users
    const providers = await sql<Array<{ provider_id: string; total_users: string }>>`
      select provider_id, sum(users_count)::text as total_users
      from provider_country_usage_30d
      group by provider_id
      order by sum(users_count) desc
      limit ${limit}
    `;

    const results = [];

    for (const provider of providers) {
      // Get country breakdown for this provider
      const countries = await sql<
        Array<{ country_code: string; users_count: string; updated_at: Date }>
      >`
        select country_code, users_count::text, updated_at
        from provider_country_usage_30d
        where provider_id = ${provider.provider_id}
        order by users_count desc
        limit ${MAX_COUNTRIES_PER_PROVIDER}
      `;

      const updatedAt = countries[0]?.updated_at ?? null;

      results.push({
        providerId: provider.provider_id,
        countries: countries.map((c) => ({
          countryCode: c.country_code,
          usersCount: parseInt(c.users_count, 10),
        })),
        totalUsers: parseInt(provider.total_users, 10),
        updatedAt: updatedAt?.toISOString() ?? null,
        isStale: isStale(updatedAt),
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Get raw event count by provider (for debugging).
 */
async function getRawEventStats(): Promise<{
  totalEvents: number;
  uniqueProviders: number;
  uniqueCountries: number;
  oldestEvent: string | null;
  newestEvent: string | null;
}> {
  if (!hasDatabaseConfigured()) {
    return {
      totalEvents: 0,
      uniqueProviders: 0,
      uniqueCountries: 0,
      oldestEvent: null,
      newestEvent: null,
    };
  }

  try {
    const sql = db();

    const stats = await sql<
      Array<{
        total_events: string;
        unique_providers: string;
        unique_countries: string;
        oldest_event: Date | null;
        newest_event: Date | null;
      }>
    >`
      select
        count(*)::text as total_events,
        count(distinct provider_id)::text as unique_providers,
        count(distinct country_code)::text as unique_countries,
        min(created_at) as oldest_event,
        max(created_at) as newest_event
      from provider_activity_events
    `;

    const stat = stats[0];
    return {
      totalEvents: parseInt(stat?.total_events ?? '0', 10),
      uniqueProviders: parseInt(stat?.unique_providers ?? '0', 10),
      uniqueCountries: parseInt(stat?.unique_countries ?? '0', 10),
      oldestEvent: stat?.oldest_event?.toISOString() ?? null,
      newestEvent: stat?.newest_event?.toISOString() ?? null,
    };
  } catch {
    return {
      totalEvents: 0,
      uniqueProviders: 0,
      uniqueCountries: 0,
      oldestEvent: null,
      newestEvent: null,
    };
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();
  const requestId = getRequestId(request);

  try {
    requireAuth(request);

    // Check database configuration
    const dbConfigured = hasDatabaseConfigured();
    const dbReachable = dbConfigured ? await canReachDatabase() : false;

    // Get aggregation health
    const aggHealth = await checkAggregationHealth();

    // Get last cron run
    const lastCronRun = await getLastCronRun();

    // Get raw event stats
    const rawEventStats = await getRawEventStats();

    // Get sample provider data
    const sampleProviders = await getSampleProviderData(5);

    const durationMs = Date.now() - startedAt;

    const payload = {
      ok: true,
      requestId,
      timestamp: new Date().toISOString(),
      durationMs,

      // Configuration
      config: {
        databaseConfigured: dbConfigured,
        databaseReachable: dbReachable,
        staleThresholdHours: env.analytics.staleAfterHours ?? STALE_THRESHOLD_HOURS,
        windowDays: env.analytics.usersWindowDays,
        maxCountriesPerProvider: MAX_COUNTRIES_PER_PROVIDER,
        safeMode: env.safeMode.enabled,
      },

      // Raw events (input)
      rawEvents: rawEventStats,

      // Aggregation table (output)
      aggregation: {
        tableExists: aggHealth.tableExists,
        rowCount: aggHealth.rowCount,
        providerCount: aggHealth.providerCount,
        oldestUpdate: aggHealth.oldestUpdate?.toISOString() ?? null,
        newestUpdate: aggHealth.newestUpdate?.toISOString() ?? null,
        isStale: isStale(aggHealth.newestUpdate),
      },

      // Last cron run
      lastCronRun: lastCronRun
        ? {
            ranAt: lastCronRun.ranAt?.toISOString() ?? null,
            ok: lastCronRun.ok,
            rowsAffected: lastCronRun.rowsAffected,
            providersAffected: lastCronRun.providersAffected,
          }
        : null,

      // Sample data (top 5 providers)
      sampleProviders,

      // Helpful links
      help: {
        triggerCron: '/api/promagen-users/cron?secret=YOUR_SECRET',
        dryRun: '/api/promagen-users/cron?secret=YOUR_SECRET&dryRun=1',
        docs: 'docs/authority/ribbon-homepage.md § Promagen Users',
      },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Promagen-Request-Id': requestId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    // Return 404 for auth errors (security)
    const isAuthError = message === 'Unauthorized';
    const status = isAuthError ? 404 : 500;
    const clientMessage = isAuthError ? 'Not Found' : message;

    return NextResponse.json(
      {
        ok: false,
        message: clientMessage,
        requestId,
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Promagen-Request-Id': requestId,
        },
      },
    );
  }
}
