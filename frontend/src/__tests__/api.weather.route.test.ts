// src/__tests__/api.weather.route.test.ts

/**
 * App-scoped test for the /api/weather route.
 *
 * We focus on:
 * - shape of the payload
 * - that DEMO mode uses the demo dataset
 */

import { NextResponse } from 'next/server';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((payload: unknown) => {
      // Rough shim of NextResponse.json for testing.
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      } as Response;
    }),
  },
}));

jest.mock('@/lib/weather/exchange-weather', () => ({
  listExchangeWeather: jest.fn(() => [
    {
      exchange: 'lse-london',
      tempC: 16,
      feelsLikeC: 14,
      condition: 'rain',
      emoji: '🌧️',
      iconOverride: '',
    },
  ]),
}));

jest.mock('@/data/exchanges.catalog.json', () => [
  {
    id: 'lse-london',
    city: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
  },
]);

jest.mock('@/data/exchanges.selected.json', () => ({
  ids: ['lse-london'],
}));

// Import AFTER mocks so that the route sees the mocks.
import { GET } from '@/app/api/weather/route';

describe('/api/weather (DEMO mode)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, WEATHER_MODE: 'demo' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  test('returns a well-formed payload with demo mode and one exchange', async () => {
    const response = await GET();

    const body = (await (response as unknown as Response).json()) as {
      mode: string;
      asOf: string;
      exchanges: Array<{
        id: string;
        city: string;
        temperatureC: number;
        feelsLikeC: number;
        conditions: string;
        emoji: string;
        updatedISO: string;
      }>;
    };

    expect(body.mode).toBe('demo');
    expect(Array.isArray(body.exchanges)).toBe(true);
    expect(body.exchanges.length).toBe(1);

    // Non-null assertion is safe here because we just asserted length === 1.
    const first = body.exchanges[0]!;

    expect(first.id).toBe('lse-london');
    expect(first.city).toBe('London');
    expect(typeof first.temperatureC).toBe('number');
    expect(typeof first.feelsLikeC).toBe('number');
    expect(first.conditions).toBe('rain');
    expect(first.emoji).toBe('🌧️');
    expect(new Date(first.updatedISO).toString()).not.toBe('Invalid Date');
  });

  test('uses NextResponse.json under the hood', async () => {
    await GET();
    expect(NextResponse.json).toHaveBeenCalledTimes(1);
  });
});
