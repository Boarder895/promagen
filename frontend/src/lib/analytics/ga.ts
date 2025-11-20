// src/lib/analytics/ga.ts

// Keep window.gtag typed and safe to call.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Toggle analytics from env:
 *
 * - NEXT_PUBLIC_ANALYTICS_ENABLED
 *   - undefined / anything except "false"  → enabled
 *   - "false"                              → disabled
 *
 * - NEXT_PUBLIC_ANALYTICS_DEBUG
 *   - "true"  → log events to console as well
 */
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

export type AnalyticsEventName =
  | 'provider_click'
  | 'provider_outbound'
  | 'prompt_builder_open'
  | 'finance_toggle'
  | 'nav_click'
  | 'page_view_custom';

export interface AnalyticsEventPayloads {
  provider_click: {
    provider_id: string;
    provider_name?: string;
  };
  provider_outbound: {
    provider_id: string;
    provider_name?: string;
    href?: string;
  };
  prompt_builder_open: {
    provider_id: string;
    location?: 'leaderboard' | 'providers_page' | 'deeplink';
  };
  finance_toggle: {
    widget: 'fx' | 'commodities' | 'crypto';
    enabled: boolean;
  };
  nav_click: {
    label: string;
    href: string;
  };
  page_view_custom: {
    page_path: string;
  };
}

// Fallback to a generic record if you pass a name that isn't in AnalyticsEventPayloads.
export type AnalyticsEventParamsMap = {
  [K in AnalyticsEventName]: AnalyticsEventPayloads[K];
};

export type AnalyticsEventParams<K extends AnalyticsEventName> =
  | AnalyticsEventParamsMap[K]
  | Record<string, unknown>;

/**
 * trackEvent
 *
 * Thin wrapper around window.gtag('event', ...).
 * - No-op on the server.
 * - Respects NEXT_PUBLIC_ANALYTICS_ENABLED.
 * - Logs to console when NEXT_PUBLIC_ANALYTICS_DEBUG === "true".
 */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  params?: AnalyticsEventParams<K>,
): void {
  if (!ANALYTICS_ENABLED) {
    if (ANALYTICS_DEBUG) {
      // eslint-disable-next-line no-console
      console.info('[analytics] disabled:', name, params);
    }
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag !== 'function') {
    if (ANALYTICS_DEBUG) {
      // eslint-disable-next-line no-console
      console.info('[analytics] gtag not ready:', name, params);
    }
    return;
  }

  if (ANALYTICS_DEBUG) {
    // eslint-disable-next-line no-console
    console.info('[analytics] event:', name, params);
  }

  window.gtag('event', name, params ?? {});
}

/**
 * trackPageView
 *
 * Optional helper for virtual page views or SPA-style transitions.
 * Note: GA4 already tracks normal page_view from your config call,
 * this is for cases where you want extra, custom page_view events.
 */
export function trackPageView(path: string): void {
  if (!ANALYTICS_ENABLED) {
    if (ANALYTICS_DEBUG) {
      // eslint-disable-next-line no-console
      console.info('[analytics] page_view skipped (disabled):', path);
    }
    return;
  }

  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;

  if (ANALYTICS_DEBUG) {
    // eslint-disable-next-line no-console
    console.info('[analytics] page_view:', path);
  }

  window.gtag('event', 'page_view', {
    page_path: path,
  });
}

/**
 * trackOutboundLink
 *
 * Convenience helper for outbound links (affiliate clicks etc.).
 * You can call this in an onClick before navigating away.
 */
export function trackOutboundLink(
  href: string,
  extra?: Partial<AnalyticsEventPayloads['provider_outbound']>,
): void {
  trackEvent('provider_outbound', {
    href,
    ...(extra ?? {}),
  });
}
