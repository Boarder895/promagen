// frontend/src/app/api/providers/route.ts
//
// Providers API endpoint.
// Returns the provider catalog with optional enrichment from aggregation tables.
//
// Updated: January 22, 2026 - Added promagenUsers enrichment from aggregation table
//
// Existing features preserved: Yes.

import { NextResponse } from 'next/server';

import { hasDatabaseConfigured } from '@/lib/db';
import { getPromagenUsersForProviders } from '@/lib/promagen-users';
import type { Provider } from '@/types/providers';

// Runtime-safe import that tolerates default or named export without 'any'.
function asProviders(mod: unknown): Provider[] {
  if (Array.isArray(mod)) return mod;
  if (mod && typeof mod === 'object') {
    const m = mod as Record<string, unknown>;
    const candidates = ['default', 'CATALOG', 'catalog', 'providers', 'PROVIDERS'] as const;
    for (const k of candidates) {
      const v = m[k as string];
      if (Array.isArray(v)) return v as Provider[];
    }
  }
  return [];
}

/**
 * Enrich providers with Promagen Users data from aggregation table.
 * Falls back gracefully if database is unavailable.
 */
async function enrichWithPromagenUsers(providers: Provider[]): Promise<Provider[]> {
  // Skip enrichment if no database configured
  if (!hasDatabaseConfigured()) {
    return providers;
  }

  // Skip if no providers
  if (providers.length === 0) {
    return providers;
  }

  try {
    // Get all provider IDs
    const providerIds = providers.map((p) => p.id);

    // Fetch aggregation data for all providers in one query
    const usageMap = await getPromagenUsersForProviders(providerIds);

    // Enrich each provider with its usage data
    return providers.map((provider) => {
      const usage = usageMap.get(provider.id.toLowerCase());

      // Only add promagenUsers if we have data
      // Per spec: empty means zero users (UI renders empty cell)
      if (usage && usage.length > 0) {
        return {
          ...provider,
          promagenUsers: usage,
        };
      }

      // Return provider without promagenUsers (undefined = no data)
      return provider;
    });
  } catch (error) {
    // Log error but don't fail the entire request
    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/providers',
        event: 'promagen_users_enrichment_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );

    // Return providers without enrichment
    return providers;
  }
}

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('@/data/providers');
    const providers = asProviders(raw);

    // Enrich with Promagen Users data
    const enrichedProviders = await enrichWithPromagenUsers(providers);

    return NextResponse.json(enrichedProviders, {
      status: 200,
      headers: {
        // Allow caching for 5 minutes, stale-while-revalidate for 1 hour
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        route: '/api/providers',
        event: 'request_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );

    return NextResponse.json({ error: 'Failed to load providers' }, { status: 500 });
  }
}
