/**
 * Promagen Frontend - Weather Config Route
 * =========================================
 * SSOT endpoint for the gateway to fetch city coordinates.
 * 
 * FIXED (2026-01-19): Changed exchangeIds → ids to match exchanges.selected.json
 * 
 * Path: /api/weather/config
 * Method: GET
 * 
 * Returns cities from the exchange catalog with lat/lon coordinates.
 * Gateway fetches this on startup to initialize weather handler.
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
  selectedExchangeIds: string[];
}

// =============================================================================
// HANDLER
// =============================================================================

export async function GET(): Promise<NextResponse<WeatherConfigResponse>> {
  // Extract cities with coordinates from exchange catalog
  const cities: CityForWeather[] = (exchangesCatalog as ExchangeFromCatalog[])
    .filter((ex) => {
      // Only include exchanges with valid coordinates
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
  // FIX: exchanges.selected.json uses "ids", not "exchangeIds"
  // =========================================================================
  const selectedExchangeIds = (exchangesSelected as { ids: string[] }).ids ?? [];

  const response: WeatherConfigResponse = {
    version: 1,
    generatedAt: new Date().toISOString(),
    ssot: 'frontend/src/data/exchanges/exchanges.catalog.json',
    cities,
    selectedExchangeIds,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
