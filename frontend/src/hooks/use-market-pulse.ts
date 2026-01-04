// src/hooks/use-market-pulse.ts
// ============================================================================
// MARKET PULSE v2.0 - Event-driven pulse detection with flowing energy
// ============================================================================
// Detects when exchanges are within ±1 minute of open/close events.
// Supports multi-session exchanges (lunch breaks fire 4 events/day).
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Exchange } from '@/data/exchanges/types';
import MARKET_HOURS_TEMPLATES from '@/data/markets/market-hours.templates.json';

// ============================================================================
// Types
// ============================================================================

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
 * Pulse state machine states
 */
export type PulseState =
  | 'dormant' // Nothing visible - most of the day
  | 'pre-open' // 1 min before open - curves fade in, slow particles
  | 'opening' // Market opens - BURST, row flash
  | 'pre-close' // 1 min before close - curves reappear, reverse particles
  | 'closing'; // Market closes - reverse burst, then fade out

/**
 * A single session transition event
 */
export type SessionTransition = {
  /** Exchange ID */
  exchangeId: string;
  /** Session index (0 for main, 1+ for afternoon sessions) */
  sessionIndex: number;
  /** Whether this is the open or close of the session */
  type: 'open' | 'close';
  /** Local time of this event (HH:MM) */
  localTime: string;
  /** Minutes from now (negative = past, positive = future) */
  minutesFromNow: number;
};

/**
 * Current pulse context for an exchange
 */
export type ExchangePulseContext = {
  exchangeId: string;
  state: PulseState;
  /** Current or next transition */
  transition?: SessionTransition;
  /** Progress through current state (0-1) */
  progress: number;
};

// ============================================================================
// Constants
// ============================================================================

/** Event window in minutes before/after open/close */
const EVENT_WINDOW_MINUTES = 1;

/** How often to check for state changes (ms) */
const CHECK_INTERVAL_MS = 1000; // Every second for accuracy

/** Duration of the burst event itself (ms) */
const BURST_DURATION_MS = 10000; // 10 seconds

// ============================================================================
// Utility Functions
// ============================================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
 * Get all session transitions for an exchange today
 */
function getSessionTransitions(
  tz: string,
  hoursTemplate: string | undefined,
  currentMinutes: number,
  currentDay: number,
): SessionTransition[] {
  if (!hoursTemplate) return [];

  const templates = (MARKET_HOURS_TEMPLATES as TemplatesData).templates;
  const template = templates[hoursTemplate];

  if (!template?.session?.length) return [];

  const transitions: Array<{
    sessionIndex: number;
    type: 'open' | 'close';
    localTime: string;
    eventMinutes: number;
  }> = [];

  template.session.forEach((session, idx) => {
    if (!isDayIncluded(session.days, currentDay)) return;

    const openMinutes = timeToMinutes(session.open);
    const closeMinutes = timeToMinutes(session.close);

    transitions.push({
      sessionIndex: idx,
      type: 'open',
      localTime: session.open,
      eventMinutes: openMinutes,
    });

    transitions.push({
      sessionIndex: idx,
      type: 'close',
      localTime: session.close,
      eventMinutes: closeMinutes,
    });
  });

  // Sort by time and calculate minutes from now
  return transitions
    .sort((a, b) => a.eventMinutes - b.eventMinutes)
    .map((t) => ({
      exchangeId: '', // Will be set by caller
      sessionIndex: t.sessionIndex,
      type: t.type,
      localTime: t.localTime,
      minutesFromNow: t.eventMinutes - currentMinutes,
    }));
}

/**
 * Determine the pulse state for an exchange based on upcoming transitions
 */
function determinePulseState(
  transitions: SessionTransition[],
  burstStartTime: number | null,
): { state: PulseState; transition?: SessionTransition; progress: number } {
  const now = Date.now();

  // Check if we're in a burst animation
  if (burstStartTime !== null) {
    const elapsed = now - burstStartTime;
    if (elapsed < BURST_DURATION_MS) {
      const progress = elapsed / BURST_DURATION_MS;
      // Find the transition that triggered this burst
      const activeTransition = transitions.find((t) => Math.abs(t.minutesFromNow) < 0.5);
      const state = activeTransition?.type === 'close' ? 'closing' : 'opening';
      return { state, transition: activeTransition, progress };
    }
  }

  // Find the nearest transition
  for (const transition of transitions) {
    const mins = transition.minutesFromNow;

    // Pre-open: 1 minute before open
    if (transition.type === 'open' && mins > 0 && mins <= EVENT_WINDOW_MINUTES) {
      const progress = 1 - mins / EVENT_WINDOW_MINUTES;
      return { state: 'pre-open', transition, progress };
    }

    // Opening: exactly at open (within 30 seconds)
    if (transition.type === 'open' && mins <= 0 && mins > -EVENT_WINDOW_MINUTES) {
      const progress = Math.abs(mins) / EVENT_WINDOW_MINUTES;
      return { state: 'opening', transition, progress };
    }

    // Pre-close: 1 minute before close
    if (transition.type === 'close' && mins > 0 && mins <= EVENT_WINDOW_MINUTES) {
      const progress = 1 - mins / EVENT_WINDOW_MINUTES;
      return { state: 'pre-close', transition, progress };
    }

    // Closing: exactly at close (within 30 seconds)
    if (transition.type === 'close' && mins <= 0 && mins > -EVENT_WINDOW_MINUTES) {
      const progress = Math.abs(mins) / EVENT_WINDOW_MINUTES;
      return { state: 'closing', transition, progress };
    }
  }

  return { state: 'dormant', progress: 0 };
}

// ============================================================================
// Hook
// ============================================================================

export type UseMarketPulseOptions = {
  /** Exchanges to monitor */
  exchanges: ReadonlyArray<Exchange>;
  /** Callback when a burst event fires (opening/closing) */
  onBurst?: (context: ExchangePulseContext) => void;
};

export type UseMarketPulseReturn = {
  /** Current pulse context for each exchange */
  pulseContexts: Map<string, ExchangePulseContext>;
  /** Exchanges currently in active states (not dormant) */
  activeExchangeIds: string[];
  /** Force a burst for testing */
  triggerTestBurst: (exchangeId: string, type: 'open' | 'close') => void;
};

/**
 * Hook that monitors exchange market schedules and fires pulse events.
 *
 * Features:
 * - Detects all session open/close events (including lunch breaks)
 * - Fires events ±1 minute around transitions
 * - Provides progress values for smooth animations
 *
 * @example
 * ```tsx
 * const { pulseContexts, activeExchangeIds } = useMarketPulse({
 *   exchanges,
 *   onBurst: (ctx) => console.log(`${ctx.exchangeId} is ${ctx.state}`),
 * });
 * ```
 */
export function useMarketPulse({
  exchanges,
  onBurst,
}: UseMarketPulseOptions): UseMarketPulseReturn {
  const [pulseContexts, setPulseContexts] = useState<Map<string, ExchangePulseContext>>(
    () => new Map(),
  );

  // Track burst start times for each exchange
  const burstStartTimesRef = useRef<Map<string, number>>(new Map());

  // Track which bursts we've already fired (to avoid duplicates)
  const firedBurstsRef = useRef<Set<string>>(new Set());

  const updateContexts = useCallback(() => {
    const newContexts = new Map<string, ExchangePulseContext>();
    const currentBurstTimes = burstStartTimesRef.current;
    const firedBursts = firedBurstsRef.current;

    for (const exchange of exchanges) {
      const currentMinutes = getCurrentMinutesInTZ(exchange.tz);
      const currentDay = getCurrentDayInTZ(exchange.tz);

      const transitions = getSessionTransitions(
        exchange.tz,
        exchange.hoursTemplate,
        currentMinutes,
        currentDay,
      ).map((t) => ({ ...t, exchangeId: exchange.id }));

      const burstStartTime = currentBurstTimes.get(exchange.id) ?? null;
      const { state, transition, progress } = determinePulseState(transitions, burstStartTime);

      // Check if we need to trigger a burst
      if ((state === 'opening' || state === 'closing') && transition) {
        const burstKey = `${exchange.id}-${transition.type}-${transition.localTime}`;

        if (!firedBursts.has(burstKey) && !currentBurstTimes.has(exchange.id)) {
          // Start a new burst
          currentBurstTimes.set(exchange.id, Date.now());
          firedBursts.add(burstKey);

          const context: ExchangePulseContext = {
            exchangeId: exchange.id,
            state,
            transition,
            progress: 0,
          };

          onBurst?.(context);
        }
      }

      // Clean up old burst times
      const burstStart = currentBurstTimes.get(exchange.id);
      if (burstStart && Date.now() - burstStart > BURST_DURATION_MS) {
        currentBurstTimes.delete(exchange.id);
      }

      // Clean up old fired bursts (reset at midnight to allow next day)
      if (currentMinutes === 0) {
        firedBursts.clear();
      }

      newContexts.set(exchange.id, {
        exchangeId: exchange.id,
        state,
        transition,
        progress,
      });
    }

    setPulseContexts(newContexts);
  }, [exchanges, onBurst]);

  // Set up interval for status checks
  useEffect(() => {
    updateContexts();
    const intervalId = setInterval(updateContexts, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [updateContexts]);

  // Get active exchange IDs (not dormant)
  const activeExchangeIds = useMemo(() => {
    return Array.from(pulseContexts.entries())
      .filter(([, ctx]) => ctx.state !== 'dormant')
      .map(([id]) => id);
  }, [pulseContexts]);

  // Test function to manually trigger a burst
  const triggerTestBurst = useCallback(
    (exchangeId: string, type: 'open' | 'close') => {
      burstStartTimesRef.current.set(exchangeId, Date.now());

      const context: ExchangePulseContext = {
        exchangeId,
        state: type === 'open' ? 'opening' : 'closing',
        transition: {
          exchangeId,
          sessionIndex: 0,
          type,
          localTime: '00:00',
          minutesFromNow: 0,
        },
        progress: 0,
      };

      onBurst?.(context);
      updateContexts();
    },
    [onBurst, updateContexts],
  );

  return {
    pulseContexts,
    activeExchangeIds,
    triggerTestBurst,
  };
}

export default useMarketPulse;
