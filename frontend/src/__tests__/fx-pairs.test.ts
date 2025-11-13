import fs from "node:fs";
import path from "node:path";

type Pair = { base: string; quote: string };

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

describe("FX pairs catalogue (canonical at src/data/pairs.json)", () => {
  const fp = path.join(process.cwd(), "src", "data", "pairs.json");

  test("pairs.json exists", () => {
    expect(fs.existsSync(fp)).toBe(true);
  });

  test("pairs are well-formed", () => {
    const arr = readJson<Pair[]>(fp);

    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(0);

    for (const p of arr) {
      expect(typeof p.base).toBe("string");
      expect(typeof p.quote).toBe("string");
      expect(/^[A-Z]{3}$/.test(p.base)).toBe(true);
      expect(/^[A-Z]{3}$/.test(p.quote)).toBe(true);
      expect(p.base).not.toBe(p.quote);
    }
  });
});
