// frontend/src/data/markets.ts
// Canonical “markets” view derived from exchanges.catalog.json.
// Exports MARKETS plus a couple of tiny helpers.

type ExchangeRec = {
  id: string;
  name?: string;
  city?: string;
  countryCode?: string;
  timezone?: string; // some older records may use 'timezone'
  tz?: string;       // preferred key
  latitude?: number;
  longitude?: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
};

// Import the single source of truth JSON.
// Assumes tsconfig has `"resolveJsonModule": true`.
import exchanges from "./exchanges.catalog.json";

export type Market = {
  id: string;
  city: string;
  tz: string;
};

/**
 * MARKETS – minimal projection used around the app.
 * Filters out any incomplete rows (no id/city/tz).
 */
export const MARKETS: Market[] = (exchanges as ExchangeRec[])
  .map((x) => ({
    id: String(x.id ?? "").trim(),
    city: String(x.city ?? "").trim(),
    tz: String((x.tz ?? x.timezone ?? "")).trim(),
  }))
  .filter((m) => m.id && m.city && m.tz);

/** Unique list of market cities. */
export const getAllMarketCities = (): string[] => [
  ...new Set(MARKETS.map((m) => m.city)),
];

/** Resolve an exchange timezone by id (prefers tz, falls back handled above). */
export const getExchangeTimeZone = (id: string): string | undefined =>
  MARKETS.find((m) => m.id === id)?.tz;
