// frontend/src/lib/analytics/finance.ts
//
// Finance analytics helpers (API Brain compliant).
//
// Hard rules (no-bypass mindset applied to analytics):
// - Must never call FX providers.
// - Must never call /api/fx or /api/fx/trace.
// - Must never set timers/intervals that could create traffic pressure.
// - Must never throw (analytics must be powerless).
//
// This module is observational only: it may emit client-side analytics events
// (e.g. GA4 via gtag) through the shared trackEvent wrapper.

import { trackEvent, type AnalyticsEventName, type AnalyticsEventParams } from '@/lib/analytics/ga';

function safeTrack<K extends AnalyticsEventName>(name: K, payload?: AnalyticsEventParams<K>): void {
  try {
    trackEvent(name, payload);
  } catch {
    // Analytics is never allowed to break product behaviour.
  }
}

export interface RibbonPauseParams {
  /**
   * true when the ribbon is paused, false when resumed.
   */
  isPaused: boolean;
  /**
   * Where this action happened from, e.g. "homepage_ribbon".
   */
  source?: string;
}

/**
 * trackRibbonPause
 *
 * Fired when the main finance ribbon is paused or resumed.
 * Observational only.
 *
 * Note:
 * - This event may not be present in AnalyticsEventName yet, so we assert the type.
 * - When you later add it to AnalyticsEventName/AnalyticsEventPayloads, this stays valid.
 */
export function trackRibbonPause({ isPaused, source }: RibbonPauseParams): void {
  const eventName = 'ribbon_pause' as AnalyticsEventName;

  safeTrack(eventName, {
    is_paused: isPaused,
    source,
  } as AnalyticsEventParams<typeof eventName>);
}

export type FxPairSelectSource = 'default' | 'picker' | 'reset' | string;

export interface FxPairSelectParams {
  /**
   * Current set of selected FX pair ids (e.g. ["gbp-usd","eur-usd",…]).
   */
  pairIds: string[];
  /**
   * How this selection was made.
   */
  source?: FxPairSelectSource;
}

/**
 * trackFxPairSelect
 *
 * Fired when the user saves a new FX pair selection (e.g. via the picker).
 * Observational only.
 */
export function trackFxPairSelect({ pairIds, source }: FxPairSelectParams): void {
  const eventName = 'fx_pair_select' as AnalyticsEventName;

  safeTrack(eventName, {
    count: pairIds.length,
    ids: pairIds.join(','),
    source,
  } as AnalyticsEventParams<typeof eventName>);
}
