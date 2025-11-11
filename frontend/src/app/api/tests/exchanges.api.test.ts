import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/exchanges/route";

type ApiErr = { ok: false; error: string };
type ExchangesPayload = { ok: true; data: { items: unknown[] } };
type ApiResp = ApiErr | ExchangesPayload;

function isOk<T extends { ok: true }>(v: unknown): v is T {
  return !!v && typeof v === "object" && (v as any).ok === true;
}

describe("GET /api/exchanges", () => {
  it("returns items array", async () => {
    const res = await GET();
    const json = (await res.json()) as ApiResp;
    expect(isOk<ExchangesPayload>(json)).toBe(true);
    if (isOk<ExchangesPayload>(json)) {
      expect(Array.isArray(json.data.items)).toBe(true);
    }
  });
});
