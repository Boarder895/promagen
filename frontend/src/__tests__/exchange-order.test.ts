import { describe, it, expect } from "@jest/globals";
import {
  getValidatedExchanges,
  sortEastToWest,
  splitRails,
  isValidCount,
} from "@/lib/exchange-order";

describe("exchange-order runtime guards", () => {
  it("rejects invalid longitudes", () => {
    const all = getValidatedExchanges();
    for (const e of all) {
      expect(typeof e.longitude).toBe("number");
      expect(e.longitude).toBeGreaterThanOrEqual(-180);
      expect(e.longitude).toBeLessThanOrEqual(180);
    }
  });

  it("sorts east→west", () => {
    const xs = [
      { id: "a", name: "A", country: "JP", longitude: 140 },
      { id: "b", name: "B", country: "GB", longitude: 0 },
      { id: "c", name: "C", country: "US", longitude: -74 },
    ];
    const sorted = sortEastToWest(xs);
    expect(sorted.map((x) => x.id)).toEqual(["c", "b", "a"].reverse());
  });

  it("splits evenly and reverses right", () => {
    const xs = [
      { id: "1", name: "One", country: "A", longitude: 10 },
      { id: "2", name: "Two", country: "B", longitude: 20 },
      { id: "3", name: "Three", country: "C", longitude: 30 },
      { id: "4", name: "Four", country: "D", longitude: 40 },
    ];
    const { left, right } = splitRails(xs);
    expect(left.length + right.length).toBe(xs.length);
    expect(right[0].id).toBe("4");
  });

  it("accepts valid paid counts only", () => {
    [6, 8, 10, 12, 14, 16].forEach((n) => expect(isValidCount(n)).toBe(true));
    [5, 7, 9, 11, 13, 15, 17].forEach((n) => expect(isValidCount(n)).toBe(false));
  });
});
