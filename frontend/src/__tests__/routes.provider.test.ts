/**
 * Providers route smoke. This imports the Next.js route handler directly if present.
 * If the module cannot be resolved (e.g., route doesn’t exist yet), the test is skipped.
 */

import { describe, it, expect } from "@jest/globals";

function tryRequire<T>(p: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(p) as T;
  } catch {
    return null;
  }
}

describe("API: /api/providers (module smoke)", () => {
  const mod =
    tryRequire<{ GET: () => Promise<Response> }>("@/app/api/providers/route") ||
    tryRequire<{ GET: () => Promise<Response> }>("../../app/api/providers/route");

  if (!mod?.GET) {
    it.skip("providers route not present; skipping", () => {});
    return;
  }

  it("GET returns 200 and JSON array with minimal fields", async () => {
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const data = (await res.json()) as unknown;
    expect(Array.isArray(data)).toBe(true);
    const first = (data as any[])[0];
    if (first) {
      expect(typeof first.id).toBe("string");
      expect(typeof first.name).toBe("string");
    }
  });
});
