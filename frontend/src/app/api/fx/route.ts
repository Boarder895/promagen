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
 * Behaviour in tests:
 * - When NODE_ENV === 'test' we **force** the demo provider so that
 *   contract tests never hit real HTTP APIs or burn quota.
 */

export const dynamic = 'force-dynamic';

/**
 * Stable build identifier propagated into every API response.
 *
 * Priority:
 * 1. NEXT_PUBLIC_BUILD_ID (when running in the browser or Vercel-style env)
 * 2. BUILD_ID (generic CI/host build identifier)
 * 3. "local-dev" as a safe fallback for local runs.
 */
const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.BUILD_ID ?? 'local-dev';

/**
 * Quality mode of the FX data, mirrored from the gateway.
 */
type FxMode = 'live' | 'fallback' | 'demo' | 'cached';

/**
 * Public FX quote shape returned by this API route.
 *
 * This is deliberately simple and UI-friendly – it hides the internal
 * gateway field names (pair, price, change_24h, etc.) behind a stable
 * contract that the frontend and tests can rely on.
 */
export interface FxRibbonQuoteDto {
  /**
   * Pair identifier, e.g. "GBPUSD".
   */
  symbol: string;
  /**
   * Base currency code, e.g. "GBP".
   */
  base: string;
  /**
   * Quote currency code, e.g. "USD".
   */
  quote: string;
  /**
   * Normalised bid, ask, and mid prices.
   */
  bid: number;
  ask: number;
  mid: number;
  /**
   * Absolute and percentage 24h change.
   */
  change: number;
  changePct: number;
  /**
   * ISO timestamp of when these prices were assembled.
   */
  lastUpdated: string;
}

interface FxApiSuccessResponse {
  meta: {
    buildId: string;
    role: string;
    sourceProvider: string;
    mode: FxMode;
    asOf: string;
  };
  data: {
    pairs: FxRibbonQuoteDto[];
  };
}

interface FxApiErrorResponse {
  meta: {
    buildId: string;
  };
  error: string;
}

/**
 * Map the gateway's internal FX quote shape to the public DTO used by this route.
 */
function mapGatewayPairToDto(options: {
  pair: string;
  base: string;
  quote: string;
  price: number;
  bid?: number;
  ask?: number;
  change_24h?: number;
  change_24h_pct?: number;
  asOf: string;
}): FxRibbonQuoteDto {
  const { pair, base, quote, price, bid, ask, change_24h, change_24h_pct, asOf } = options;

  return {
    symbol: pair,
    base,
    quote,
    bid: bid ?? price,
    ask: ask ?? price,
    mid: price,
    change: change_24h ?? 0,
    changePct: change_24h_pct ?? 0,
    lastUpdated: asOf,
  };
}

/**
 * Route handler.
 *
 * Next.js will call this in production with a `NextRequest` argument,
 * but for tests we keep the signature argument-less so that Jest can
 * simply call `await GET()` without needing to construct a Request
 * instance or web runtime shims.
 */
export async function GET() {
  try {
    const isTestRun = process.env.NODE_ENV === 'test';

    const gatewayResult = await getFxRibbon({
      // In tests always force the demo provider.
      forceProviderId: isTestRun ? 'demo' : undefined,
    });

    const { role, sourceProvider, mode, asOf, pairs } = gatewayResult;

    const mappedPairs: FxRibbonQuoteDto[] = pairs.map((pair) =>
      mapGatewayPairToDto({
        ...pair,
        asOf,
      }),
    );

    const body: FxApiSuccessResponse = {
      meta: {
        buildId: BUILD_ID,
        role,
        sourceProvider,
        mode,
        asOf,
      },
      data: {
        pairs: mappedPairs,
      },
    };

    return NextResponse.json(body);
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
