// src/lib/commodities/providers.ts
/**
 * Commodities providers - Gateway Client (mirrors FX pattern)
 *
 * Rules:
 * - This module must NOT call TwelveData directly from the frontend.
 * - Prefer the Fly gateway. It owns caching/budget/circuit-breakers.
 * - If the gateway is unavailable or returns an unexpected payload, fall back
 *   to SSOT demo values so the UI stays calm.
 *
 * Existing features preserved: Yes
 */

import { unstable_noStore } from 'next/cache';

import { getBudgetGuardEmoji } from '@/data/emoji/emoji';
import { getDefaultFreeCommodities } from '@/lib/commodities/catalog';

import type {
  CommoditiesApiMode,
  CommoditiesApiResponse,
  CommoditiesBudgetState,
  CommoditiesSourceProvider,
} from '@/types/commodities-ribbon';

type ProviderResult = {
  mode: CommoditiesApiMode;
  sourceProvider: CommoditiesSourceProvider;
  budgetState?: CommoditiesBudgetState;
  quotes: { id: string; value: number; prevClose: number }[];
};

const DEFAULT_GATEWAY_URL = 'https://promagen-api.fly.dev';

/**
 * Gateway base URL.
 * Reuse FX_GATEWAY_URL so you only configure one thing.
 */
function getGatewayBaseUrl(): string {
  return (process.env['FX_GATEWAY_URL'] ?? DEFAULT_GATEWAY_URL).replace(/\/$/, '');
}

function buildFallback(): ProviderResult {
  const defaults = getDefaultFreeCommodities();

  // Demo values are stable and obviously synthetic; UI must not infer freshness.
  const quotes = defaults.map((c) => ({
    id: c.id,
    value: 1.0,
    prevClose: 1.0,
  }));

  return {
    mode: 'fallback',
    sourceProvider: 'fallback',
    budgetState: 'ok',
    quotes,
  };
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function mapMode(raw: unknown): CommoditiesApiMode {
  // Gateway (Drop B) can return: live | cached | stale | error
  // Frontend API exposes: live | cached | fallback
  if (raw === 'live') return 'live';
  if (raw === 'cached' || raw === 'stale') return 'cached';
  return 'fallback';
}

function pickProvider(raw: unknown): CommoditiesSourceProvider {
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return 'cache';
}

function parseBudgetState(raw: unknown): CommoditiesBudgetState {
  if (raw === 'ok' || raw === 'warning' || raw === 'blocked') {
    return raw;
  }
  return 'ok';
}

// Type guard for gateway response shape
interface GatewayResponse {
  meta?: {
    mode?: unknown;
    provider?: unknown;
    sourceProvider?: unknown;
    budget?: { state?: unknown };
  };
  data?: unknown[] | { quotes?: unknown[] };
  quotes?: unknown[];
}

export async function getCommoditiesRibbon(): Promise<ProviderResult> {
  unstable_noStore();

  const gatewayBase = getGatewayBaseUrl();
  const url = `${gatewayBase}/commodities`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Keep this small; gateway should be fast, and we don't want hung lambdas.
      signal: AbortSignal.timeout(8_000),
      // Don't cache at fetch layer; gateway already caches.
      cache: 'no-store',
    });

    if (!res.ok) {
      return buildFallback();
    }

    const json = (await res.json()) as GatewayResponse;

    // Minimal defensive parsing (do not trust upstream).
    const quotes: { id: string; value: number; prevClose: number }[] = [];

    // Shape A (frontend API style): { data: { quotes: [{id,value,prevClose}] } }
    const dataObj = json?.data as Record<string, unknown> | undefined;
    const arrA = (dataObj?.quotes ?? json?.quotes) as unknown[] | undefined;
    if (Array.isArray(arrA)) {
      for (const item of arrA) {
        const rec = item as Record<string, unknown>;
        const id = typeof rec?.id === 'string' ? rec.id : null;
        const value = toFiniteNumber(rec?.value);
        const prevClose = toFiniteNumber(rec?.prevClose);
        if (!id || value == null || prevClose == null) continue;
        quotes.push({ id, value, prevClose });
      }
    }

    // Shape B (gateway Drop B): { data: [{id, price, ...}] }
    if (quotes.length === 0 && Array.isArray(json?.data)) {
      for (const item of json.data) {
        const rec = item as Record<string, unknown>;
        const id = typeof rec?.id === 'string' ? rec.id : null;
        const price = toFiniteNumber(rec?.price);
        if (!id || price == null) continue;
        quotes.push({ id, value: price, prevClose: price });
      }
    }

    if (quotes.length === 0) {
      return buildFallback();
    }

    const budgetState = parseBudgetState(json?.meta?.budget?.state);

    // Gateway uses meta.provider; frontend API uses meta.sourceProvider
    const provider: CommoditiesSourceProvider = pickProvider(
      json?.meta?.provider ?? json?.meta?.sourceProvider,
    );

    return {
      mode: mapMode(json?.meta?.mode),
      sourceProvider: provider,
      budgetState,
      quotes,
    };
  } catch {
    return buildFallback();
  }
}

export function toCommoditiesApiResponse(opts: {
  requestId?: string;
  buildId?: string;
  generatedAt: string;
  result: ProviderResult;
}): CommoditiesApiResponse {
  const { requestId, buildId, generatedAt, result } = opts;

  const emoji = getBudgetGuardEmoji(result.budgetState ?? 'ok');

  return {
    meta: {
      mode: result.mode,
      sourceProvider: result.sourceProvider,
      budget: { state: result.budgetState ?? 'ok', emoji },
      requestId,
      buildId,
      generatedAt,
    },
    data: {
      quotes: result.quotes,
    },
  };
}
