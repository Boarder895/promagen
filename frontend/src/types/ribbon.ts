// Canonical types for ribbon + providers, kept broad enough to match older code.

export type MarketStatus =
  | "open"
  | "closed"
  | "pre"
  | "post"
  | "holiday"
  | "unknown";

// --- Exchange/meta ---

export interface ExchangeMeta {
  id: string;          // "lse", "nyse", etc.
  city: string;        // "London"
  exchange: string;    // "LSE"
  country: string;     // "United Kingdom"
  iso2: string;        // "GB"
  tz: string;          // IANA TZ, e.g. "Europe/London"
  longitude: number;   // used for east/west split
}

// Older code uses ExchangeInfo — keep it as an alias for compatibility.
export type ExchangeInfo = ExchangeMeta;

// Some code may import ExchangeFlags; make it optional/extendable.
export interface ExchangeFlags {
  openNow?: boolean;
  holidayToday?: boolean;
  [k: string]: boolean | number | string | undefined;
}

// Optional time fields some code references.
export interface ExchangeChrono {
  openISO?: string;
  closeISO?: string;
  nextChangeISO?: string;
}

// --- Weather ---

export interface Weather {
  tempC?: number | null;     // allow undefined from APIs
  condition?: string;        // "clear", "rain", "snow", etc.
  // Older code sometimes (incorrectly) keys into Weather with "city".
  // Add as optional to satisfy keyof lookups without changing callers.
  city?: string;
}

// --- Market row on the ribbon ---

export interface MarketState {
  status: MarketStatus;
  nextChangeISO?: string;
}

export interface RibbonMarket {
  exchange: ExchangeMeta;
  weather?: Weather;
  state?: MarketState & ExchangeFlags & ExchangeChrono;
}

// --- Providers (leaderboard) ---

export interface ProviderTile {
  id: string;
  name: string;
  tagline?: string;
  url?: string;              // official/affiliate link
  affiliateUrl?: string;     // some code expects this exact key
  score?: number;            // 0–100
  trend?: "up" | "down" | "flat";
}

export interface RibbonPayload {
  markets: RibbonMarket[];
  providers: ProviderTile[];
}



