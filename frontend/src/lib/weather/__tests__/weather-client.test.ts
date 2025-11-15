/** @jest-environment node */

// src/lib/weather/__tests__/weather-client.test.ts

/**
 * These tests focus on cache behaviour and basic wiring.
 * We mock fetch and environment variables so no real network calls happen.
 */

import { getOrFetchMarketWeather } from '../weather-client';

declare const global: typeof globalThis & {
  fetch: jest.Mock;
};

describe('weather-client getOrFetchMarketWeather', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();

    // Pretend we’re in a properly configured server environment by default.
    process.env = { ...ORIGINAL_ENV, VISUAL_CROSSING_API_KEY: 'test-key' };

    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('performs a fetch on first call and returns normalised data', async () => {
    const mockResponse = {
      currentConditions: {
        temp: 20,
        feelslike: 22,
        conditions: 'Clear',
        datetimeEpoch: 1_700_000_000,
      },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await getOrFetchMarketWeather(
      'lse-london',
      'London',
      51.5074,
      -0.1278,
      60_000, // 1 minute for the test
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('lse-london');
    expect(result.city).toBe('London');
    expect(result.temperatureC).toBe(20);
    expect(result.feelsLikeC).toBe(22);
    expect(result.conditions).toBe('Clear');
    expect(new Date(result.updatedISO).toString()).not.toBe('Invalid Date');
  });

  test('uses cache on subsequent calls within refresh interval', async () => {
    const mockResponse = {
      currentConditions: {
        temp: 10,
        feelslike: 8,
        conditions: 'Cloudy',
        datetimeEpoch: 1_700_000_000,
      },
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const key = 'nyse-new-york';

    const first = await getOrFetchMarketWeather(
      key,
      'New York',
      40.7128,
      -74.006,
      60_000,
    );
    const second = await getOrFetchMarketWeather(
      key,
      'New York',
      40.7128,
      -74.006,
      60_000,
    );

    // Only one network call – second result comes from cache.
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

    await expect(
      getOrFetchMarketWeather('test', 'Test City', 0, 0, 60_000),
    ).rejects.toThrow('VISUAL_CROSSING_API_KEY is not configured in the server environment.');
  });
});
