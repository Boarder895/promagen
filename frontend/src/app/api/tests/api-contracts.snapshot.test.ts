// src/app/api/tests/api-contracts.snapshot.test.ts
// ────────────────────────────────────────────────────────────────────────────
// Contract snapshot tests for all API routes.
//
// Purpose:
//   Each route's response shape is a public contract consumed by the
//   frontend. These tests serialize the response KEY STRUCTURE (no volatile
//   values like timestamps or counts) and alert via Jest snapshots when the
//   shape changes.
//
//   This catches shape drift immediately — the exact problem that caused
//   the exchanges/providers test failures (tests expected { data: { items } }
//   but routes had moved to { exchanges } and bare arrays).
//
// How it works:
//   extractKeyStructure() replaces values with their typeof string and
//   recursively processes nested objects/arrays. The resulting skeleton
//   is snapshot-tested, so any added/removed/renamed key triggers a
//   snapshot mismatch that must be explicitly approved.
//
// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).
//
// Existing features preserved: Yes — new file, nothing modified.
// ────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from '@jest/globals';
import { NextRequest } from 'next/server';

import { extractKeyStructure } from './api-test-helpers';

// ─── Exchanges ───────────────────────────────────────────────────────────────

import { GET as getExchanges } from '@/app/api/exchanges/route';

describe('Contract: GET /api/exchanges', () => {
  it('response structure matches snapshot', async () => {
    const res = await getExchanges();
    const json = (await res.json()) as unknown;
    const structure = extractKeyStructure(json);

    expect(structure).toMatchSnapshot();
  });
});

// ─── Providers ───────────────────────────────────────────────────────────────

import { GET as getProviders } from '@/app/api/providers/route';

describe('Contract: GET /api/providers', () => {
  it('response structure matches snapshot', async () => {
    const res = await getProviders();
    const json = (await res.json()) as unknown;
    const structure = extractKeyStructure(json);

    expect(structure).toMatchSnapshot();
  });
});

// ─── FX ──────────────────────────────────────────────────────────────────────

// Mock gateway dependency so tests don't need a live Fly.io connection.
jest.mock('@/lib/fx/providers', () => {
   
  const { getDefaultFxPairsWithIndexForTier: getPairs } = require('@/data/fx');
  const pairs = getPairs('free');

  return {
    getFxRibbon: jest.fn(async () => ({
      meta: {
        mode: 'cached',
        buildId: 'test',
        sourceProvider: 'mock',
        asOf: new Date().toISOString(),
        cached: true,
        ttlSeconds: 300,
        ssotKey: 'test-ssot',
        budget: { state: 'ok' },
      },
      data: pairs.map((p: { id: string; base: string; quote: string; label: string; group: string }) => ({
        id: p.id,
        base: p.base,
        quote: p.quote,
        label: p.label,
        category: p.group || 'major',
        price: 1.0,
        change: 0.01,
        changePct: 0.5,
        providerSymbol: `${p.base}/${p.quote}`,
      })),
    })),
  };
});

import { GET as getFx } from '@/app/api/fx/route';

describe('Contract: GET /api/fx', () => {
  it('response structure matches snapshot', async () => {
    const req = new NextRequest('http://localhost/api/fx', {
      headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'jest' },
    });

    const res = await getFx(req);
    const json = (await res.json()) as unknown;
    const structure = extractKeyStructure(json);

    expect(structure).toMatchSnapshot();
  });
});

// ─── Weather ─────────────────────────────────────────────────────────────────

// Mock NextResponse.json (route uses it directly).
jest.mock('next/server', () => ({
  NextRequest: jest.requireActual('next/server').NextRequest,
  NextResponse: {
    json: jest.fn((payload: unknown, _init?: unknown) => ({
      ok: true,
      status: 200,
      json: async () => payload,
    })),
  },
}));

import { GET as getWeather } from '@/app/api/weather/route';

describe('Contract: GET /api/weather', () => {
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            meta: {
              mode: 'live',
              provider: 'openweathermap',
              currentBatch: 'A',
              batchARefreshedAt: '2026-01-01T00:00:00Z',
              budget: { state: 'ok', dailyUsed: 5, dailyLimit: 1000, minuteUsed: 1, minuteLimit: 60 },
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
                asOf: '2026-01-01T00:00:00Z',
                isDayTime: true,
              },
            ],
          }),
      } as Response),
    );
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it('response structure matches snapshot', async () => {
    const res = await getWeather();
    const json = (await (res as Response).json()) as unknown;
    const structure = extractKeyStructure(json);

    expect(structure).toMatchSnapshot();
  });
});
