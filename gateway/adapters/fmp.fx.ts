/**
 * FinancialModelingPrep FX adapter for Promagen.
 *
 * Responsible for:
 * - Calling the FMP FX endpoint defined in providers.registry.json
 * - Applying auth from the provider config
 * - Normalising the response into FxRibbonQuote[]
 *
 * Notes:
 * - This implementation assumes an endpoint that accepts a comma-separated list
 *   of FX symbols via a "symbol" query parameter, e.g.:
 *   https://financialmodelingprep.com/api/v3/fx?symbol=GBPUSD,EURUSD&apikey=...
 * - If your actual FMP FX endpoint differs, you only need to adjust the URL
 *   building and response-mapping logic below; the gateway contract remains
 *   unchanged.
 */

import type { ProviderConfig, FxRibbonQuote } from '../index';

interface FmpFxRawQuote {
  symbol?: string; // e.g. "GBPUSD"
  ticker?: string;
  name?: string;
  bid?: number;
  ask?: number;
  price?: number;
  last?: number;
  changesPercentage?: number;
  change?: number;
  open?: number;
  previousClose?: number;
}

/**
 * Homepage + mini-widget pairs for now.
 * These match the demo adapter, so live and demo stay visually aligned.
 */
const RIBBON_PAIRS: string[] = ['GBPUSD', 'EURUSD', 'USDJPY', 'USDCAD', 'AUDUSD'];

export async function fetchFmpFxQuotes(options: {
  provider: ProviderConfig;
  role: string;
}): Promise<FxRibbonQuote[]> {
  const { provider } = options;

  if (!provider.endpoints.fx_quotes) {
    throw new Error(
      `FMP FX adapter: provider "${provider.id}" is missing endpoints.fx_quotes in providers.registry.json`,
    );
  }

  const url = buildFmpFxUrl(provider, RIBBON_PAIRS);
  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`FMP FX adapter: HTTP ${response.status} when calling "${url.toString()}"`);
  }

  const data = (await response.json()) as FmpFxRawQuote[] | FmpFxRawQuote | unknown;

  const quotes = normaliseFmpFxResponse(data, RIBBON_PAIRS);

  if (!quotes.length) {
    throw new Error(
      `FMP FX adapter: no FX quotes returned for requested pairs: ${RIBBON_PAIRS.join(', ')}`,
    );
  }

  return quotes;
}

/**
 * Build the FMP URL using the provider's endpoint and auth configuration.
 */
function buildFmpFxUrl(provider: ProviderConfig, pairs: string[]): URL {
  const fxEndpoint = provider.endpoints.fx_quotes;
  if (!fxEndpoint) {
    throw new Error(
      `FMP FX adapter: provider "${provider.id}" is missing endpoints.fx_quotes in providers.registry.json`,
    );
  }

  const url = new URL(fxEndpoint);

  // Add the requested pairs as a comma-separated symbol list.
  // Adjust this if your live endpoint expects a different parameter shape.
  url.searchParams.set('symbol', pairs.join(','));

  const { auth } = provider;

  if (auth.type === 'query_param') {
    if (!auth.env || !auth.key_name) {
      throw new Error(
        `FMP FX adapter: provider "${provider.id}" auth config must include "env" and "key_name" for query_param`,
      );
    }

    const apiKey = process.env[auth.env];

    if (!apiKey) {
      throw new Error(`FMP FX adapter: environment variable "${auth.env}" is not set`);
    }

    url.searchParams.set(auth.key_name, apiKey);
  }

  return url;
}

/**
 * Normalise the FMP FX payload into FxRibbonQuote[].
 *
 * FMP's JSON shape can vary slightly between endpoints, so this function is
 * intentionally defensive and looks at both "symbol" and "ticker" fields.
 */
function normaliseFmpFxResponse(raw: unknown, requestedPairs: string[]): FxRibbonQuote[] {
  const items: FmpFxRawQuote[] = Array.isArray(raw) ? raw : raw ? [raw as FmpFxRawQuote] : [];

  if (!items.length) {
    return [];
  }

  const bySymbol = new Map<string, FmpFxRawQuote>();

  for (const item of items) {
    const symbol = (item.symbol || item.ticker || '').toUpperCase();
    if (!symbol) {
      continue;
    }
    bySymbol.set(symbol, item);
  }

  const result: FxRibbonQuote[] = [];

  for (const pair of requestedPairs) {
    const symbol = pair.toUpperCase();
    const rawQuote = bySymbol.get(symbol);

    if (!rawQuote) {
      // If the API does not return a given pair, we skip it rather than inventing data.
      continue;
    }

    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3);

    const price = resolvePrice(rawQuote);
    const { changeAbs, changePct } = resolveChange(rawQuote, price);

    const bid =
      typeof rawQuote.bid === 'number' && Number.isFinite(rawQuote.bid) ? rawQuote.bid : undefined;

    const ask =
      typeof rawQuote.ask === 'number' && Number.isFinite(rawQuote.ask) ? rawQuote.ask : undefined;

    result.push({
      pair: symbol,
      base,
      quote,
      price,
      bid,
      ask,
      change_24h: changeAbs,
      change_24h_pct: changePct,
    });
  }

  return result;
}

/**
 * Pick a sensible price field from the FMP payload.
 * We prefer "price" or "last", and fall back to "bid" if necessary.
 */
function resolvePrice(raw: FmpFxRawQuote): number {
  const candidates = [raw.price, raw.last, raw.bid, raw.ask];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  throw new Error('FMP FX adapter: no usable price field found in FX quote');
}

/**
 * Work out absolute and percentage change, if FMP provides it.
 * If only percentage is provided, we derive the absolute; if only absolute is
 * provided we derive the percentage; if neither, we leave both undefined.
 */
function resolveChange(
  raw: FmpFxRawQuote,
  price: number,
): { changeAbs?: number; changePct?: number } {
  const changeAbs =
    typeof raw.change === 'number' && Number.isFinite(raw.change) ? raw.change : undefined;

  const changePct =
    typeof raw.changesPercentage === 'number' && Number.isFinite(raw.changesPercentage)
      ? raw.changesPercentage
      : undefined;

  if (changeAbs != null && changePct != null) {
    return { changeAbs, changePct };
  }

  if (changeAbs != null && price !== 0) {
    return {
      changeAbs,
      changePct: round4((changeAbs / (price - changeAbs)) * 100),
    };
  }

  if (changePct != null) {
    const abs = round4((price * changePct) / (100 + changePct));
    return {
      changeAbs: abs,
      changePct,
    };
  }

  return {};
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
