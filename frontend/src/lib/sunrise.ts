// src/lib/sunrise.ts
export function toLocalSolarNote(coords: { lat: number; lon: number }): string {
  return `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
}









