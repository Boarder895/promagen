// src/app/api/exchanges/route.ts

import { NextResponse } from 'next/server';
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';

type ExchangesSelectedJson = {
  ids?: string[];
};

type ExchangeCatalogRow = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  latitude: number;
  hemisphere?: string;
  hoursTemplate?: string;
  holidaysRef?: string;
};

type ExchangeSummary = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  latitude: number;
  hemisphere?: string;
};

const selectedIds: string[] = (exchangesSelected as ExchangesSelectedJson).ids ?? [];
const CATALOG = exchangesCatalog as ExchangeCatalogRow[];

/**
 * Map the selected id list to full exchange objects.
 *
 * SSOT rule (Option A): the order in exchanges.selected.json is authoritative.
 * We therefore preserve that exact order (do NOT sort here).
 */
function getSelectedExchanges(): ExchangeSummary[] {
  const byId = new Map<string, ExchangeCatalogRow>(CATALOG.map((row) => [row.id, row]));

  const rows: ExchangeSummary[] = [];

  for (const id of selectedIds) {
    const src = byId.get(id);
    if (!src) {
      // If SSOT references an unknown ID, fail loudly so it is fixed at the source.
      throw new Error(`[exchanges] SSOT selected id not found in catalog: ${id}`);
    }

    rows.push({
      id: src.id,
      city: src.city,
      exchange: src.exchange,
      country: src.country,
      iso2: src.iso2,
      tz: src.tz,
      longitude: src.longitude,
      latitude: src.latitude,
      hemisphere: src.hemisphere,
    });
  }

  return rows;
}

export async function GET(): Promise<Response> {
  const asOf = new Date().toISOString();
  const exchanges = getSelectedExchanges();

  return NextResponse.json({
    ok: true,
    asOf,
    count: exchanges.length,
    exchanges,
  });
}
