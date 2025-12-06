import { NextResponse } from 'next/server';
import { getFxRibbon } from '../../../../../gateway';
import type { FxRibbonQuote, FxMode } from '../../../../../gateway';

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
 * contract tests never burn real upstream quota.
 */
export const dynamic = 'force-dynamic';

/**
 * Stable build identifier for this deployment.
 *
 * Priority:
 * 1. NEXT_PUBLIC_BUILD_ID (when running in the browser or Vercel-style env)
 * 2. BUILD_ID (generic CI/host build identifier)
 * 3. "local-dev" as a safe default for local runs.
 */
const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.BUILD_ID ?? 'local-dev';

/**
 * Public FX quote shape returned by this API route.
 *
 * This is intentionally simpler than the internal FxRibbonQuote used by the
 * gateway: we expose only what the frontend actually needs.
 */
export interface FxRibbonQuoteDto {
  /**
   * Stable identifier for this chip in the ribbon, usually the raw pair,
   * e.g. "GBPUSD".
   */
  id: string;
  /**
   * Base currency code, e.g. "GBP".
   */
  base: string;
  /**
   * Quote currency code, e.g. "USD".
   */
  quote: string;
  /**
   * Mid / last price for the pair.
   */
  mid: number;
  /**
   * Optional bid / ask, if the provider offers them.
   */
  bid?: number;
  ask?: number;
  /**
   * Optional absolute 24h price change.
   */
  change?: number;
  /**
   * Optional percentage 24h price change.
   */
  changePct?: number;
  /**
   * Raw provider symbol for debugging / tooltips, usually the pair string.
   */
  providerSymbol?: string;
}

interface FxApiSuccessResponse {
  meta: {
    /**
     * Build identifier for this deployment (used by tests).
     */
    buildId: string;
    /**
     * Logical role, e.g. "fx_ribbon".
     */
    role: string;
    /**
     * Quality mode of the data.
     */
    mode: FxMode;
    /**
     * Provider the role *prefers* (from roles.policies.json).
     */
    primaryProvider: string;
    /**
     * Provider that actually served this response.
     */
    sourceProvider: string;
    /**
     * ISO timestamp when this snapshot was assembled.
     */
    asOf: string;
  };
  data: {
    /**
     * FX pairs making up the ribbon.
     */
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
 * Map an internal gateway pair (FxRibbonQuote) to the public DTO
 * shape exposed by this API route.
 */
function mapGatewayPairToDto(options: { idPrefix?: string } = {}) {
  const { idPrefix = '' } = options;

  return (pair: FxRibbonQuote): FxRibbonQuoteDto => {
    const rawId = pair.pair ?? `${pair.base}${pair.quote}`;

    return {
      id: `${idPrefix}${rawId}`,
      base: pair.base,
      quote: pair.quote,
      mid: pair.price,
      bid: pair.bid,
      ask: pair.ask,
      change: pair.change_24h,
      changePct: pair.change_24h_pct,
      providerSymbol: rawId,
    };
  };
}

/**
 * GET /api/fx
 *
 * Returns the homepage FX ribbon snapshot.
 */
export async function GET(): Promise<NextResponse<FxApiSuccessResponse | FxApiErrorResponse>> {
  try {
    const isTestRun = process.env.NODE_ENV === 'test';

    // In tests we hard-force the demo provider so we never burn real API quota.
    const gatewayResult = await getFxRibbon(isTestRun ? { forceProviderId: 'demo' } : undefined);

    const { role, primaryProvider, sourceProvider, mode, asOf, pairs } = gatewayResult;

    const mappedPairs = pairs.map(mapGatewayPairToDto());

    const body: FxApiSuccessResponse = {
      meta: {
        buildId: BUILD_ID,
        role,
        mode,
        primaryProvider,
        sourceProvider,
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
