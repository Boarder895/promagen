// src/lib/weather/types.ts

export type WeatherCode =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'fog'
  | string;

export interface WeatherSnapshot {
  city: string;
  tz: string;
  temperatureC: number | null;
  weatherCode: WeatherCode | null;
  observedISO: string | null;
  stale: boolean;
}
