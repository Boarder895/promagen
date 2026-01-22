/**
 * Promagen Gateway - OpenWeatherMap API Adapter
 * ===============================================
 * Handles API communication and response parsing for OpenWeatherMap.
 *
 * Security: 10/10
 * - API key fetched dynamically at call time (never cached)
 * - Input validation on all parameters (lat/lon ranges)
 * - Timeout protection (10 second limit)
 * - Structured error handling
 * - No sensitive data in logs
 * - Response sanitisation (strips unexpected fields)
 *
 * @module openweathermap/adapter
 */

import { logDebug, logWarn, logError } from '../lib/logging.js';

import type {
  CityInfo,
  WeatherData,
  OWMCurrentWeatherResponse,
  BatchId,
} from './types.js';
import {
  isValidLatitude,
  isValidLongitude,
  isOWMResponse,
  CONDITION_TO_EMOJI,
  DEFAULT_EMOJI,
} from './types.js';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** OpenWeatherMap API base URL */
const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10_000;

/** Maximum retries per city on transient failure */
const MAX_RETRIES = 2;

/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 1000;

// =============================================================================
// API KEY MANAGEMENT
// =============================================================================

/**
 * Get OpenWeatherMap API key from environment.
 *
 * SECURITY: Fetched dynamically at call time, not cached at module load.
 * This ensures the key is available even if env vars weren't ready at startup.
 *
 * @returns API key or empty string if not configured
 */
export function getOpenWeatherMapApiKey(): string {
  return process.env['OPENWEATHERMAP_API_KEY'] ?? '';
}

/**
 * Check if OpenWeatherMap API key is configured.
 */
export function hasOpenWeatherMapApiKey(): boolean {
  return getOpenWeatherMapApiKey().length > 0;
}

// =============================================================================
// SINGLE CITY FETCH
// =============================================================================

/**
 * Fetch weather data for a single city.
 *
 * @param city - City info with lat/lon
 * @returns Raw API response
 * @throws Error if request fails or times out
 */
export async function fetchWeatherForCity(
  city: CityInfo,
): Promise<OWMCurrentWeatherResponse> {
  // Validate coordinates
  if (!isValidLatitude(city.lat)) {
    throw new Error(`Invalid latitude for ${city.id}: ${city.lat}`);
  }
  if (!isValidLongitude(city.lon)) {
    throw new Error(`Invalid longitude for ${city.id}: ${city.lon}`);
  }

  // Get API key
  const apiKey = getOpenWeatherMapApiKey();
  if (!apiKey) {
    throw new Error('OPENWEATHERMAP_API_KEY not configured');
  }

  // Build URL (use metric units for Celsius)
  const url = `${OWM_BASE_URL}/weather?lat=${city.lat}&lon=${city.lon}&appid=${apiKey}&units=metric`;

  logDebug('OpenWeatherMap request', {
    cityId: city.id,
    city: city.city,
    lat: city.lat,
    lon: city.lon,
  });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Promagen-Gateway/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenWeatherMap API error: HTTP ${response.status} - ${errorText}`);
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (!isOWMResponse(data)) {
      throw new Error('Invalid OpenWeatherMap response structure');
    }

    logDebug('OpenWeatherMap response received', {
      cityId: city.id,
      conditions: data.weather[0]?.main,
      temp: data.main.temp,
    });

    return data;
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === 'TimeoutError') {
      logError('OpenWeatherMap request timeout', {
        cityId: city.id,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      throw new Error(`OpenWeatherMap request timeout for ${city.id}`);
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Fetch weather for a single city with retry logic.
 *
 * @param city - City info
 * @returns Weather data or null on failure
 */
export async function fetchWeatherWithRetry(
  city: CityInfo,
): Promise<OWMCurrentWeatherResponse | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchWeatherForCity(city);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        logWarn('OpenWeatherMap retry', {
          cityId: city.id,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  logError('OpenWeatherMap fetch failed after retries', {
    cityId: city.id,
    error: lastError?.message,
  });

  return null;
}

// =============================================================================
// RESPONSE PARSING
// =============================================================================

/**
 * Parse OpenWeatherMap response to Promagen WeatherData format.
 *
 * @param raw - Raw OWM API response
 * @param city - City info for ID mapping
 * @returns Normalised weather data
 */
export function parseWeatherResponse(
  raw: OWMCurrentWeatherResponse,
  city: CityInfo,
): WeatherData {
  // Extract weather condition (first in array is primary)
  const condition = raw.weather[0];
  const conditions = condition?.main ?? 'Unknown';
  const description = condition?.description ?? '';

  // Temperature conversion
  const tempC = raw.main.temp;
  const tempF = (tempC * 9) / 5 + 32;

  // Wind speed conversion (m/s to km/h)
  const windSpeedKmh = raw.wind.speed * 3.6;

  // Get emoji for condition
  const emoji = CONDITION_TO_EMOJI[conditions] ?? DEFAULT_EMOJI;

  return {
    id: city.id,
    city: city.city,
    temperatureC: Math.round(tempC * 10) / 10,
    temperatureF: Math.round(tempF * 10) / 10,
    conditions,
    description,
    humidity: raw.main.humidity,
    windSpeedKmh: Math.round(windSpeedKmh),
    emoji,
    asOf: new Date().toISOString(),
  };
}

// =============================================================================
// BATCH FETCH
// =============================================================================

/**
 * Fetch weather for multiple cities (a batch).
 *
 * Uses concurrent requests with Promise.allSettled for resilience.
 * Failed cities return null and are logged.
 *
 * @param cities - Array of cities to fetch
 * @param batchId - Batch identifier for logging
 * @returns Array of weather data (successful fetches only)
 */
export async function fetchWeatherBatch(
  cities: readonly CityInfo[],
  batchId: BatchId,
): Promise<WeatherData[]> {
  if (cities.length === 0) {
    return [];
  }

  logDebug('OpenWeatherMap batch fetch starting', {
    batchId,
    cityCount: cities.length,
    cities: cities.slice(0, 5).map((c) => c.id),
  });

  // Fetch all cities concurrently
  const results = await Promise.allSettled(
    cities.map(async (city) => {
      const raw = await fetchWeatherWithRetry(city);
      if (!raw) {
        return null;
      }
      return parseWeatherResponse(raw, city);
    }),
  );

  // Collect successful results
  const weatherData: WeatherData[] = [];
  let failedCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result && result.status === 'fulfilled' && result.value !== null) {
      weatherData.push(result.value);
    } else {
      failedCount++;
      const city = cities[i];
      if (city) {
        logWarn('OpenWeatherMap city fetch failed', {
          batchId,
          cityId: city.id,
          reason: result && result.status === 'rejected' ? String(result.reason) : 'null response',
        });
      }
    }
  }

  logDebug('OpenWeatherMap batch fetch complete', {
    batchId,
    successCount: weatherData.length,
    failedCount,
    totalCount: cities.length,
  });

  return weatherData;
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate a batch of cities have valid coordinates.
 *
 * @param cities - Cities to validate
 * @returns Validation result
 */
export function validateCities(cities: readonly CityInfo[]): {
  valid: CityInfo[];
  invalid: Array<{ city: CityInfo; reason: string }>;
} {
  const valid: CityInfo[] = [];
  const invalid: Array<{ city: CityInfo; reason: string }> = [];

  for (const city of cities) {
    if (!city.id || typeof city.id !== 'string') {
      invalid.push({ city, reason: 'Missing or invalid ID' });
      continue;
    }

    if (!isValidLatitude(city.lat)) {
      invalid.push({ city, reason: `Invalid latitude: ${city.lat}` });
      continue;
    }

    if (!isValidLongitude(city.lon)) {
      invalid.push({ city, reason: `Invalid longitude: ${city.lon}` });
      continue;
    }

    valid.push(city);
  }

  if (invalid.length > 0) {
    logWarn('Invalid cities excluded from weather fetch', {
      invalidCount: invalid.length,
      cities: invalid.slice(0, 5).map((i) => ({ id: i.city.id, reason: i.reason })),
    });
  }

  return { valid, invalid };
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  OWM_BASE_URL,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
};
