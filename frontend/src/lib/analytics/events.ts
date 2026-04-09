// frontend/src/lib/analytics/events.ts
// ============================================================================
// CENTRALISED ANALYTICS EVENT CATALOGUE + DISPATCHER (v2.2.0)
// ============================================================================
// v2.2.0 (10 Apr 2026):
// - FIX: Extra 2 fully wired. trackProviderClick and trackPromptCopy now
//   record session journey breadcrumbs. trackProviderOutbound calls
//   getSnapshot() and merges journey fields into the GA4 payload.
// - FIX: trackAiCitationLanding respects ANALYTICS_DEBUG for consistency.
//
// v2.1.0 (10 Apr 2026):
// - ProviderSurface tightened with 'engine_bay' | 'mobile_card'.
// - Wrapper JSDoc corrected to match v1.3.0 plan.
// - Wrappers mirror surface → source for back-compat.
//
// v2.0.0 (10 Apr 2026):
// - provider_launch removed. 5 convenience wrappers added.
//
// Must remain powerless:
// - No fetches, no timers, no retries, no cookies.
// - Never throws.
// - Safe for SSR/tests (no window usage on import; all access is guarded).
//
// Authority: analytics-build-plan-v1.3.md §3 (Event-Boundary Contract)
// Existing features preserved: Yes
// ============================================================================

import {
  recordEvent as recordJourneyEvent,
  getSnapshot as getJourneySnapshot,
  getRawBreadcrumbs,
} from '@/lib/analytics/session-journey';
import { computeAttribution } from '@/lib/analytics/attribution-waterfall';
import { getPromptQualitySnapshot } from '@/lib/analytics/prompt-quality-correlation';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true';

/**
 * ProviderSurface — where an analytics event originates.
 *
 * Named values are the canonical surfaces used across the codebase.
 * The trailing `| string` allows future call-sites without a type update,
 * but new surfaces should be added here first to keep the type informative.
 */
export type ProviderSurface =
  | 'leaderboard'
  | 'engine_bay'
  | 'mobile_card'
  | 'detail'
  | 'prompt_builder'
  | string;

/**
 * Event catalogue — keep names stable once introduced.
 *
 * provider_launch permanently removed (v2.0.0). The launch panel fires
 * provider_outbound as its sole GA4 event.
 */
export type AnalyticsEventName =
  | 'provider_click'
  | 'provider_outbound'
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
  | 'fx_pair_select'
  | 'scene_selected'
  | 'scene_reset'
  | 'explore_drawer_opened'
  | 'explore_chip_clicked'
  | 'cascade_reorder_triggered'
  | 'prompt_liked'
  | 'prompt_like_removed'
  | 'ai_citation_landing';

export interface AnalyticsEventPayloads {
  provider_click: {
    provider_id: string;
    provider_name?: string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  provider_outbound: {
    provider_id: string;
    provider_name?: string;
    href?: string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
    // Session Journey Snapshot (Extra 2)
    journey_providers_viewed?: number;
    journey_prompts_copied?: number;
    journey_pages_visited?: number;
    journey_duration_seconds?: number;
    journey_entry_source?: string;
    journey_entry_page?: string;
    // Extra 3 — Attribution Waterfall
    attribution_chain?: string;
    primary_driver?: string;
    touchpoint_count?: number;
    // Extra 4 — Prompt Quality Correlation
    prompt_quality_score?: number | null;
    prompt_length_at_copy?: number | null;
    platform_tier_at_copy?: number | null;
    was_optimised?: boolean;
    prompts_scored_in_session?: number;
    best_score_in_session?: number | null;
  };

  prompt_builder_open: {
    provider_id: string;
    location?: 'leaderboard' | 'providers_page' | 'deeplink' | string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_copy: {
    provider_id: string;
    prompt_length?: number;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_submit: {
    provider_id: string;
    surface?: ProviderSurface;
    source?: ProviderSurface;
    usage_weight?: number;
  };

  prompt_success: {
    provider_id: string;
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

  scene_selected: {
    scene_id: string;
    scene_name: string;
    world: string;
    tier: 'free' | 'pro';
    platform_tier: number;
    categories_prefilled: number;
  };

  scene_reset: {
    scene_id: string;
    was_modified: boolean;
  };

  explore_drawer_opened: {
    category: string;
    platform_tier: number;
  };

  explore_chip_clicked: {
    category: string;
    term: string;
    platform_tier: number;
    source_tab: string;
  };

  cascade_reorder_triggered: {
    categories_reordered: number;
    elapsed_ms: number;
  };

  prompt_liked: {
    prompt_id: string;
    tier?: string;
    source?: 'showcase' | 'pulse';
    is_authenticated?: boolean;
  };

  prompt_like_removed: {
    prompt_id: string;
    tier?: string;
    source?: 'showcase' | 'pulse';
    is_authenticated?: boolean;
  };

  ai_citation_landing: {
    ai_source: string;
    landing_page: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}

export type AnalyticsEventParams<K extends AnalyticsEventName> = AnalyticsEventPayloads[K];

/**
 * trackEvent — sends events to dataLayer (GTM) and gtag (GA4).
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
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...(params as unknown as Record<string, unknown>) });
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch (error) {
    if (ANALYTICS_DEBUG) {
      console.error('[analytics:event] dispatch failed', { name, params, error });
    }
  }
}

/** trackPageView — for virtual page views or SPA transitions. */
export function trackPageView(path: string): void {
  const page_path = path.trim();
  if (!page_path) return;
  trackEvent('page_view_custom', { page_path });
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================
// camelCase component params → snake_case GA4 params.
// Rule: 1:1 to trackEvent(). No logic beyond param translation + journey recording.
//
// Back-compat: surface → source mirrored for existing GA4 reports.
// Will be removed in a future cleanup phase.
// ============================================================================

/** Fire when user lands on the prompt builder page. */
export function trackPromptBuilderOpen(params: {
  providerId: string;
  location?: string;
}): void {
  trackEvent('prompt_builder_open', {
    provider_id: params.providerId,
    location: params.location,
  });
}

/**
 * Fire when user copies a generated prompt.
 * Records a journey breadcrumb for Extra 2 session snapshot.
 */
export function trackPromptCopy(params: {
  providerId: string;
  promptLength?: number;
}): void {
  recordJourneyEvent('prompt_copy', params.providerId);
  trackEvent('prompt_copy', {
    provider_id: params.providerId,
    prompt_length: params.promptLength,
  });
}

/** Fire when user clicks a top-nav link. */
export function trackNavClick(params: { label: string; href: string }): void {
  trackEvent('nav_click', {
    label: params.label,
    href: params.href,
  });
}

/**
 * Fire when user clicks a provider on the leaderboard/homepage.
 * Top of the conversion funnel — "who browses."
 * Records a journey breadcrumb for Extra 2 session snapshot.
 *
 * Call-sites (pinned in build plan §5 Part 4):
 * - engine-bay.tsx line 374 → surface: 'engine_bay'
 * - providers-table.tsx line 1471 → surface: 'mobile_card'
 */
export function trackProviderClick(params: {
  providerId: string;
  providerName?: string;
  surface?: ProviderSurface;
}): void {
  recordJourneyEvent('provider_click', params.providerId);
  trackEvent('provider_click', {
    provider_id: params.providerId,
    provider_name: params.providerName,
    surface: params.surface,
    source: params.surface,
  });
}

/**
 * Fire when user clicks "Go to site" / affiliate link.
 * Bottom of the conversion funnel — "who converts."
 * Enriches the GA4 payload with:
 * - Session journey snapshot (Extra 2)
 * - Attribution waterfall (Extra 3)
 * - Prompt quality correlation (Extra 4)
 *
 * Call-site: launch-panel.tsx (replaces the removed trackProviderLaunch)
 */
export function trackProviderOutbound(params: {
  providerId: string;
  providerName?: string;
  href?: string;
  surface?: ProviderSurface;
}): void {
  const journey = getJourneySnapshot();
  const breadcrumbs = getRawBreadcrumbs();
  const attribution = breadcrumbs ? computeAttribution(breadcrumbs) : null;
  const quality = getPromptQualitySnapshot();

  trackEvent('provider_outbound', {
    provider_id: params.providerId,
    provider_name: params.providerName,
    href: params.href,
    surface: params.surface,
    source: params.surface,
    ...(journey ?? {}),
    // Extra 3 — Attribution Waterfall
    ...(attribution ? {
      attribution_chain: attribution.attribution_chain,
      primary_driver: attribution.primary_driver,
      touchpoint_count: attribution.touchpoint_count,
    } : {}),
    // Extra 4 — Prompt Quality Correlation
    ...(quality ?? {}),
  });
}

/**
 * Fire once per session when user arrives from an AI system.
 * Called from: use-ai-citation-detector.ts (Extra 1)
 */
export function trackAiCitationLanding(params: {
  aiSource: string;
  landingPage: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): void {
  if (ANALYTICS_DEBUG) {
    console.debug('[analytics:ai-citation]', params.aiSource, params.landingPage);
  }
  trackEvent('ai_citation_landing', {
    ai_source: params.aiSource,
    landing_page: params.landingPage,
    utm_source: params.utmSource,
    utm_medium: params.utmMedium,
    utm_campaign: params.utmCampaign,
  });
}
