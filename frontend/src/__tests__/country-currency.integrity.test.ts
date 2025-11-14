import exchangesSelected from "@/data/exchanges.selected.json";
import countryCurrencyMap from "@/data/fx/country-currency.map.json";

type ExchangesSelected = { ids: string[] };
type CountryCurrency = Record<string, string>;

describe("country-currency map integrity", () => {
  it("exchanges.selected exposes ids[]", () => {
    const xs = exchangesSelected as unknown as ExchangesSelected;
    expect(Array.isArray(xs.ids)).toBe(true);
    expect(xs.ids.length).toBeGreaterThan(0);
  });

  it("country-currency map is a non-empty object of ISO2->CCY", () => {
    const map = countryCurrencyMap as unknown as CountryCurrency;
    expect(map && typeof map).toBe("object");
    const entries = Object.entries(map);
    expect(entries.length).toBeGreaterThan(0);

    const [k, v] = entries[0] ?? ["ZZ", "ZZZ"];
    expect(/^[A-Z]{2}$/.test(k)).toBe(true);
    expect(/^[A-Z]{3}$/.test(v)).toBe(true);
  });
});
