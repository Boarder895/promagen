/**
 * TwelveData FX adapter for Promagen.
 *
 * Responsible for:
 * - Calling the TwelveData FX endpoint defined in providers.registry.json
 * - Applying auth from the provider config
 * - Normalising the response into FxRibbonQuote[]
 *
 * Assumptions:
 * - Endpoint in providers.registry.json is "https://api.twelvedata.com/price"
 * - We request multiple FX pairs via a comma-separated "symbol" query parameter,
 *   using symbols like "GBP/USD", "EUR/USD", "USD/JPY", etc.
 * - The response is a JSON object keyed by the symbol string, for example:
 *
 *   {
 *     "GBP/USD": { "price": "1.2634", "timestamp": "2025-12-03 21:15:00" },
 *     "EUR/USD": { "price": "1.0912", "timestamp": "2025-12-03 21:15:00" }
 *   }
 *
 * If your live TwelveData endpoint uses a slightly different path or shape
 * (for example /quote instead of /price, or an array), you only need to adjust
 * the URL construction and normalisation logic below. The gateway contract
 * (FxRibbonQuote[]) stays the same.
 */

import type { ProviderConfig, FxRibbonQuote } from '../index';

interface TwelveDataPriceEntry {
  price?: string | number;
  datetime?: string;
  timestamp?: string;
  [key: string]: unknown;
}

type TwelveDataPriceResponse =
  | Record<string, TwelveDataPriceEntry>
  | { data?: TwelveDataPriceEntry[] }
  | unknown;

/**
 * Homepage + mini-widget pairs, kept in sync with demo and FMP adapters
 * so the ribbon and widgets show the same universe regardless of provider.
 */
const RIBBON_PAIRS: string[] = ['GBPUSD', 'EURUSD', 'USDJPY', 'USDCAD', 'AUDUSD'];

export async function fetchTwelveDataFxQuotes(options: {
  provider: ProviderConfig;
  role: string;
}): Promise<FxRibbonQuote[]> {
  const { provider } = options;

  if (!provider.endpoints.fx_quotes) {
    throw new Error(
      `TwelveData FX adapter: provider "${provider.id}" is missing endpoints.fx_quotes in providers.registry.json`,
    );
  }

  const url = buildTwelveDataFxUrl(provider, RIBBON_PAIRS);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TwelveData FX adapter: HTTP ${response.status} when calling "${url.toString()}"`,
    );
  }

  const raw = (await response.json()) as TwelveDataPriceResponse;

  const quotes = normaliseTwelveDataFxResponse(raw, RIBBON_PAIRS);

  if (!quotes.length) {
    throw new Error(
      `TwelveData FX adapter: no FX quotes returned for requested pairs: ${RIBBON_PAIRS.join(
        ', ',
      )}`,
    );
  }

  return quotes;
}

/**
 * Build the TwelveData URL using the provider's endpoint and auth configuration.
 */
function buildTwelveDataFxUrl(provider: ProviderConfig, pairs: string[]): URL {
  const fxEndpoint = provider.endpoints.fx_quotes;
  if (!fxEndpoint) {
    throw new Error(
      `TwelveData FX adapter: provider "${provider.id}" is missing endpoints.fx_quotes in providers.registry.json`,
    );
  }

  const url = new URL(fxEndpoint);

  // TwelveData typically expects symbols like "GBP/USD" rather than "GBPUSD".
  const apiSymbols = pairs.map(toTwelveDataSymbol);

  url.searchParams.set('symbol', apiSymbols.join(','));

  // Optional: decimal precision, can be tweaked later if needed.
  url.searchParams.set('dp', '6');

  const { auth } = provider;

  if (auth.type === 'query_param') {
    if (!auth.env || !auth.key_name) {
      throw new Error(
        `TwelveData FX adapter: provider "${provider.id}" auth config must include "env" and "key_name" for query_param`,
      );
    }

    const apiKey = process.env[auth.env];

    if (!apiKey) {
      throw new Error(`TwelveData FX adapter: environment variable "${auth.env}" is not set`);
    }

    url.searchParams.set(auth.key_name, apiKey);
  }

  return url;
}

/**
 * Convert a Promagen FX pair like "GBPUSD" into a TwelveData symbol "GBP/USD".
 */
function toTwelveDataSymbol(pair: string): string {
  const normalised = pair.toUpperCase();
  if (normalised.length !== 6) {
    // Failsafe; we expect normal 3+3 FX codes.
    return normalised;
  }
  const base = normalised.slice(0, 3);
  const quote = normalised.slice(3);
  return `${base}/${quote}`;
}

/**
 * Normalise TwelveData's response into FxRibbonQuote[].
 *
 * We mainly care about "price"; change_24h values are left undefined here and
 * can be enhanced later by switching to a richer endpoint (e.g. /quote).
 */
function normaliseTwelveDataFxResponse(
  raw: TwelveDataPriceResponse,
  requestedPairs: string[],
): FxRibbonQuote[] {
  // Common TwelveData multi-symbol shape: object keyed by symbol string.
  const bySymbol = new Map<string, TwelveDataPriceEntry>();

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      // Skip known top-level properties that are not actual symbol keys.
      if (key === 'status' || key === 'message' || key === 'code' || key === 'data') {
        continue;
      }

      if (value && typeof value === 'object') {
        bySymbol.set(key.toUpperCase(), value as TwelveDataPriceEntry);
      }
    }

    // Some TwelveData variants nest under "data" as an array of objects.
    if (Array.isArray((raw as { data?: unknown }).data)) {
      const dataArray = (raw as { data?: TwelveDataPriceEntry[] }).data ?? [];
      for (const entry of dataArray) {
        const symbolKey = deriveSymbolKeyFromEntry(entry);
        if (symbolKey) {
          bySymbol.set(symbolKey.toUpperCase(), entry);
        }
      }
    }
  }

  const result: FxRibbonQuote[] = [];

  for (const pair of requestedPairs) {
    const apiSymbol = toTwelveDataSymbol(pair).toUpperCase();

    const entry =
      bySymbol.get(apiSymbol) ??
      // Some endpoints may return keys without the slash.
      bySymbol.get(pair.toUpperCase());

    if (!entry) {
      continue;
    }

    const price = resolvePrice(entry);

    const normalisedPair = pair.toUpperCase();
    const base = normalisedPair.slice(0, 3);
    const quote = normalisedPair.slice(3);

    result.push({
      pair: normalisedPair,
      base,
      quote,
      price,
      // TwelveData /price does not include change fields;
      // we leave these undefined for now and let the UI handle that gracefully.
      change_24h: undefined,
      change_24h_pct: undefined,
    });
  }

  return result;
}

/**
 * Try to derive a symbol-like key from a data entry if the API returns
 * something like an array of objects instead of a symbol-keyed map.
 */
function deriveSymbolKeyFromEntry(entry: TwelveDataPriceEntry): string | null {
  // TwelveData sometimes surfaces "symbol" or "ticker".
  const maybeSymbol =
    (entry as { symbol?: string; ticker?: string }).symbol ??
    (entry as { symbol?: string; ticker?: string }).ticker;

  if (maybeSymbol && typeof maybeSymbol === 'string') {
    return maybeSymbol;
  }

  return null;
}

/**
 * Extract a usable price from a TwelveData entry.
 */
function resolvePrice(entry: TwelveDataPriceEntry): number {
  const rawPrice = entry.price;

  if (typeof rawPrice === 'number' && Number.isFinite(rawPrice)) {
    return rawPrice;
  }

  if (typeof rawPrice === 'string') {
    const parsed = Number(rawPrice);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error('TwelveData FX adapter: no usable price field found in FX quote');
}
