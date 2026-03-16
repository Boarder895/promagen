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

  // =========================================================================
  // v3.0.0: Emit one entry per INDEX (not per exchange).
  // Multi-index exchanges produce multiple entries with compound IDs:
  //   "cse-colombo::cse_all_share", "cse-colombo::cse_general"
  // Single-index exchanges also get compound IDs for consistency.
  // The gateway fetches unique Marketstack symbols (deduped), then fans
  // quotes back out to every compound entry sharing that benchmark.
  // =========================================================================

  // Step 1: Build flat list of all index entries with compound IDs
  interface IndexEntry {
    compoundId: string;
    exchangeId: string;
    city: string;
    exchange: string;
    country: string;
    iso2: string | null;
    tz: string;
    benchmark: string;
    indexName: string;
  }

  const allIndexEntries: IndexEntry[] = [];

  for (const e of allExchanges) {
    if (e.isActive === false) continue;
    if (e.id.startsWith('city-vibe-')) continue;

    const ms = e.marketstack;
    if (!ms) continue;

    // Common fields
    const base = {
      exchangeId: e.id.toLowerCase().trim(),
      city: (e.city ?? '').toString(),
      exchange: (e.exchange ?? '').toString(),
      country: (e.country ?? '').toString(),
      iso2: e.iso2 ?? null,
      tz: e.tz ?? 'UTC',
    };

    // Check if MarketstackSchema already transformed it (union → {benchmark, indexName})
    const benchmark = ms.benchmark;
    const indexName = ms.indexName;

    if (!benchmark || !indexName) continue;

    // For the config response we only emit the single default (Zod already collapsed it).
    // But we need to check if the RAW catalog entry has availableIndices.
    // Re-read from the raw catalog to get all indices.
    const rawEntry = (exchangesCatalogJson as Array<Record<string, unknown>>).find(
      (r) => typeof r['id'] === 'string' && r['id'].toLowerCase().trim() === base.exchangeId,
    );

    const rawMs = rawEntry?.['marketstack'] as Record<string, unknown> | undefined;
    const rawAvailable = rawMs?.['availableIndices'] as
      | Array<{ benchmark: string; indexName: string }>
      | undefined;

    if (Array.isArray(rawAvailable) && rawAvailable.length > 1) {
      // Multi-index: emit one entry per available index
      for (const idx of rawAvailable) {
        if (!idx.benchmark || !idx.indexName) continue;
        allIndexEntries.push({
          ...base,
          compoundId: `${base.exchangeId}::${idx.benchmark}`,
          benchmark: idx.benchmark,
          indexName: idx.indexName,
        });
      }
    } else {
      // Single-index: emit one entry
      allIndexEntries.push({
        ...base,
        compoundId: `${base.exchangeId}::${benchmark}`,
        benchmark,
        indexName,
      });
    }
  }

  // defaultExchangeIds = ALL compound IDs (gateway fetches all)
  const defaultExchangeIds = allIndexEntries.map((e) => e.compoundId);

  // freeDefaultIds = default benchmark per SSOT-16 exchange (backward compat)
  const freeDefaultIds = selectedExchanges.ids.map((id) => {
    const entry = allIndexEntries.find(
      (e) => e.exchangeId === id.toLowerCase().trim(),
    );
    return entry?.compoundId ?? id.toLowerCase().trim();
  });

  // Build response format expected by gateway
  const exchanges = allIndexEntries.map((e) => ({
    id: e.compoundId,
    city: e.city,
    exchange: e.exchange,
    country: e.country,
    iso2: e.iso2,
    tz: e.tz,
    benchmark: e.benchmark,
    indexName: e.indexName,
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
