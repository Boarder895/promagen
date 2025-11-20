// src/lib/finance/fx-client.ts
// Server-side FX client for Promagen.
// - Primary: exchangerate.host
// - Fallback: ExchangeRate-API
// - Caches results in memory for a short TTL to protect free tiers.

import type { FxQuote, FxProviderId } from '@/types/finance-ribbon';

const TTL_MS = 5 * 60_000; // 5 minutes

type Mode = 'live' | 'fallback';

type FxPairConfig = {
  id: string;
  base: string;
  quote: string;
};

// Core free-tier 5 pairs used by the homepage + mini widget.
// (We still fetch only these; the ribbon/mini widgets can slice/invert as needed.)
const FX_PAIRS: FxPairConfig[] = [
  { id: 'eur-usd', base: 'EUR', quote: 'USD' },
  { id: 'gbp-usd', base: 'GBP', quote: 'USD' },
  { id: 'eur-gbp', base: 'EUR', quote: 'GBP' },
  { id: 'usd-jpy', base: 'USD', quote: 'JPY' },
  { id: 'usd-cny', base: 'USD', quote: 'CNY' },
];

type Snapshot = {
  quotes: FxQuote[];
  mode: Mode;
  fetchedAt: number;
};

let snapshot: Snapshot | null = null;

function now(): number {
  return Date.now();
}

function toFxProviderId(id: string): FxProviderId {
  if (id === 'exchange-rate-api') {
    return 'exchange-rate-api';
  }

  return 'exchangerate-host';
}

/**
 * Fetch a fresh snapshot of FX quotes, with caching and provider fallback.
 * This function is safe to call from any API route; it never touches the browser.
 */
export async function fetchFxSnapshot(): Promise<Snapshot> {
  const current = snapshot;
  const ts = now();

  if (current && ts - current.fetchedAt < TTL_MS) {
    return current;
  }

  // Try primary provider first.
  try {
    const liveQuotes = await fetchFromExchangerateHost();
    snapshot = {
      quotes: liveQuotes,
      mode: 'live',
      fetchedAt: ts,
    };
    return snapshot;
  } catch {
    // Primary failed; fall through to fallback provider.
  }

  // Fallback provider (ExchangeRate-API).
  const fallbackQuotes = await fetchFromExchangeRateApi();
  snapshot = {
    quotes: fallbackQuotes,
    mode: 'fallback',
    fetchedAt: ts,
  };
  return snapshot;
}

type ExchangerateHostResponse = {
  base: string;
  date: string;
  rates: Record<string, number>;
};

async function fetchFromExchangerateHost(): Promise<FxQuote[]> {
  const endpoint =
    process.env.PROMAGEN_FX_EXCHANGERATE_HOST_BASE_URL ?? 'https://api.exchangerate.host/latest';

  // Group symbols by base currency so we can minimise HTTP calls.
  const byBase = new Map<string, Set<string>>();
  for (const pair of FX_PAIRS) {
    const set = byBase.get(pair.base) ?? new Set<string>();
    set.add(pair.quote);
    byBase.set(pair.base, set);
  }

  const results: FxQuote[] = [];

  for (const [base, symbolsSet] of byBase.entries()) {
    const symbols = Array.from(symbolsSet).join(',');
    const url = `${endpoint}?base=${encodeURIComponent(
      base,
    )}&symbols=${encodeURIComponent(symbols)}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`exchangerate.host HTTP ${res.status}`);
    }

    const json = (await res.json()) as ExchangerateHostResponse;
    const asOf = json.date ? new Date(json.date).toISOString() : new Date().toISOString();

    for (const pair of FX_PAIRS) {
      if (pair.base !== base) continue;
      const rate = json.rates[pair.quote];
      if (typeof rate !== 'number') continue;

      results.push({
        pairId: `${pair.base.toLowerCase()}-${pair.quote.toLowerCase()}`,
        mid: rate,
        bid: rate,
        ask: rate,
        asOf,
        provider: toFxProviderId('exchangerate-host'),
      });
    }
  }

  return results;
}

type ExchangeRateApiPairResponse =
  | {
      result: 'success';
      base_code: string;
      target_code: string;
      conversion_rate: number;
      time_last_update_utc: string;
    }
  | {
      result: 'error';
      'error-type': string;
    };

async function fetchFromExchangeRateApi(): Promise<FxQuote[]> {
  const key = process.env.PROMAGEN_FX_EXCHANGE_RATE_API_KEY;
  if (!key) {
    throw new Error('PROMAGEN_FX_EXCHANGE_RATE_API_KEY is not set');
  }

  const baseUrl =
    process.env.PROMAGEN_FX_EXCHANGE_RATE_API_BASE_URL ?? 'https://v6.exchangerate-api.com/v6';

  const results: FxQuote[] = [];

  for (const pair of FX_PAIRS) {
    const url = `${baseUrl}/${encodeURIComponent(key)}/pair/${pair.base}/${pair.quote}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`ExchangeRate-API HTTP ${res.status}`);
    }

    const json = (await res.json()) as ExchangeRateApiPairResponse;

    if (json.result !== 'success') {
      throw new Error(`ExchangeRate-API error: ${json['error-type']}`);
    }

    const rate = json.conversion_rate;
    const asOf = json.time_last_update_utc
      ? new Date(json.time_last_update_utc).toISOString()
      : new Date().toISOString();

    results.push({
      pairId: `${pair.base.toLowerCase()}-${pair.quote.toLowerCase()}`,
      mid: rate,
      bid: rate,
      ask: rate,
      asOf,
      provider: toFxProviderId('exchange-rate-api'),
    });
  }

  return results;
}
