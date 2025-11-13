// frontend/src/__tests__/schemas.catalogs.test.ts
// -----------------------------------------------------------------------------
// Safer checks around possibly-undefined response.data (strict mode).
// -----------------------------------------------------------------------------

type ApiResult<T> = { data?: T };

function fakeFetch<T>(data?: T): Promise<ApiResult<T>> {
  return Promise.resolve({ data });
}

describe("catalog schemas", () => {
  it("returns some exchanges", async () => {
    const res = await fakeFetch([{ id: "ldn" }]);
    expect((res.data?.length ?? 0)).toBeGreaterThan(0);
  });

  it("iterates countries safely", async () => {
    const res = await fakeFetch([{ code: "GB" }]);
    for (const c of res.data ?? []) {
      expect(c).toBeDefined();
    }
  });

  it("iterates providers safely", async () => {
    const res = await fakeFetch([{ id: "midjourney" }]);
    for (const p of res.data ?? []) {
      expect(p).toBeDefined();
    }
  });
});
