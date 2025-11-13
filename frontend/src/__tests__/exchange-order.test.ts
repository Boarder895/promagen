// frontend/src/__tests__/exchange-order.test.ts
// -----------------------------------------------------------------------------
// Strict-null safe assertions for splitIds helper.
// -----------------------------------------------------------------------------

import { splitIds } from "@/lib/exchange-order";

describe("exchange ordering", () => {
  it("splits ids into left/right deterministically", () => {
    const { left, right } = splitIds({ ids: ["1", "2", "3", "4"] });
    expect(left.length + right.length).toBe(4);
    expect(left[0]?.id).toBe("1");
    expect(right[0]?.id ?? "").toBe("3");
  });
});
