import countryCurrency from "@/data/fx/country-currency.map.json";
import currencies from "@/data/fx/currencies.catalog.json";

type CountryCurrency = Record<string, string>;
type CurrencyCatalog = Array<{ code: string; name?: string }>;

describe("currency catalogs", () => {
  it("country-currency map uses ISO2→ISO3", () => {
    const cc = countryCurrency as unknown as CountryCurrency;
    expect(Object.keys(cc).length).toBeGreaterThan(0);
    for (const [iso2, iso3] of Object.entries(cc)) {
      expect(/^[A-Z]{2}$/.test(iso2)).toBe(true);
      expect(/^[A-Z]{3}$/.test(iso3)).toBe(true);
    }
  });

  it("every currency in catalog has a 3-letter code", () => {
    const catalog = currencies as unknown as CurrencyCatalog;
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThan(0);
    for (const c of catalog) {
      expect(/^[A-Z]{3}$/.test(c.code)).toBe(true);
    }
  });
});
