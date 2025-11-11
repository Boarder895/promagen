import { describe, it, expect } from "@jest/globals";

// Use relative imports to avoid path/alias hiccups in Jest
// Shapes are intentionally loose; the test asserts what we need.
type Exchange = { id: string; name: string; country: string; longitude: number };

// eslint-disable-next-line @typescript-eslint/no-var-requires
const exchanges: Exchange[] = require("../data/exchanges.selected.json");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const countryCurrencyMap: Record<string, unknown> = require("../data/country-currency.map.json");

function isIso2(s: unknown): s is string {
  return typeof s === "string" && /^[A-Z]{2}$/.test(s);
}

describe("Data integrity: exchange countries exist in country-currency map", () => {
  it("exchanges.selected.json should be a non-empty array", () => {
    expect(Array.isArray(exchanges)).toBe(true);
    expect(exchanges.length).toBeGreaterThan(0);
  });

  it("country-currency.map.json should be a non-empty object", () => {
    expect(countryCurrencyMap && typeof countryCurrencyMap === "object").toBe(true);
    expect(Object.keys(countryCurrencyMap).length).toBeGreaterThan(0);
  });

  it("every exchange.country is ISO2 and present in the map", () => {
    const missing: Array<{ id: string; name: string; country: string }> = [];
    const badIso: Array<{ id: string; name: string; country: string }> = [];

    const keys = new Set(Object.keys(countryCurrencyMap).map((k) => k.toUpperCase()));

    for (const ex of exchanges) {
      const c = (ex.country || "").toUpperCase();
      if (!isIso2(c)) {
        badIso.push({ id: ex.id, name: ex.name, country: ex.country });
        continue;
        }
      if (!keys.has(c)) {
        missing.push({ id: ex.id, name: ex.name, country: c });
      }
    }

    // Helpful diagnostics if the test fails
    if (badIso.length) {
      // eslint-disable-next-line no-console
      console.error("[country-currency] Non-ISO2 countries:", badIso);
    }
    if (missing.length) {
      // eslint-disable-next-line no-console
      console.error("[country-currency] Countries missing from map:", missing);
    }

    expect(badIso).toHaveLength(0);
    expect(missing).toHaveLength(0);
  });

  it("map keys are ISO2 (sanity check on the map file)", () => {
    const nonIsoKeys = Object.keys(countryCurrencyMap).filter((k) => !isIso2(k.toUpperCase()));
    if (nonIsoKeys.length) {
      // eslint-disable-next-line no-console
      console.error("[country-currency] Non-ISO2 keys in map:", nonIsoKeys);
    }
    expect(nonIsoKeys).toHaveLength(0);
  });
});
