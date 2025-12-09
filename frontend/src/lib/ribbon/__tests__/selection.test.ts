// frontend/src/lib/ribbon/__tests__/selection.test.tsx

import { selectForRibbon, type SelectionResult } from '../selection';

interface FxPair {
  id: string;
  label: string;
}

interface Commodity {
  id: string;
  label: string;
}

interface CryptoAsset {
  id: string;
  label: string;
}

describe('selectForRibbon – FX pairs', () => {
  const catalogue: FxPair[] = [
    { id: 'gbp-usd', label: 'GBP / USD' },
    { id: 'eur-usd', label: 'EUR / USD' },
    { id: 'usd-jpy', label: 'USD / JPY' },
    { id: 'aud-usd', label: 'AUD / USD' },
  ];

  it('selects requested pairs in order, respecting maxItems, and reports missing', () => {
    const requested = ['gbp-usd', 'eur-usd', 'nzd-cad', 'usd-jpy'] as const;

    const result: SelectionResult<FxPair, string> = selectForRibbon<FxPair, string>({
      allItems: catalogue,
      requestedIds: requested as unknown as string[],
      maxItems: 3,
      getId: (item: FxPair) => item.id,
    });

    // Items that actually exist in the catalogue
    expect(result.items.map((a: FxPair) => a.id)).toEqual(['gbp-usd', 'eur-usd', 'usd-jpy']);

    // Only first 3 can be selected because maxItems = 3
    expect(result.selected.map((a: FxPair) => a.id)).toEqual(['gbp-usd', 'eur-usd', 'usd-jpy']);
    expect(result.extras).toHaveLength(0);

    // One requested id is missing from the catalogue
    expect(result.missing).toEqual(['nzd-cad']);

    const counts = result.counts;
    const total = Object.values(counts).reduce((sum: number, value: number) => sum + value, 0);

    expect(counts.requested).toBe(4);
    expect(counts.matched).toBe(3);
    expect(counts.selected).toBe(3);
    expect(counts.extras).toBe(0);
    expect(counts.missing).toBe(1);
    expect(total).toBeGreaterThan(0);
  });
});

describe('selectForRibbon – Commodities', () => {
  const catalogue: Commodity[] = [
    { id: 'gold', label: 'Gold' },
    { id: 'silver', label: 'Silver' },
    { id: 'brent', label: 'Brent Crude' },
    { id: 'wti', label: 'WTI Crude' },
  ];

  it('handles overflow into extras when maxItems is small', () => {
    const requested = ['gold', 'silver', 'brent', 'wti'] as const;

    const result: SelectionResult<Commodity, string> = selectForRibbon<Commodity, string>({
      allItems: catalogue,
      requestedIds: requested as unknown as string[],
      maxItems: 2,
      getId: (item: Commodity) => item.id,
    });

    expect(result.selected.map((a: Commodity) => a.id)).toEqual(['gold', 'silver']);
    expect(result.extras.map((a: Commodity) => a.id)).toEqual(['brent', 'wti']);
    expect(result.missing).toEqual([]);

    const counts = result.counts;
    expect(counts.requested).toBe(4);
    expect(counts.matched).toBe(4);
    expect(counts.selected).toBe(2);
    expect(counts.extras).toBe(2);
    expect(counts.missing).toBe(0);
  });
});

describe('selectForRibbon – Crypto assets', () => {
  const catalogue: CryptoAsset[] = [
    { id: 'btc-usd', label: 'BTC / USD' },
    { id: 'eth-usd', label: 'ETH / USD' },
    { id: 'sol-usd', label: 'SOL / USD' },
  ];

  it('returns a valid SelectionResult shape for crypto', () => {
    const requested = ['btc-usd', 'doge-usd'] as const;

    const result: SelectionResult<CryptoAsset, string> = selectForRibbon<CryptoAsset, string>({
      allItems: catalogue,
      requestedIds: requested as unknown as string[],
      maxItems: 5,
      getId: (item: CryptoAsset) => item.id,
    });

    expect(result.items.map((a: CryptoAsset) => a.id)).toEqual(['btc-usd']);
    expect(result.selected.map((a: CryptoAsset) => a.id)).toEqual(['btc-usd']);
    expect(result.extras).toHaveLength(0);
    expect(result.missing).toEqual(['doge-usd']);

    const counts = result.counts;
    const sum = Object.values(counts).reduce((acc: number, value: number) => acc + value, 0);

    expect(sum).toBeGreaterThan(0);
  });
});
