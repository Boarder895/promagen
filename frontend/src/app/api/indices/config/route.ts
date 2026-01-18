// frontend/src/app/api/indices/config/route.ts
/**
 * /api/indices/config — SSOT endpoint for gateway Indices feed initialization.
 *
 * Goal: replace hand-written JSON typing with Zod validation + inferred safety,
 * so schema drift is caught immediately and loudly.
 *
 * Data sources:
 * - frontend/src/data/exchanges/exchanges.catalog.json (full catalog)
 * - frontend/src/data/exchanges/exchanges.selected.json (default ordered IDs)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import exchangesCatalogJson from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelectedJson from '@/data/exchanges/exchanges.selected.json';

// ---------------------------------------------------------------------------
// ZOD SCHEMAS (drift-proof)
// ---------------------------------------------------------------------------

const MarketstackSchema = z
  .object({
    benchmark: z.string().min(1),
    indexName: z.string().min(1),
  })
  .passthrough();

const ExchangeCatalogItemSchema = z
  .object({
    id: z.string().min(1),
    city: z.string().optional().default(''),
    exchange: z.string().optional().default(''),
    country: z.string().optional().default(''),
    iso2: z.string().optional(),
    tz: z.string().optional(),
    marketstack: MarketstackSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough();

const ExchangesCatalogSchema = z.array(ExchangeCatalogItemSchema);

const ExchangesSelectedSchema = z
  .object({
    ids: z.array(z.string().min(1)),
  })
  .passthrough();

// ---------------------------------------------------------------------------

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const allExchanges = ExchangesCatalogSchema.parse(exchangesCatalogJson);
  const selectedExchanges = ExchangesSelectedSchema.parse(exchangesSelectedJson);

  // Filter active exchanges with marketstack config
  const activeExchanges = allExchanges.filter(
    (e) =>
      e.isActive !== false &&
      typeof e.marketstack?.benchmark === 'string' &&
      e.marketstack.benchmark.length > 0,
  );

  // Get default exchange IDs from selected.json (order is authoritative)
  const defaultExchangeIds = selectedExchanges.ids.map((id) => id.toLowerCase().trim());

  // SSOT integrity checks: selected IDs must exist in catalog and have benchmark + indexName
  const byId = new Map<string, z.infer<typeof ExchangeCatalogItemSchema>>(
    allExchanges.map((e) => [e.id.toLowerCase().trim(), e]),
  );

  for (const id of defaultExchangeIds) {
    const ex = byId.get(id);
    if (!ex) {
      throw new Error(`[indices/config] SSOT selected exchange not found in catalog: ${id}`);
    }
    if (!ex.marketstack?.benchmark) {
      throw new Error(
        `[indices/config] SSOT selected exchange missing marketstack benchmark mapping: ${id}`,
      );
    }
    if (!ex.marketstack?.indexName) {
      throw new Error(
        `[indices/config] SSOT selected exchange missing marketstack indexName mapping: ${id}`,
      );
    }
  }

  // Build response format expected by gateway
  const exchanges = activeExchanges.map((e) => ({
    id: e.id.toLowerCase().trim(),
    city: (e.city ?? '').toString(),
    exchange: (e.exchange ?? '').toString(),
    country: (e.country ?? '').toString(),
    iso2: e.iso2 ?? null,
    tz: e.tz ?? 'UTC',
    benchmark: e.marketstack?.benchmark ?? null,
    indexName: e.marketstack?.indexName ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'frontend/src/data/exchanges/exchanges.catalog.json',
      generatedAt: new Date().toISOString(),
      defaultExchangeIds,
      exchanges,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
