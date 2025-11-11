// frontend/__tests__/finance-config.test.ts
import config from "@/data/feeds/finance.config.json";
import pairs from "@/data/fx/pairs.json";

describe("finance.config.json", () => {
  it("has valid schedule and timeout range", () => {
    expect(["hourly-staggered"]).toContain(config.provider?.schedule);
    expect(config.provider?.timeoutMs).toBeGreaterThanOrEqual(200);
    expect(config.provider?.timeoutMs).toBeLessThanOrEqual(5000);
  });

  it("pairs = '*' or a non-empty array matching pairs.json ids", () => {
    const ids = new Set((pairs as any[]).map((p) => String(p.id).toUpperCase()));
    const cfg = config.pairs as any;

    if (cfg === "*") {
      expect(cfg).toBe("*");
      return;
    }
    expect(Array.isArray(cfg)).toBe(true);
    const arr = cfg as string[];
    expect(arr.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const id of arr) {
      const up = id.toUpperCase();
      expect(ids.has(up)).toBe(true);
      expect(seen.has(up)).toBe(false);
      seen.add(up);
    }
  });
});
