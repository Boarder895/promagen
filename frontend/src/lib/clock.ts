/**
 * Clock formatting utilities for timezone-aware time display.
 * Uses native Intl.DateTimeFormat for zero-dependency timezone handling.
 */

/**
 * Formats a Date object as HH:MM:SS (24-hour format).
 * @param date - The Date object to format
 * @returns Time string in HH:MM:SS format
 */
export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formats the current time in a specific timezone as HH:MM:SS (24-hour format).
 * Uses Intl.DateTimeFormat for reliable timezone conversion.
 *
 * @param tz - IANA timezone identifier (e.g., "Asia/Tokyo", "Europe/London")
 * @returns Time string in HH:MM:SS format, or "--:--:--" if timezone is invalid
 */
export function formatClockInTZ(tz: string): string {
  if (!tz) {
    return '--:--:--';
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return formatter.format(new Date());
  } catch {
    // Invalid timezone identifier
    return '--:--:--';
  }
}

/**
 * Returns the current time as a Date object, adjusted for a specific timezone.
 * Note: JavaScript Date objects are always in UTC internally; this function
 * returns a Date that, when formatted in UTC, shows the local time in the
 * specified timezone.
 *
 * @param tz - IANA timezone identifier (e.g., "Asia/Tokyo", "Europe/London")
 * @returns Date object representing current time (falls back to current Date if tz is invalid)
 */
export function nowInTZ(tz: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const getValue = (type: string): number => {
      const part = parts.find((p) => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };

    const year = getValue('year');
    const month = getValue('month') - 1; // JS months are 0-indexed
    const day = getValue('day');
    const hour = getValue('hour');
    const minute = getValue('minute');
    const second = getValue('second');

    return new Date(year, month, day, hour, minute, second);
  } catch {
    // Invalid timezone - return current date as fallback
    return new Date();
  }
}
