// src/lib/analytics/events.ts

declare global {
  interface Window {
    dataLayer?: unknown[];
    // GA4 gtag signature – we only ever pass name + params
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Analytics feature flags
 *
 * - NEXT_PUBLIC_ANALYTICS_ENABLED
 *   - "false" → disable all tracking
 *   - anything else / undefined → enabled
 *
 * - NEXT_PUBLIC_ANALYTICS_DEBUG
 *   - "true" → log events and errors to console
 */
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';

const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

export type AnalyticsEventName =
  | 'provider_click'
  | 'provider_outbound'
  | 'prompt_builder_open'
  | 'finance_toggle'
  | 'finance_tab_view'
  | 'exchange_widget_open'
  | 'country_commodities_hover'
  | 'nav_click'
  | 'page_view_custom';

/**
 * Payloads per event
 */

export interface ProviderClickPayload {
  providerId: string;
  providerName: string;
  surface: 'leaderboard' | 'detail' | 'prompt_builder';
}

export interface ProviderOutboundPayload {
  providerId: string;
  providerName: string;
  href?: string;
  surface: 'leaderboard' | 'detail' | 'prompt_builder';
}

export interface PromptBuilderOpenPayload {
  providerId: string;
  location: 'leaderboard' | 'providers_page' | 'deeplink';
}

export interface FinanceTogglePayload {
  widget: 'fx' | 'commodities' | 'crypto';
  enabled: boolean;
}

export interface FinanceTabViewPayload {
  tabId: string;
}

export interface ExchangeWidgetOpenPayload {
  exchangeId: string;
  surface: 'left_rail' | 'right_rail' | 'centre_column';
}

export interface CountryCommoditiesHoverPayload {
  countryCode: string;
  commodityId?: string;
}

export interface NavClickPayload {
  label: string;
  href: string;
}

export interface PageViewCustomPayload {
  page_path: string;
}

/**
 * Map event names → payload types
 */

export interface AnalyticsEventPayloads {
  provider_click: ProviderClickPayload;
  provider_outbound: ProviderOutboundPayload;
  prompt_builder_open: PromptBuilderOpenPayload;
  finance_toggle: FinanceTogglePayload;
  finance_tab_view: FinanceTabViewPayload;
  exchange_widget_open: ExchangeWidgetOpenPayload;
  country_commodities_hover: CountryCommoditiesHoverPayload;
  nav_click: NavClickPayload;
  page_view_custom: PageViewCustomPayload;
}

export type AnalyticsEventParams<K extends AnalyticsEventName> = AnalyticsEventPayloads[K];

/**
 * Core tracking helper
 *
 * Sends events to:
 * - window.dataLayer (if present) for GTM-style consumers
 * - window.gtag (if present) for GA4
 *
 * Never throws – failures are swallowed, with optional debug logging.
 */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  payload: AnalyticsEventParams<K>,
): void {
  if (!ANALYTICS_ENABLED) {
    return;
  }

  if (typeof window === 'undefined') {
    // Server-side render: do nothing
    return;
  }

  const eventData = {
    event: name,
    ...payload,
  };

  if (ANALYTICS_DEBUG) {
    // Use console.debug to comply with eslint rule: only warn/error/debug allowed
    console.debug('[analytics:event]', name, payload);
  }

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(eventData);
    }

    if (typeof window.gtag === 'function') {
      // GA4 expects name + params object; we keep it structurally typed
      window.gtag('event', name, payload);
    }
  } catch (error) {
    if (ANALYTICS_DEBUG) {
      console.error('trackEvent failed', { name, payload, error });
    }
  }
}

/**
 * Convenience helper for virtual page views
 * (e.g. tab changes, client-side route transitions).
 */
export function trackPageView(path: string): void {
  const trimmed = path.trim();

  if (!trimmed) {
    return;
  }

  trackEvent('page_view_custom', { page_path: trimmed });
}
