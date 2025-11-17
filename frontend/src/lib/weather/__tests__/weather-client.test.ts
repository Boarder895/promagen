/** @jest-environment node */

// src/lib/weather/__tests__/weather-client.test.ts

/**
 * These tests focus on cache behaviour and basic wiring.
 * We mock fetch and environment variables so no real network calls happen.
 */

import { getOrFetchMarketWeather, __resetWeatherCache } from '../weather-client';

declare const global: typeof globalThis & {
  fetch: jest.Mock;
};

describe('weather-client getOrFetchMarketWeather', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      VISUAL_CROSSING_API_KEY: 'test-key',
    };

    global.fetch = jest.fn();
    __resetWeatherCache();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetAllMocks();
  });

  test('fetches from Visual Crossing when cache is empty', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentConditions: {
          temp: 20,
          feelslike: 22,
          conditions: 'Partly cloudy',
          datetimeEpoch: 1_700_000_000,
        },
      }),
    });

    const result = await getOrFetchMarketWeather('lse-london', 'London', 51.5, -0.1, 60_000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('lse-london');
    expect(result.city).toBe('London');
    expect(result.temperatureC).toBe(20);
    expect(result.feelsLikeC).toBe(22);
    expect(result.conditions).toBe('Partly cloudy');
  });

  test('uses cache when entry is still fresh', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        currentConditions: {
          temp: 10,
          feelslike: 11,
          conditions: 'Cloudy',
          datetimeEpoch: 1_700_000_000,
        },
      }),
    });

    const first = await getOrFetchMarketWeather('lse-london', 'London', 51.5, -0.1, 60_000);
    const second = await getOrFetchMarketWeather('lse-london', 'London', 51.5, -0.1, 60_000);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  test('throws when VISUAL_CROSSING_API_KEY is missing', async () => {
    // Remove the key for this test only.
    process.env = { ...ORIGINAL_ENV };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(getOrFetchMarketWeather('test', 'Test City', 0, 0, 60_000)).rejects.toThrow(
      'VISUAL_CROSSING_API_KEY is not configured in the server environment.',
    );
  });
});
