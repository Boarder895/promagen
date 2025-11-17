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
 * Map the selected id list to full exchange objects, sorted by longitude
 * from east → west (smallest → largest).
 */
function getSelectedExchanges(): ExchangeSummary[] {
  const byId = new Map<string, ExchangeCatalogRow>(CATALOG.map((row) => [row.id, row]));

  const rows: ExchangeSummary[] = [];

  for (const id of selectedIds) {
    const src = byId.get(id);
    if (!src) continue;

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

  rows.sort((a, b) => a.longitude - b.longitude);

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
