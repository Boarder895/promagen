import { describe, it, expect } from '@jest/globals';

import { GET } from '@/app/api/fx/route';
import { getDefaultFxPairsWithIndexForTier } from '@/data/fx';
import type { FxApiResponse } from '@/types/finance-ribbon';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFxApiResponse(x: unknown): x is FxApiResponse {
  if (!isPlainObject(x)) return false;

  const meta = x.meta;
  const data = x.data;

  if (!isPlainObject(meta)) return false;
  if (!Array.isArray(data)) return false;

  const buildId = meta.buildId;
  const mode = meta.mode;
  const sourceProvider = meta.sourceProvider;
  const asOf = meta.asOf;

  if (typeof buildId !== 'string') return false;
  if (typeof mode !== 'string') return false;
  if (typeof sourceProvider !== 'string') return false;
  if (typeof asOf !== 'string') return false;

  for (const item of data) {
    if (!isPlainObject(item)) return false;

    if (typeof item.id !== 'string') return false;
    if (typeof item.base !== 'string') return false;
    if (typeof item.quote !== 'string') return false;
    if (typeof item.label !== 'string') return false;
    if (typeof item.category !== 'string') return false;

    const price = item.price;
    const change = item.change;
    const changePct = item.changePct;

    const priceOk = price === null || (typeof price === 'number' && Number.isFinite(price));
    const changeOk = change === null || (typeof change === 'number' && Number.isFinite(change));
    const changePctOk =
      changePct === null || (typeof changePct === 'number' && Number.isFinite(changePct));

    if (!priceOk || !changeOk || !changePctOk) return false;
  }

  return true;
}

describe('GET /api/fx', () => {
  it('returns the canonical { meta, data, error? } payload shape', async () => {
    const res = await GET();
    const json = (await res.json()) as unknown;

    expect(isFxApiResponse(json)).toBe(true);
  });

  it('always returns N quotes in SSOT order (never data:[])', async () => {
    const expectedIds = getDefaultFxPairsWithIndexForTier('free').map((p) => p.id);

    const res = await GET();
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
