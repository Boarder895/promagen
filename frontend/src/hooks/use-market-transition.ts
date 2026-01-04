// src/hooks/use-market-transition.ts
// ============================================================================
// MARKET TRANSITION HOOK - Detects when exchanges open or close
// ============================================================================
// Used by Market Pulse feature to trigger pulse animations.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Exchange } from '@/data/exchanges/types';
import MARKET_HOURS_TEMPLATES from '@/data/markets/market-hours.templates.json';

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

export type MarketStatus = 'open' | 'closed';

export type MarketTransitionEvent = {
  exchangeId: string;
  transition: 'opening' | 'closing';
  timestamp: number;
};

export type MarketStatusMap = Map<string, MarketStatus>;

/**
 * Parse HH:MM time string to minutes since midnight.
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
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return dayMap[dayStr] ?? 0;
  } catch {
    return 0;
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function normaliseDayToken(token: string): string {
  return token.trim().slice(0, 3);
}

function isDayIncluded(daysStr: string, dayOfWeek: number): boolean {
  const cleaned = daysStr.trim();
  if (!cleaned) return false;

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map((s) => normaliseDayToken(s));
    const startDay = parts[0];
    const endDay = parts[1];
    if (!startDay || !endDay) return false;
    const startIdx = DAY_NAMES.indexOf(startDay as (typeof DAY_NAMES)[number]);
    const endIdx = DAY_NAMES.indexOf(endDay as (typeof DAY_NAMES)[number]);
    if (startIdx === -1 || endIdx === -1) return false;
    if (startIdx <= endIdx) {
      return dayOfWeek >= startIdx && dayOfWeek <= endIdx;
    }
    return dayOfWeek >= startIdx || dayOfWeek <= endIdx;
  }

  if (cleaned.includes(',')) {
    const tokens = cleaned.split(',').map((s) => normaliseDayToken(s));
    const today = DAY_NAMES[dayOfWeek] ?? 'Sun';
    return tokens.includes(today);
  }

  const single = normaliseDayToken(cleaned);
  const today = DAY_NAMES[dayOfWeek] ?? 'Sun';
  return single === today;
}

/**
 * Determine if market is currently open based on timezone and hours template.
 */
function getMarketStatus(tz: string, hoursTemplate?: string): MarketStatus {
  if (!hoursTemplate) return 'closed';

  const templates = (MARKET_HOURS_TEMPLATES as TemplatesData).templates;
  const template = templates[hoursTemplate];

  if (!template || !template.session || template.session.length === 0) {
    return 'closed';
  }

  const currentMinutes = getCurrentMinutesInTZ(tz);
  const currentDay = getCurrentDayInTZ(tz);

  for (const session of template.session) {
    if (!isDayIncluded(session.days, currentDay)) continue;
    const openMinutes = timeToMinutes(session.open);
    const closeMinutes = timeToMinutes(session.close);
    if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
      return 'open';
    }
  }

  return 'closed';
}

export type UseMarketTransitionOptions = {
  /** Exchanges to monitor */
  exchanges: ReadonlyArray<Exchange>;
  /** Callback when a market opens or closes */
  onTransition?: (event: MarketTransitionEvent) => void;
  /** Check interval in milliseconds (default: 10000 = 10 seconds) */
  intervalMs?: number;
};

/**
 * Hook that monitors exchange market status and detects transitions.
 * 
 * Returns the current status map and fires onTransition callback when
 * a market opens or closes.
 * 
 * @example
 * ```tsx
 * const { statusMap } = useMarketTransition({
 *   exchanges,
 *   onTransition: (event) => {
 *     console.log(`${event.exchangeId} is ${event.transition}`);
 *     triggerPulseAnimation(event);
 *   },
 * });
 * ```
 */
export function useMarketTransition({
  exchanges,
  onTransition,
  intervalMs = 10000,
}: UseMarketTransitionOptions) {
  const [statusMap, setStatusMap] = useState<MarketStatusMap>(() => new Map());
  const previousStatusRef = useRef<MarketStatusMap>(new Map());

  // Build initial status map
  const updateStatuses = useCallback(() => {
    const newMap = new Map<string, MarketStatus>();
    
    for (const exchange of exchanges) {
      const status = getMarketStatus(exchange.tz, exchange.hoursTemplate);
      newMap.set(exchange.id, status);
    }

    // Check for transitions
    const prevMap = previousStatusRef.current;
    for (const [exchangeId, newStatus] of newMap) {
      const prevStatus = prevMap.get(exchangeId);
      
      // Only fire transition if we have a previous status (not initial load)
      if (prevStatus !== undefined && prevStatus !== newStatus) {
        const transition = newStatus === 'open' ? 'opening' : 'closing';
        onTransition?.({
          exchangeId,
          transition,
          timestamp: Date.now(),
        });
      }
    }

    previousStatusRef.current = newMap;
    setStatusMap(newMap);
  }, [exchanges, onTransition]);

  // Set up interval for status checks
  useEffect(() => {
    // Initial update
    updateStatuses();

    // Regular interval
    const intervalId = setInterval(updateStatuses, intervalMs);

    return () => clearInterval(intervalId);
  }, [updateStatuses, intervalMs]);

  return { statusMap };
}

export default useMarketTransition;
