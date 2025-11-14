import { localTime, isoNow, utcOffsetLabel } from "@/lib/time";

describe("time helpers", () => {
  test("isoNow returns a stable ISO string when given a Date", () => {
    const fixed = new Date("2020-01-01T00:00:00.000Z");
    const iso = isoNow(fixed);
    expect(iso).toBe("2020-01-01T00:00:00.000Z");
  });

  test("localTime applies numeric offset in minutes", () => {
    const base = new Date("2020-01-01T00:00:00.000Z");

    // UTC+1 → 01:00
    expect(localTime(60, base)).toBe("01:00");

    // UTC-5 → 19:00 (previous day, but we only care about HH:MM)
    expect(localTime(-300, base)).toBe("19:00");

    // UTC+5:30 → 05:30
    expect(localTime(330, base)).toBe("05:30");
  });

  test("utcOffsetLabel formats offsets as UTC±HH or UTC±HH:MM", () => {
    expect(utcOffsetLabel(0)).toBe("UTC");
    expect(utcOffsetLabel(60)).toBe("UTC+01");
    expect(utcOffsetLabel(-300)).toBe("UTC-05");
    expect(utcOffsetLabel(330)).toBe("UTC+05:30");
  });
});
