/**
 * Promagen Frontend - Weather Hook
 * ==================================
 * Polling hook for weather data, aligned to :10 and :40.
 *
 * Usage:
 * ```tsx
 * const { weather, isLoading, error } = useWeather();
 * const nyWeather = weather['nyse-new-york'];
 * ```
 *
 * @module hooks/use-weather
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface WeatherData {
  id: string;
  city: string;
  temperatureC: number;
  temperatureF: number;
  conditions: string;
  description: string;
  humidity: number;
  windSpeedKmh: number;
  emoji: string;
  asOf: string;
}

export interface WeatherMeta {
  mode: 'live' | 'cached' | 'stale' | 'fallback' | 'error';
  cachedAt?: string;
  expiresAt?: string;
  provider: string;
  currentBatch: 'A' | 'B' | 'C' | 'D';
}

export interface UseWeatherResult {
  /** Weather data indexed by exchange ID */
  weather: Record<string, WeatherData>;
  /** Raw array of weather data */
  weatherArray: WeatherData[];
  /** Response metadata */
  meta: WeatherMeta | null;
  /** Loading state (true during initial fetch) */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Weather refresh slots (minutes past hour) - guaranteed non-empty */
// v3.0.0: Gateway only fires at :10 (dropped :40 for budget)
const WEATHER_SLOTS: readonly [number, ...number[]] = [10] as const;

/** Minimum poll interval (1 minute) */
const MIN_POLL_MS = 60_000;

/** Maximum poll interval (35 minutes - ensures we catch both slots) */
const MAX_POLL_MS = 35 * 60_000;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate milliseconds until next weather refresh slot.
 */
function getMsUntilNextSlot(): number {
  const now = new Date();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentMs = now.getMilliseconds();

  // Find next slot
  let nextSlotMinute = WEATHER_SLOTS.find((s) => s > currentMinute);

  // If no slot in current hour, wrap to first slot + 60
  // WEATHER_SLOTS[0] is guaranteed to exist due to tuple type
  if (nextSlotMinute === undefined) {
    nextSlotMinute = WEATHER_SLOTS[0] + 60;
  }

  // Calculate ms until slot
  const minutesUntil = nextSlotMinute - currentMinute;
  const msUntil = minutesUntil * 60_000 - currentSecond * 1000 - currentMs;

  // Add 30 seconds buffer (let gateway refresh first)
  const withBuffer = msUntil + 30_000;

  // Clamp to reasonable range
  return Math.max(MIN_POLL_MS, Math.min(MAX_POLL_MS, withBuffer));
}

// =============================================================================
// HOOK
// =============================================================================

export function useWeather(): UseWeatherResult {
  const [weatherMap, setWeatherMap] = useState<Record<string, WeatherData>>({});
  const [weatherArray, setWeatherArray] = useState<WeatherData[]>([]);
  const [meta, setMeta] = useState<WeatherMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch weather data from API.
   */
  const fetchWeather = useCallback(async () => {
    try {
      const response = await fetch('/api/weather', {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        meta: WeatherMeta;
        data: WeatherData[];
      };

      if (!isMountedRef.current) return;

      // Build lookup map by exchange ID
      const map: Record<string, WeatherData> = {};
      for (const w of data.data) {
        map[w.id] = w;
      }

      setWeatherMap(map);
      setWeatherArray(data.data);
      setMeta(data.meta);
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error('[useWeather] Fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Schedule next fetch aligned to weather slots.
   */
  const scheduleNext = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const msUntil = getMsUntilNextSlot();

    timerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      // Only fetch if tab is visible
      if (document.visibilityState === 'visible') {
        void fetchWeather().then(scheduleNext);
      } else {
        // Tab hidden - just reschedule
        scheduleNext();
      }
    }, msUntil);
  }, [fetchWeather]);

  /**
   * Manual refresh (exposed to consumers).
   */
  const refresh = useCallback(async () => {
    await fetchWeather();
  }, [fetchWeather]);

  // Initial fetch + schedule
  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    void fetchWeather().then(() => {
      scheduleNext();
    });

    // Handle visibility changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - fetch if stale
        void fetchWeather();
        scheduleNext();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchWeather, scheduleNext]);

  return {
    weather: weatherMap,
    weatherArray,
    meta,
    isLoading,
    error,
    refresh,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get weather for a specific exchange.
 */
export function getWeatherForExchange(
  weather: Record<string, WeatherData>,
  exchangeId: string
): WeatherData | null {
  return weather[exchangeId] ?? null;
}

/**
 * Format temperature for display.
 */
export function formatTemperature(weather: WeatherData | null, unit: 'C' | 'F' = 'C'): string {
  if (!weather) return '—';
  const temp = unit === 'C' ? weather.temperatureC : weather.temperatureF;
  return `${Math.round(temp)}°${unit}`;
}

/**
 * Get atmosphere tags for prompt generation (Gallery Mode).
 */
export function getAtmosphereTags(weather: WeatherData | null): string[] {
  if (!weather) return [];

  const CONDITION_TO_ATMOSPHERE: Record<string, string[]> = {
    Clear: ['vibrant', 'bright', 'warm'],
    Clouds: ['overcast', 'soft light', 'muted'],
    Rain: ['moody', 'reflective', 'glistening'],
    Drizzle: ['moody', 'soft', 'misty'],
    Thunderstorm: ['dramatic', 'intense', 'electric'],
    Snow: ['serene', 'pristine', 'cold'],
    Mist: ['mysterious', 'ethereal', 'diffused'],
    Fog: ['mysterious', 'ethereal', 'diffused'],
    Haze: ['hazy', 'warm', 'diffused'],
  };

  return CONDITION_TO_ATMOSPHERE[weather.conditions] ?? [];
}
