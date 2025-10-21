// frontend/src/lib/weather.ts
// Safe helpers + a minimal stub fetcher used by /api/snapshot/weather (and /api/ingest/weather).

import type { RibbonPayload, RibbonMarket, MarketStatus } from "@/types/ribbon";

/* ---------------- Temperature helpers (safe for undefined) ---------------- */

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Map temperature °C -> hue (cold=220 blue, hot=10 red). */
export function hueFromTemp(temp?: number | null): number {
  const t = typeof temp === "number" ? temp : 12; // neutral default
  const min = -20, max = 40;
  const ratio = clamp((t - min) / (max - min), 0, 1);
  return Math.round(220 + (10 - 220) * ratio);
}

/** HSL color string suitable for dark UI backgrounds. */
export function tempToColor(temp?: number | null): string {
  return `hsl(${hueFromTemp(temp)} 70% 16%)`;
}

/** Back-compat alias some older files referenced. */
export const tempcolor = tempToColor;

/** Normalize loose strings into the MarketStatus union. */
export function normalizeStatus(s?: unknown): MarketStatus {
  const v = String(s ?? "unknown").toLowerCase();
  if (v === "open") return "open";
  if (v === "closed") return "closed";
  if (v === "pre" || v === "preopen" || v === "pre-open") return "pre";
  if (v === "post" || v === "postclose" || v === "post-close") return "post";
  if (v === "holiday") return "holiday";
  return "unknown";
}

/** Convert status to a saturation weight for chips (0–100). */
export function stateSat(status: MarketStatus): number {
  switch (status) {
    case "open": return 95;
    case "pre": return 85;
    case "post": return 65;
    case "holiday": return 35;
    case "closed": return 25;
    default: return 40;
  }
}

/* ---------------- Minimal stub: fetchWeatherForMarkets ----------------
   Stage-1/2 placeholder that returns the same 12 exchanges with simple
   weather objects. Replace with a real data fetcher in Stage-3.
------------------------------------------------------------------------- */

export async function fetchWeatherForMarkets(): Promise<RibbonPayload["markets"]> {
  // East ➜ West ordering; temps are illustrative for heartline hues.
  const markets: RibbonMarket[] = [
    { exchange: { id: "asx", city: "Sydney", exchange: "ASX", country: "Australia", iso2: "AU", tz: "Australia/Sydney", longitude: 151.2093 }, weather: { tempC: 22, condition: "clear" }, state: { status: "unknown" } },
    { exchange: { id: "tse", city: "Tokyo", exchange: "TSE", country: "Japan", iso2: "JP", tz: "Asia/Tokyo", longitude: 139.6917 }, weather: { tempC: 13, condition: "cloud" }, state: { status: "unknown" } },
    { exchange: { id: "hkex", city: "Hong Kong", exchange: "HKEX", country: "Hong Kong", iso2: "HK", tz: "Asia/Hong_Kong", longitude: 114.1694 }, weather: { tempC: 19, condition: "rain" }, state: { status: "unknown" } },
    { exchange: { id: "sgx", city: "Singapore", exchange: "SGX", country: "Singapore", iso2: "SG", tz: "Asia/Singapore", longitude: 103.8198 }, weather: { tempC: 29, condition: "hot" }, state: { status: "unknown" } },
    { exchange: { id: "bse", city: "Mumbai", exchange: "BSE", country: "India", iso2: "IN", tz: "Asia/Kolkata", longitude: 72.8777 }, weather: { tempC: 28, condition: "hot" }, state: { status: "unknown" } },
    { exchange: { id: "dfm", city: "Dubai", exchange: "DFM", country: "United Arab Emirates", iso2: "AE", tz: "Asia/Dubai", longitude: 55.2708 }, weather: { tempC: 26, condition: "clear" }, state: { status: "unknown" } },
    { exchange: { id: "jse", city: "Johannesburg", exchange: "JSE", country: "South Africa", iso2: "ZA", tz: "Africa/Johannesburg", longitude: 28.0473 }, weather: { tempC: 18, condition: "clear" }, state: { status: "unknown" } },
    { exchange: { id: "xetra", city: "Frankfurt", exchange: "Xetra", country: "Germany", iso2: "DE", tz: "Europe/Berlin", longitude: 8.6821 }, weather: { tempC: 8, condition: "cloud" }, state: { status: "unknown" } },
    { exchange: { id: "lse", city: "London", exchange: "LSE", country: "United Kingdom", iso2: "GB", tz: "Europe/London", longitude: -0.1276 }, weather: { tempC: 6, condition: "rain" }, state: { status: "unknown" } },
    { exchange: { id: "nyse", city: "New York", exchange: "NYSE", country: "United States", iso2: "US", tz: "America/New_York", longitude: -74.006 }, weather: { tempC: 2, condition: "snow" }, state: { status: "unknown" } },
    { exchange: { id: "tsx", city: "Toronto", exchange: "TSX", country: "Canada", iso2: "CA", tz: "America/Toronto", longitude: -79.3832 }, weather: { tempC: -1, condition: "snow" }, state: { status: "unknown" } },
    { exchange: { id: "cme", city: "Chicago", exchange: "CME", country: "United States", iso2: "US", tz: "America/Chicago", longitude: -87.6298 }, weather: { tempC: 1, condition: "cloud" }, state: { status: "unknown" } },
  ];

  return markets;
}




