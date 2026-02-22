/**
 * Promagen Frontend - Weather Config Route (v3.1.0)
 * ==================================================
 * SSOT endpoint for the gateway to fetch city coordinates.
 *
 * Path: /api/weather/config
 * Method: GET
 *
 * Returns cities from the exchange catalog with lat/lon coordinates,
 * plus provider HQ cities for AI provider weather tooltips.
 * Gateway fetches this on startup to initialize weather handler.
 *
 * UPDATED v3.1.0 (21 Feb 2026):
 * - EXPANDED: 10 → 15 provider HQ cities. Tightened proximity rule from
 *   100km to 10km: providers must be within 10km of their weather source.
 *   Added: Mountain View, San Jose, Menlo Park, Burlington, Freiburg.
 *   Freiburg fix: Flux was getting Zurich weather (87km, wrong country).
 *   Budget impact: 93 → 99 cities, 552 → 582 calls/day (58.2%).
 *
 * UPDATED v3.0.0 (21 Feb 2026):
 * - ADDED: 10 provider HQ cities for AI provider weather tooltips.
 *   These are cities where AI providers are headquartered but that
 *   don't overlap with any exchange city within 100km (tightened to 10km in v3.1.0).
 *   IDs are prefixed "provider-" to distinguish from exchange IDs.
 *   Budget impact: 83 → 93 unique locations, 498 → 558 calls/day (55.8%).
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
import providerWeatherCities from '@/data/providers/provider-weather-cities.json';

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

interface ProviderCity {
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
  // PROVIDER HQ CITIES (v3.1.0): Append 15 provider-only weather cities.
  // These are AI provider HQ cities that don't overlap with any exchange
  // city within 10km. IDs prefixed "provider-" for clear separation.
  // Gateway treats them identically to exchange cities — same batching,
  // same dedup, same caching. No gateway code changes needed.
  // =========================================================================
  const providerCities: CityForWeather[] = (providerWeatherCities as ProviderCity[])
    .filter(
      (pc) =>
        typeof pc.lat === 'number' &&
        typeof pc.lon === 'number' &&
        pc.lat >= -90 &&
        pc.lat <= 90 &&
        pc.lon >= -180 &&
        pc.lon <= 180,
    )
    .map((pc) => ({
      id: pc.id,
      city: pc.city,
      lat: pc.lat,
      lon: pc.lon,
    }));

  // Merge: all exchange cities + all provider HQ cities
  const allCities: CityForWeather[] = [...cities, ...providerCities];

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
    version: 4,
    generatedAt: new Date().toISOString(),
    ssot: 'frontend/src/data/exchanges/exchanges.catalog.json + provider-weather-cities.json',
    cities: allCities,
    selectedExchangeIds: allExchangeIds,
    freeDefaultIds,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
