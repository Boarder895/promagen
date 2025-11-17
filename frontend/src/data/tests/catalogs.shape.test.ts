/**
 * Lightweight shape checks for Promagen data catalogs.
 * Kept intentionally permissive so regular data edits don’t break CI.
 */
import exchangesCatalog from '@/data/exchanges/exchanges.catalog.json';
import exchangesSelectedJson from '@/data/exchanges/exchanges.selected.json';
import providers from '@/data/providers/providers.json';
import currenciesCatalog from '@/data/fx/currencies.catalog.json';
import countryCurrencyMap from '@/data/fx/country-currency.map.json';

type ExchangesSelected = { ids: string[] };

describe('catalogs basic shape', () => {
  it('loads arrays where expected', () => {
    expect(Array.isArray(exchangesCatalog)).toBe(true);
    expect(Array.isArray(providers)).toBe(true);
  });

  it('exchanges.selected has an ids array', () => {
    const selected = exchangesSelectedJson as unknown as ExchangesSelected;
    expect(Array.isArray(selected.ids)).toBe(true);
    expect(selected.ids.length).toBeGreaterThan(0);
  });

  it('currency catalogs and maps are present', () => {
    expect(typeof currenciesCatalog).toBe('object');
    expect(currenciesCatalog).not.toBeNull();

    expect(typeof countryCurrencyMap).toBe('object');
    expect(countryCurrencyMap).not.toBeNull();
  });
});
