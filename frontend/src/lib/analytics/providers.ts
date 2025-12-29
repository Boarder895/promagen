// frontend/src/lib/analytics/providers.ts
//
// Domain-level analytics helpers for AI Providers.
// Components should use these helpers instead of calling trackEvent() directly.
//
// Promagen Users column (analytics-derived):
// - Ensure provider_id is always present.
// - Emit stronger signals for “real usage” than for casual browsing.
// - Dedupe/anti-gaming is handled at aggregation time (unique sessions/users),
//   but we include usage_weight to make that aggregation sane.

import {
  trackEvent,
  type ProviderSurface,
  type AnalyticsEventName,
  type AnalyticsEventParams,
} from '@/lib/analytics/events';

export interface ProviderEventBase {
  /**
   * Canonical provider id from the providers catalogue (e.g. "openai").
   */
  providerId: string;

  /**
   * Optional human-friendly provider name (nice for reports).
   */
  providerName?: string;

  /**
   * Where the action happened in Promagen.
   */
  surface?: ProviderSurface;

  /**
   * Back-compat alias (older callers used "source").
   */
  source?: ProviderSurface;
}

function safeTrack<K extends AnalyticsEventName>(name: K, payload: AnalyticsEventParams<K>): void {
  try {
    trackEvent(name, payload);
  } catch {
    // Analytics must never be allowed to break product behaviour.
  }
}

/**
 * Usage weights (anti-noise)
 *
 * Rule required by spec:
 * - Weight submit/success more than click/open.
 *
 * These weights are ONLY hints for later aggregation; UI must never depend on them.
 */
const USAGE_WEIGHT = {
  provider_click: 1,
  provider_outbound: 1,
  provider_launch: 2,
  prompt_builder_open: 1,
  prompt_copy: 2,
  prompt_submit: 3,
  prompt_success: 5,
} as const;

function normaliseSurface(surface: ProviderSurface | undefined): {
  surface?: ProviderSurface;
  source?: ProviderSurface;
} {
  // We keep both keys:
  // - surface: clearer domain meaning
  // - source: back-compat with existing GA reports
  if (typeof surface === 'string' && surface.trim()) {
    return { surface, source: surface };
  }
  return {};
}

export type TrackProviderClickParams = ProviderEventBase;

/**
 * trackProviderClick
 *
 * Fired when the user clicks a primary “open” action for a provider (e.g. provider name/CTA).
 */
export function trackProviderClick(params: TrackProviderClickParams): void {
  const { providerId, providerName } = params;
  const surface = params.surface ?? params.source;

  safeTrack('provider_click', {
    provider_id: providerId,
    provider_name: providerName,
    ...normaliseSurface(surface),
    usage_weight: USAGE_WEIGHT.provider_click,
  });
}

export interface TrackProviderOutboundParams extends ProviderEventBase {
  /**
   * The link the user clicked.
   * In Promagen this should normally be: /go/{providerId}?src=<surface>
   */
  href?: string;

  /**
   * Back-compat alias used by some callers.
   */
  destinationUrl?: string;
}

/**
 * trackProviderOutbound
 *
 * Fired when the user clicks an outbound link for a provider.
 * (UI must route through /go; never direct external URLs.)
 */
export function trackProviderOutbound(params: TrackProviderOutboundParams): void {
  const { providerId, providerName } = params;
  const surface = params.surface ?? params.source;
  const href = params.href ?? params.destinationUrl;

  safeTrack('provider_outbound', {
    provider_id: providerId,
    provider_name: providerName,
    href,
    ...normaliseSurface(surface),
    usage_weight: USAGE_WEIGHT.provider_outbound,
  });
}

export interface TrackPromptBuilderOpenParams extends Omit<ProviderEventBase, 'surface'> {
  /**
   * Prompt builder surface is always prompt_builder for reporting,
   * but we still accept the caller’s original location.
   */
  location?: 'leaderboard' | 'providers_page' | 'deeplink' | (string & {});
}

/**
 * trackPromptBuilderOpen
 *
 * Fired when the prompt builder mounts for a provider.
 */
export function trackPromptBuilderOpen(params: TrackPromptBuilderOpenParams): void {
  const { providerId, location } = params;

  safeTrack('prompt_builder_open', {
    provider_id: providerId,
    location,
    ...normaliseSurface('prompt_builder'),
    usage_weight: USAGE_WEIGHT.prompt_builder_open,
  });
}

export interface TrackPromptSubmitParams {
  providerId: string;
}

/**
 * trackPromptSubmit
 *
 * Fired when a user submits/generates a prompt in Promagen.
 * Stronger than browsing/clicking.
 */
export function trackPromptSubmit(params: TrackPromptSubmitParams): void {
  const { providerId } = params;

  safeTrack('prompt_submit', {
    provider_id: providerId,
    ...normaliseSurface('prompt_builder'),
    usage_weight: USAGE_WEIGHT.prompt_submit,
  });
}

export interface TrackPromptSuccessParams {
  providerId: string;
}

/**
 * trackPromptSuccess
 *
 * Fired when the user completes the “success” step Promagen considers a high-signal usage action
 * (e.g. copied prompt + outbound open). Strongest usage signal.
 */
export function trackPromptSuccess(params: TrackPromptSuccessParams): void {
  const { providerId } = params;

  safeTrack('prompt_success', {
    provider_id: providerId,
    ...normaliseSurface('prompt_builder'),
    usage_weight: USAGE_WEIGHT.prompt_success,
  });
}

export interface TrackPromptCopyParams {
  providerId: string;
  /** Length of the copied prompt text */
  promptLength?: number;
}

/**
 * trackPromptCopy
 *
 * Fired when a user copies a prompt to clipboard.
 * Authority: docs/authority/prompt-builder-page.md § Analytics events
 */
export function trackPromptCopy(params: TrackPromptCopyParams): void {
  const { providerId, promptLength } = params;

  safeTrack('prompt_copy', {
    provider_id: providerId,
    prompt_length: promptLength,
    ...normaliseSurface('prompt_builder'),
    usage_weight: USAGE_WEIGHT.prompt_copy,
  });
}

export interface TrackProviderLaunchParams {
  providerId: string;
  providerName?: string;
  /** Source context for the launch action */
  src?: string;
}

/**
 * trackProviderLaunch
 *
 * Fired when the user clicks the launch button to open the provider platform.
 * Authority: docs/authority/prompt-builder-page.md § Analytics events
 */
export function trackProviderLaunch(params: TrackProviderLaunchParams): void {
  const { providerId, providerName, src } = params;

  safeTrack('provider_launch', {
    provider_id: providerId,
    provider_name: providerName,
    src,
    ...normaliseSurface('prompt_builder'),
    usage_weight: USAGE_WEIGHT.provider_launch,
  });
}
