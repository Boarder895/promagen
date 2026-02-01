/**
 * Promagen Frontend - Weather Config Route (v2.0.0)
 * ==================================================
 * SSOT endpoint for the gateway to fetch city coordinates.
 *
 * Path: /api/weather/config
 * Method: GET
 *
 * Returns cities from the exchange catalog with lat/lon coordinates.
 * Gateway fetches this on startup to initialize weather handler.
 *
 * UPDATED v2.0.0 (01 Feb 2026):
 * - DECOUPLED: selectedExchangeIds now includes ALL catalog exchanges,
 *   not just the 16 from exchanges.selected.json.
 *   Reason: Pro users can select any exchange. The gateway must fetch
 *   weather for ALL exchanges so every card has data regardless of
 *   which exchanges the user picks.
 *   The gateway's own batching logic (Batch A / Batch B) handles
 *   the API budget — it fetches 24 per cycle, rotating through all.
 * - ADDED: freeDefaultIds — the original SSOT 16 for future use
 *   (e.g. if gateway wants to prioritise free defaults in Batch A).
 *
 * FIXED (2026-01-19): Changed exchangeIds → ids to match exchanges.selected.json
 *
 * Existing features preserved: Yes
 *
 * @module app/api/weather/config/route
 */

import { NextResponse } from 'next/server';

import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';

// =============================================================================
// TYPES
// =============================================================================

interface ExchangeFromCatalog {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  exchange: string;
  // ... other fields we don't need
}

interface CityForWeather {
  id: string;
  city: string;
  lat: number;
  lon: number;
}

interface WeatherConfigResponse {
  version: number;
  generatedAt: string;
  ssot: string;
  cities: CityForWeather[];
  /** ALL exchange IDs — gateway fetches weather for every exchange in the catalog */
  selectedExchangeIds: string[];
  /** Original SSOT 16 — free tier homepage defaults (forward-compatible) */
  freeDefaultIds: string[];
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse<WeatherConfigResponse>> {
  const catalog = exchangesCatalog as ExchangeFromCatalog[];

  // Extract cities with valid coordinates from FULL exchange catalog
  const cities: CityForWeather[] = catalog
    .filter((ex) => {
      return (
        typeof ex.latitude === 'number' &&
        typeof ex.longitude === 'number' &&
        ex.latitude >= -90 &&
        ex.latitude <= 90 &&
        ex.longitude >= -180 &&
        ex.longitude <= 180
      );
    })
    .map((ex) => ({
      id: ex.id,
      city: ex.city,
      lat: ex.latitude,
      lon: ex.longitude,
    }));

  // =========================================================================
  // DECOUPLED (v2.0.0): Send ALL exchange IDs to gateway
  // Previously: only sent the 16 from exchanges.selected.json
  // Now: sends every exchange in the catalog so the gateway fetches weather
  // for ALL exchanges. Pro users selecting Nagoya, Shenzhen, etc. will
  // have live weather data available.
  // The gateway's splitIntoBatches() handles API budget:
  // - Batch A: first 24 IDs (refreshed at :10 and :40)
  // - Batch B: remaining IDs (refreshed on alternate cycles)
  // =========================================================================
  const allExchangeIds = catalog.map((ex) => ex.id);

  // Keep SSOT 16 as freeDefaultIds for forward-compatibility
  const freeDefaultIds = (exchangesSelected as { ids: string[] }).ids ?? [];

  const response: WeatherConfigResponse = {
    version: 2,
    generatedAt: new Date().toISOString(),
    ssot: 'frontend/src/data/exchanges/exchanges.catalog.json',
    cities,
    selectedExchangeIds: allExchangeIds,
    freeDefaultIds,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
