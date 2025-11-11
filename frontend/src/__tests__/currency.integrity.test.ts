import { describe, it, expect } from "@jest/globals";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const countryCurrency: Record<string, string> = require("../data/country-currency.map.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const currencies: Array<{ code: string; name?: string }> = require("../data/currencies.catalog.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pairs: Array<{ id: string; base: string; quote: string }> = require("../data/pairs.json");

const currencyCodes = new Set(currencies.map((c) => c.code.toUpperCase()));
const countryEntries = Object.entries(countryCurrency);

describe("Data integrity: currencies and pairs", () => {
  it("every country maps to a valid ISO currency in the catalogue", () => {
    const missing: string[] = [];
    for (const [country, cur] of countryEntries) {
      const code = cur.toUpperCase();
      if (!currencyCodes.has(code)) missing.push(`${country}:${code}`);
    }

    if (missing.length) {
      // eslint-disable-next-line no-console
      console.error("[currency] Missing from currencies.catalog.json:", missing);
    }
    expect(missing).toHaveLength(0);
  });

  it("each FX pair base/quote exists in the currency catalogue", () => {
    const badPairs: string[] = [];
    for (const p of pairs) {
      const base = p.base.toUpperCase();
      const quote = p.quote.toUpperCase();
      if (!currencyCodes.has(base) || !currencyCodes.has(quote)) {
        badPairs.push(p.id);
      }
    }
    if (badPairs.length) {
      // eslint-disable-next-line no-console
      console.error("[currency] FX pairs with unknown currencies:", badPairs);
    }
    expect(badPairs).toHaveLength(0);
  });

  it("every currency used in pairs is referenced by at least one country (no orphan currency)", () => {
    const used = new Set<string>();
    for (const p of pairs) {
      used.add(p.base.toUpperCase());
      used.add(p.quote.toUpperCase());
    }

    const mapValues = new Set(Object.values(countryCurrency).map((v) => v.toUpperCase()));
    const orphans: string[] = [];
    for (const c of used) {
      if (!mapValues.has(c)) orphans.push(c);
    }

    if (orphans.length) {
      // eslint-disable-next-line no-console
      console.error("[currency] Currencies used in pairs but not mapped to any country:", orphans);
    }
    expect(orphans).toHaveLength(0);
  });
});
