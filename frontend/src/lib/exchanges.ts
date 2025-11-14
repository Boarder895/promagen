// frontend/src/lib/exchanges.ts

export type ExchangeStatus = "active" | "inactive";

export type ExchangeRegion = "APAC" | "EMEA" | "AMERICAS";

export type Exchange = {
  /**
   * Stable identifier for the exchange, e.g. "NZX", "ASX", "TSE".
   */
  id: string;

  /**
   * Full display name, e.g. "Tokyo Stock Exchange".
   */
  name: string;

  /**
   * City where the primary market is located, e.g. "Tokyo".
   */
  city?: string;

  /**
   * Country name, e.g. "Japan".
   */
  country: string;

  /**
   * ISO-3166 alpha-2 country code, e.g. "JP", "GB".
   * Required for flags and some future grouping.
   */
  countryCode: string;

  /**
   * IANA timezone identifier, e.g. "Asia/Tokyo", "Europe/London".
   */
  tz: string;

  /**
   * Optional pre-computed offset from GMT, in minutes, e.g. 540 for GMT+9.
   * This is used only for the small "GMT+09:00" label. It is safe to omit.
   */
  offsetMinutes?: number | null;

  /**
   * Broad region grouping used for internal analytics and future filters.
   */
  region?: ExchangeRegion;

  /**
   * Trading currency code, e.g. "JPY", "GBP".
   */
  tradingCurrency?: string;

  /**
   * Marks whether the exchange is active in the app.
   */
  status?: ExchangeStatus;

  /**
   * Optional MIC code or other identifiers. Kept flexible for future use.
   */
  micCode?: string;

  /**
   * Optional free-form notes, e.g. "Part of JPX Group".
   */
  notes?: string;
};

/**
 * Helper to create a compact "City · ShortName" label.
 * Falls back sensibly if some fields are missing.
 */
export function getExchangeShortLabel(exchange: Exchange): string {
  const city = exchange.city?.trim();
  if (city) {
    return `${city} · ${exchange.id}`;
  }
  return exchange.id;
}
