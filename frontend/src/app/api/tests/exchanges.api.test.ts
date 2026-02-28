import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/exchanges/route";

// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).

type ExchangeItem = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
  latitude: number;
};

type ExchangesPayload = {
  ok: true;
  asOf: string;
  count: number;
  exchanges: ExchangeItem[];
};

describe("GET /api/exchanges", () => {
  it("returns exchanges array with expected shape", async () => {
    const res = await GET();
    const json = (await res.json()) as ExchangesPayload;

    expect(json.ok).toBe(true);
    expect(typeof json.asOf).toBe("string");
    expect(typeof json.count).toBe("number");
    expect(Array.isArray(json.exchanges)).toBe(true);
    expect(json.exchanges.length).toBe(json.count);
    expect(json.exchanges.length).toBeGreaterThan(0);

    // Spot-check first item shape.
    const first = json.exchanges[0];
    if (!first) throw new Error('Expected at least one exchange');
    expect(typeof first.id).toBe("string");
    expect(typeof first.city).toBe("string");
    expect(typeof first.tz).toBe("string");
  });
});
