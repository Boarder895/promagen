// components/WorldClocksBySunrise.tsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Sunrise calculation (compact NOAA-style).
 * Returns a Date in UTC for today's sunrise at lat/lon, or null for polar day/night.
 */
function calcSunriseUTC(date: Date, lat: number, lon: number): Date | null {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  // Day of year (UTC)
  const n =
    Math.floor(
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        Date.UTC(date.getUTCFullYear(), 0, 0)) /
        86400000
    ) || 1;

  // Approximate solar mean anomaly (simplified)
  const M = (357.5291 + 0.98560028 * (n - 1)) * rad;

  // Equation of center
  const C =
    (1.9148 * Math.sin(M) +
      0.0200 * Math.sin(2 * M) +
      0.0003 * Math.sin(3 * M)) *
    rad;

  // Ecliptic longitude
  const L = (280.1470 * rad + (0.9856474 * rad) * n + M + C) % (2 * Math.PI);

  const e = 23.4397 * rad; // obliquity
  const sinDec = Math.sin(e) * Math.sin(L);
  const cosDec = Math.cos(Math.asin(sinDec));

  // Apparent sunrise altitude
  const sunAlt = -0.83 * rad;

  const latR = lat * rad;
  const cosH =
    (Math.sin(sunAlt) - Math.sin(latR) * sinDec) / (Math.cos(latR) * cosDec);

  if (cosH < -1 || cosH > 1) return null; // no sunrise today

  const H = Math.acos(cosH); // hour angle (rad)
  const Hdeg = H * deg;

  // Very compact equation of time approx (minutes)
  const y = Math.tan(e / 2) ** 2;
  const Etime =
    4 *
    deg *
    (y * Math.sin(2 * L) -
      2 * 0 * Math.sin(0) +
      4 * y * 0 * Math.sin(0) -
      0.5 * y ** 2 * Math.sin(4 * L) -
      1.25 * 0 * Math.sin(2 * 0));

  // Sunrise true solar time (minutes)
  const sunriseTST = 720 - 4 * (lon + Hdeg) - Etime;

  let minutesUTC = sunriseTST % 1440;
  if (minutesUTC < 0) minutesUTC += 1440;

  const result = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0
    )
  );
  result.setUTCMinutes(minutesUTC);
  return result;
}

// Types
type Window = { start: string; end: string };
type MarketHours = {
  monToFri: Window[]; // multiple windows allowed (e.g., lunch break)
};

type City = {
  name: string;
  tz: string; // IANA timezone
  lat: number;
  lon: number;
  code: string;
  market?: MarketHours;
};

// Helpers
const timeFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  });

const offsetFmt = (tz: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZoneName: "shortOffset",
    timeZone: tz,
  });

const dateParts = (d: Date, tz: string) => {
  // Extracts Y/M/D/H/M/S in the given tz using formatToParts
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
  // 1..5 as Mon..Fri
  const wdFmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: tz,
  }).format(d);
  // Map Sun..Sat
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const n = map[wdFmt] ?? 0;
  return n >= 1 && n <= 5;
};

function nextTransition(
  now: Date,
  tz: string,
  windows: Window[]
): { open: boolean; nextAt: Date | null; label: string } {
  const mins = minutesSinceMidnight(now, tz);
  const baseParts = dateParts(now, tz);

  // Build today's absolute Date objects for each window start/end
  const toLocalDate = (m: number) =>
    new Date(
      Date.UTC(
        baseParts.year,
        baseParts.month - 1,
        baseParts.day,
        0,
        0,
        0
      )
    );

  let open = false;
  let closesAt: Date | null = null;
  let opensAt: Date | null = null;

  for (const w of windows) {
    const s = parseHHMM(w.start);
    const e = parseHHMM(w.end);

    if (mins >= s && mins < e) {
      open = true;
      const d = toLocalDate(e);
      // convert that local midnight baseline back to local time
      d.setUTCMinutes(e);
      closesAt = closesAt ? (d < closesAt ? d : closesAt) : d;
    } else if (mins < s) {
      const d = toLocalDate(s);
      d.setUTCMinutes(s);
      opensAt = opensAt ? (d < opensAt ? d : opensAt) : d;
    }
  }

  // If currently open, show the soonest close today
  if (open && closesAt) {
    return { open: true, nextAt: closesAt, label: "Closes" };
  }

  // If closed and there's an opening later today
  if (!open && opensAt) {
    return { open: false, nextAt: opensAt, label: "Opens" };
  }

  // Otherwise, next transition is tomorrow's first open
  if (!open) {
    const first = windows[0];
    if (first) {
      const tomorrow = new Date(
        Date.UTC(
          baseParts.year,
          baseParts.month - 1,
          baseParts.day + 1,
          0,
          0,
          0
        )
      );
      const m = parseHHMM(first.start);
      tomorrow.setUTCMinutes(m);
      return { open: false, nextAt: tomorrow, label: "Opens" };
    }
  }

  return { open, nextAt: null, label: open ? "Closes" : "Opens" };
}

// Simple day/night tint (you can replace with sun-alt logic later)
const isDayNow = (tz: string): boolean => {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(new Date())
  );
  return h >= 7 && h < 19;
};

// City config + local exchange windows (typical hours; tweak as needed)
const CITIES: City[] = [
  // Note: These windows are indicative defaults, not an official schedule.
  // You can edit per exchange (including lunch breaks).
  {
    name: "Sydney",
    tz: "Australia/Sydney",
    lat: -33.8688,
    lon: 151.2093,
    code: "SYD",
    market: { monToFri: [{ start: "10:00", end: "16:00" }] }, // ASX
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
      ], // TSE with lunch break
    },
  },
  {
    name: "Shanghai",
    tz: "Asia/
