import { getFxRibbon } from '..';

describe('Promagen API Gateway — FX demo mode', () => {
  test('getFxRibbon returns a non-empty pairs array when forced to demo provider', async () => {
    const result = await getFxRibbon({
      forceProviderId: 'demo',
      bypassCache: true,
    });

    expect(result.mode).toBe('demo');
    expect(result.sourceProvider).toBe('demo');

    expect(Array.isArray(result.pairs)).toBe(true);
    expect(result.pairs.length).toBeGreaterThan(0);

    for (const quote of result.pairs) {
      expect(typeof quote.pair).toBe('string');
      expect(quote.pair.length).toBeGreaterThan(0);

      expect(typeof quote.base).toBe('string');
      expect(quote.base.length).toBe(3);

      expect(typeof quote.quote).toBe('string');
      expect(quote.quote.length).toBe(3);

      expect(typeof quote.price).toBe('number');
      expect(Number.isFinite(quote.price)).toBe(true);
    }
  });
});
