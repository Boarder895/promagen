// src/lib/utils/timezone.ts

/**
 * Format the current time in a given timezone as HH:MM
 */
export function formatTimeInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(now);
  } catch (error) {
    console.error(`Invalid timezone: ${timezone}`, error);
    return '--:--';
  }
}

/**
 * Check if current time is within support hours
 * @param timezone IANA timezone (e.g., "America/Los_Angeles")
 * @param supportHours Human-readable string (e.g., "Mon-Fri 9AM-6PM PT")
 * @returns true if currently within hours, false otherwise
 */
export function isWithinSupportHours(timezone: string, supportHours?: string): boolean {
  if (!supportHours) return false;
  if (supportHours === '24/7') return true;

  try {
    const now = new Date();
    
    // Get current day and time in the provider's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    
    // Simple heuristic: if support hours mention "Mon-Fri" and it's Sat/Sun, not available
    if (supportHours.includes('Mon-Fri') && (weekday === 'Sat' || weekday === 'Sun')) {
      return false;
    }
    
    // Simple time range check (assumes 9AM-6PM or similar patterns)
    // This is a basic implementation - you can enhance with regex parsing
    const hasNineToSix = supportHours.match(/9\s*AM.*6\s*PM/i);
    if (hasNineToSix) {
      return hour >= 9 && (hour < 18 || (hour === 18 && minute === 0));
    }
    
    // Default: assume available if we can't parse (better UX than always dim)
    return true;
  } catch (error) {
    console.error('Error checking support hours:', error);
    return false;
  }
}

/**
 * Get current time in a timezone as a Date object
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(new Date(utcTime));
    const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';
    
    return new Date(
      parseInt(getValue('year'), 10),
      parseInt(getValue('month'), 10) - 1,
      parseInt(getValue('day'), 10),
      parseInt(getValue('hour'), 10),
      parseInt(getValue('minute'), 10),
      parseInt(getValue('second'), 10)
    );
  } catch {
    return new Date(utcTime);
  }
}
