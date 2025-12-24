// C:\Users\Proma\Projects\promagen\frontend\src\lib\providers\api.ts

import 'server-only';

import { z } from 'zod';

import rawProviders from '@/data/providers/providers.json';
import { db, hasDatabaseConfigured } from '@/lib/db';
import { env } from '@/lib/env';
import type { Provider } from '@/types/providers';

export type ProvidersApiResponse = Provider[];

export type PromagenUsersCountryUsage = {
  countryCode: string; // ISO-3166 alpha-2 (e.g. "GB", "DE")
  count: number; // positive integer
};

type ProviderWithPromagenUsers = Provider & {
  promagenUsers?: PromagenUsersCountryUsage[];
};

const ProviderSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    website: z.string().url().optional(),
    affiliateUrl: z.string().url().nullable().optional(),
    score: z.number().int().optional(),
  })
  .passthrough();

const ProvidersSchema = z.array(ProviderSchema);

type ParsedProvider = z.infer<typeof ProviderSchema>;

let providersCache: Provider[] | null = null;

function parseProviders(): Provider[] {
  if (providersCache) return providersCache;

  const parsed = ProvidersSchema.parse(rawProviders) as ParsedProvider[];

  // Sort: highest score first; stable tie-breakers.
  const sorted = [...parsed].sort((a, b) => {
    const as = typeof a.score === 'number' ? a.score : -Infinity;
    const bs = typeof b.score === 'number' ? b.score : -Infinity;

    if (bs !== as) return bs - as;

    // Secondary: name
    const n = a.name.localeCompare(b.name, 'en');
    if (n !== 0) return n;

    // Final: id
    return a.id.localeCompare(b.id, 'en');
  });

  providersCache = sorted as unknown as Provider[];
  return providersCache;
}

/**
 * Base provider list (synchronous).
 * NOTE: This does NOT enrich promagenUsers; pages that want Promagen Users should call
 * getProvidersWithPromagenUsers() and await it (Stage 5 wiring).
 */
export function getProviders(limit = 20): Provider[] {
  const providers = parseProviders();

  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20;
  if (safeLimit <= 0) return [];

  return providers.slice(0, safeLimit);
}

type UsageRow = {
  providerId: string;
  countryCode: string;
  count: number;
};

type UsageSnapshot = {
  updatedAt: Date | null;
  byProvider: Map<string, PromagenUsersCountryUsage[]>;
};

let cachedUsageSnapshot: UsageSnapshot | null = null;
let cachedUsageSnapshotAtMs = 0;

function isStaleSnapshot(nowMs: number): boolean {
  // Cache DB usage snapshot briefly to avoid hammering Postgres on the same SSR request burst.
  // 30 seconds is enough; we also have the 48-hour freshness guard on the data itself.
  const TTL_MS = 30_000;
  return !cachedUsageSnapshot || nowMs - cachedUsageSnapshotAtMs > TTL_MS;
}

function isUsageFresh(updatedAt: Date | null): boolean {
  if (!updatedAt) return false;

  const ageMs = Date.now() - updatedAt.getTime();
  const maxAgeMs = env.analytics.staleAfterHours * 60 * 60 * 1000;

  return ageMs <= maxAgeMs;
}

async function loadUsageSnapshot(providerIds: string[]): Promise<UsageSnapshot> {
  // If DB is not configured, treat as “no data” and keep UI truthful (blank).
  if (!hasDatabaseConfigured()) {
    return { updatedAt: null, byProvider: new Map() };
  }

  // 1) Global freshness check.
  // Data is “fresh” if the aggregate table has been updated recently.
  let updatedAt: Date | null = null;
  try {
    const rows = await db()<Array<{ updatedAt: Date | null }>>`
      select max(updated_at) as "updatedAt"
      from provider_country_usage_30d
    `;
    updatedAt = rows?.[0]?.updatedAt ?? null;
  } catch {
    // Table missing / DB error: treat as no data (truth > vanity).
    return { updatedAt: null, byProvider: new Map() };
  }

  if (!isUsageFresh(updatedAt)) {
    // Self-disabling behaviour (per docs): show blank rather than lie.
    // Use warn so it shows up in Vercel logs.
     
    console.warn(
      `[PromagenUsers] aggregates stale or missing (updatedAt=${
        updatedAt?.toISOString() ?? 'null'
      }). Rendering blank.`,
    );
    return { updatedAt, byProvider: new Map() };
  }

  // 2) Load rows for the providers shown on the page, in one query.
  const uniqueProviderIds = Array.from(new Set(providerIds)).filter(Boolean);
  if (uniqueProviderIds.length === 0) return { updatedAt, byProvider: new Map() };

  let usageRows: UsageRow[] = [];
  try {
    usageRows = await db()<UsageRow[]>`
      select
        provider_id as "providerId",
        country_code as "countryCode",
        user_count as "count"
      from provider_country_usage_30d
      where provider_id = any(${uniqueProviderIds})
    `;
  } catch {
    return { updatedAt, byProvider: new Map() };
  }

  const byProvider = new Map<string, PromagenUsersCountryUsage[]>();

  for (const r of usageRows) {
    const cc = (r.countryCode ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) continue;

    const count = Number.isFinite(r.count) ? Math.floor(r.count) : 0;
    if (count <= 0) continue;

    const list = byProvider.get(r.providerId) ?? [];
    list.push({ countryCode: cc, count });
    byProvider.set(r.providerId, list);
  }

  // Sort and top-slice per provider (UI shows top 6 countries).
  for (const [pid, list] of byProvider.entries()) {
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.countryCode.localeCompare(b.countryCode, 'en');
    });
    byProvider.set(pid, list.slice(0, 6));
  }

  return { updatedAt, byProvider };
}

async function getUsageSnapshot(providerIds: string[]): Promise<UsageSnapshot> {
  const nowMs = Date.now();

  if (!isStaleSnapshot(nowMs) && cachedUsageSnapshot) {
    return cachedUsageSnapshot;
  }

  const snapshot = await loadUsageSnapshot(providerIds);

  cachedUsageSnapshot = snapshot;
  cachedUsageSnapshotAtMs = nowMs;

  return snapshot;
}

/**
 * Enriched provider list (async).
 * This is the Stage 4/5 shape: providers + promagenUsers[] (top 6 by country).
 *
 * Truth rules:
 * - If DB not configured or aggregates stale/unavailable -> returns base providers (no promagenUsers field).
 * - If provider has no users -> returns base provider (no promagenUsers field) so UI renders blank.
 */
export async function getProvidersWithPromagenUsers(
  limit = 20,
): Promise<ProviderWithPromagenUsers[]> {
  const base = getProviders(limit);
  if (base.length === 0) return [];

  const providerIds = base.map((p) => p.id);
  const snapshot = await getUsageSnapshot(providerIds);

  // If snapshot is empty, keep base list untouched.
  if (snapshot.byProvider.size === 0) {
    return base as ProviderWithPromagenUsers[];
  }

  return base.map((p) => {
    const promagenUsers = snapshot.byProvider.get(p.id);
    return promagenUsers && promagenUsers.length > 0
      ? ({ ...p, promagenUsers } as ProviderWithPromagenUsers)
      : (p as ProviderWithPromagenUsers);
  });
}
