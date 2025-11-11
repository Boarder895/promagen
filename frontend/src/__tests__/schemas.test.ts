import { describe, it, expect } from "@jest/globals";
import { ProvidersSchema, ExchangesSchema, PairsSchema } from "@/data/schemas";

describe("schemas", () => {
  it("validates providers", () => {
    const ok = ProvidersSchema.safeParse([{ id: "midjourney", name: "Midjourney" }]);
    expect(ok.success).toBe(true);
  });

  it("rejects bad exchange", () => {
    const bad = ExchangesSchema.safeParse([{ id: "ldn", name: "London", longitude: 300 }]);
    expect(bad.success).toBe(false);
  });

  it("requires pair demo block", () => {
    const good = PairsSchema.safeParse([
      { id: "EURUSD", base: "EUR", quote: "USD", label: "EUR/USD", precision: 5, demo: { value: 1.1, prevClose: 1.08 } },
    ]);
    expect(good.success).toBe(true);
  });
});
