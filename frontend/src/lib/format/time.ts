/**
 * Time helpers used by the ribbon and tiles.
 */

export type AgeCategory = "fresh" | "ageing" | "delayed";

/** Decide freshness category by minutes since timestamp. */
export function ageCategory(ts: number, now = Date.now()): AgeCategory {
  const mins = (now - ts) / 60000;
  if (mins <= 30) return "fresh";
  if (mins <= 90) return "ageing";
  return "delayed";
}

export function formatAsOf(ts: number, locale?: string): string {
  return new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/** Format label like: "as of 14:05 local" */
export function asOfLabel(ts: number, locale?: string): string {
  return `as of ${formatAsOf(ts, locale)} local`;
}
