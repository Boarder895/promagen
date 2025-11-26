// src/lib/analytics/ga.ts

import { logger } from '@/app/utils/logger';

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
 *   - "true"                               → log events via logger as well
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
    /**
     * Canonical provider id from your providers catalogue.
     */
    provider_id: string;
    /**
     * Human-readable provider name (optional but nice for GA reports).
     */
    provider_name?: string;
    /**
     * Where the click happened, e.g. "leaderboard", "grid".
     */
    source?: string;
  };
  provider_outbound: {
    /**
     * Canonical provider id.
     */
    provider_id: string;
    /**
     * Human-friendly name.
     */
    provider_name?: string;
    /**
     * Destination URL the user is going to.
     */
    href?: string;
    /**
     * Where the outbound link was clicked from.
     */
    source?: string;
  };
  prompt_builder_open: {
    /**
     * Provider id whose studio was opened.
     */
    provider_id: string;
    /**
     * Where the studio was opened from.
     */
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
}

// Map event name → payload shape.
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
 * - Logs via the shared logger when NEXT_PUBLIC_ANALYTICS_DEBUG === "true".
 *
 * Public API is `trackEvent(name, params?)` per the Promagen code standard.
 */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  payload?: AnalyticsEventParams<K>,
): void {
  const finalPayload = (payload ?? {}) as AnalyticsEventParams<K>;

  if (!ANALYTICS_ENABLED) {
    if (ANALYTICS_DEBUG) {
      logger.info('[analytics] skipped (disabled)', { name, params: finalPayload });
    }
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }

  if (typeof window.gtag !== 'function') {
    if (ANALYTICS_DEBUG) {
      logger.warn('[analytics] window.gtag not available for event', {
        name,
        params: finalPayload,
      });
    }
    return;
  }

  if (ANALYTICS_DEBUG) {
    logger.info('[analytics] event', { name, params: finalPayload });
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
