// src/lib/providers/api.ts

import { z } from 'zod';
import type { Provider } from '@/types/provider';
import rawProviders from '@/data/providers/providers.json';

const ProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
  trend: z.enum(['up', 'down', 'flat']).optional(),
  tags: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  affiliateUrl: z.string().url().nullable().optional(),
  requiresDisclosure: z.boolean().optional(),
  tagline: z.string().optional(),
});

const ProvidersSchema = z.array(ProviderSchema);

export type ProvidersApiResponse = ReadonlyArray<Provider>;

/**
 * Load providers from JSON, validate with Zod, and optionally slice.
 * This runs on the server only; there are no client bundles for the JSON.
 */
export function getProviders(limit?: number): ProvidersApiResponse {
  const parsed = ProvidersSchema.parse(rawProviders) as ProvidersApiResponse;

  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return parsed.slice(0, limit);
  }

  return parsed;
}
