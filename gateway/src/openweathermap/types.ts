/**
 * Promagen Gateway - OpenWeatherMap Types
 * =========================================
 * Type definitions for the OpenWeatherMap weather feed.
 *
 * Security: 10/10
 * - All types are readonly where possible
 * - Strict typing for API responses
 * - No 'any' types anywhere
 *
 * @module openweathermap/types
 */

// =============================================================================
// CITY TYPES (From SSOT Exchange Catalog)
// =============================================================================

/**
 * City information extracted from exchange catalog.
 * Used to determine which cities need weather data.
 */
export interface CityInfo {
  /** Exchange ID (e.g., "nyse-new-york") */
  readonly id: string;
  /** City name (e.g., "New York") */
  readonly city: string;
  /** Latitude (-90 to 90) */
  readonly lat: number;
  /** Longitude (-180 to 180) */
  readonly lon: number;
}

/**
 * Batch configuration for weather fetching.
 * Cities are split into two batches for budget efficiency.
 */
export interface WeatherBatches {
  /** Batch A: Priority cities (includes all selected exchanges) */
  readonly batchA: readonly CityInfo[];
  /** Batch B: Remaining cities */
  readonly batchB: readonly CityInfo[];
}

/**
 * Batch identifier for alternating hourly fetches.
 */
export type BatchId = 'A' | 'B';

// =============================================================================
// OPENWEATHERMAP API TYPES (RAW RESPONSE)
// =============================================================================

/**
 * Raw weather condition from OpenWeatherMap API.
 */
export interface OWMWeatherCondition {
  /** Weather condition ID */
  readonly id: number;
  /** Group of weather parameters (Rain, Snow, Extreme etc.) */
  readonly main: string;
  /** Weather condition within the group */
  readonly description: string;
  /** Weather icon ID */
  readonly icon: string;
}

/**
 * Raw main weather data from OpenWeatherMap API.
 */
export interface OWMMainData {
  /** Temperature (Celsius when units=metric) */
  readonly temp: number;
  /** Temperature feels like */
  readonly feels_like: number;
  /** Minimum temperature */
  readonly temp_min: number;
  /** Maximum temperature */
  readonly temp_max: number;
  /** Atmospheric pressure (hPa) */
  readonly pressure: number;
  /** Humidity percentage */
  readonly humidity: number;
  /** Sea level pressure (optional) */
  readonly sea_level?: number;
  /** Ground level pressure (optional) */
  readonly grnd_level?: number;
}

/**
 * Raw wind data from OpenWeatherMap API.
 */
export interface OWMWindData {
  /** Wind speed (m/s when units=metric) */
  readonly speed: number;
  /** Wind direction (degrees) */
  readonly deg: number;
  /** Wind gust (optional) */
  readonly gust?: number;
}

/**
 * Raw clouds data from OpenWeatherMap API.
 */
export interface OWMCloudsData {
  /** Cloudiness percentage */
  readonly all: number;
}

/**
 * Raw system data from OpenWeatherMap API.
 */
export interface OWMSysData {
  /** Country code */
  readonly country: string;
  /** Sunrise time (Unix, UTC) */
  readonly sunrise: number;
  /** Sunset time (Unix, UTC) */
  readonly sunset: number;
}

/**
 * Complete raw response from OpenWeatherMap Current Weather API.
 * GET /data/2.5/weather
 */
export interface OWMCurrentWeatherResponse {
  /** Weather conditions (can have multiple) */
  readonly weather: readonly OWMWeatherCondition[];
  /** Main weather data */
  readonly main: OWMMainData;
  /** Wind data */
  readonly wind: OWMWindData;
  /** Clouds data */
  readonly clouds: OWMCloudsData;
  /** System data */
  readonly sys: OWMSysData;
  /** City name */
  readonly name: string;
  /** City ID */
  readonly id: number;
  /** Visibility in meters */
  readonly visibility: number;
  /** Data calculation time (Unix, UTC) */
  readonly dt: number;
  /** Timezone shift from UTC (seconds) */
  readonly timezone: number;
  /** HTTP response code */
  readonly cod: number;
}

// =============================================================================
// NORMALISED WEATHER TYPES (PROMAGEN FORMAT)
// =============================================================================

/**
 * Normalised weather data for a single city.
 * This is what Promagen components consume.
 */
export interface WeatherData {
  /** Exchange ID (e.g., "nyse-new-york") */
  readonly id: string;
  /** City name (e.g., "New York") */
  readonly city: string;
  /** Temperature in Celsius */
  readonly temperatureC: number;
  /** Temperature in Fahrenheit */
  readonly temperatureF: number;
  /** Weather condition (e.g., "Clear", "Rain", "Snow") */
  readonly conditions: string;
  /** Detailed description (e.g., "light rain") */
  readonly description: string;
  /** Humidity percentage (0-100) */
  readonly humidity: number;
  /** Wind speed in km/h */
  readonly windSpeedKmh: number;
  /** Weather emoji for display */
  readonly emoji: string;
  /** Data timestamp (ISO format) */
  readonly asOf: string;
}

// =============================================================================
// GATEWAY RESPONSE TYPES
// =============================================================================

/**
 * Weather-specific response metadata.
 */
export interface WeatherResponseMeta {
  /** Data freshness mode */
  readonly mode: 'live' | 'cached' | 'stale' | 'fallback';
  /** When data was cached */
  readonly cachedAt?: string;
  /** When cache expires */
  readonly expiresAt?: string;
  /** Provider name */
  readonly provider: 'openweathermap';
  /** Current batch being fetched */
  readonly currentBatch: BatchId;
  /** When Batch A was last refreshed */
  readonly batchARefreshedAt?: string;
  /** When Batch B was last refreshed */
  readonly batchBRefreshedAt?: string;
  /** Budget state */
  readonly budget: {
    readonly state: 'ok' | 'warning' | 'blocked';
    readonly dailyUsed: number;
    readonly dailyLimit: number;
    readonly minuteUsed: number;
    readonly minuteLimit: number;
  };
}

/**
 * Complete weather gateway response.
 */
export interface WeatherGatewayResponse {
  readonly meta: WeatherResponseMeta;
  readonly data: readonly WeatherData[];
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate latitude is within valid range.
 * @param lat - Latitude to validate
 * @returns true if valid (-90 to 90)
 */
export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude is within valid range.
 * @param lon - Longitude to validate
 * @returns true if valid (-180 to 180)
 */
export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Type guard for OWM API response.
 * @param data - Unknown data to check
 * @returns true if data looks like a valid OWM response
 */
export function isOWMResponse(data: unknown): data is OWMCurrentWeatherResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  return (
    Array.isArray(obj['weather']) &&
    obj['weather'].length > 0 &&
    typeof obj['main'] === 'object' &&
    obj['main'] !== null &&
    typeof (obj['main'] as Record<string, unknown>)['temp'] === 'number' &&
    typeof obj['name'] === 'string'
  );
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Weather condition to emoji mapping.
 * Based on OpenWeatherMap condition groups.
 */
export const CONDITION_TO_EMOJI: Readonly<Record<string, string>> = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '🌧️',
  Drizzle: '🌦️',
  Thunderstorm: '⛈️',
  Snow: '❄️',
  Mist: '🌫️',
  Fog: '🌫️',
  Haze: '🌫️',
  Smoke: '🌫️',
  Dust: '🌫️',
  Sand: '🌫️',
  Ash: '🌋',
  Squall: '💨',
  Tornado: '🌪️',
} as const;

/**
 * Default emoji when condition is unknown.
 */
export const DEFAULT_EMOJI = '🌤️';

/**
 * Weather conditions that map to prompt atmospheres.
 * Used by Gallery Mode theme engine.
 */
export const CONDITION_TO_ATMOSPHERE: Readonly<Record<string, readonly string[]>> = {
  Clear: ['vibrant', 'bright', 'warm'],
  Clouds: ['overcast', 'soft light', 'muted'],
  Rain: ['moody', 'reflective', 'glistening'],
  Drizzle: ['moody', 'soft', 'misty'],
  Thunderstorm: ['dramatic', 'intense', 'electric'],
  Snow: ['serene', 'pristine', 'cold'],
  Mist: ['mysterious', 'ethereal', 'diffused'],
  Fog: ['mysterious', 'ethereal', 'diffused'],
  Haze: ['hazy', 'warm', 'diffused'],
} as const;
