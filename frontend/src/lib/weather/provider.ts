// frontend/src/lib/weather/provider.ts
import type { Exchange } from '../markets/types';

export type WeatherProvider = 'open-meteo' | 'met-office' | 'noaa';

export function providerForExchange(_: Exchange): WeatherProvider {
  // Minimal stub: pick a default; wire real routing later.
  return 'open-meteo';
}

export function providerLabel(p: WeatherProvider): string {
  switch (p) {
    case 'open-meteo': return 'Open-Meteo';
    case 'met-office': return 'Met Office';
    case 'noaa': return 'NOAA';
    default: return String(p);
  }
}
