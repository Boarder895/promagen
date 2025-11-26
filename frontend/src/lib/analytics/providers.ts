// src/lib/analytics/providers.ts
//
// Domain-level analytics helpers for provider-related events.
//
// Components should import these helpers instead of calling trackEvent()
// directly so we keep a single, consistent mapping between UI actions
// and GA4 event payloads.

import { trackEvent } from '@/lib/analytics/ga';

export interface ProviderClickParams {
  /**
   * Canonical provider id from the providers catalogue.
   */
  providerId: string;
  /**
   * Human-friendly provider name for nicer GA reports.
   */
  providerName?: string;
  /**
   * Where the click happened, e.g. 'grid', 'leaderboard'.
   */
  source?: string;
}

/**
 * trackProviderClick
 *
 * Fired when the user clicks a primary “open” action for a provider
 * (card button, main CTA etc.).
 */
export function trackProviderClick({
  providerId,
  providerName,
  source,
}: ProviderClickParams): void {
  trackEvent('provider_click', {
    provider_id: providerId,
    provider_name: providerName,
    source,
  });
}

export interface ProviderOutboundParams {
  /**
   * Canonical provider id.
   */
  providerId: string;
  /**
   * Human-readable name.
   */
  providerName?: string;
  /**
   * Destination URL.
   */
  destinationUrl: string;
  /**
   * Where the outbound click originated (e.g. 'leaderboard').
   */
  source?: string;
}

/**
 * trackProviderOutbound
 *
 * Fired when the user clicks an outbound link to a provider’s site
 * (e.g. from the leaderboard table).
 */
export function trackProviderOutbound({
  providerId,
  providerName,
  destinationUrl,
  source,
}: ProviderOutboundParams): void {
  trackEvent('provider_outbound', {
    provider_id: providerId,
    provider_name: providerName,
    href: destinationUrl,
    source,
  });
}

export type PromptBuilderLocation = 'leaderboard' | 'providers_page' | 'deeplink' | string;

export interface PromptBuilderOpenParams {
  /**
   * Provider whose prompt studio is being opened.
   */
  providerId: string;
  /**
   * Where the studio was opened from.
   */
  location?: PromptBuilderLocation;
}

/**
 * trackPromptBuilderOpen
 *
 * Fired when the prompt builder/studio mounts for a given provider.
 */
export function trackPromptBuilderOpen({ providerId, location }: PromptBuilderOpenParams): void {
  trackEvent('prompt_builder_open', {
    provider_id: providerId,
    location,
  });
}
