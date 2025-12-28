'use client';

import * as React from 'react';
import type { MarketStatus } from '../types';
import MARKET_HOURS_TEMPLATES from '@/data/markets/market-hours.templates.json';

export type MarketStatusProps = {
  /** IANA timezone identifier for the exchange */
  tz: string;
  /** Reference to hours template key, e.g. "us-standard", "asia-break" */
  hoursTemplate?: string;
  /** Optional className for styling */
  className?: string;
};

type Session = {
  days: string;
  open: string;
  close: string;
};

type Template = {
  label: string;
  session: Session[];
  notes?: string;
};

type TemplatesData = {
  templates: Record<string, Template>;
};

/**
 * Parse HH:MM time string to minutes since midnight.
 * Returns 0 if input is malformed.
 */
function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return 0;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;

  return hours * 60 + minutes;
}

/**
 * Get current time in specified timezone as minutes since midnight.
 */
function getCurrentMinutesInTZ(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    return hour * 60 + minute;
  } catch {
    return 0;
  }
}

/**
 * Get current day of week (0=Sun, 1=Mon, ..., 6=Sat) in specified timezone.
 */
function getCurrentDayInTZ(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
    });
    const dayStr = formatter.format(new Date());
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return dayMap[dayStr] ?? 0;
  } catch {
    return 0;
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function normaliseDayToken(token: string): string {
  // Keep it simple: templates use short day names already.
  // Trim whitespace and take first 3 chars in case someone writes "Monday".
  return token.trim().slice(0, 3);
}

/**
 * Check if days string (e.g. "Mon-Fri") includes the given day.
 * Also supports comma-separated lists like "Mon,Wed,Fri" and single days "Mon".
 */
function isDayIncluded(daysStr: string, dayOfWeek: number): boolean {
  const cleaned = daysStr.trim();
  if (!cleaned) return false;

  // Range: "Mon-Fri"
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map((s) => normaliseDayToken(s));
    const startDay = parts[0];
    const endDay = parts[1];

    if (!startDay || !endDay) return false;

    const startIdx = DAY_NAMES.indexOf(startDay as (typeof DAY_NAMES)[number]);
    const endIdx = DAY_NAMES.indexOf(endDay as (typeof DAY_NAMES)[number]);

    if (startIdx === -1 || endIdx === -1) return false;

    // Handle wrap-around ranges like "Fri-Mon"
    if (startIdx <= endIdx) {
      return dayOfWeek >= startIdx && dayOfWeek <= endIdx;
    }
    return dayOfWeek >= startIdx || dayOfWeek <= endIdx;
  }

  // Comma-separated: "Mon,Wed,Fri"
  if (cleaned.includes(',')) {
    const tokens = cleaned.split(',').map((s) => normaliseDayToken(s));
    const today = DAY_NAMES[dayOfWeek] ?? 'Sun';
    return tokens.includes(today);
  }

  // Single token: "Mon"
  const single = normaliseDayToken(cleaned);
  const today = DAY_NAMES[dayOfWeek] ?? 'Sun';
  return single === today;
}

/**
 * Determine if market is currently open based on timezone and hours template.
 */
function getMarketStatus(tz: string, hoursTemplate?: string): MarketStatus {
  // Default to closed if no template
  if (!hoursTemplate) {
    return 'closed';
  }

  const templates = (MARKET_HOURS_TEMPLATES as TemplatesData).templates;
  const template = templates[hoursTemplate];

  if (!template || !template.session || template.session.length === 0) {
    return 'closed';
  }

  const currentMinutes = getCurrentMinutesInTZ(tz);
  const currentDay = getCurrentDayInTZ(tz);

  // Check each session
  for (const session of template.session) {
    if (!isDayIncluded(session.days, currentDay)) {
      continue;
    }

    const openMinutes = timeToMinutes(session.open);
    const closeMinutes = timeToMinutes(session.close);

    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return 'open';
    }
  }

  return 'closed';
}

/**
 * MarketStatus - Displays open/closed indicator for an exchange.
 *
 * Features:
 * - Updates every minute to check market status
 * - Uses exchange timezone for accurate local time
 * - Reads trading hours from SSOT (market-hours.templates.json)
 * - Shows emerald dot for open, rose dot for closed
 */
export const MarketStatusIndicator = React.memo(function MarketStatusIndicator({
  tz,
  hoursTemplate,
  className = '',
}: MarketStatusProps) {
  const [status, setStatus] = React.useState<MarketStatus>('closed');

  React.useEffect(() => {
    const updateStatus = () => {
      setStatus(getMarketStatus(tz, hoursTemplate));
    };

    // Initial update
    updateStatus();

    // Update every minute (60000ms)
    const intervalId = setInterval(updateStatus, 60000);

    return () => clearInterval(intervalId);
  }, [tz, hoursTemplate]);

  const isOpen = status === 'open';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${className}`}
      role="status"
      aria-label={isOpen ? 'Market is open' : 'Market is closed'}
    >
      <span
        className={`h-2 w-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-rose-500'}`}
        aria-hidden="true"
      />
      <span className={isOpen ? 'text-emerald-400' : 'text-rose-400'}>
        {isOpen ? 'Open' : 'Closed'}
      </span>
    </span>
  );
});

export default MarketStatusIndicator;
