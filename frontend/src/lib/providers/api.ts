// C:\Users\Proma\Projects\promagen\frontend\src\lib\providers\api.ts

import 'server-only';

import { z } from 'zod';
import kv from '@/lib/kv';
import type { Provider } from '@/types/providers';
import rawProviders from '@/data/providers/providers.json';

export type ProvidersApiResponse = Provider[];

export type PromagenUsersCountryUsage = {
  countryCode: string; // ISO-3166 alpha-2 (e.g. "GB", "DE")
  count: number; // positive integer
};

export type ProviderWithPromagenUsers = Provider & {
  /**
   * Analytics-derived only (MUST NOT come from providers.json).
   * If absent or empty, UI must render an empty cell.
   */
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
};

/**
 * KV namespace for per-provider country usage snapshots.
 * Writer-side code is responsible for anti-gaming + dedupe + weighting.
 * Reader-side (here) is tolerant: if KV is unavailable or invalid, we return base providers.
 */
const PROMAGEN_USERS_KV_NAMESPACE = 'promagen_users_by_provider_country';

const TrendSchema = z.enum(['up', 'down', 'flat']);
const SpeedSchema = z.enum(['fast', 'medium', 'slow', 'varies']);

const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().length(2).optional(),

  score: z.number().int().min(0).max(100).optional(),
  trend: TrendSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),

  // URLs / disclosures
  website: z.string().url(),
  // UI may also use `url` as a normalised alias; catalogue can omit it.
  url: z.string().url().optional(),
  affiliateUrl: z.string().url().nullable().optional(),
  requiresDisclosure: z.boolean().optional(),

  // Copy helpers
  tagline: z.string().optional(),
  tip: z.string().optional(),

  // Leaderboard copy columns
  sweetSpot: z.string().optional(),
  visualStyles: z.string().optional(),

  // Optional columns (may be absent in providers.json; kept for forwards compatibility)
  apiAvailable: z.boolean().optional(),
  affiliateProgramme: z.boolean().optional(),
  generationSpeed: SpeedSchema.optional(),
  affordability: z.string().optional(),

  // Prompt builder UX
  supportsPrefill: z.boolean().optional(),

  // Future categorisation (optional)
  group: z.string().optional(),
  tier: z.string().optional(),
});

const ProvidersSchema = z.array(ProviderSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const p of arr) {
    if (seen.has(p.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate provider id: ${p.id}`,
      });
    }
    seen.add(p.id);
  }
});

const PromagenUsersSchema = z.array(
  z.object({
    countryCode: z.string().length(2),
    count: z.number().int().positive(),
  }),
);

/**
 * Normalise provider records for UI usage.
 * - ensure `url` is present (alias of `website` unless explicitly set)
 * - coerce nullable/boolean defaults without inventing new data
 */
function normaliseProvider(p: Provider): Provider {
  const website = (p.website ?? '').trim();
  const url = (p.url ?? p.website ?? '').trim();

  return {
    ...p,
    website,
    url,
    affiliateUrl: p.affiliateUrl ?? null,
    requiresDisclosure: p.requiresDisclosure ?? false,
    supportsPrefill: p.supportsPrefill ?? false,
  };
}

let cachedProviders: Provider[] | null = null;

function loadProvidersCatalogue(): Provider[] {
  if (cachedProviders) return cachedProviders;

  const parsed = ProvidersSchema.parse(rawProviders) as Provider[];
  cachedProviders = parsed.map(normaliseProvider);
  return cachedProviders;
}

/**
 * Load providers from JSON, validate with Zod, normalise website/url, and optionally slice.
 * This runs on the server only; there are no client bundles for the JSON.
 */
export function getProviders(limit?: number): ProvidersApiResponse {
  const providers = loadProvidersCatalogue();

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return providers.slice(0, Math.floor(limit));
  }

  return providers;
}

/**
 * Fetch analytics-derived “Promagen Users” per provider (top countries by usage).
 * Tolerant by design: failures must not break page render.
 */
async function getPromagenUsersForProvider(
  providerId: string,
): Promise<PromagenUsersCountryUsage[] | undefined> {
  try {
    const raw = await kv.get<unknown>(PROMAGEN_USERS_KV_NAMESPACE, providerId);
    if (!raw) return undefined;

    const parsed = PromagenUsersSchema.safeParse(raw);
    if (!parsed.success) return undefined;

    // Normalise + sort highest-first (writer should already do this, but we don’t trust inputs blindly)
    return parsed.data
      .map((u) => ({
        countryCode: u.countryCode.trim().toUpperCase(),
        count: Math.floor(u.count),
      }))
      .filter((u) => u.countryCode.length === 2 && Number.isFinite(u.count) && u.count > 0)
      .sort((a, b) => b.count - a.count);
  } catch {
    return undefined;
  }
}

/**
 * Server helper for leaderboard pages: base providers + analytics-derived promagenUsers.
 * NOTE: promagenUsers must NEVER be sourced from providers.json.
 */
export async function getProvidersWithPromagenUsers(
  limit?: number,
): Promise<ProviderWithPromagenUsers[]> {
  const base = getProviders(limit);

  // Avoid failing the whole render if KV is unavailable.
  const enriched = await Promise.all(
    base.map(async (p) => {
      const promagenUsers = await getPromagenUsersForProvider(p.id);
      return promagenUsers && promagenUsers.length > 0
        ? ({ ...p, promagenUsers } as ProviderWithPromagenUsers)
        : (p as ProviderWithPromagenUsers);
    }),
  );

  return enriched;
}
