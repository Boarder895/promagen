import exchangesCatalogJson from '../../exchanges/exchanges.catalog.json';
import { getCommoditiesForCountryName } from '../country-commodities.map';

interface ExchangeCountry {
  id: string;
  country: string;
}

describe('exchanges-country coverage', () => {
  it('ensures every exchange country has a matching country-commodities row', () => {
    const exchanges = exchangesCatalogJson as ExchangeCountry[];

    const missingCountriesSet = new Set<string>();

    exchanges.forEach((exchange) => {
      const mapped = getCommoditiesForCountryName(exchange.country);

      if (!mapped) {
        missingCountriesSet.add(exchange.country);
      }
    });

    const missingCountries = Array.from(missingCountriesSet).sort();

    // Jest will diff this nicely if anything is missing
    expect(missingCountries).toEqual([]);
  });
});
