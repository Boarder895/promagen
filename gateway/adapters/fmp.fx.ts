/**
 * FMP FX adapter for Promagen.
 *
 * Responsibilities:
 * - Build an HTTP request to the FMP forex quote endpoint.
 * - Apply auth from the caller (API key).
 * - Normalise the vendor payload to FxRibbonQuote[] in canonical ribbon order.
 *
 * Contract:
 * - Input is a list of canonical FX pairs in "BASE/QUOTE" form, e.g. "GBP/USD".
 * - Output is an array of FxRibbonQuote ordered exactly like the input list.
 * - If no valid quotes can be produced, the adapter throws so the gateway can fall back.
 *
 * This file is deliberately self-contained for now: no imports from the
 * gateway index. The rest of the gateway will be wired up to this contract.
 */

export interface FxRibbonQuote {
  base: string;
  quote: string;
  /**
   * Canonical pair string, e.g. "GBP/USD".
   */
  pair: string;
  /**
   * Latest trade / mid price in quote currency.
   */
  price: number;
  /**
   * Absolute 24-hour change, if the provider exposes it.
   */
  change_24h?: number;
  /**
   * 24-hour percentage change, if the provider exposes it.
   */
  change_24h_pct?: number;
  /**
   * Symbol as the provider knows it, e.g. "GBPUSD".
   */
  providerSymbol: string;
}

/**
 * Request shape for live FX adapters.
 *
 * The gateway (or API route) is responsible for:
 * - Supplying the canonical ribbon pairs in "BASE/QUOTE" form.
 * - Passing the fully-qualified endpoint URL from providers.registry.json.
 * - Injecting the API key from the relevant environment variable.
 */
export interface FxAdapterRequest {
  /**
   * Canonical ribbon pairs, e.g. ["GBP/USD", "EUR/USD", "USD/JPY"].
   */
  pairs: string[];
  /**
   * Fully-qualified endpoint URL, e.g.
   * "https://financialmodelingprep.com/stable/batch-forex-quotes"
   * or "https://financialmodelingprep.com/stable/quote".
   */
  url: string;
  /**
   * Provider API key, or null / undefined when the provider does not need one.
   */
  apiKey?: string | null;
  /**
   * Optional timeout in milliseconds. Defaults to 3000ms.
   */
  timeoutMs?: number;
}

type FmpRawQuote = {
  symbol?: string;
  name?: string;
  price?: number | string;
  change?: number | string;
  changesPercentage?: number | string;
  [key: string]: unknown;
};

/**
 * Default export used by the gateway for the FMP provider.
 */
export default async function fmpFxAdapter(request: FxAdapterRequest): Promise<FxRibbonQuote[]> {
  const { pairs, url, apiKey, timeoutMs = 3000 } = request;

  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('FMP FX adapter: no FX pairs supplied');
  }

  const symbols = pairs.map((pair) => toFmpSymbol(pair));
  const endpoint = new URL(url);

  endpoint.searchParams.set('symbol', symbols.join(','));

  if (apiKey) {
    endpoint.searchParams.set('apikey', apiKey);
  }

  const rawPayload = await fetchJsonWithTimeout(endpoint.toString(), timeoutMs);

  if (!Array.isArray(rawPayload)) {
    throw new Error('FMP FX adapter: unexpected response shape (expected an array of quotes)');
  }

  const byCanonicalPair = new Map<string, FxRibbonQuote>();

  for (const item of rawPayload) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const quote = normaliseFmpQuote(item as FmpRawQuote);
    if (!quote) {
      continue;
    }

    byCanonicalPair.set(quote.pair, quote);
  }

  const orderedQuotes = buildOrderedQuotes(pairs, byCanonicalPair);

  if (orderedQuotes.length === 0) {
    throw new Error('FMP FX adapter: no valid quotes produced for requested ribbon pairs');
  }

  return orderedQuotes;
}

/**
 * Convert FMP raw quote object into an internal FxRibbonQuote.
 * Returns null when the price or symbol cannot be resolved.
 */
function normaliseFmpQuote(raw: FmpRawQuote): FxRibbonQuote | null {
  const rawSymbol =
    typeof raw.symbol === 'string' && raw.symbol.trim().length > 0 ? raw.symbol.trim() : null;

  if (!rawSymbol) {
    return null;
  }

  const { base, quote, canonical } = parsePair(rawSymbol);

  const price = extractNumericField(raw, ['price']);
  if (price == null) {
    return null;
  }

  const change = extractNumericField(raw, ['change']);
  const changePct = extractNumericField(raw, ['changesPercentage']);

  return {
    base,
    quote,
    pair: canonical,
    price,
    change_24h: change ?? undefined,
    change_24h_pct: changePct ?? undefined,
    providerSymbol: rawSymbol,
  };
}

/**
 * Build FxRibbonQuote[] ordered exactly like the requested ribbon pairs.
 * Missing pairs are simply skipped.
 */
function buildOrderedQuotes(
  requestedPairs: string[],
  byCanonicalPair: Map<string, FxRibbonQuote>,
): FxRibbonQuote[] {
  const result: FxRibbonQuote[] = [];

  for (const pair of requestedPairs) {
    const { canonical } = parsePair(pair);
    const quote = byCanonicalPair.get(canonical);
    if (quote) {
      result.push(quote);
    }
  }

  return result;
}

/**
 * Helper to convert canonical "GBP/USD" style pair into FMP's compact
 * "GBPUSD" symbol.
 */
function toFmpSymbol(pair: string): string {
  const { base, quote } = parsePair(pair);
  return `${base}${quote}`;
}

/**
 * Parse an FX pair in either "GBP/USD" or "GBPUSD" form and return
 * base, quote, and canonical "BASE/QUOTE".
 *
 * This version is tightened up to keep TypeScript happy: we guard
 * rawBase / rawQuote before calling .trim(), so they are never possibly
 * undefined when we use them.
 */
function parsePair(input: string): {
  base: string;
  quote: string;
  canonical: string;
} {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('FMP FX adapter: empty FX pair');
  }

  if (trimmed.includes('/')) {
    const [rawBase, rawQuote] = trimmed.split('/');

    if (!rawBase || !rawQuote) {
      throw new Error(`FMP FX adapter: invalid FX pair "${input}"`);
    }

    const base = rawBase.trim().toUpperCase();
    const quote = rawQuote.trim().toUpperCase();

    if (!base || !quote) {
      throw new Error(`FMP FX adapter: invalid FX pair "${input}"`);
    }

    return { base, quote, canonical: `${base}/${quote}` };
  }

  if (trimmed.length === 6) {
    const base = trimmed.slice(0, 3).toUpperCase();
    const quote = trimmed.slice(3).toUpperCase();
    return { base, quote, canonical: `${base}/${quote}` };
  }

  throw new Error(`FMP FX adapter: unsupported FX pair format "${input}"`);
}

/**
 * Extract a numeric field from a record, accepting both numbers and
 * numeric strings. Returns null if no usable value was found.
 */
function extractNumericField(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Minimal fetch wrapper with a per-request timeout. Throws a clear error
 * when the request fails or times out.
 */
async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  try {
    const response = await fetch(url, { signal: controller?.signal });

    if (!response.ok) {
      throw new Error(`FMP FX adapter: HTTP ${response.status} from ${url}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`FMP FX adapter: request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
