// Minimal export so `import('@/lib/sunrise')` is a module.
// You can replace with a real implementation later.
export const SUNRISE_LIB = true;

export function getSunriseSunset(_lat: number, _lon: number, _isoDate?: string) {
  return {
    sunrise: "06:00",
    sunset: "18:00",
  };
}
