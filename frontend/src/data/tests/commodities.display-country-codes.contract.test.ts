import commoditiesJson from '../commodities/commodities.catalog.json';
import countriesJson from '../geo/countries.catalog.json';

interface CommodityRecord {
  id: string;
  displayCountryCodes?: string[];
}

interface CountryRecord {
  code: string;
}

/**
 * Contract test:
 * - All displayCountryCodes used by commodities must be valid ISO codes
 *   defined in src/data/geo/countries.catalog.json.
 *
 * This helps ensure that:
 * - We don't accidentally reference unknown country codes in the ribbon.
 * - Any future changes to the geo catalogue are reflected here.
 */
describe('commodities.displayCountryCodes contract', () => {
  it('only uses valid ISO country codes defined in countries.catalog.json', () => {
    const commodities = commoditiesJson as CommodityRecord[];
    const countries = countriesJson as CountryRecord[];

    const knownCountryCodes = new Set(countries.map((country) => country.code));

    const missingEntries: { commodityId: string }[] = [];
    const invalidEntries: { commodityId: string; invalidCodes: string[] }[] = [];

    commodities.forEach((commodity) => {
      const { id, displayCountryCodes } = commodity;

      if (!displayCountryCodes || displayCountryCodes.length === 0) {
        missingEntries.push({ commodityId: id });
        return;
      }

      const invalidCodes = displayCountryCodes.filter((code) => !knownCountryCodes.has(code));

      if (invalidCodes.length > 0) {
        invalidEntries.push({ commodityId: id, invalidCodes });
      }
    });

    const debugMessageLines: string[] = [];

    if (missingEntries.length > 0) {
      debugMessageLines.push(
        'Commodities missing displayCountryCodes:',
        ...missingEntries.map((entry) => `  - ${entry.commodityId}`),
      );
    }

    if (invalidEntries.length > 0) {
      debugMessageLines.push(
        'Commodities with invalid displayCountryCodes:',
        ...invalidEntries.map(
          (entry) => `  - ${entry.commodityId}: ${entry.invalidCodes.join(', ')}`,
        ),
      );
    }

    const debugMessage = debugMessageLines.join('\n');

    // Expect no missing displayCountryCodes and no invalid codes.
    expect({
      missingDisplayCountryCodesCount: missingEntries.length,
      invalidCountryCodesCount: invalidEntries.length,
    }).toEqual({
      missingDisplayCountryCodesCount: 0,
      invalidCountryCodesCount: 0,
    });

    if (debugMessage) {
      // If the assertion above fails, this helps you see exactly what went wrong.
      console.error(debugMessage);
    }
  });
});
