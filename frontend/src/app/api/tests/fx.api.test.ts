import { describe, it, expect } from '@jest/globals';

import { NextRequest } from 'next/server';

import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';
import { isFxApiResponse } from './api-test-helpers';

// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).

// ---------------------------------------------------------------------------
// Mock getFxRibbon so tests don't require a live gateway.
// Uses SSOT pair data so the "N quotes in SSOT order" test works.
// ---------------------------------------------------------------------------
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

// Import route AFTER mocks are set up.
import { GET } from '@/app/api/fx/route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/fx', {
    headers: {
      // Helps your route's request-id + rate-limit logic behave deterministically in tests.
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'jest',
    },
  });
}

describe('GET /api/fx', () => {
  it('returns the canonical { meta, data, error? } payload shape', async () => {
    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown;

    expect(isFxApiResponse(json)).toBe(true);
  });

  it('always returns N quotes in SSOT order (never data:[])', async () => {
    const expectedIds = getDefaultFxPairsWithIndexForTier('free').map((p) => p.id);

    const res = await GET(makeRequest());
    const json = (await res.json()) as unknown;

    if (!isFxApiResponse(json)) {
      throw new Error('Response failed FxApiResponse guard');
    }

    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(expectedIds.length);

    const receivedIds = json.data.map((q) => q.id);
    expect(receivedIds).toEqual(expectedIds);
  });
});
