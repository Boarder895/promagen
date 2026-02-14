// src/lib/weather/weather-types.ts
// ============================================================================
// WEATHER TYPES - EXTENDED FOR PROMPT GENERATION
// ============================================================================
// Extended weather types that include all API fields needed for:
// - Display in exchange cards (temp, emoji, conditions)
// - Dynamic prompt generation (humidity, wind, description)
// - Accurate day/night detection (sunrise, sunset, isDayTime)
//
// UPDATED v3.1.0 (12 Feb 2026):
// - ExchangeWeatherFull gains sunriseUtc, sunsetUtc, timezoneOffset, isDayTime
// - ExchangeWeatherDisplay gains matching optional fields
// - toDisplayWeather() and toFullWeather() pipe through new fields
// - Enables moon phase emoji at night, accurate sunrise/sunset threshold
//
// Authority: docs/authority/ribbon-homepage.md
// Existing features preserved: Yes
// ============================================================================

/**
 * Full weather data from API.
 * Includes all fields needed for prompt generation.
 *
 * v3.1.0: Added day/night detection fields from gateway.
 */
export interface ExchangeWeatherFull {
  /** Temperature in Celsius */
  temperatureC: number;
  /** Temperature in Fahrenheit */
  temperatureF: number;
  /** Short condition label (e.g., "Clear", "Rain") */
  conditions: string;
  /** Detailed description (e.g., "clear sky", "light rain") */
  description: string;
  /** Relative humidity percentage (0-100) */
  humidity: number;
  /** Wind speed in km/h */
  windSpeedKmh: number;
  /** Weather emoji from API */
  emoji: string;
  /**
   * Sunrise time as Unix timestamp (seconds, UTC).
   * From OWM sys.sunrise. null when demo data or API missing sys.
   * Used by prompt generator for exact day/night boundary.
   */
  sunriseUtc: number | null;
  /**
   * Sunset time as Unix timestamp (seconds, UTC).
   * From OWM sys.sunset. null when demo data or API missing sys.
   * Used by prompt generator for exact day/night boundary.
   */
  sunsetUtc: number | null;
  /**
   * City timezone offset from UTC in seconds.
   * From OWM timezone field (e.g., 28800 for UTC+8 Taipei).
   * null when demo data or API missing timezone.
   */
  timezoneOffset: number | null;
  /**
   * Whether it is currently daytime at this city.
   * Derived from OWM icon suffix: 'd' = day, 'n' = night.
   * OWM calculates this using the city's actual sunrise/sunset.
   * When null (demo data), prompt generator falls back to hour threshold.
   */
  isDayTime: boolean | null;
}

/**
 * Weather data for exchange card display.
 * Subset of full data used in UI.
 *
 * v3.1.0: Added day/night fields (all nullable for backward compat).
 */
export interface ExchangeWeatherDisplay {
  /** Temperature in Celsius; null if unavailable */
  tempC: number | null;
  /** Temperature in Fahrenheit; null if unavailable */
  tempF: number | null;
  /** Weather emoji; null triggers SSOT fallback */
  emoji: string | null;
  /** Condition text for accessibility */
  condition: string | null;
  /** Humidity percentage (for display) */
  humidity: number | null;
  /** Wind speed in km/h (for display) */
  windKmh: number | null;
  /** Full weather description (for tooltip) */
  description: string | null;
  /** Sunrise UTC timestamp; null if unavailable */
  sunriseUtc: number | null;
  /** Sunset UTC timestamp; null if unavailable */
  sunsetUtc: number | null;
  /** Timezone offset in seconds from UTC; null if unavailable */
  timezoneOffset: number | null;
  /** Whether it is daytime; null if unavailable */
  isDayTime: boolean | null;
}

/**
 * Convert API weather response to display format.
 */
export function toDisplayWeather(
  full: ExchangeWeatherFull | null | undefined
): ExchangeWeatherDisplay {
  if (!full) {
    return {
      tempC: null,
      tempF: null,
      emoji: null,
      condition: null,
      humidity: null,
      windKmh: null,
      description: null,
      sunriseUtc: null,
      sunsetUtc: null,
      timezoneOffset: null,
      isDayTime: null,
    };
  }

  return {
    tempC: full.temperatureC,
    tempF: full.temperatureF,
    emoji: full.emoji,
    condition: full.conditions,
    humidity: full.humidity,
    windKmh: full.windSpeedKmh,
    description: full.description,
    sunriseUtc: full.sunriseUtc,
    sunsetUtc: full.sunsetUtc,
    timezoneOffset: full.timezoneOffset,
    isDayTime: full.isDayTime,
  };
}

/**
 * Convert display weather back to full format for prompt generation.
 * Fills in missing values with reasonable defaults.
 */
export function toFullWeather(
  display: ExchangeWeatherDisplay
): ExchangeWeatherFull | null {
  if (display.tempC === null) return null;

  return {
    temperatureC: display.tempC,
    temperatureF: display.tempF ?? display.tempC * 9 / 5 + 32,
    conditions: display.condition ?? 'Unknown',
    // Only pass through real API descriptions (e.g., "haze", "broken clouds").
    // Demo data has description=null → empty string here → prompt builder skips it.
    description: display.description || '',
    humidity: display.humidity ?? 50,
    windSpeedKmh: display.windKmh ?? 5,
    emoji: display.emoji ?? '🌤️',
    sunriseUtc: display.sunriseUtc ?? null,
    sunsetUtc: display.sunsetUtc ?? null,
    timezoneOffset: display.timezoneOffset ?? null,
    // null means "unknown" — prompt generator will fall back to hour threshold
    isDayTime: display.isDayTime ?? null,
  };
}

/**
 * Temperature-based color for tooltip glow.
 * Returns hex color based on temperature range.
 */
export function getTemperatureColor(tempC: number): string {
  if (tempC < 0) return '#3B82F6';   // Deep blue - Freezing
  if (tempC < 10) return '#60A5FA';  // Ice blue - Cold
  if (tempC < 15) return '#22D3EE';  // Cyan - Cool
  if (tempC < 20) return '#22C55E';  // Green - Mild
  if (tempC < 25) return '#F59E0B';  // Amber - Warm
  if (tempC < 30) return '#F97316';  // Orange - Hot
  return '#EF4444';                   // Red - Scorching
}

/**
 * Get temperature description for accessibility.
 */
export function getTemperatureLabel(tempC: number): string {
  if (tempC < 0) return 'Freezing';
  if (tempC < 10) return 'Cold';
  if (tempC < 15) return 'Cool';
  if (tempC < 20) return 'Mild';
  if (tempC < 25) return 'Warm';
  if (tempC < 30) return 'Hot';
  return 'Scorching';
}

/**
 * Expanded emoji mapping for weather conditions.
 * Maps API conditions to appropriate emojis.
 */
export const WEATHER_EMOJI_MAP: Record<string, string> = {
  // Clear conditions
  'clear': '☀️',
  'clear sky': '☀️',
  'sunny': '🌞',
  
  // Clouds
  'partly cloudy': '🌤️',
  'few clouds': '🌤️',
  'scattered clouds': '⛅',
  'cloudy': '☁️',
  'broken clouds': '🌥️',
  'overcast': '🌫️',
  'overcast clouds': '🌫️',
  
  // Rain
  'light rain': '🌦️',
  'drizzle': '🌦️',
  'rain': '🌧️',
  'moderate rain': '🌧️',
  'heavy rain': '🌧️',
  'shower rain': '🌧️',
  
  // Storm
  'thunderstorm': '⛈️',
  'storm': '⛈️',
  'thunder': '🌩️',
  
  // Snow
  'snow': '❄️',
  'light snow': '🌨️',
  'heavy snow': '🌨️',
  'sleet': '🌨️',
  
  // Atmosphere
  'fog': '🌫️',
  'mist': '🌫️',
  'haze': '🌫️',
  'smoke': '🌫️',
  'dust': '🏜️',
  'sand': '🏜️',
  
  // Wind
  'windy': '💨',
  'breezy': '🌬️',
  
  // Extreme
  'tornado': '🌪️',
  'hurricane': '🌀',
};

/**
 * Get emoji for weather condition.
 * Falls back to generic weather emoji if not found.
 */
export function getWeatherEmoji(condition: string): string {
  const key = condition.toLowerCase().trim();
  return WEATHER_EMOJI_MAP[key] ?? '🌤️';
}
