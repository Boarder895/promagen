// src/lib/analytics/nav.ts
//
// Small domain helpers for navigation-related analytics.
// Top-level navigation components should call these instead of
// using trackEvent directly.

import { trackEvent } from '@/lib/analytics/ga';

export interface NavClickParams {
  /**
   * Human-friendly label for the navigation item.
   * e.g. "Prompt Designer", "My Prompts".
   */
  label: string;
  /**
   * Destination href for the navigation item.
   * e.g. "/designer", "/saved".
   */
  href: string;
}

/**
 * trackNavClick
 *
 * Fired when a top navigation link is clicked.
 */
export function trackNavClick({ label, href }: NavClickParams): void {
  trackEvent('nav_click', {
    label,
    href,
  });
}
