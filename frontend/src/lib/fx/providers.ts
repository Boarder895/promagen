// C:\Users\Proma\Projects\promagen\frontend\src\lib\fx\providers.ts
// -----------------------------------------------------------------------------
// FX provider + server-side ribbon loader (Twelve Data only).
//
// Rules (as requested):
// - Disregard all API providers apart from Twelve Data.
// - No demo mode. No demo fallback. Ever.
// - SSOT for ribbon pairs is derived from:
//     src/data/fx/fx.pairs.json + src/data/fx/pairs.json (via fx-pairs.ts)
// - Cache results in-memory for 30 minutes (server-side) to protect quotas.
//
// Notes:
// - Twelve Data /price expects: symbol=GBP/USD&apikey=...
// - We return change/changePct as null because /price doesn't supply them.
// -----------------------------------------------------------------------------

import rawProviders from '@/data/fx/providers.json';
import { assertFxRibbonSsotValid, getFxRibbonPairs, buildSlashPair } from '@/lib/finance/fx-pairs';
import type { FxApiResponse, FxApiQuote, FxApiMode } from '@/types/finance-ribbon';

export type FxProviderTier = 'primary' | 'fallback' | 'unknown';

export interface FxProviderMeta {
  id: string;
  name: string;
  tier: FxProviderTier | string;
  role: string;
  url: string;
  copy: string;
}

const PROVIDERS: FxProviderMeta[] = (rawProviders as FxProviderMeta[])
  .map((p) => ({ ...p, id: String(p.id).toLowerCase() }))
  .filter((p) => p.id === 'twelvedata'); // enforce Twelve Data only

const providersById = new Map<string, FxProviderMeta>();
for (const provider of PROVIDERS) providersById.set(provider.id, provider);

export function getFxProviderMeta(id: string | null | undefined): FxProviderMeta | null {
  if (!id) return null;
  return providersById.get(id.toLowerCase()) ?? null;
}

export interface FxProviderSummary {
  meta: FxProviderMeta;
  modeLabel: string;
  provenanceLabel: string;
  emphasiseFallback: boolean;
}

export function getFxProviderSummary(
  mode: FxApiMode | null | undefined,
  providerId: string | null | undefined,
): FxProviderSummary {
  const meta = getFxProviderMeta(providerId) ??
    getFxProviderMeta('twelvedata') ?? {
      id: 'twelvedata',
      name: 'Twelve Data',
      tier: 'primary',
      role: 'Primary FX provider',
      url: 'https://twelvedata.com',
      copy: 'Primary live FX quotes provider (Twelve Data).',
    };

  const modeLabel = mode === 'cached' ? 'Cached data' : 'Live data';

  return {
    meta,
    modeLabel,
    provenanceLabel: meta.copy,
    emphasiseFallback: false, // there is no fallback
  };
}

// -----------------------------------------------------------------------------
// Server-side loader used by /api/fx
// -----------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60_000;

type FxRibbonCache = {
  expiresAt: number;
  payload: FxApiResponse;
};

let ribbonCache: FxRibbonCache | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function buildId(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev';
}

function buildResponse(mode: FxApiMode, quotes: FxApiQuote[]): FxApiResponse {
  return {
    meta: {
      buildId: buildId(),
      mode,
      sourceProvider: 'twelvedata',
      asOf: nowIso(),
    },
    data: quotes,
  };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<no body>');
      throw new Error(`HTTP ${res.status} for ${url} :: ${body.slice(0, 200)}`);
    }

    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------- Twelve Data ----------------------------------

type TwelveDataPriceResponse = {
  price?: string | number;
  rate?: string | number;
  status?: string;
  message?: string;
  code?: number | string;
};

async function fetchTwelveDataPrice(pairSlash: string, apiKey: string): Promise<number | null> {
  const endpoint = new URL('https://api.twelvedata.com/price');
  endpoint.searchParams.set('symbol', pairSlash);
  endpoint.searchParams.set('apikey', apiKey);

  const raw = (await fetchJsonWithTimeout(endpoint.toString(), 8_000)) as TwelveDataPriceResponse;

  // Twelve Data sometimes returns { status:"error", message:"..." }
  if (typeof raw?.status === 'string' && raw.status.toLowerCase() === 'error') {
    return null;
  }

  const v = raw?.price ?? raw?.rate;
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

// ---------------------------- Main entry point ------------------------------

export async function getFxRibbon(): Promise<FxApiResponse> {
  const now = Date.now();

  // 30-min in-memory cache (server-side)
  if (ribbonCache && ribbonCache.expiresAt > now) {
    return {
      ...ribbonCache.payload,
      meta: {
        ...ribbonCache.payload.meta,
        mode: 'cached',
      },
    };
  }

  assertFxRibbonSsotValid();
  const pairs = getFxRibbonPairs();

  const twelveKey = (process.env.TWELVEDATA_API_KEY ?? '').trim();
  if (!twelveKey) {
    throw new Error('FX: TWELVEDATA_API_KEY is missing. Twelve Data is the only allowed provider.');
  }

  const quotes: FxApiQuote[] = [];
  let anyPrice = false;

  // Sequential requests: helps stay well inside Twelve Data’s per-minute limits.
  for (const p of pairs) {
    const base = String(p.base).toUpperCase();
    const quote = String(p.quote).toUpperCase();

    const slash = buildSlashPair(base, quote);
    const price = await fetchTwelveDataPrice(slash, twelveKey);

    if (price !== null) anyPrice = true;

    quotes.push({
      id: p.id, // must match SSOT id (e.g. "gbp-usd") for the UI join
      base,
      quote,
      label: p.label,
      category: p.category ?? 'fx',
      price,
      change: null,
      changePct: null,
    });
  }

  if (!anyPrice) {
    throw new Error('FX: Twelve Data returned no valid prices for the ribbon pairs.');
  }

  const payload = buildResponse('live', quotes);
  ribbonCache = { payload, expiresAt: now + CACHE_TTL_MS };

  return payload;
}
