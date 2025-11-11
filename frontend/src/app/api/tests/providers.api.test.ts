import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/providers/route";

type ApiErr = { ok: false; error: string };
type ProvidersPayload = { ok: true; data: { items: unknown[] } };
type ApiResp = ApiErr | ProvidersPayload;

function isOk<T extends { ok: true }>(v: unknown): v is T {
  return !!v && typeof v === "object" && (v as any).ok === true;
}

describe("GET /api/providers", () => {
  it("returns providers", async () => {
    const res = await GET();
    const json = (await res.json()) as ApiResp;
    expect(isOk<ProvidersPayload>(json)).toBe(true);
    if (isOk<ProvidersPayload>(json)) {
      expect(json.data.items.length).toBeGreaterThan(0);
    }
  });
});
