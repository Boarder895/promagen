import { describe, it, expect } from "@jest/globals";
import {
  ProvidersSchema,
  ExchangesSchema,
  SelectedExchangesSchema,
  CurrenciesSchema,
  PairsSchema,
  CountryCurrencyMapSchema,
  formatZodError,
} from "@/data/schemas";

/** Use require to avoid ESM/TS config friction inside Jest. */
const exchangesCatalog = require("../data/exchanges.catalog.json");
const exchangesSelected = require("../data/exchanges.selected.json");
const currenciesCatalog = require("../data/currencies.catalog.json");
const countryCurrencyMap = require("../data/country-currency.map.json");
const pairs = require("../data/pairs.json");

function tryRequire(path: string): unknown | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path);
  } catch {
    return null;
  }
}

describe("Catalogue schemas – structural validity", () => {
  it("exchanges.catalog.json matches ExchangesSchema", () => {
    const res = ExchangesSchema.safeParse(exchangesCatalog);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[exchanges.catalog] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it("exchanges.selected.json matches SelectedExchangesSchema (strict: country+longitude required)", () => {
    const res = SelectedExchangesSchema.safeParse(exchangesSelected);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[exchanges.selected] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it("currencies.catalog.json matches CurrenciesSchema and has unique codes", () => {
    const res = CurrenciesSchema.safeParse(currenciesCatalog);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[currencies.catalog] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);

    const codes = new Set<string>();
    for (const c of res.data) {
      const key = c.code.toUpperCase();
      expect(codes.has(key)).toBe(false);
      codes.add(key);
    }
  });

  it("country-currency.map.json matches CountryCurrencyMapSchema", () => {
    const res = CountryCurrencyMapSchema.safeParse(countryCurrencyMap);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[country-currency.map] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);
  });

  it("pairs.json matches PairsSchema and has consistent ids", () => {
    const res = PairsSchema.safeParse(pairs);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[pairs] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);

    for (const p of res.data) {
      // Basic self-consistency: ID should start with base and end with quote
      expect(p.id.toUpperCase().startsWith(p.base.toUpperCase())).toBe(true);
      expect(p.id.toUpperCase().endsWith(p.quote.toUpperCase())).toBe(true);
    }
  });

  it("providers.json (if present) matches ProvidersSchema", () => {
    const providersMaybe = tryRequire("../data/providers.json");
    if (!providersMaybe) {
      // Optional: file may not exist yet
      return;
    }
    const res = ProvidersSchema.safeParse(providersMaybe);
    if (!res.success) {
      // eslint-disable-next-line no-console
      console.error("[providers] schema errors:\n" + formatZodError(res.error));
    }
    expect(res.success).toBe(true);
  });
});
