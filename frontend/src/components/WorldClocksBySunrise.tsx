"use client";

import { useEffect, useMemo, useState } from "react";

/** ---------- tiny sunrise util (UTC) ---------- */
function calcSunriseUTC(date: Date, lat: number, lon: number): Date | null {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const dayUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day0UTC = Date.UTC(date.getUTCFullYear(), 0, 0);
  const n = Math.floor((dayUTC - day0UTC) / 86400000) || 1;

  const M = (357.5291 + 0.98560028 * (n - 1)) * rad;
  const C = (1.9148 * Math.sin(M) + 0.0200 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * rad;
  const L = (280.1470 * rad + (0.9856474 * rad) * n + M + C) % (2 * Math.PI);

  const e = 23.4397 * rad;
  const sinDec = Math.sin(e) * Math.sin(L);
  const cosDec = Math.cos(Math.asin(sinDec));

  const sunAlt = -0.83 * rad;
  const latR = lat * rad;
  const cosH = (Math.sin(sunAlt) - Math.sin(latR) * sinDec) / (Math.cos(latR) * cosDec);
  if (cosH < -1 || cosH > 1) return null;

  const H = Math.acos(cosH) * deg;

  const y = Math.tan(e / 2) ** 2;
  const Etime = 4 * deg * (y * Math.sin(2 * L) - 0.5 * y ** 2 * Math.sin(4 * L));

  const sunriseTST = 720 - 4 * (lon + H) - Etime;
  let minutesUTC = sunriseTST % 1440;
  if (minutesUTC < 0) minutesUTC += 1440;

  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  result.setUTCMinutes(minutesUTC);
  return result;
}

/** ---------- time helpers ---------- */
const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz });

const offsetFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZoneName: "shortOffset", timeZone: tz });

const dateParts = (d: Date, tz: string) => {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
};

const minutesSinceMidnight = (d: Date, tz: string) => {
  const { hour, minute } = dateParts(d, tz);
  return hour * 60 + minute;
};

const parseHHMM = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
};

const isWeekday = (d: Date, tz: string) => {
  const wdFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const n = map[wdFmt] ?? 0;
  return n >= 1 && n <= 5;
};

/** ---------- market windows + transition logic ---------- */
type Window = { start: string; end: string };
type MarketHours = { monToFri: Window[] };

type City = {
  name: string;
  tz: string;
  lat: number;
  lon: number;
  code: string;
  market?: MarketHours;
};

function nextTransition(
  now: Date,
  tz: string,
  windows: Window[]
): { open: boolean; nextAt: Date | null; label: "Opens" | "Closes" } {
  const mins = minutesSinceMidnight(now, tz);
  const base = dateParts(now, tz);

  const toLocalDate = (m: number) => {
    const d = new Date(Date.UTC(base.year, base.month - 1, base.day, 0, 0, 0));
    d.setUTCMinutes(m);
    return d;
  };

  let open = false;
  let closesAt: Date | null = null;
  let opensAt: Date | null = null;

  for (const w of windows) {
    const s = parseHHMM(w.start);
    const e = parseHHMM(w.end);

    if (mins >= s && mins < e) {
      open = true;
      const d = toLocalDate(e);
      closesAt = closesAt ? (d.getTime() < closesAt.getTime() ? d : closesAt) : d;
    } else if (mins < s) {
      const d = toLocalDate(s);
      opensAt = opensAt ? (d.getTime() < opensAt.getTime() ? d : opensAt) : d;
    }
  }

  if (open && closesAt) return { open: true, nextAt: closesAt, label: "Closes" };
  if (!open && opensAt) return { open: false, nextAt: opensAt, label: "Opens" };

  if (!open && windows[0]) {
    const d = new Date(Date.UTC(base.year, base.month - 1, base.day + 1, 0, 0, 0));
    d.setUTCMinutes(parseHHMM(windows[0].start));
    return { open: false, nextAt: d, label: "Opens" };
  }

  return { open, nextAt: null, label: open ? "Closes" : "Opens" };
}

/** ---------- city list (Stage 1) ---------- */
const CITIES: City[] = [
  {
    name: "Sydney",
    tz: "Australia/Sydney",
    lat: -33.8688,
    lon: 151.2093,
    code: "SYD",
    market: { monToFri: [{ start: "10:00", end: "16:00" }] },
  },
  {
    name: "Tokyo",
    tz: "Asia/Tokyo",
    lat: 35.6762,
    lon: 139.6503,
    code: "TYO",
    market: {
      monToFri: [
        { start: "09:00", end: "11:30" },
        { start: "12:30", end: "15:00" },
      ],
    },
  },
];

/** ---------- component ---------- */
export default function WorldClocksBySunrise() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    return CITIES.map((c) => {
      const sunriseUTC = calcSunriseUTC(now, c.lat, c.lon);
      const sunriseLocal = sunriseUTC
        ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: c.tz }).format(
            sunriseUTC
          )
        : "—";

      const market =
        c.market && isWeekday(now, c.tz)
          ? nextTransition(now, c.tz, c.market.monToFri)
          : { open: false, nextAt: null as Date | null, label: "Opens" as const };

      const timeNow = timeFmt(c.tz).format(now);
      const offset = offsetFmt(c.tz).format(now);

      return {
        name: c.name,
        code: c.code,
        now: timeNow,
        offset,
        sunrise: sunriseLocal,
        marketLabel: c.market ? (market.open ? "Open" : "Closed") : "—",
        marketNext: c.market && market.nextAt ? `${market.label} ${timeFmt(c.tz).format(market.nextAt)}` : "",
      };
    });
  }, [now]);

  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.code} className="flex items-center justify-between rounded-xl p-3 shadow">
          <div className="font-semibold">
            {r.name} <span className="opacity-60">({r.code})</span>
          </div>
          <div>
            {r.now} <span className="opacity-60">{r.offset}</span>
          </div>
          <div>Sunrise: {r.sunrise}</div>
          <div>
            {r.marketLabel}
            {r.marketNext ? ` · ${r.marketNext}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}















