// frontend/src/__tests__/__finance-ribbon.contracts.test.tsx

import { selectForRibbon, type SelectionResult } from '../lib/ribbon/selection';

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

/**
 * High-level contract test making sure the ribbon selection layer behaves
 * consistently for FX, Commodities and Crypto. This test is intentionally
 * simple and focuses on type shape and basic behaviour rather than UI.
 */
describe('Finance ribbon selection contracts', () => {
  it('produces a valid SelectionResult for FX, Commodities and Crypto', () => {
    const fxCatalogue: FxPair[] = [
      { id: 'gbp-usd', label: 'GBP / USD' },
      { id: 'eur-usd', label: 'EUR / USD' },
    ];

    const commoditiesCatalogue: Commodity[] = [
      { id: 'gold', label: 'Gold' },
      { id: 'brent', label: 'Brent Crude' },
    ];

    const cryptoCatalogue: CryptoAsset[] = [
      { id: 'btc-usd', label: 'BTC / USD' },
      { id: 'eth-usd', label: 'ETH / USD' },
    ];

    const fxResult: SelectionResult<FxPair, string> = selectForRibbon<FxPair, string>({
      allItems: fxCatalogue,
      requestedIds: ['gbp-usd', 'usd-jpy'],
      maxItems: 2,
      getId: (item: FxPair) => item.id,
    });

    const commoditiesResult: SelectionResult<Commodity, string> = selectForRibbon<
      Commodity,
      string
    >({
      allItems: commoditiesCatalogue,
      requestedIds: ['gold', 'wti'],
      maxItems: 2,
      getId: (item: Commodity) => item.id,
    });

    const cryptoResult: SelectionResult<CryptoAsset, string> = selectForRibbon<CryptoAsset, string>(
      {
        allItems: cryptoCatalogue,
        requestedIds: ['btc-usd', 'doge-usd'],
        maxItems: 2,
        getId: (item: CryptoAsset) => item.id,
      },
    );

    // FX
    expect(fxResult.selected.map((a: FxPair) => a.id)).toEqual(['gbp-usd']);
    expect(fxResult.missing).toEqual(['usd-jpy']);

    // Commodities
    expect(commoditiesResult.selected.map((a: Commodity) => a.id)).toEqual(['gold']);
    expect(commoditiesResult.missing).toEqual(['wti']);

    // Crypto
    expect(cryptoResult.selected.map((a: CryptoAsset) => a.id)).toEqual(['btc-usd']);
    expect(cryptoResult.missing).toEqual(['doge-usd']);

    // Sanity-check counts for one of them to make sure aggregation behaves.
    const counts = fxResult.counts;
    const sum = Object.values(counts).reduce((acc: number, value: number) => acc + value, 0);

    expect(counts.requested).toBe(2);
    expect(counts.matched).toBe(1);
    expect(counts.selected).toBe(1);
    expect(counts.missing).toBe(1);
    expect(sum).toBeGreaterThan(0);
  });
});
