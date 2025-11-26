// src/lib/analytics/finance.ts
//
// Domain-level analytics helpers for finance widgets and the ribbon.
// Components (ribbon, mini-widgets, toggles) should call these helpers,
// never trackEvent directly.

import { trackEvent, type AnalyticsEventName } from '@/lib/analytics/ga';

export type FinanceAssetClass = 'fx' | 'commodities' | 'crypto';

export type FinanceToggleState = 'on' | 'off';

export interface FinanceToggleParams {
  /**
   * Optional provider context if the toggle lives inside a provider page.
   */
  providerId?: string;
  /**
   * Which asset class is being toggled.
   */
  assetClass: FinanceAssetClass;
  /**
   * New state of the toggle.
   */
  state: FinanceToggleState;
}

/**
 * trackFinanceToggle
 *
 * Fired whenever an FX / Commodities / Crypto widget is enabled/disabled
 * in the prompt builder or any other finance toggle UI.
 */
export function trackFinanceToggle({ providerId, assetClass, state }: FinanceToggleParams): void {
  const enabled = state === 'on';

  trackEvent('finance_toggle', {
    widget: assetClass,
    enabled,
    // Extra dimension (not required by the GA payload, but useful):
    provider_id: providerId,
  });
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
 *
 * Note:
 * - ga.ts does not currently declare "ribbon_pause" in AnalyticsEventName.
 *   We assert the type here so we can start sending the event without
 *   having to refactor GA immediately.
 * - When you later add it to AnalyticsEventName/AnalyticsEventPayloads,
 *   this helper stays valid.
 */
export function trackRibbonPause({ isPaused, source }: RibbonPauseParams): void {
  const eventName = 'ribbon_pause' as AnalyticsEventName;

  trackEvent(eventName, {
    is_paused: isPaused,
    source,
  });
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
 * Fired when the user saves a new FX pair selection (e.g. via the 5-slot picker).
 * This is optional until the picker UI lands, but keeping it here keeps
 * the API ready.
 */
export function trackFxPairSelect({ pairIds, source }: FxPairSelectParams): void {
  const eventName = 'fx_pair_select' as AnalyticsEventName;

  trackEvent(eventName, {
    count: pairIds.length,
    ids: pairIds.join(','),
    source,
  });
}
