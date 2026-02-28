import { describe, it, expect } from "@jest/globals";
import { GET } from "@/app/api/providers/route";

// Console silencing handled by api-test-setup.ts (setupFilesAfterFramework).

type ProviderItem = {
  id: string;
  name: string;
  [key: string]: unknown;
};

describe("GET /api/providers", () => {
  it("returns providers array", async () => {
    const res = await GET();
    const json = (await res.json()) as ProviderItem[];

    // Route returns the provider array directly (not wrapped in { ok, data }).
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);

    // Spot-check first item shape.
    const first = json[0];
    if (!first) throw new Error('Expected at least one provider');
    expect(typeof first.id).toBe("string");
    expect(typeof first.name).toBe("string");
  });
});
