// frontend/src/lib/time.ts

/**
 * Returns the current time as an ISO 8601 string.
 * A custom Date can be passed for deterministic tests.
 */
export function isoNow(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Computes a simple local time string ("HH:MM") for a given UTC offset in minutes.
 *
 * - offsetMinutes is the difference from UTC in minutes (e.g. +60 for UTC+1).
 * - baseDate defaults to now, but can be injected for tests.
 */
export function localTime(offsetMinutes: number, baseDate: Date = new Date()): string {
  // Convert baseDate to UTC, then apply the offset.
  const utcMillis = baseDate.getTime() + baseDate.getTimezoneOffset() * 60_000;
  const localMillis = utcMillis + offsetMinutes * 60_000;
  const local = new Date(localMillis);

  const hours = local.getUTCHours().toString().padStart(2, "0");
  const minutes = local.getUTCMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

/**
 * Formats a UTC offset in minutes into a human label like:
 * - 0       → "UTC"
 * - 60      → "UTC+01"
 * - -300    → "UTC-05"
 * - 330     → "UTC+05:30"
 */
export function utcOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";

  const sign = offsetMinutes > 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  const hh = hours.toString().padStart(2, "0");
  if (minutes === 0) {
    return `UTC${sign}${hh}`;
  }

  const mm = minutes.toString().padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}
