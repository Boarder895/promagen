// frontend/src/lib/analytics/events.ts
//
// Centralised analytics event catalogue + dispatcher.
// Must remain powerless:
// - No fetches, no timers, no retries, no cookies.
// - Never throws.
// - Safe for SSR/tests (no window usage on import; all window access is guarded).
//
// Notes for “Promagen Users”:
// - Country is analytics-derived (GA geo/session), not stored in providers.json.
// - Provider usage should be attributable via provider_id + event name/surface.

declare global {
  interface Window {
    dataLayer?: unknown[];
    // GA4 gtag signature (we only call: gtag('event', name, params))
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Feature flags (client-safe, NEXT_PUBLIC only):
 *
 * - NEXT_PUBLIC_ANALYTICS_ENABLED
 *   - "false"  → disable all tracking
 *   - anything else / undefined → enabled
 *
 * - NEXT_PUBLIC_ANALYTICS_DEBUG
 *   - "true" → console.debug events and errors
 */
const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

export type ProviderSurface = 'leaderboard' | 'detail' | 'prompt_builder' | string;

/**
 * Event catalogue
 *
 * Keep names stable once introduced (analytics contracts are sticky).
 */
export type AnalyticsEventName =
  | 'provider_click'
  | 'provider_outbound'
  | 'provider_launch'
  | 'prompt_builder_open'
  | 'prompt_copy'
  | 'prompt_submit'
  | 'prompt_success'
  | 'finance_toggle'
  | 'finance_tab_view'
  | 'exchange_widget_open'
  | 'country_commodities_hover'
  | 'nav_click'
  | 'page_view_custom'
  | 'ribbon_pause'
  | 'fx_pair_select';

export interface AnalyticsEventPayloads {
  provider_click: {
    provider_id: string;
    provider_name?: string;
    /**
     * Where the action happened. Kept as both keys:
     * - surface (clear domain meaning)
     * - source  (back-compat with older reports)
     */
    surface?: ProviderSurface;
    source?: ProviderSurface;
    /**
     * Optional usage weight for later aggregation (anti-noise).
     * Display/UX must never depend on this value.
     */
    usage_weight?: number;
  };

  provider_outbound: {
    provider_id: string;
    provider_name?: string;
    /**
     * The href clicked. In Promagen this should usually be /go/{id}?src=...
     * (Never a direct third-party URL from the UI.)
     */
    href?: string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  provider_launch: {
    provider_id: string;
    provider_name?: string;
    /**
     * Source context for the launch action (e.g. 'prompt_builder').
     */
    src?: string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_builder_open: {
    provider_id: string;
    /**
     * Where the prompt builder was opened from (route context).
     */
    location?: 'leaderboard' | 'providers_page' | 'deeplink' | string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_copy: {
    provider_id: string;
    /**
     * Length of the copied prompt (for analytics insights).
     */
    prompt_length?: number;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_submit: {
    provider_id: string;
    /**
     * Optional: “submit” means the user generated a prompt in Promagen
     * (even if they haven't executed it on the provider yet).
     */
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_success: {
    provider_id: string;
    /**
     * Optional: “success” means the user completed the flow Promagen considers
     * a strong usage signal (e.g. copied prompt, opened provider, etc.).
     * Exact definition is enforced by the calling code, not here.
     */
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  finance_toggle: {
    widget: 'fx' | 'commodities' | 'crypto';
    enabled: boolean;
  };

  finance_tab_view: {
    tab_id: string;
  };

  exchange_widget_open: {
    exchange_id: string;
    surface?: 'left_rail' | 'right_rail' | 'centre_column' | string;
  };

  country_commodities_hover: {
    country_code: string;
    commodity_id?: string;
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

export type AnalyticsEventParams<K extends AnalyticsEventName> = AnalyticsEventPayloads[K];

/**
 * trackEvent
 *
 * Sends events to:
 * - window.dataLayer (if present) for GTM-style consumers
 * - window.gtag (if present) for GA4
 *
 * Never throws. No-ops on the server.
 */
export function trackEvent<K extends AnalyticsEventName>(
  name: K,
  payload?: AnalyticsEventParams<K>,
): void {
  if (!ANALYTICS_ENABLED) return;
  if (typeof window === 'undefined') return;

  const params = (payload ?? {}) as AnalyticsEventParams<K>;

  if (ANALYTICS_DEBUG) {
    console.debug('[analytics:event]', name, params);
  }

  try {
    // GTM / dataLayer
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...(params as unknown as Record<string, unknown>) });
    }

    // GA4 / gtag
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch (error) {
    if (ANALYTICS_DEBUG) {
      console.error('[analytics:event] dispatch failed', { name, params, error });
    }
  }
}

/**
 * trackPageView
 *
 * For virtual page views or SPA-style transitions.
 */
export function trackPageView(path: string): void {
  const page_path = path.trim();
  if (!page_path) return;

  trackEvent('page_view_custom', { page_path });
}
