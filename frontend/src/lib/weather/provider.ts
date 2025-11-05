import type { Exchange } from "../market/types";

export type WeatherSummary = {
  tempC: number;
  condition:
    | "clear" | "partly-cloudy" | "cloudy" | "fog"
    | "drizzle" | "rain" | "showers"
    | "snow" | "snow-showers"
    | "thunder" | "thunder-hail" | "unknown";
  updatedISO: string;
};

export function pseudoWeather(exchange: Pick<Exchange, "city">): WeatherSummary {
  const city = exchange.city ?? "";
  const seed = [...city].reduce((a, c) => a + c.charCodeAt(0), 0);
  const tempC = (seed % 35) - 5;
  const bucket = seed % 6;
  const condition: WeatherSummary["condition"] =
    bucket === 0 ? "clear" :
    bucket === 1 ? "partly-cloudy" :
    bucket === 2 ? "cloudy" :
    bucket === 3 ? "showers" :
    bucket === 4 ? "rain" : "unknown";
  return { tempC, condition, updatedISO: new Date().toISOString() };
}



