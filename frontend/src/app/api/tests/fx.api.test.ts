import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/fx/route";

type Quote = { id: string; value: number; prevClose: number };
type Payload = { ok: boolean; quotes: Quote[]; nextUpdateAt: string };
function isPayload(x: unknown): x is Payload {
  const a = x as any;
  return !!a && typeof a.ok === "boolean" && Array.isArray(a.quotes) && typeof a.nextUpdateAt === "string";
}

describe("GET /api/fx", () => {
  it("returns the expected payload", async () => {
    const res = await GET();
    const json = await res.json();
    expect(isPayload(json)).toBe(true);
  });
});
