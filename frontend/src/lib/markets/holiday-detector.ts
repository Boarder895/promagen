/**
 * Holiday detector (minimal, deterministic for tests)
 * - Outside venue hours  -> "closed-out-of-hours"
 * - Inside but quiet/stale -> "probable-holiday"
 * - Else -> "open"
 */
export type MarketSnapshot = {
  lastTradeTs: number;
  lastQuoteTs: number;
  tradesInWindow: number;
};

export type HolidayArgs = {
  id: string;   // e.g., "nyse"
  now: number;  // epoch ms
  snapshot: MarketSnapshot;
};

export type HolidayState = "open" | "probable-holiday" | "closed-out-of-hours";

function getLocalHM(now: number, timeZone: string): { h: number; m: number; dow: number } {
  const d = new Date(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false, timeZone
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const h = parseInt(map.hour ?? "0", 10);
  const m = parseInt(map.minute ?? "0", 10);
  const dowFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone }).format(d);
  const idx = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dowFmt.slice(0,3));
  return { h, m, dow: idx };
}

function inSessionNYSE(now: number): boolean {
  const { h, m, dow } = getLocalHM(now, "America/New_York");
  if (dow === 0 || dow === 6) return false; // Sun/Sat
  const minutes = h * 60 + m;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function holidayDetector(args: HolidayArgs): { state: HolidayState } {
  const { id, now, snapshot } = args;

  let inSession: boolean;
  switch (id) {
    case "nyse":
      inSession = inSessionNYSE(now);
      break;
    default: {
      const { h, m, dow } = getLocalHM(now, "UTC");
      if (dow === 0 || dow === 6) { inSession = false; break; }
      const minutes = h * 60 + m;
      inSession = minutes >= 9 * 60 && minutes < 17 * 60;
      break;
    }
  }

  if (!inSession) return { state: "closed-out-of-hours" };

  const LONG = 60 * 60 * 1000; // 60 min
  const quotesStale = now - snapshot.lastQuoteTs > LONG;
  const tradesQuiet = snapshot.tradesInWindow === 0;

  if (quotesStale && tradesQuiet) return { state: "probable-holiday" };
  return { state: "open" };
}

export default holidayDetector;
