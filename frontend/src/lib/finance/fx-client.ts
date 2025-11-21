// src/lib/finance/fx-client.ts
// Server-side FX client for Promagen.
//
// - Primary: ExchangeRate-API v6
// - Fallback: exchangerate.host
// - Caches results in memory with different TTLs for live vs fallback
// - Never calls real APIs in NODE_ENV === 'test'

import type { FxQuote, FxProviderId } from '@/types/finance-ribbon';
import freeTierPairsJson from '@/data/fx/fx.pairs.json';
import allPairsJson from '@/data/fx/pairs.json';

type Mode = 'live' | 'fallback';

type FxPairJson = {
  id: string;
  base: string;
  quote: string;
  demo?: {
    value: number;
    asOf?: string;
  };
};

type FxPairConfig = {
  id: string;
  base: string;
  quote: string;
};

// -----------------------------------------------------------------------------
// Single sources of truth for FX pairs
// -----------------------------------------------------------------------------

// Curated free-tier set (used for the homepage ribbon and FX API).
const FREE_TIER_FX_PAIRS = freeTierPairsJson as FxPairJson[];

// Full catalogue for paid tier and richer demo values.
const ALL_FX_PAIRS = allPairsJson as FxPairJson[];

// The pairs we actually price in this client (currently free-tier set).
const FX_PAIRS: FxPairConfig[] = FREE_TIER_FX_PAIRS.map((pair) => ({
  id: String(pair.id),
  base: String(pair.base).toUpperCase(),
  quote: String(pair.quote).toUpperCase(),
}));

// Unique non-USD currency codes used by the free-tier pairs.
// This is what we request from exchangerate.host as symbols.
const FX_CURRENCY_SYMBOLS = Array.from(
  new Set(FX_PAIRS.flatMap((pair) => [pair.base, pair.quote]).filter((code) => code !== 'USD')),
).join(',');

// -----------------------------------------------------------------------------
// Caching / TTL
// -----------------------------------------------------------------------------

// TTLs are per "mode":
// - When primary (ExchangeRate-API) is working, we refresh at most every 30 minutes.
// - When we're on fallback (exchangerate.host), we refresh at most every 60 minutes.
const LIVE_TTL_MS = 30 * 60_000; // 30 minutes
const FALLBACK_TTL_MS = 60 * 60_000; // 60 minutes

type Snapshot = {
  quotes: FxQuote[];
  mode: Mode;
  fetchedAt: number;
};

let snapshot: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

// -----------------------------------------------------------------------------
// Env helpers
// -----------------------------------------------------------------------------

const EXCHANGE_RATE_API_KEY = process.env.PROMAGEN_FX_EXCHANGE_RATE_API_KEY ?? '';

const EXCHANGE_RATE_API_BASE_URL = (
  process.env.PROMAGEN_FX_EXCHANGE_RATE_API_BASE_URL ?? 'https://v6.exchangerate-api.com/v6'
).replace(/\/+$/, ''); // documented default

const EXCHANGERATE_HOST_BASE_URL =
  process.env.PROMAGEN_FX_EXCHANGERATE_HOST_BASE_URL ?? 'https://api.exchangerate.host/latest';

const EXCHANGERATE_HOST_API_KEY = process.env.PROMAGEN_FX_EXCHANGERATE_HOST_API_KEY ?? '';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function now(): number {
  return Date.now();
}

function toFxProviderId(id: FxProviderId | (string & {})): FxProviderId {
  return id as FxProviderId;
}

function isFresh(s: Snapshot): boolean {
  const ttl = s.mode === 'live' ? LIVE_TTL_MS : FALLBACK_TTL_MS;
  return now() - s.fetchedAt < ttl;
}

// -----------------------------------------------------------------------------
// Demo snapshot for tests / hard fallback
// -----------------------------------------------------------------------------

const DEMO_QUOTES: FxQuote[] = FREE_TIER_FX_PAIRS.map((pair) => {
  const match = ALL_FX_PAIRS.find((p) => p.id === pair.id);
  const mid = match?.demo?.value ?? 1;
  const asOf = match?.demo?.asOf ?? new Date('2024-01-01T00:00:00.000Z').toISOString();

  return {
    pairId: String(pair.id),
    mid,
    bid: mid,
    ask: mid,
    asOf,
    provider: toFxProviderId('demo'),
  };
});

// This is what the API route consumes.
export type FxSnapshot = Snapshot;

// Public entry point used by /api/fx
export async function fetchFxSnapshot(): Promise<Snapshot> {
  // Test environment: never hit real providers.
  if (process.env.NODE_ENV === 'test') {
    return {
      quotes: DEMO_QUOTES,
      mode: 'live',
      fetchedAt: now(),
    };
  }

  if (snapshot && isFresh(snapshot)) {
    return snapshot;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = fetchWithProviders().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

// -----------------------------------------------------------------------------
// Provider selection
// -----------------------------------------------------------------------------

async function fetchWithProviders(): Promise<Snapshot> {
  // PRIMARY: ExchangeRate-API v6
  try {
    const quotes = await fetchFromExchangeRateApi();
    const fresh: Snapshot = {
      quotes,
      mode: 'live',
      fetchedAt: now(),
    };
    snapshot = fresh;
    return fresh;
  } catch (primaryError) {
    console.error('[fx] Primary provider (ExchangeRate-API v6) failed', primaryError);
  }

  // FALLBACK: exchangerate.host
  try {
    const quotes = await fetchFromExchangerateHost();
    const fresh: Snapshot = {
      quotes,
      mode: 'fallback',
      fetchedAt: now(),
    };
    snapshot = fresh;
    return fresh;
  } catch (fallbackError) {
    console.error('[fx] Fallback provider (exchangerate.host) failed', fallbackError);
  }

  // Hard fallback: demo data
  const hardFallback: Snapshot = {
    quotes: DEMO_QUOTES,
    mode: 'fallback',
    fetchedAt: now(),
  };
  snapshot = hardFallback;
  return hardFallback;
}

// -----------------------------------------------------------------------------
// Provider: ExchangeRate-API v6 (primary)
// -----------------------------------------------------------------------------

type ExchangeRateApiSuccess = {
  result: 'success';
  time_last_update_utc?: string;
  conversion_rates: Record<string, number>;
};

type ExchangeRateApiError = {
  result: 'error';
  'error-type'?: string;
  error_type?: string;
};

type ExchangeRateApiResponse = ExchangeRateApiSuccess | ExchangeRateApiError;

// We call the Standard endpoint once with base USD and derive all pairs from that.
async function fetchFromExchangeRateApi(): Promise<FxQuote[]> {
  if (!EXCHANGE_RATE_API_KEY) {
    throw new Error(
      'PROMAGEN_FX_EXCHANGE_RATE_API_KEY is required for ExchangeRate-API primary provider',
    );
  }

  const url = `${EXCHANGE_RATE_API_BASE_URL}/${encodeURIComponent(
    EXCHANGE_RATE_API_KEY,
  )}/latest/USD`;

  const res = await fetch(url, {
    method: 'GET',
    // 10s timeout via Next.js fetch timeout or hosting defaults is fine
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`ExchangeRate-API HTTP error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ExchangeRateApiResponse;

  if (
    (json as ExchangeRateApiSuccess).result !== 'success' ||
    !(json as ExchangeRateApiSuccess).conversion_rates
  ) {
    const err = json as ExchangeRateApiError;
    const type = err['error-type'] ?? err.error_type ?? 'unknown';
    throw new Error(`ExchangeRate-API result=error (${type})`);
  }

  const payload = json as ExchangeRateApiSuccess;
  const rates = payload.conversion_rates;

  const asOf = payload.time_last_update_utc ?? new Date().toISOString();

  const quotes: FxQuote[] = FX_PAIRS.map((pair) => {
    const rate = deriveRateFromUsdBase(pair, rates);
    return {
      pairId: pair.id,
      mid: rate,
      bid: rate,
      ask: rate,
      asOf,
      provider: toFxProviderId('exchange-rate-api'),
    };
  });

  return quotes;
}

// -----------------------------------------------------------------------------
// Provider: exchangerate.host (fallback)
// -----------------------------------------------------------------------------

type ExchangerateHostResponse = {
  base: string;
  date?: string;
  rates: Record<string, number>;
};

async function fetchFromExchangerateHost(): Promise<FxQuote[]> {
  // We treat exchangerate.host as a gentle fallback. If the API key is set
  // we pass it via `access_key`, otherwise we try the keyless endpoint.
  const url = new URL(EXCHANGERATE_HOST_BASE_URL);

  // Force base USD so we can reuse the same derivation logic.
  url.searchParams.set('base', 'USD');
  url.searchParams.set('symbols', FX_CURRENCY_SYMBOLS);

  if (EXCHANGERATE_HOST_API_KEY) {
    url.searchParams.set('access_key', EXCHANGERATE_HOST_API_KEY);
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`exchangerate.host HTTP error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as ExchangerateHostResponse;

  if (!json || !json.rates) {
    throw new Error('exchangerate.host: missing rates in response');
  }

  const rates = json.rates;
  const asOf = json.date ? new Date(json.date).toISOString() : new Date().toISOString();

  const quotes: FxQuote[] = FX_PAIRS.map((pair) => {
    const rate = deriveRateFromUsdBase(pair, rates);
    return {
      pairId: pair.id,
      mid: rate,
      bid: rate,
      ask: rate,
      asOf,
      provider: toFxProviderId('exchangerate-host'),
    };
  });

  return quotes;
}

// -----------------------------------------------------------------------------
// Shared rate derivation
// -----------------------------------------------------------------------------

// Given a map of rates with base USD, derive a rate for any of our FX_PAIRS.
//
// Example: if base is USD, rates.EUR = 0.92 means 1 USD = 0.92 EUR.
//
// - For USD -> X, we just return rates[X].
// - For X -> USD, we invert rates[X].
// - For cross (e.g. EUR -> GBP), we use USD as the bridge.
function deriveRateFromUsdBase(pair: FxPairConfig, usdRates: Record<string, number>): number {
  const { base, quote } = pair;

  // Trivial case: USD/USD
  if (base === 'USD' && quote === 'USD') {
    return 1;
  }

  // USD -> X
  if (base === 'USD') {
    const r = usdRates[quote];
    if (!r || r <= 0) {
      throw new Error(`Missing USD->${quote} rate from provider`);
    }
    return r;
  }

  // X -> USD
  if (quote === 'USD') {
    const r = usdRates[base];
    if (!r || r <= 0) {
      throw new Error(`Missing USD->${base} rate from provider`);
    }
    return 1 / r;
  }

  // Cross via USD
  const usdToBase = usdRates[base];
  const usdToQuote = usdRates[quote];

  if (!usdToBase || usdToBase <= 0) {
    throw new Error(`Missing USD->${base} rate from provider`);
  }

  if (!usdToQuote || usdToQuote <= 0) {
    throw new Error(`Missing USD->${quote} rate from provider`);
  }

  return usdToQuote / usdToBase;
}
