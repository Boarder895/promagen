/**
 * Contract: inside session + long quiet => "probable-holiday".
 * Outside session => "closed-out-of-hours".
 * Uses 'now' (not tzNow/label), matching HolidayArgs.
 */
import holidayDetector from "@/lib/markets/holiday-detector";

type Args = Parameters<typeof holidayDetector>[0];

function makeNyTime(year: number, month: number, day: number, hour: number, minute = 0) {
  // Builds an instant observed in America/New_York without external libs.
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // formatToParts will re-interpret in the detector; this just gives a stable epoch.
  return d.getTime();
}

test("probable holiday if quiet in-session", () => {
  const now = makeNyTime(2025, 6, 3, 17, 0); // 13:00 NY local (approx via UTC baseline)
  const args: Args = {
    id: "nyse",
    now,
    snapshot: {
      lastTradeTs: now - 90 * 60 * 1000,
      lastQuoteTs: now - 90 * 60 * 1000,
      tradesInWindow: 0
    }
  };
  const result = holidayDetector(args);
  expect(result.state).toBe("probable-holiday");
});

test("out of hours is closed-out-of-hours", () => {
  const now = makeNyTime(2025, 6, 7, 7, 0); // Saturday pre-market
  const args: Args = {
    id: "nyse",
    now,
    snapshot: {
      lastTradeTs: now - 10 * 60 * 1000,
      lastQuoteTs: now - 10 * 60 * 1000,
      tradesInWindow: 0
    }
  };
  const result = holidayDetector(args);
  expect(result.state).toBe("closed-out-of-hours");
});
