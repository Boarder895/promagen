// frontend/src/lib/weather.ts
type ExchangeRecord = { id: string; city: string; lat: number; lon: number; avgTempC?: number };

const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?current_weather=true";

export interface MarketWeather {
  id: string;
  city: string;
  temperatureC: number;
  conditions: string;
  updatedISO: string;
}

export async function fetchWeatherForMarkets(
  markets: ExchangeRecord[]
): Promise<MarketWeather[]> {
  const results = await Promise.all(
    markets.map(async (m) => {
      try {
        const url = `${OPEN_METEO_URL}&latitude=${m.lat}&longitude=${m.lon}`;
        const res = await fetch(url);
        const data = await res.json();

        const cw = data.current_weather;
        return {
          id: m.id,
          city: m.city,
          temperatureC: cw?.temperature ?? 0,
          conditions: cw?.weathercode ?? "unknown",
          updatedISO: new Date().toISOString(),
        };
      } catch {
        // Fallback to historical mean if API fails
        return {
          id: m.id,
          city: m.city,
          temperatureC: m.avgTempC ?? 20,
          conditions: "historical",
          updatedISO: new Date().toISOString(),
        };
      }
    })
  );

  return results;
}















