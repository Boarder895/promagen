// C:\Users\Proma\Projects\promagen\frontend\src\app\api\fx\route.ts

import { NextResponse } from 'next/server';
import { getFxRibbon } from '../../../../../gateway';

/**
 * FX API route (/api/fx)
 *
 * Thin wrapper over the Promagen API Gateway.
 *
 * Responsibilities:
 * - Ask the gateway for the homepage FX ribbon snapshot.
 * - Normalise it into a stable `meta` + `data` JSON structure.
 * - Always include a build identifier so tests can assert a stable contract.
 *
 * In tests (NODE_ENV === 'test') this route forces the `demo` provider so
 * we never burn live API quota.
 */

const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local-dev';

/**
 * DTO shape exposed to the frontend for each FX pair.
 */
interface FxApiPairDto {
  id: string;
  base: string;
  quote: string;
  label: string;
  category: string;
  emoji?: string;
  /**
   * Latest price (quote currency per 1 unit of base currency).
   */
  price: number | null;
  /**
   * Absolute change over the last period (e.g. since previous close).
   */
  change: number | null;
  /**
   * Percentage change over the last period.
   */
  changePct: number | null;
}

/**
 * Successful API response body.
 */
interface FxApiSuccessResponse {
  meta: {
    buildId: string;
    /**
     * Gateway mode – lets the UI know whether we’re live, falling back, cached, or in demo.
     */
    mode: 'live' | 'fallback' | 'cached' | 'demo';
    /**
     * Provider that actually produced the data.
     */
    sourceProvider: string;
    /**
     * ISO timestamp from the gateway, marking when the data snapshot was taken.
     */
    asOf: string;
  };
  data: FxApiPairDto[];
}

/**
 * Error API response body.
 */
interface FxApiErrorResponse {
  meta: {
    buildId: string;
  };
  error: string;
}

/**
 * Internal, normalised representation of a single FX pair record that we
 * expect back from the gateway.
 */
interface NormalisedFxPairRecord {
  id: string;
  base: string;
  quote: string;
  category: string;
  emoji?: string;
  label: string;
  price: number;
  /**
   * Absolute change over the provider's 24h window.
   */
  changeAbs: number;
  /**
   * Percentage change over the provider's 24h window.
   */
  changePct: number;
  /**
   * Raw provider symbol, if available (e.g. "GBPUSD" or "GBP/USD").
   */
  providerSymbol?: string;
}

/**
 * Convert a raw FX pair record from the gateway into our internal shape.
 *
 * This function is deliberately tolerant of multiple historical shapes:
 * - The current FxRibbonQuote shape from the gateway (base, quote, pair, price, change_24h, change_24h_pct, providerSymbol).
 * - Older shapes that used id/symbol/pairId, changeAbs/changePct, etc.
 */
function normaliseFxPairRecord(rawPair: unknown): NormalisedFxPairRecord | null {
  if (!rawPair || typeof rawPair !== 'object') {
    return null;
  }

  const pairRecord = rawPair as Record<string, unknown>;

  // Base / quote – prefer explicit fields, but fall back to splitting pair/symbol if needed.
  const rawBase =
    pairRecord.base ?? pairRecord.baseCurrency ?? pairRecord.currency_base ?? pairRecord.from;

  const rawQuote =
    pairRecord.quote ?? pairRecord.quoteCurrency ?? pairRecord.currency_quote ?? pairRecord.to;

  let base =
    typeof rawBase === 'string' && rawBase.trim().length > 0 ? rawBase.trim().toUpperCase() : '';

  let quote =
    typeof rawQuote === 'string' && rawQuote.trim().length > 0 ? rawQuote.trim().toUpperCase() : '';

  // Some payloads only have a combined symbol/pair – derive base/quote from that.
  const rawPairId = pairRecord.pair ?? pairRecord.symbol ?? pairRecord.providerSymbol;
  let pairStr =
    typeof rawPairId === 'string' && rawPairId.trim().length > 0
      ? rawPairId.trim().toUpperCase()
      : '';

  if ((!base || !quote) && pairStr) {
    const slashIndex = pairStr.indexOf('/');
    if (slashIndex > 0) {
      base = base || pairStr.slice(0, slashIndex);
      quote = quote || pairStr.slice(slashIndex + 1);
    } else if (pairStr.length === 6) {
      base = base || pairStr.slice(0, 3);
      quote = quote || pairStr.slice(3);
    }
  }

  if (!base || !quote) {
    return null;
  }

  if (!pairStr) {
    pairStr = `${base}/${quote}`;
  }

  // Identifier – prefer explicit id, then providerSymbol, then pair.
  const rawId =
    pairRecord.id ??
    pairRecord.providerSymbol ??
    pairRecord.symbol ??
    pairRecord.pair ??
    `${base}${quote}`;

  const id =
    typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : `${base}${quote}`;

  const categoryValue = pairRecord.category ?? 'fx_major';
  const category =
    typeof categoryValue === 'string' && categoryValue.trim().length > 0
      ? categoryValue.trim()
      : 'fx_major';

  const emojiValue = pairRecord.emoji;
  const emoji =
    typeof emojiValue === 'string' && emojiValue.trim().length > 0 ? emojiValue.trim() : undefined;

  const labelValue = pairRecord.label ?? `${base}/${quote}`;
  const label =
    typeof labelValue === 'string' && labelValue.trim().length > 0
      ? labelValue.trim()
      : `${base}/${quote}`;

  const rawPrice = pairRecord.price ?? pairRecord.last ?? pairRecord.rate;
  const price =
    typeof rawPrice === 'number'
      ? rawPrice
      : typeof rawPrice === 'string' && rawPrice.trim().length > 0
      ? Number(rawPrice)
      : NaN;

  if (!Number.isFinite(price)) {
    return null;
  }

  // Allow both the newer change_24h / change_24h_pct fields and the older
  // changeAbs / changePct names coming from the gateway.
  const rawChangeAbs = pairRecord.changeAbs ?? pairRecord.change_24h;
  const changeAbs =
    typeof rawChangeAbs === 'number'
      ? rawChangeAbs
      : typeof rawChangeAbs === 'string' && rawChangeAbs.trim().length > 0
      ? Number(rawChangeAbs)
      : 0;

  const rawChangePct = pairRecord.changePct ?? pairRecord.change_24h_pct;
  const changePct =
    typeof rawChangePct === 'number'
      ? rawChangePct
      : typeof rawChangePct === 'string' && rawChangePct.trim().length > 0
      ? Number(rawChangePct)
      : price !== 0
      ? (changeAbs / (price - changeAbs)) * 100
      : 0;

  const providerSymbolValue = pairRecord.providerSymbol ?? pairRecord.symbol ?? pairStr;
  const providerSymbol =
    typeof providerSymbolValue === 'string' && providerSymbolValue.trim().length > 0
      ? providerSymbolValue.trim()
      : undefined;

  return {
    id,
    base,
    quote,
    category,
    emoji,
    label,
    price,
    changeAbs,
    changePct,
    providerSymbol,
  };
}

/**
 * Normalise the gateway result into the public API contract.
 *
 * We deliberately accept `unknown` here so that the gateway can evolve
 * internally without immediately breaking this route; we only rely on
 * the subset of fields we actually care about.
 */
function buildSuccessResponse(rawResult: unknown): FxApiSuccessResponse {
  const resultRecord =
    rawResult && typeof rawResult === 'object' ? (rawResult as Record<string, unknown>) : {};

  const rawMode = resultRecord.mode;
  let mode: FxApiSuccessResponse['meta']['mode'];

  if (rawMode === 'fallback_cached') {
    mode = 'cached';
  } else if (
    rawMode === 'live' ||
    rawMode === 'fallback' ||
    rawMode === 'cached' ||
    rawMode === 'demo'
  ) {
    mode = rawMode;
  } else {
    mode = 'demo';
  }

  const rawSourceProvider =
    resultRecord.sourceProvider ?? resultRecord.primaryProvider ?? resultRecord.providerId;
  const sourceProvider =
    typeof rawSourceProvider === 'string' && rawSourceProvider.trim().length > 0
      ? rawSourceProvider.trim()
      : 'unknown';

  const rawAsOf = resultRecord.asOf ?? resultRecord.timestamp;
  const asOf =
    typeof rawAsOf === 'string' && rawAsOf.trim().length > 0
      ? rawAsOf.trim()
      : new Date().toISOString();

  // Prefer the new FxRibbonResult.data shape, but tolerate older names too.
  const rawPairs = Array.isArray(resultRecord.data)
    ? (resultRecord.data as unknown[])
    : Array.isArray(resultRecord.pairs)
    ? (resultRecord.pairs as unknown[])
    : Array.isArray(resultRecord.quotes)
    ? (resultRecord.quotes as unknown[])
    : [];

  const data: FxApiPairDto[] = rawPairs
    .map((pair) => normaliseFxPairRecord(pair))
    .filter((pair): pair is NormalisedFxPairRecord => pair !== null)
    .map((pair) => ({
      id: pair.id,
      base: pair.base,
      quote: pair.quote,
      label: pair.label,
      category: pair.category,
      emoji: pair.emoji,
      price: pair.price,
      change: pair.changeAbs,
      changePct: pair.changePct,
    }));

  return {
    meta: {
      buildId: BUILD_ID,
      mode,
      sourceProvider,
      asOf,
    },
    data,
  };
}

/**
 * GET /api/fx
 *
 * Uses the gateway `getFxRibbon` helper and returns a stable JSON contract.
 */
export async function GET() {
  const isTestEnv = process.env.NODE_ENV === 'test';

  // Gateway accepts an optional { forceProviderId?: string } options object.
  // In tests we force the `demo` provider; otherwise we let the gateway pick
  // according to the API Brain configuration.
  const options = isTestEnv ? { forceProviderId: 'demo' as const } : undefined;

  try {
    const rawResult = await getFxRibbon(options);
    const body = buildSuccessResponse(rawResult);

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    // Log and return a minimal error payload – the ribbon can fall back to
    // neutral values on the frontend if needed.
     
    console.error('[/api/fx] Failed to resolve FX ribbon', error);

    const body: FxApiErrorResponse = {
      meta: {
        buildId: BUILD_ID,
      },
      error: 'Unable to fetch FX ribbon at this time.',
    };

    return NextResponse.json(body, { status: 503 });
  }
}
