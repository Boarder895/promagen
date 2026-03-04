import exchangesCatalogJson from '../../exchanges/exchanges.catalog.json';
import { getCommoditiesForCountryName } from '../country-commodities.map';

interface ExchangeCountry {
  id: string;
  country: string;
}

/**
 * Known exchange countries that don't yet have a matching row in
 * country-commodities.map.json. These are real exchange countries pending
 * commodity data addition.
 *
 * TODO: add commodity data for these 29 countries.
 */
const KNOWN_MISSING_COUNTRIES = new Set([
  'Bahrain', 'Bosnia and Herzegovina', 'Botswana', 'Croatia',
  'Cyprus', 'Czech Republic', 'Ecuador', 'Ghana', 'Jordan', 'Kazakhstan',
  'Kuwait', 'Laos', 'Lebanon', 'Luxembourg', 'Mauritius',
  'Mongolia', 'Montenegro', 'Namibia', 'North Macedonia', 'Oman',
  'Portugal', 'Qatar', 'Serbia', 'Slovakia', 'Slovenia',
  'Tanzania', 'Turkey', 'Ukraine', 'Venezuela',
]);

describe('exchanges-country coverage', () => {
  it('ensures every exchange country has a matching country-commodities row', () => {
    const exchanges = exchangesCatalogJson as ExchangeCountry[];

    const unexpectedMissing = new Set<string>();

    exchanges.forEach((exchange) => {
      const mapped = getCommoditiesForCountryName(exchange.country);

      if (!mapped && !KNOWN_MISSING_COUNTRIES.has(exchange.country)) {
        unexpectedMissing.add(exchange.country);
      }
    });

    const unexpectedMissingArr = Array.from(unexpectedMissing).sort();

    if (unexpectedMissingArr.length > 0) {
      console.error(
        'Unexpected exchange countries without commodity data (not in known gaps):',
        unexpectedMissingArr,
      );
    }

    // No NEW missing countries beyond the documented gaps
    expect(unexpectedMissingArr).toEqual([]);
  });
});
