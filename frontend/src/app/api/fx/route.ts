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
 * Normalise a single raw FX pair record coming back from the gateway into
 * our internal, stricter shape.
 *
 * The gateway payload may evolve over time; this function keeps the API
 * surface for the frontend stable by coercing and defaulting fields.
 */
function normaliseFxPairRecord(rawPair: unknown): NormalisedFxPairRecord | null {
  if (!rawPair || typeof rawPair !== 'object') {
    return null;
  }

  const pairRecord = rawPair as Record<string, unknown>;

  const idValue = pairRecord.id ?? pairRecord.symbol ?? pairRecord.pairId;
  const id = typeof idValue === 'string' && idValue.trim().length > 0 ? idValue.trim() : null;

  const baseValue = pairRecord.base ?? pairRecord.baseCurrency ?? pairRecord.from;
  const base =
    typeof baseValue === 'string' && baseValue.trim().length === 3
      ? baseValue.trim().toUpperCase()
      : null;

  const quoteValue = pairRecord.quote ?? pairRecord.quoteCurrency ?? pairRecord.to;
  const quote =
    typeof quoteValue === 'string' && quoteValue.trim().length === 3
      ? quoteValue.trim().toUpperCase()
      : null;

  if (!id || !base || !quote) {
    return null;
  }

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

  const providerSymbolValue = pairRecord.providerSymbol ?? pairRecord.symbol;
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

  const mode =
    typeof resultRecord.mode === 'string' && resultRecord.mode.trim().length > 0
      ? resultRecord.mode
      : 'demo';

  const primaryProvider =
    typeof resultRecord.primaryProvider === 'string' &&
    resultRecord.primaryProvider.trim().length > 0
      ? resultRecord.primaryProvider
      : 'unknown';

  const asOf =
    typeof resultRecord.asOf === 'string' && resultRecord.asOf.trim().length > 0
      ? resultRecord.asOf
      : new Date().toISOString();

  const rawPairs = Array.isArray(resultRecord.pairs)
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
      mode: mode === 'fallback_cached' ? 'cached' : (mode as FxApiSuccessResponse['meta']['mode']),
      sourceProvider: primaryProvider,
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
