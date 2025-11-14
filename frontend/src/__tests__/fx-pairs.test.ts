import fs from "fs";
import path from "path";

type FxPairRow = {
  base: string;
  quote: string;
  id?: string;
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

const fp = path.resolve(__dirname, "..", "data", "fx", "pairs.json");

describe("FX pairs catalogue (canonical at src/data/fx/pairs.json)", () => {
  test("pairs.json exists", () => {
    expect(fs.existsSync(fp)).toBe(true);
  });

  test("pairs are well-formed", () => {
    const pairs = readJson<FxPairRow[]>(fp);

    // basic shape
    expect(Array.isArray(pairs)).toBe(true);
    expect(pairs.length).toBeGreaterThan(0);

    for (const row of pairs) {
      // base / quote present
      expect(typeof row.base).toBe("string");
      expect(typeof row.quote).toBe("string");

      // uppercase ISO codes
      expect(row.base).toBe(row.base.toUpperCase());
      expect(row.quote).toBe(row.quote.toUpperCase());

      // no self-pairs like EUR/EUR
      expect(row.base).not.toBe(row.quote);
    }
  });
});
