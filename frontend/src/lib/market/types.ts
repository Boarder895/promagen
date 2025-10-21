// src/lib/market/types.ts
export type MarketStatus = 'open' | 'closed' | 'pre' | 'post' | 'holiday' | 'unknown';

export interface Exchange {
  id: string;
  exchange: string;
  city: string;
  country: string;
  iso2: string;
  tz: string;        // IANA zone
  longitude: number; // for east–west split
}

export interface WeatherSummary {
  tempC: number;
  condition: 'Clear' | 'Cloudy' | 'Partly Cloudy' | 'Rain' | 'Haze' | 'Fog' | 'Drizzle' | 'Thunder';
}

export interface MarketState {
  id: string;                   // exchange id
  status: MarketStatus;
  nextChangeISO: string | null; // UTC ISO string, null if unknown
}


