export type ExchangeId = string;

export type ExchangeInfo = {
  id: ExchangeId;
  exchange: string;
  city: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
};

/** Widened to match UI usage (Stage-1/2). */
export type MarketStatus =
  | "OPEN" | "CLOSED" | "PRE" | "POST"
  | "open" | "closed" | "pre" | "post"
  | "holiday" | "unknown";

export type MarketState = { status: MarketStatus; asOfISO?: string; nextChangeISO?: string | null };

/** Interface (not union) so Pick<> works. */
export interface Weather {
  city?: string;
  tempC?: number;
  condition?:
    | "clear" | "partly-cloudy" | "cloudy" | "fog"
    | "drizzle" | "rain" | "showers"
    | "snow" | "snow-showers"
    | "thunder" | "thunder-hail" | "unknown";
  updatedISO?: string;
}

export type RibbonMarket = {
  exchange: ExchangeInfo;
  state?: MarketState | null;
  weather?: Weather | null;
};

export type ExchangeMeta = {
  id?: string;
  code: string;
  localtime?: string;
  open?: boolean;
};



