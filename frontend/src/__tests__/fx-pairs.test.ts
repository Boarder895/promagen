import fs from "node:fs";
import path from "node:path";

type Pair = {
  id: string;
  base: string;
  quote: string;
  label: string;
  precision: number;
  demo: { value: number; prevClose: number };
};

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

test("fx/pairs.json exists and pairs are well-formed", () => {
  const fp = path.join(process.cwd(), "src", "data", "fx", "pairs.json");
  expect(fs.existsSync(fp)).toBe(true);

  const arr: Pair[] = readJson(fp);
  expect(Array.isArray(arr)).toBe(true);
  for (const p of arr) {
    expect(typeof p.id).toBe("string");
    expect(typeof p.base).toBe("string");
    expect(typeof p.quote).toBe("string");
    expect(typeof p.label).toBe("string");
    expect(typeof p.precision).toBe("number");
    expect(typeof p.demo?.value).toBe("number");
    expect(typeof p.demo?.prevClose).toBe("number");
    // quick ids sanity
    expect(p.id).toBe(`${p.base.toLowerCase()}-${p.quote.toLowerCase()}`);
  }
});
