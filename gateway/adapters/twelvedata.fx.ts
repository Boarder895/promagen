// C:\Users\Proma\Projects\promagen\gateway\adapters\twelvedata.fx.ts

import type { FxRibbonQuote, FxAdapterRequest } from '..';

/**
 * TwelveData FX adapter for Promagen.
 *
 * Responsibilities:
 * - Build an HTTP request to the TwelveData FX price endpoint.
 * - Apply auth from the caller (API key).
 * - Normalise the vendor payload to FxRibbonQuote[] in canonical ribbon order.
 *
 * Contract:
 * - Input is FxAdapterRequest with:
 *     - pairs: canonical FX pairs in "BASE/QUOTE" form, e.g. "GBP/USD".
 *     - url:   TwelveData price endpoint, e.g. "https://api.twelvedata.com/price".
 * - Output is an array of FxRibbonQuote ordered exactly like the input list.
 * - If no valid quotes can be produced, the adapter throws so the gateway can fall back.
 */

interface TwelveDataRawQuote {
  price?: string | number;
  symbol?: string;
  [key: string]: unknown;
}

/**
 * Main entry point used by the gateway.
 */
export default async function twelvedataFxAdapter(
  request: FxAdapterRequest,
): Promise<FxRibbonQuote[]> {
  const { pairs, url, apiKey, timeoutMs = 3000 } = request;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('TwelveData FX adapter: no FX pairs supplied');
  }

  if (!url) {
    throw new Error('TwelveData FX adapter: missing base URL');
  }

  // Build TwelveData endpoint with comma-separated symbols.
  const endpoint = new URL(url);
  endpoint.searchParams.set('symbol', pairs.join(','));

  if (apiKey) {
    endpoint.searchParams.set('apikey', apiKey);
  }

  const raw = await fetchJsonWithTimeout(endpoint.toString(), timeoutMs);

  // ---- Debug summary (safe: no API key, no full URL) ----
  try {
    const debugSummary: Record<string, unknown> = {};

    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      debugSummary.topLevelKeys = Object.keys(obj).slice(0, 10);
      if ('status' in obj) debugSummary.status = (obj as { status?: unknown }).status;
      if ('code' in obj) debugSummary.code = (obj as { code?: unknown }).code;
      if ('message' in obj) debugSummary.message = (obj as { message?: unknown }).message;
    } else {
      debugSummary.type = typeof raw;
    }

    // eslint-disable-next-line no-console
    console.log('[gateway][debug][twelvedata.fx][payload]', JSON.stringify(debugSummary));
  } catch {
    // Never let logging break the adapter.
  }
  // ------------------------------------------------------

  if (!raw || typeof raw !== 'object') {
    throw new Error('TwelveData FX adapter: unexpected payload shape');
  }

  const quotes: FxRibbonQuote[] = [];

  for (const pair of pairs) {
    const entry = findQuoteEntry(raw, pair);

    if (!entry) {
      continue;
    }

    const price = normalisePrice(entry.price);

    if (price == null) {
      continue;
    }

    const split = pair.split('/');
    const base = (split[0] || '').trim();
    const quote = (split[1] || '').trim();

    if (!base || !quote) {
      continue;
    }

    quotes.push({
      base,
      quote,
      pair,
      price,
      providerSymbol: pair.replace('/', ''),
    });
  }

  if (quotes.length === 0) {
    throw new Error('TwelveData FX adapter: no valid quotes produced for requested ribbon pairs');
  }

  return quotes;
}

/**
 * Try to locate a quote object for a given pair inside an arbitrary TwelveData payload.
 *
 * This is deliberately defensive because TwelveData can return slightly different
 * shapes depending on whether you ask for one symbol or many, and which endpoint
 * is wired up behind the provider URL.
 *
 * Supported shapes:
 *  - { "GBP/USD": { price: "1.23" }, "EUR/USD": { ... } }
 *  - { "GBPUSD": { price: "1.23" }, ... }
 *  - { price: "1.23", ... }   // single-symbol /price response
 *  - { data: [{ symbol: "GBP/USD", price: "1.23" }, ...] }
 *  - { values: [{ symbol: "GBP/USD", price: "1.23" }, ...] }
 */
function findQuoteEntry(raw: unknown, pair: string): TwelveDataRawQuote | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const compactKey = pair.replace('/', '');

  // 1. Direct map with pair as key: { "GBP/USD": { price: ... } }
  const direct = obj[pair];
  const directQuote = asRawQuote(direct);
  if (directQuote) {
    return directQuote;
  }

  // 2. Map keyed by compact symbol: { "GBPUSD": { price: ... } }
  const compact = obj[compactKey];
  const compactQuote = asRawQuote(compact);
  if (compactQuote) {
    return compactQuote;
  }

  // 3. Single-symbol price: { price: "1.23", ... }
  if ('price' in obj) {
    const singleQuote = asRawQuote(obj);
    if (singleQuote && singleQuote.price != null) {
      return singleQuote;
    }
  }

  // 4. Container arrays: { data: [{ symbol, price }], ... } or { values: [...] }
  const containerKeys = ['data', 'values'];

  for (const key of containerKeys) {
    const maybeContainer = obj[key];

    if (Array.isArray(maybeContainer)) {
      for (const item of maybeContainer) {
        const quote = asRawQuote(item);
        if (!quote) {
          continue;
        }

        const rawSymbol = quote.symbol;
        if (typeof rawSymbol !== 'string') {
          continue;
        }

        const symbolUpper = rawSymbol.toUpperCase();
        const wantedSymbols = [pair.toUpperCase(), compactKey.toUpperCase()];

        if (
          wantedSymbols.includes(symbolUpper) ||
          wantedSymbols.includes(symbolUpper.replace('/', ''))
        ) {
          return quote;
        }
      }
    }
  }

  return null;
}

function asRawQuote(value: unknown): TwelveDataRawQuote | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as TwelveDataRawQuote;
}

/**
 * Normalise TwelveData price value into a number.
 */
function normalisePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Simple fetch with optional timeout, mirroring the FMP adapter behaviour.
 * Logs a very small, scrubbed HTTP debug summary (no API keys).
 */
async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, { signal: controller?.signal });

    const safeDebug: Record<string, unknown> = {};
    try {
      const u = new URL(url);
      safeDebug.endpoint = `${u.origin}${u.pathname}`;
      safeDebug.status = response.status;
      const symbols = u.searchParams.get('symbol');
      if (symbols) {
        safeDebug.symbolCount = symbols.split(',').length;
      }
    } catch {
      safeDebug.status = response.status;
    }

    // eslint-disable-next-line no-console
    console.log('[gateway][debug][twelvedata.fx][http]', JSON.stringify(safeDebug));

    if (!response.ok) {
      throw new Error(`TwelveData FX adapter: HTTP ${response.status} from TwelveData`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`TwelveData FX adapter: request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
