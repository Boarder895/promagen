/* eslint-disable no-console */
// C:\Users\Proma\Projects\promagen\gateway\adapters\twelvedata.fx.ts

import type { FxRibbonQuote, FxAdapterRequest } from '..';

/**
 * Twelve Data FX adapter for Promagen.
 *
 * Responsibilities:
 * - Call Twelve Data's /price endpoint for each FX pair.
 * - Apply auth from the caller (API key).
 * - Normalise the vendor payload to FxRibbonQuote[].
 */

interface TwelveDataPriceResponse {
  price?: string | number;
  rate?: string | number; // some Twelve Data endpoints use "rate" instead of "price"
  symbol?: string;
  [key: string]: unknown;
}

const DEFAULT_TIMEOUT_MS = 1800;
const PROVIDER_ID = 'twelvedata';
const API_KEY_FIELD = 'apikey';

export default async function twelvedataFxAdapter(
  request: FxAdapterRequest,
): Promise<FxRibbonQuote[]> {
  const { url, apiKey, pairs, timeoutMs = DEFAULT_TIMEOUT_MS } = request;

  if (!url) {
    throw new Error('TwelveData FX adapter: request.url is required');
  }

  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('TwelveData FX adapter: at least one FX pair must be provided');
  }

  if (!apiKey) {
    throw new Error('TwelveData FX adapter: apiKey is required');
  }

  console.info('[twelvedataFxAdapter] starting request', {
    providerId: PROVIDER_ID,
    pairCount: pairs.length,
    pairs,
    timeoutMs,
  });

  const baseEndpoint = new URL(url);
  const quotes: FxRibbonQuote[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const pair of pairs) {
    if (typeof pair !== 'string' || !pair.includes('/')) {
      failureCount += 1;
      console.warn('[twelvedataFxAdapter] skipping invalid FX pair value', {
        providerId: PROVIDER_ID,
        pair,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const endpoint = new URL(baseEndpoint.toString());
    endpoint.searchParams.set('symbol', pair);
    endpoint.searchParams.set(API_KEY_FIELD, apiKey);

    let raw: unknown;

    try {
      raw = await fetchJsonWithTimeout(endpoint.toString(), timeoutMs);
    } catch (error) {
      failureCount += 1;
      console.warn(`[twelvedataFxAdapter] request failed for pair "${pair}"`, {
        providerId: PROVIDER_ID,
        url: endpoint.toString(),
        error:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const asObject = raw && typeof raw === 'object' ? (raw as TwelveDataPriceResponse) : undefined;

    const candidatePrice = asObject?.price ?? asObject?.rate;
    const numericPrice = normalisePrice(candidatePrice);

    if (numericPrice == null) {
      failureCount += 1;
      console.warn(
        `[twelvedataFxAdapter] missing or invalid price for pair "${pair}" from Twelve Data`,
        {
          providerId: PROVIDER_ID,
          url: endpoint.toString(),
          payload: truncateForLog(asObject),
        },
      );
      // eslint-disable-next-line no-continue
      continue;
    }

    const [baseRaw, quoteRaw] = pair.split('/');
    const base = (baseRaw || '').trim();
    const quote = (quoteRaw || '').trim();

    if (!base || !quote) {
      failureCount += 1;
      console.warn(`[twelvedataFxAdapter] could not derive base/quote from pair "${pair}"`, {
        providerId: PROVIDER_ID,
        pair,
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    const providerSymbol =
      typeof asObject?.symbol === 'string' && asObject.symbol.trim().length > 0
        ? asObject.symbol.trim()
        : pair.replace('/', '');

    quotes.push({
      base,
      quote,
      pair,
      price: numericPrice,
      providerSymbol,
    });
    successCount += 1;
  }

  console.info('[twelvedataFxAdapter] completed request', {
    providerId: PROVIDER_ID,
    requestedPairs: pairs.length,
    successCount,
    failureCount,
  });

  if (quotes.length === 0) {
    throw new Error('TwelveData FX adapter: no valid quotes could be produced');
  }

  // We already iterate "pairs" in order, so quotes are in ribbon order.
  return quotes;
}

function normalisePrice(value: string | number | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

/**
 * Small helper to avoid dumping giant payloads into the logs.
 * Shows top-level keys and a tiny sample of values.
 */
function truncateForLog(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);
  const sample: Record<string, unknown> = {};

  for (const key of keys.slice(0, 5)) {
    sample[key] = obj[key];
  }

  return { keys, sample };
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      const body = await response.text().catch(() => '<no body>');
      throw new Error(
        `TwelveData FX adapter: HTTP ${response.status} when calling ${url} – body: ${body.slice(
          0,
          256,
        )}`,
      );
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeoutId);
  }
}
