// frontend/src/lib/analytics/ga.ts
//
// Analytics wrapper must remain POWERLESS:
// - No fetches, no timers, no retries, no side effects.
// - Observational only: thin wrapper around window.gtag('event', ...).
//
// Why this matters to the API Brain:
// Promagen’s “authority map” says only the Refresh Gate decides upstream work.
// Anything else must not accidentally create traffic pressure or hidden behaviour.

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
 *   - "true"                               → log events to console as well
 */
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

export type AnalyticsEventName =
  | 'provider_click'
  | 'provider_outbound'
  | 'prompt_builder_open'
  | 'finance_toggle'
  | 'nav_click'
  | 'page_view_custom'
  | 'ribbon_pause'
  | 'fx_pair_select';

export interface AnalyticsEventPayloads {
  provider_click: {
    provider_id: string;
    provider_name?: string;
    source?: string;
  };
  provider_outbound: {
    provider_id: string;
    provider_name?: string;
    href?: string;
    source?: string;
  };
  prompt_builder_open: {
    provider_id: string;
    location?: 'leaderboard' | 'providers_page' | 'deeplink' | string;
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
  ribbon_pause: {
    is_paused: boolean;
    source?: string;
  };
  fx_pair_select: {
    count: number;
    ids: string;
    source?: string;
  };
}

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
 * - Optional debug logging when NEXT_PUBLIC_ANALYTICS_DEBUG === "true".
 */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  payload?: AnalyticsEventParams<K>,
): void {
  const finalPayload = (payload ?? {}) as AnalyticsEventParams<K>;

  if (!ANALYTICS_ENABLED) {
    if (ANALYTICS_DEBUG) {
      console.debug('[analytics] skipped (disabled)', { name, params: finalPayload });
    }
    return;
  }

  if (typeof window === 'undefined') return;

  if (typeof window.gtag !== 'function') {
    if (ANALYTICS_DEBUG) {
      console.warn('[analytics] window.gtag not available for event', {
        name,
        params: finalPayload,
      });
    }
    return;
  }

  if (ANALYTICS_DEBUG) {
    console.debug('[analytics] event', { name, params: finalPayload });
  }

  window.gtag('event', name, finalPayload);
}

/**
 * trackPageView
 *
 * Helper for virtual page views or SPA-style transitions.
 * Note: GA4 already tracks normal page_view from your config call;
 * this is for extra custom page_view events.
 */
export function trackPageView(path: string): void {
  trackEvent('page_view_custom', {
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
