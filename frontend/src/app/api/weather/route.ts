// src/app/api/weather/route.ts

import { NextResponse } from 'next/server';
import { listExchangeWeather } from '@/lib/weather/exchange-weather';
import { resolveFeelsLike, type MarketWeather } from '@/lib/weather/weather';
import { getOrFetchMarketWeather } from '@/lib/weather/weather-client';

// Data: exchanges catalogue + selected set
import exchangesSelected from '@/data/exchanges/exchanges.selected.json';
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';

type WeatherMode = 'demo' | 'live';

const WEATHER_MODE: WeatherMode =
  ((process.env.WEATHER_MODE as WeatherMode) ?? 'demo') === 'live' ? 'live' : 'demo';

type ExchangeCatalogRow = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
};

type ExchangesSelectedJson = {
  ids?: string[];
};

type WeatherApiExchange = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
};

const selectedIds: string[] = (exchangesSelected as ExchangesSelectedJson).ids ?? [];

const EXCHANGE_BY_ID = new Map<string, ExchangeCatalogRow>(
  (exchangesCatalog as ExchangeCatalogRow[]).map((row) => [row.id, row]),
);

/**
 * Clamp a number into [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Apply a small deterministic wobble in DEMO mode so values are not static.
 */
function applyDemoDrift(baseTempC: number, now: Date): number {
  const minutes = now.getUTCMinutes();
  const phase = (minutes / 60) * 2 * Math.PI;
  const wobble = Math.sin(phase) * 1.5; // ±1.5 °C
  const drifted = baseTempC + wobble;
  return Math.round(drifted * 10) / 10;
}

/**
 * Exchanges we will fetch weather for – currently exchanges.selected.json.
 */
function getSelectedExchangeConfigs(): WeatherApiExchange[] {
  return selectedIds
    .map((id) => {
      const entry = EXCHANGE_BY_ID.get(id);
      if (!entry) return null;

      return {
        id: entry.id,
        city: entry.city,
        latitude: entry.latitude,
        longitude: entry.longitude,
      } satisfies WeatherApiExchange;
    })
    .filter((value): value is WeatherApiExchange => value !== null);
}

/**
 * DEMO pipeline: synthesise MarketWeather[] from in-repo demo data.
 *
 * We *keep* emoji from the demo dataset (honouring iconOverride) so tests
 * can rely on predictable values like '🌧️'.
 */
async function buildDemoPayload(now: Date): Promise<(MarketWeather & { emoji: string })[]> {
  const demoEntries = listExchangeWeather();
  const configs = getSelectedExchangeConfigs();

  const byId = new Map<string, WeatherApiExchange>(configs.map((cfg) => [cfg.id, cfg]));

  const projected: (MarketWeather & { emoji: string })[] = [];

  for (const entry of demoEntries) {
    const cfg = byId.get(entry.exchange);
    if (!cfg) continue;

    const tempC = applyDemoDrift(entry.tempC, now);
    const feelsLikeC = resolveFeelsLike(tempC, entry.feelsLikeC);

    const emoji =
      entry.iconOverride && entry.iconOverride.trim().length > 0 ? entry.iconOverride : entry.emoji;

    projected.push({
      id: cfg.id,
      city: cfg.city,
      temperatureC: tempC,
      feelsLikeC,
      conditions: entry.condition,
      emoji,
      updatedISO: now.toISOString(),
    });
  }

  return projected;
}

/**
 * LIVE pipeline: call the Visual Crossing client per exchange.
 *
 * Here we derive an emoji from the free-form conditions string so the
 * shape matches demo mode.
 */
async function buildLivePayload(): Promise<(MarketWeather & { emoji: string })[]> {
  const configs = getSelectedExchangeConfigs();

  const results: (MarketWeather & { emoji: string })[] = [];

  for (const cfg of configs) {
    const snapshot = await getOrFetchMarketWeather(cfg.id, cfg.city, cfg.latitude, cfg.longitude);

    const tempC =
      typeof snapshot.temperatureC === 'number' && Number.isFinite(snapshot.temperatureC)
        ? snapshot.temperatureC
        : 0;

    const feelsLikeC = resolveFeelsLike(tempC, snapshot.feelsLikeC);
    const conditions = snapshot.conditions ?? 'Unknown';
    const emoji = conditionsToEmoji(conditions);

    results.push({
      id: cfg.id,
      city: cfg.city,
      temperatureC: tempC,
      feelsLikeC,
      conditions,
      emoji,
      updatedISO: snapshot.updatedISO,
    });
  }

  return results;
}

/**
 * GET /api/weather
 *
 * Returns a JSON array of MarketWeather objects (with an extra `emoji`
 * field). Tests explicitly expect `Array.isArray(body) === true`.
 */
export async function GET(): Promise<Response> {
  const now = new Date();

  const payload = WEATHER_MODE === 'live' ? await buildLivePayload() : await buildDemoPayload(now);

  const normalised = payload.map((entry) => ({
    ...entry,
    temperatureC: clamp(entry.temperatureC, -60, 60),
    feelsLikeC: clamp(
      typeof entry.feelsLikeC === 'number' ? entry.feelsLikeC : entry.temperatureC,
      -60,
      60,
    ),
  }));

  // IMPORTANT: body is a bare array – tests expect Array.isArray(body) === true.
  return NextResponse.json(normalised);
}

/**
 * POST behaves exactly like GET for now.
 */
export async function POST(): Promise<Response> {
  return GET();
}

/**
 * Simple, defensive mapping from a free-form conditions string
 * to an emoji. Used only in LIVE mode.
 */
function conditionsToEmoji(conditions: string): string {
  const lower = conditions.toLowerCase();

  if (lower.includes('storm') || lower.includes('thunder')) {
    return '⛈️';
  }

  if (lower.includes('snow') || lower.includes('sleet')) {
    return '❄️';
  }

  if (lower.includes('rain') || lower.includes('drizzle')) {
    return '🌧️';
  }

  if (lower.includes('cloud')) {
    return '⛅';
  }

  if (lower.includes('wind')) {
    return '🌬️';
  }

  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    return '🌫️';
  }

  // Default: assume decent weather.
  return '☀️';
}
