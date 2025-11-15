// src/app/api/weather/route.ts

import { NextResponse } from 'next/server';
import { listExchangeWeather } from '@/lib/weather/exchange-weather';
import {
  resolveFeelsLike,
  resolveWeatherIcon,
  type MarketWeather,
} from '@/lib/weather/weather';
import { getOrFetchMarketWeather } from '@/lib/weather/weather-client';

// Data: single sources of truth for exchanges
import exchangesSelected from '@/data/exchanges.selected.json';
import exchangesCatalog from '@/data/exchanges.catalog.json';

type WeatherMode = 'demo' | 'live';

const WEATHER_MODE: WeatherMode =
  (process.env.WEATHER_MODE as WeatherMode) ?? 'demo';

type WeatherApiExchange = {
  id: string;
  city: string;
  temperatureC: number;
  feelsLikeC: number;
  conditions: string;
  emoji: string;
  updatedISO: string;
};

type WeatherApiPayload = {
  mode: WeatherMode;
  asOf: string;
  exchanges: WeatherApiExchange[];
};

type ExchangeCatalogEntry = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
};

const EXCHANGE_BY_ID = new Map<string, ExchangeCatalogEntry>(
  (exchangesCatalog as ExchangeCatalogEntry[]).map((entry) => [
    entry.id,
    {
      id: entry.id,
      city: entry.city,
      latitude: entry.latitude,
      longitude: entry.longitude,
    },
  ]),
);

/**
 * The homepage currently shows a fixed set of exchanges.
 * - On the free tier: this is exactly exchanges.selected.json.
 * - On paid tiers: the selection can change, but the catalogue
 *   is still the single source of truth for coordinates.
 */
function getSelectedExchangeConfigs(): Array<{
  id: string;
  city: string;
  latitude: number;
  longitude: number;
}> {
  const ids = (exchangesSelected as { ids: string[] }).ids;

  return ids
    .map((id) => {
      const entry = EXCHANGE_BY_ID.get(id);

      if (!entry) {
        return null;
      }

      return {
        id: entry.id,
        city: entry.city,
        latitude: entry.latitude,
        longitude: entry.longitude,
      };
    })
    .filter(
      (value): value is { id: string; city: string; latitude: number; longitude: number } =>
        value !== null,
    );
}

// This is what we currently fetch in LIVE mode.
// In future paid tiers, this function can accept a user-specific
// selection (6–16 exchanges in steps of 2) whilst still relying
// on the same catalogue and the same rate-limit maths.
const LIVE_EXCHANGE_CONFIGS = getSelectedExchangeConfigs();

/**
 * Quick helper: round to one decimal for display.
 */
function roundToOneDecimal(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  if (!Number.isFinite(rounded)) {
    return Number.NaN;
  }
  return rounded;
}

/**
 * Deterministic “demo drift” so demo temperatures feel alive
 * without needing live data.
 *
 * We use a simple hash of (exchange id + day of year) to generate
 * a small ±2 °C offset.
 */
function applyDemoTemperatureDrift(
  exchangeId: string,
  baseTempC: number,
  now: Date,
): number {
  const dayOfYear = getDayOfYear(now);
  const seed = `${exchangeId}:${dayOfYear}`;
  const hash = deterministicHash(seed);

  // Map hash (0–1) into roughly -2.0 to +2.0 range.
  const offset = (hash - 0.5) * 4;
  return baseTempC + offset;
}

function getDayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function deterministicHash(input: string): number {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }

  // Normalise to [0, 1]
  return (hash >>> 0) / 0xffffffff;
}

export async function GET(): Promise<Response> {
  const now = new Date();

  if (WEATHER_MODE === 'live') {
    return handleLive(now);
  }

  // Default and safe fallback is demo mode.
  return handleDemo(now);
}

/**
 * DEMO mode:
 * - Uses the static demo dataset as the base.
 * - Applies a small deterministic drift per exchange so that temperatures
 *   change throughout the day without needing live calls.
 */
async function handleDemo(now: Date): Promise<Response> {
  const demoEntries = listExchangeWeather();

  const exchanges: WeatherApiExchange[] = demoEntries.map((entry) => {
    const catalogEntry = EXCHANGE_BY_ID.get(entry.exchange);
    const city = catalogEntry?.city ?? entry.exchange;

    const driftedTemp = applyDemoTemperatureDrift(
      entry.exchange,
      entry.tempC,
      now,
    );

    const feelsLike = resolveFeelsLike(driftedTemp, entry.feelsLikeC);
    const emoji = resolveWeatherIcon({
      emoji: entry.emoji,
      iconOverride: entry.iconOverride,
    });

    return {
      id: entry.exchange,
      city,
      temperatureC: roundToOneDecimal(driftedTemp),
      feelsLikeC: roundToOneDecimal(feelsLike),
      conditions: entry.condition,
      emoji,
      updatedISO: now.toISOString(),
    };
  });

  const payload: WeatherApiPayload = {
    mode: 'demo',
    asOf: now.toISOString(),
    exchanges,
  };

  return NextResponse.json(payload);
}

/**
 * LIVE mode:
 * - Reads selected exchanges.
 * - Uses the Visual Crossing client with a 30-minute cache.
 * - Returns the same shape as demo mode so the UI doesn’t care.
 */
async function handleLive(now: Date): Promise<Response> {
  const configs = LIVE_EXCHANGE_CONFIGS;

  const results: Array<MarketWeather | null> = await Promise.all(
    configs.map(async (cfg) => {
      try {
        const mw = await getOrFetchMarketWeather(
          cfg.id,
          cfg.city,
          cfg.latitude,
          cfg.longitude,
        );
        return mw;
      } catch (error) {
        // Intentionally swallow per-exchange failures:
        // the UI simply won't show a badge for that one.
        console.error(
          '[weather] Failed to fetch live weather for',
          cfg.id,
          error,
        );
        return null;
      }
    }),
  );

  const exchanges: WeatherApiExchange[] = results
    .map((mw) => {
      if (!mw) {
        return null;
      }

      const { id, city, temperatureC, feelsLikeC, conditions, updatedISO } = mw;

      const emoji = conditionsToEmoji(conditions);

      return {
        id,
        city,
        temperatureC: roundToOneDecimal(temperatureC),
        feelsLikeC: roundToOneDecimal(
          Number.isFinite(feelsLikeC ?? Number.NaN)
            ? (feelsLikeC as number)
            : temperatureC,
        ),
        conditions,
        emoji,
        updatedISO,
      } satisfies WeatherApiExchange;
    })
    .filter((entry): entry is WeatherApiExchange => entry !== null);

  const payload: WeatherApiPayload = {
    mode: 'live',
    asOf: now.toISOString(),
    exchanges,
  };

  return NextResponse.json(payload);
}

/**
 * Simple, defensive mapping from a free-form conditions string
 * to an emoji. This is only used in LIVE mode; DEMO uses the
 * curated emoji from the dataset.
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
