// frontend/src/app/api/indices/config/route.ts
/**
 * /api/indices/config — SSOT endpoint for gateway Indices feed initialization.
 *
 * v2.0.0 (01 Feb 2026):
 * - DECOUPLED: defaultExchangeIds now includes ALL active exchanges with
 *   valid marketstack benchmarks, not just the 16 from exchanges.selected.json.
 *   Reason: Pro users can select any exchange. The gateway must fetch index
 *   data for ALL exchanges so every card has data regardless of selection.
 * - ADDED: freeDefaultIds — the original SSOT 16. Gateway can use this to
 *   limit GET responses for free/anonymous users if desired.
 * - KEPT: Full Zod validation, integrity checks, both legacy + new formats.
 *
 * Data sources:
 * - frontend/src/data/exchanges/exchanges.catalog.json (full catalog)
 * - frontend/src/data/exchanges/exchanges.selected.json (free tier defaults)
 *
 * Existing features preserved: Yes
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import exchangesCatalogJson from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelectedJson from '@/data/exchanges/exchanges.selected.json';

// ---------------------------------------------------------------------------
// ZOD SCHEMAS (drift-proof) - Supports BOTH legacy and new multi-index format
// ---------------------------------------------------------------------------

/**
 * Legacy marketstack format (single benchmark/indexName at root).
 * @deprecated Maintained for backward compatibility only.
 */
const LegacyMarketstackSchema = z.object({
  benchmark: z.string().min(1),
  indexName: z.string().min(1),
});

/**
 * New multi-index format with defaultBenchmark and availableIndices array.
 * Pro Promagen feature: users can select which index to display per exchange.
 */
const NewMarketstackSchema = z.object({
  defaultBenchmark: z.string().min(1),
  defaultIndexName: z.string().min(1),
  availableIndices: z
    .array(
      z.object({
        benchmark: z.string().min(1),
        indexName: z.string().min(1),
      }),
    )
    .min(1),
});

/**
 * Union schema that accepts both formats and normalizes to a common structure.
 * Returns { benchmark, indexName } for gateway compatibility.
 */
const MarketstackSchema = z
  .union([
    // New format: extract defaults
    NewMarketstackSchema.transform((data) => ({
      benchmark: data.defaultBenchmark,
      indexName: data.defaultIndexName,
    })),
    // Legacy format: pass through directly
    LegacyMarketstackSchema,
  ])
  .optional();

const ExchangeCatalogItemSchema = z
  .object({
    id: z.string().min(1),
    city: z.string().optional().default(''),
    exchange: z.string().optional().default(''),
    country: z.string().optional().default(''),
    iso2: z.string().optional(),
    tz: z.string().optional(),
    marketstack: MarketstackSchema,
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

  // =========================================================================
  // DECOUPLED (v2.0.0): defaultExchangeIds = ALL active exchanges
  // Previously: only the 16 from exchanges.selected.json
  // Now: every active exchange with a valid benchmark so the gateway fetches
  // index data for ALL exchanges. Pro users selecting any exchange will
  // have index data available.
  // =========================================================================
  const defaultExchangeIds = activeExchanges.map((e) => e.id.toLowerCase().trim());

  // Keep SSOT 16 as freeDefaultIds for forward-compatibility
  // Gateway can use this to limit free/anonymous GET responses
  const freeDefaultIds = selectedExchanges.ids.map((id) => id.toLowerCase().trim());

  // SSOT integrity checks: freeDefaultIds must exist in catalog and have benchmark + indexName
  const byId = new Map<string, z.infer<typeof ExchangeCatalogItemSchema>>(
    allExchanges.map((e) => [e.id.toLowerCase().trim(), e]),
  );

  for (const id of freeDefaultIds) {
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
      version: 2,
      ssot: 'frontend/src/data/exchanges/exchanges.catalog.json',
      generatedAt: new Date().toISOString(),
      defaultExchangeIds,
      freeDefaultIds,
      exchanges,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
