import { formatNumber, formatMoney } from "@/lib/format/number";

describe("formatNumber", () => {
  it("formats with dp and sign", () => {
    expect(formatNumber(12.3456, { dp: 2 })).toBe("12.35");
    expect(formatNumber(12, { sign: "always" })).toBe("+12");
  });
  it("compact notation", () => {
    const s = formatNumber(12_300, { compact: true });
    expect(typeof s).toBe("string");
  });
  it("strict mode throws on non-finite", () => {
    expect(() => formatNumber(Number.POSITIVE_INFINITY, { strict: true })).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats GBP with symbol", () => {
    expect(formatMoney(3200.87, "GBP")).toMatch(/£\s?3,200\.87/);
  });
});
