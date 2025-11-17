// frontend/src/data/markets/index.ts
// Canonical “markets” view derived from the exchanges catalogue.
// Exports MARKETS plus tiny helpers for city lists and time-zones.

import EXCHANGES from '@/data/exchanges';
import type { Exchange } from '@/data/exchanges';

type ExchangeLike = Exchange & {
  // Older data may still use `timezone`; keep it optional for safety.
  timezone?: string | null;
};

export type Market = {
  id: string;
  city: string;
  tz: string;
};

/**
 * MARKETS – minimal projection used around the app.
 * Filters out any incomplete rows (no id/city/tz).
 */
export const MARKETS: Market[] = (EXCHANGES as ExchangeLike[])
  .map((x) => {
    const id = (x.id ?? '').toString().trim();
    const city = (x.city ?? '').toString().trim();

    const tzSource = x.tz ?? x.timezone ?? '';
    const tz = tzSource.toString().trim();

    return { id, city, tz };
  })
  .filter((m) => m.id.length > 0 && m.city.length > 0 && m.tz.length > 0);

/** Unique list of market cities (used for filters, chips, etc.). */
export const getAllMarketCities = (): string[] => [...new Set(MARKETS.map((m) => m.city))];

/** Resolve an exchange timezone by id. */
export const getExchangeTimeZone = (id: string): string | undefined =>
  MARKETS.find((m) => m.id === id)?.tz;

export default MARKETS;
