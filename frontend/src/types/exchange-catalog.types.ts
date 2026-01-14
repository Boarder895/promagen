/**
 * Promagen Exchange Catalog Types
 * Updated for Marketstack Index Integration
 *
 * @version 2.0.0
 * @since 2026-01-13
 */

/**
 * Marketstack index mapping for an exchange
 */
export interface MarketstackMapping {
  /**
   * The benchmark key used in /indexinfo?index={benchmark}
   * e.g., "us500", "ftse_100", "nikkei_225"
   */
  benchmark: string;

  /**
   * Human-readable display name for the index
   * e.g., "S&P 500", "FTSE 100", "Nikkei 225"
   */
  displayName: string;

  /**
   * Availability status:
   * - "active": Available on current Marketstack plan
   * - "coming-soon": Not yet available, show as greyed out
   */
  status: "active" | "coming-soon";

  /**
   * Optional notes for developers
   */
  notes?: string;
}

/**
 * Exchange catalog entry with Marketstack integration
 */
export interface ExchangeCatalogEntry {
  /** Unique identifier, e.g., "nyse-new-york" */
  id: string;

  /** City name, e.g., "New York" */
  city: string;

  /** Full exchange name, e.g., "New York Stock Exchange (NYSE)" */
  exchange: string;

  /** Country name, e.g., "United States" */
  country: string;

  /** ISO 3166-1 alpha-2 country code, e.g., "US" */
  iso2: string;

  /** IANA timezone, e.g., "America/New_York" */
  tz: string;

  /** Longitude coordinate */
  longitude: number;

  /** Latitude coordinate */
  latitude: number;

  /** Reference to trading hours template */
  hoursTemplate: string;

  /** Reference to holidays definition */
  holidaysRef: string;

  /** Hemisphere for ribbon sorting: NE, NW, SE, SW */
  hemisphere: "NE" | "NW" | "SE" | "SW";

  /** Optional short label for UI display */
  ribbonLabel?: string;

  /** Marketstack API mapping */
  marketstack?: MarketstackMapping;
}

/**
 * Response from Marketstack /indexinfo endpoint
 */
export interface MarketstackIndexInfo {
  benchmark: string;
  region: string;
  country: string;
  price: string;
  price_change_day: string;
  percentage_day: string;
  percentage_week: string;
  percentage_month: string;
  percentage_year: string;
  date: string;
}

/**
 * Response from Marketstack /indexlist endpoint
 */
export interface MarketstackIndexListResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: Array<{
    benchmark: string;
  }>;
}

/**
 * Exchange Card display data (combines exchange + index + weather)
 */
export interface ExchangeCardData {
  exchange: ExchangeCatalogEntry;
  index?: {
    value: number;
    change: number;
    changePercent: number;
    lastUpdated: Date;
  };
  weather?: {
    temperature: number;
    icon: string;
    description: string;
  };
  status: {
    isOpen: boolean;
    localTime: string;
    nextEvent: string; // "Opens in 2h" or "Closes in 4h"
  };
}

/**
 * Pro user selection entry
 */
export interface ExchangeSelection {
  /** Exchange ID from catalog */
  exchangeId: string;

  /** Whether user has selected this exchange */
  selected: boolean;

  /** Order in the ribbon (1-12 for paid users) */
  order?: number;
}

/**
 * Complete exchange catalog structure
 */
export interface ExchangeCatalog {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
    notes: string[];
  };
  exchanges: ExchangeCatalogEntry[];
}
