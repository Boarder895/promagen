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

type CommoditiesApiPayload = CommoditiesApiResponse;

/**
 * Hardcoded gateway fallback — matches FX + Crypto pattern.
 * Reuse FX_GATEWAY_URL so you only configure one env var across all providers.
 */
const DEFAULT_GATEWAY_URL = 'https://promagen-api.fly.dev';

function getGatewayBaseUrl(): string {
  return (
    process.env['GATEWAY_URL'] ??
    process.env['NEXT_PUBLIC_GATEWAY_URL'] ??
    process.env['FX_GATEWAY_URL'] ??
    DEFAULT_GATEWAY_URL
  ).replace(/\/+$/, '');
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapMode(raw: unknown): CommoditiesApiMode {
  // Gateway (Drop B) can return: live | cached | stale | error
  // Frontend expects: live | cached | fallback
  if (raw === 'live') return 'live';
  if (raw === 'cached' || raw === 'stale') return 'cached';
  return 'fallback';
}

function pickProvider(raw: unknown): CommoditiesSourceProvider {
  if (typeof raw === 'string' && raw.trim()) return raw as CommoditiesSourceProvider;
  return 'fallback';
}

function parseBudgetState(raw: unknown): CommoditiesBudgetState | undefined {
  if (raw === 'ok' || raw === 'warning' || raw === 'blocked') return raw;
  return undefined;
}

function buildFallback(): ProviderResult {
  // Static fallback quotes so the movers grid renders cards when the gateway is
  // unavailable (e.g. Marketstack key removed). Prices are representative, not live.
  // 12 items: 4+ "winners" (prevClose < value) + 4+ "losers" (prevClose > value).
  // When the gateway returns real data, this function is never called.
  const fallbackQuotes: { id: string; value: number; prevClose: number }[] = [
    // Winners (positive movement)
    { id: 'gold', value: 2685.4, prevClose: 2651.2 },
    { id: 'coffee', value: 182.35, prevClose: 178.9 },
    { id: 'brent_crude', value: 76.82, prevClose: 75.45 },
    { id: 'cocoa', value: 8425.0, prevClose: 8310.0 },
    // Losers (negative movement)
    { id: 'copper', value: 8742.5, prevClose: 8865.0 },
    { id: 'wheat', value: 542.25, prevClose: 558.75 },
    { id: 'live_cattle', value: 192.15, prevClose: 195.3 },
    { id: 'silver', value: 30.18, prevClose: 30.92 },
    // Extra (ensures sort has enough headroom)
    { id: 'sugar', value: 19.85, prevClose: 19.42 },
    { id: 'wti_crude', value: 72.1, prevClose: 73.55 },
    { id: 'corn', value: 448.5, prevClose: 451.0 },
    { id: 'lean_hogs', value: 87.3, prevClose: 88.1 },
  ];

  return {
    mode: 'fallback',
    sourceProvider: 'fallback',
    budgetState: 'ok',
    quotes: fallbackQuotes,
  };
}

export async function getCommoditiesRibbon(): Promise<ProviderResult> {
  unstable_noStore();

  const gatewayBase = getGatewayBaseUrl();
  const url = `${gatewayBase}/commodities`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) return buildFallback();

    const json = (await res.json()) as Record<string, unknown>;

    // ── Safe nested access (avoids `any`) ────────────────────────────────────
    const dataField = json['data'];
    const meta = json['meta'] as Record<string, unknown> | undefined;
    const budget = meta?.['budget'] as Record<string, unknown> | undefined;

    // Gateway sends TWO possible shapes:
    //   Shape A (gateway direct): { data: [ {id, price, change, ...} ] }  ← flat array
    //   Shape B (frontend API):   { data: { quotes: [ {id, value, prevClose} ] } }
    const rawQuotes: unknown[] = Array.isArray(dataField)
      ? dataField // Shape A: data IS the array
      : Array.isArray((dataField as Record<string, unknown> | undefined)?.['quotes'])
        ? ((dataField as Record<string, unknown>)['quotes'] as unknown[])
        : [];

    const quotes: { id: string; value: number; prevClose: number }[] = [];

    if (rawQuotes.length > 0) {
      for (const rec of rawQuotes as Record<string, unknown>[]) {
        const id = typeof rec?.['id'] === 'string' ? rec['id'] : null;

        // Shape B: already has value/prevClose (from frontend API cache)
        if (typeof rec?.['value'] === 'number' && typeof rec?.['prevClose'] === 'number') {
          if (!id) continue;
          quotes.push({ id, value: rec['value'], prevClose: rec['prevClose'] });
          continue;
        }

        // Shape A: gateway sends { price, change, percentChange }
        const price = toFiniteNumber(rec?.['price']);
        if (!id || price == null) continue;

        // Derive prevClose from percentChange (Marketstack "percentage_day").
        // This is the authoritative daily % move. We back-calculate prevClose so
        // the hook's (value − prevClose) / prevClose * 100 reproduces the exact %.
        //
        // NOTE: We do NOT use rec['change'] (Marketstack "price_change_day")
        // because it doesn't correspond to percentage_day — using it produces
        // wildly wrong percentages (e.g., 29% instead of 0.86%).
        const pctChange = toFiniteNumber(rec?.['percentChange']);
        let prevClose: number;
        if (pctChange != null && pctChange !== 0) {
          // prevClose = price / (1 + pct/100)
          const divisor = 1 + pctChange / 100;
          prevClose = Number.isFinite(divisor) && divisor !== 0 ? price / divisor : price;
        } else if (pctChange === 0) {
          // 0% change — prevClose equals current price (flat)
          prevClose = price;
        } else {
          // No percentage data — render flat (no arrow, no %)
          prevClose = price;
        }

        quotes.push({ id, value: price, prevClose });
      }
    }

    if (quotes.length === 0) {
      return buildFallback();
    }

    const budgetState = parseBudgetState(budget?.['state']);

    // Gateway uses meta.provider; frontend API uses meta.sourceProvider
    const provider: CommoditiesSourceProvider = pickProvider(
      meta?.['provider'] ?? meta?.['sourceProvider'],
    );

    return {
      mode: mapMode(meta?.['mode']),
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
}): CommoditiesApiPayload {
  const emoji = getBudgetGuardEmoji(opts.result.budgetState ?? 'ok');

  return {
    meta: {
      mode: opts.result.mode,
      sourceProvider: opts.result.sourceProvider,
      budget: opts.result.budgetState ? { state: opts.result.budgetState, emoji } : undefined,
      requestId: opts.requestId,
      buildId: opts.buildId,
      generatedAt: opts.generatedAt,
    },
    data: {
      quotes: opts.result.quotes.map((q) => ({
        id: q.id,
        value: q.value,
        prevClose: q.prevClose,
      })),
    },
  };
}
