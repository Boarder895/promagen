// src/app/api/snapshot/market/route.ts

import { NextResponse } from 'next/server';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';

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

type MarketSnapshot = {
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

/**
 * For now this endpoint exposes a calm, deterministic view of the
 * exchange catalogue. Live price wiring can be layered on later
 * without changing the shape.
 */
function buildSnapshot(): MarketSnapshot[] {
  const catalog = exchangesCatalog as ExchangeCatalogRow[];

  return catalog.map((row) => ({
    id: row.id,
    city: row.city,
    exchange: row.exchange,
    country: row.country,
    iso2: row.iso2,
    tz: row.tz,
    longitude: row.longitude,
    latitude: row.latitude,
    hemisphere: row.hemisphere,
  }));
}

export async function GET(): Promise<Response> {
  const asOf = new Date().toISOString();
  const markets = buildSnapshot();

  return NextResponse.json({
    ok: true,
    asOf,
    count: markets.length,
    markets,
  });
}
