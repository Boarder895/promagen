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
      tempC: 12,
      feelsLikeC: 10,
      condition: 'rain',
      emoji: '🌧️',
    },
  ]),
}));

jest.mock('@/data/exchanges/exchanges.catalog.json', () => [
  {
    id: 'lse-london',
    city: 'London',
    exchange: 'London Stock Exchange',
    country: 'United Kingdom',
    iso2: 'GB',
    tz: 'Europe/London',
    longitude: -0.1,
    latitude: 51.5,
    hoursTemplate: 'uk-regular',
    holidaysRef: 'uk-lse',
    hemisphere: 'north',
  },
]);

jest.mock('@/data/exchanges/exchanges.selected.json', () => ({
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

  test('returns a list of weather entries with expected shape', async () => {
    const response = await GET();
    const body = await (response as Response).json();

    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBeGreaterThan(0);

    const first: any = (body as unknown[])[0];

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
