// C:\Users\Proma\Projects\promagen\frontend\src\lib\fx\providers.ts

import type { FxQuotesPayload } from '@/types/finance-ribbon';
import rawProviders from '@/data/fx/providers.json';

export type FxProviderTier = 'primary' | 'fallback' | 'demo';

export interface FxProviderMeta {
  id: string;
  name: string;
  tier: FxProviderTier;
  role: string;
  url: string;
  copy: string;
}

const PROVIDERS: FxProviderMeta[] = (rawProviders as FxProviderMeta[]).map((provider) => ({
  ...provider,
  id: provider.id.toLowerCase(),
}));

const providersById = new Map<string, FxProviderMeta>();
for (const provider of PROVIDERS) {
  providersById.set(provider.id, provider);
}

export function getFxProviderMeta(id: string | null | undefined): FxProviderMeta | null {
  if (!id) return null;
  const normalised = id.toLowerCase();
  return providersById.get(normalised) ?? null;
}

export interface FxProviderSummary {
  meta: FxProviderMeta;
  modeLabel: string;
  provenanceLabel: string;
  emphasiseFallback: boolean;
}

/**
 * Picks the right provider metadata for a given FX payload mode
 * and provider ID.
 *
 * Rules:
 *  - If mode === 'demo' → always use the 'demo' provider entry.
 *  - Otherwise, use the given providerId if recognised.
 *  - If that fails, fall back to 'exchange-rate-api' if present.
 *  - If all else fails, return a neutral "Unknown provider" meta.
 */
export function getFxProviderSummary(
  mode: FxQuotesPayload['mode'] | null | undefined,
  providerId: string | null | undefined,
): FxProviderSummary {
  let meta: FxProviderMeta | null = null;

  if (mode === 'demo') {
    meta = getFxProviderMeta('demo');
  } else {
    meta = getFxProviderMeta(providerId) ?? getFxProviderMeta('exchange-rate-api') ?? null;
  }

  if (!meta) {
    meta = {
      id: 'unknown',
      name: 'Unknown provider',
      tier: 'demo',
      role: 'Unknown FX provider',
      url: '#',
      copy: 'Provider information is not available.',
    };
  }

  let modeLabel: string;
  switch (mode) {
    case 'live':
      modeLabel = 'Live data';
      break;
    case 'fallback':
      modeLabel = 'Fallback data';
      break;
    case 'demo':
      modeLabel = 'Demo data';
      break;
    default:
      modeLabel = 'FX data';
  }

  const emphasiseFallback = mode === 'fallback' || meta.tier === 'fallback';

  const provenanceLabel = mode === 'demo' ? 'Illustrative only — not for trading.' : meta.copy;

  return {
    meta,
    modeLabel,
    provenanceLabel,
    emphasiseFallback,
  };
}
