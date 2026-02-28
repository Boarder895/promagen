// src/__tests__/api.weather.route.test.ts

/**
 * App-scoped test for the /api/weather route.
 *
 * The route is a pure proxy to the Fly.io gateway /weather endpoint.
 * We mock global.fetch to simulate the gateway response and verify
 * the route returns the expected shape.
 */

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((payload: unknown, _init?: unknown) => {
      // Rough shim of NextResponse.json for testing.
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      } as Response;
    }),
  },
}));

// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).

import { NextResponse } from 'next/server';

// Import AFTER mocks so that the route sees the NextResponse shim.
import { GET } from '@/app/api/weather/route';

const MOCK_GATEWAY_RESPONSE = {
  meta: {
    mode: 'live' as const,
    provider: 'openweathermap',
    currentBatch: 'A' as const,
    batchARefreshedAt: new Date().toISOString(),
    budget: {
      state: 'ok',
      dailyUsed: 5,
      dailyLimit: 1000,
      minuteUsed: 1,
      minuteLimit: 60,
    },
  },
  data: [
    {
      id: 'lse-london',
      city: 'London',
      temperatureC: 12,
      temperatureF: 54,
      conditions: 'rain',
      description: 'Light rain',
      humidity: 80,
      windSpeedKmh: 15,
      emoji: '🌧️',
      asOf: new Date().toISOString(),
      isDayTime: true,
    },
  ],
};

describe('/api/weather (proxy mode)', () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MOCK_GATEWAY_RESPONSE),
      } as Response),
    );
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  test('returns gateway weather data with expected shape', async () => {
    const response = await GET();
    const body = (await (response as Response).json()) as typeof MOCK_GATEWAY_RESPONSE;

    // Route passes through the gateway { meta, data } envelope.
    expect(body.meta).toBeDefined();
    expect(body.meta.mode).toBe('live');
    expect(body.meta.provider).toBe('openweathermap');

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);

    const first = body.data[0];
    if (!first) throw new Error('Expected at least one weather item');
    expect(first.id).toBe('lse-london');
    expect(first.city).toBe('London');
    expect(typeof first.temperatureC).toBe('number');
    expect(first.conditions).toBe('rain');
    expect(first.emoji).toBe('🌧️');
  });

  test('uses NextResponse.json under the hood', async () => {
    await GET();
    expect(NextResponse.json).toHaveBeenCalledTimes(1);
  });

  test('returns error envelope when gateway is unavailable', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.resolve({}),
      } as Response),
    );

    const response = await GET();
    const body = (await (response as Response).json()) as Record<string, unknown>;

    expect(body.error).toBe('Weather data unavailable');
  });
});
