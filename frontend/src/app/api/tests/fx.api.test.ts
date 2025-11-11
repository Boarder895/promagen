import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/fx/route";

type ApiErr = { ok: false; error: string };
type FxQuotes = { id: string; value: number; prevClose: number };
type FxQuotesPayload = { ok: true; data: { quotes: FxQuotes[] }; nextUpdateAt: string };
type ApiResp = ApiErr | FxQuotesPayload;

function isOk<T extends { ok: true }>(v: unknown): v is T {
  return !!v && typeof v === "object" && (v as any).ok === true;
}

describe("GET /api/fx", () => {
  it("returns quotes payload", async () => {
    const res = await GET(); // handler takes no args in current impl
    const json = (await res.json()) as ApiResp;
    expect(isOk<FxQuotesPayload>(json)).toBe(true);
    if (isOk<FxQuotesPayload>(json)) {
      expect(Array.isArray(json.data.quotes)).toBe(true);
      expect(typeof json.nextUpdateAt).toBe("string");
    }
  });

  it("filters by ids when supported", async () => {
    // When handler is upgraded to accept Request, switch to:
    // const res = await GET(new Request('http://test.local/api/fx?ids=EURUSD'));
    const res = await GET();
    const json = (await res.json()) as ApiResp;
    expect(isOk<FxQuotesPayload>(json)).toBe(true);
  });
});
