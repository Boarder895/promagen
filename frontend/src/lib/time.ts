// Tiny, SSR-safe time helpers for the homepage.
// Focus: readable local time by IANA tz, stable formatting, and safe fallbacks.

export type Tz = string;

type LocalTimeOptions = {
  hour12?: boolean;
  withSeconds?: boolean;
  locale?: string; // e.g. 'en-GB'
};

/** Returns a best-effort local time string for a given IANA timezone. */
export function localTime(tz: Tz, opts: LocalTimeOptions = {}): string {
  const {
    hour12 = false, // 24-hour by default for en-GB
    withSeconds = false,
    locale = 'en-GB',
  } = opts;

  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
      hour12,
    });
    return fmt.format(now);
  } catch {
    // If tz is unknown, fall back to system local
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
      hour12,
    });
  }
}

/** Returns an ISO string (UTC) — safe to use on client or server. */
export function isoNow(): string {
  return new Date().toISOString();
}

/** Formats a GMT offset like “UTC+9” for an IANA tz, with a safe fallback. */
export function utcOffsetLabel(tz: Tz): string {
  try {
    const now = new Date();
    // Get offset minutes by formatting parts and inferring zone from UTC comparison.
    // More reliable approach: use getTimezoneOffset on a date constructed with the tz via formatting.
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
    })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value;

    if (parts && /^UTC[+-]\d{1,2}(:\d{2})?$/.test(parts)) {
      return parts.replace(':00', '');
    }
  } catch {
    // ignore
  }
  // Fallback to system offset
  const mins = -new Date().getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60)
    .toString()
    .padStart(1, '0');
  return `UTC${sign}${h}`;
}
